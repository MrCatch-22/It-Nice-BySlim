// Same Apps Script deployment used by the customer site (js/script.js) for
// order logging; here it's used to read/write the Menu tab.
const SHEET_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxsCrvzTIlPa66yQxmioithK0icAN7oRKTlOfXsQNVQhFe6nT_FwIdCZuTCptoPJCA/exec";

// ---------- DOM refs ----------
const loginScreen = document.getElementById("login-screen");
const adminApp = document.getElementById("admin-app");
const loginForm = document.getElementById("login-form");
const loginPassword = document.getElementById("login-password");
const loginError = document.getElementById("login-error");
const itemList = document.getElementById("item-list");
const addItemBtn = document.getElementById("add-item-btn");
const resetOrdersBtn = document.getElementById("reset-orders-btn");
const logoutBtn = document.getElementById("logout-btn");
const adminTabs = document.querySelectorAll(".admin-tab");
const menuView = document.getElementById("menu-view");
const ordersView = document.getElementById("orders-view");
const refreshOrdersBtn = document.getElementById("refresh-orders-btn");
const ordersUpdated = document.getElementById("orders-updated");
const ordersList = document.getElementById("orders-list");
const kpiTotalOrders = document.getElementById("kpi-total-orders");
const kpiTotalRevenue = document.getElementById("kpi-total-revenue");
const kpiAvgOrder = document.getElementById("kpi-avg-order");
const kpiOrdersToday = document.getElementById("kpi-orders-today");
const itemFormOverlay = document.getElementById("item-form-overlay");
const itemFormClose = document.getElementById("item-form-close");
const itemForm = document.getElementById("item-form");
const itemFormTitle = document.getElementById("item-form-title");
const toast = document.getElementById("toast");

// ---------- State ----------
let currentItems = [];
let secret = sessionStorage.getItem("adminSecret") || "";
let ordersPollTimer;

// ---------- API helpers ----------
function apiGet(withSecret, action) {
  const url = `${SHEET_WEBHOOK_URL}?action=${action || "menu"}${withSecret ? `&secret=${encodeURIComponent(secret)}` : ""}`;
  return fetch(url).then((res) => res.json());
}

function apiPost(body) {
  return fetch(SHEET_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(body),
  }).then((res) => res.json());
}

// ---------- Toast ----------
let toastTimer;
function showToast(msg, isError) {
  toast.textContent = msg;
  toast.classList.toggle("toast-error", !!isError);
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

// ---------- Login / logout ----------
function showLogin(message) {
  clearInterval(ordersPollTimer);
  sessionStorage.removeItem("adminSecret");
  secret = "";
  adminApp.classList.add("hidden");
  loginScreen.classList.remove("hidden");
  loginError.textContent = message || "";
}

function showAdminApp(items) {
  currentItems = items;
  loginScreen.classList.add("hidden");
  adminApp.classList.remove("hidden");
  renderItemList();
}

loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  secret = loginPassword.value;
  apiGet(true)
    .then((data) => {
      if (data.status === "success") {
        sessionStorage.setItem("adminSecret", secret);
        showAdminApp(data.items);
      } else {
        showLogin("Incorrect password");
      }
    })
    .catch(() => showLogin("Network error — check your connection"));
});

logoutBtn.addEventListener("click", () => showLogin());

// ---------- Tabs (Menu / Orders) ----------
adminTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    if (tab.classList.contains("active")) return;
    adminTabs.forEach((t) => t.classList.toggle("active", t === tab));
    const view = tab.dataset.view;
    menuView.classList.toggle("hidden", view !== "menu");
    ordersView.classList.toggle("hidden", view !== "orders");
    if (view === "orders") {
      fetchOrders();
      clearInterval(ordersPollTimer);
      ordersPollTimer = setInterval(fetchOrders, 20000);
    } else {
      clearInterval(ordersPollTimer);
    }
  });
});

// ---------- Orders dashboard ----------
function fetchOrders() {
  return apiGet(true, "orders")
    .then((data) => {
      if (data.status === "success") {
        renderOrders(data.orders || []);
        ordersUpdated.textContent = `Updated ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
      } else {
        showToast(data.message || "Failed to load orders", true);
      }
    })
    .catch(() => showToast("Network error", true));
}

function renderOrders(orders) {
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const avgOrder = totalOrders ? totalRevenue / totalOrders : 0;
  const todayStr = new Date().toDateString();
  const ordersToday = orders.filter((o) => o.timestamp && new Date(o.timestamp).toDateString() === todayStr).length;

  kpiTotalOrders.textContent = totalOrders;
  kpiTotalRevenue.textContent = `$${totalRevenue.toFixed(2)}`;
  kpiAvgOrder.textContent = `$${avgOrder.toFixed(2)}`;
  kpiOrdersToday.textContent = ordersToday;

  if (!orders.length) {
    ordersList.innerHTML = `<p class="orders-list-empty">No orders yet this week.</p>`;
    return;
  }

  const sorted = [...orders].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  ordersList.innerHTML = sorted.map((o) => {
    const when = o.timestamp ? new Date(o.timestamp).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
    const itemsText = o.items || "";
    return `
      <div class="order-row">
        <div class="order-row-top">
          <div>
            <div class="order-row-name">${o.name || "Unknown"}</div>
            <div class="order-row-meta">${when}${o.pickupDate ? ` &middot; Pickup: ${o.pickupDate}` : ""}${o.phone ? ` &middot; ${o.phone}` : ""}</div>
          </div>
          <div class="order-row-total">$${Number(o.total || 0).toFixed(2)}</div>
        </div>
        ${itemsText ? `<div class="order-row-items">${itemsText}</div>` : ""}
      </div>
    `;
  }).join("");
}

refreshOrdersBtn.addEventListener("click", fetchOrders);

// ---------- Reset orders (new week) ----------
resetOrdersBtn.addEventListener("click", () => {
  if (!confirm("Archive all current orders and clear the Orders sheet for a new week? This can't be undone.")) return;
  resetOrdersBtn.disabled = true;
  apiPost({ action: "reset_orders", secret })
    .then((data) => {
      if (data.status === "success") {
        const msg = data.archived > 0
          ? `${data.archived} order${data.archived === 1 ? "" : "s"} archived to "${data.archiveSheet}"`
          : "No orders to reset";
        showToast(msg);
      } else {
        showToast(data.message || "Failed to reset orders", true);
      }
    })
    .catch(() => showToast("Network error", true))
    .finally(() => { resetOrdersBtn.disabled = false; });
});

// ---------- Render item list ----------
function renderItemList() {
  if (!currentItems.length) {
    itemList.innerHTML = `<p class="item-list-empty">No menu items yet. Click "+ Add Item" to create one.</p>`;
    return;
  }

  const sorted = [...currentItems].sort((a, b) => a.sortOrder - b.sortOrder);

  itemList.innerHTML = sorted.map((item) => `
    <div class="item-row ${item.active ? "" : "item-row-inactive"}">
      <div class="item-row-icon">${item.icon || "🍽️"}</div>
      <div class="item-row-info">
        <div class="item-row-name">
          ${item.name}
          ${item.special ? '<span class="item-badge">SPECIAL</span>' : ""}
          ${item.active ? "" : '<span class="item-badge item-badge-off">HIDDEN</span>'}
        </div>
        <div class="item-row-desc">${item.desc || ""}</div>
        ${item.date ? `<div class="item-row-date">${item.date}</div>` : ""}
      </div>
      <div class="item-row-price">$${Number(item.price).toFixed(2)}</div>
      <div class="item-row-actions">
        <button class="admin-btn admin-btn-small" data-action="toggle" data-id="${item.id}">${item.active ? "Hide" : "Show"}</button>
        <button class="admin-btn admin-btn-small" data-action="edit" data-id="${item.id}">Edit</button>
        <button class="admin-btn admin-btn-small admin-btn-danger" data-action="delete" data-id="${item.id}">Delete</button>
      </div>
    </div>
  `).join("");

  itemList.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = currentItems.find((i) => i.id === btn.dataset.id);
      if (!item) return;
      if (btn.dataset.action === "edit") openItemForm(item);
      if (btn.dataset.action === "toggle") toggleActive(item);
      if (btn.dataset.action === "delete") deleteItem(item);
    });
  });
}

function toggleActive(item) {
  apiPost({ action: "menu_upsert", secret, item: { ...item, active: !item.active } })
    .then((data) => {
      if (data.status === "success") {
        currentItems = data.items;
        renderItemList();
        showToast(`${item.name} ${item.active ? "hidden" : "shown"}`);
      } else {
        showToast(data.message || "Failed to update item", true);
      }
    })
    .catch(() => showToast("Network error", true));
}

function deleteItem(item) {
  if (!confirm(`Delete "${item.name}"? This can't be undone.`)) return;
  apiPost({ action: "menu_delete", secret, id: item.id })
    .then((data) => {
      if (data.status === "success") {
        currentItems = data.items;
        renderItemList();
        showToast(`${item.name} deleted`);
      } else {
        showToast(data.message || "Failed to delete item", true);
      }
    })
    .catch(() => showToast("Network error", true));
}

// ---------- Add/edit form ----------
function openItemForm(item) {
  itemForm.reset();
  document.getElementById("item-id").value = item ? item.id : "";
  document.getElementById("item-icon").value = item ? item.icon : "";
  document.getElementById("item-name").value = item ? item.name : "";
  document.getElementById("item-desc").value = item ? item.desc : "";
  document.getElementById("item-price").value = item ? item.price : "";
  document.getElementById("item-date").value = item ? item.date || "" : "";
  document.getElementById("item-special").checked = item ? !!item.special : false;
  document.getElementById("item-active").checked = item ? item.active !== false : true;
  document.getElementById("item-sort").value = item ? item.sortOrder : currentItems.length + 1;
  itemFormTitle.textContent = item ? "Edit Item" : "Add Item";
  itemFormOverlay.classList.add("open");
}

function closeItemForm() {
  itemFormOverlay.classList.remove("open");
}

addItemBtn.addEventListener("click", () => openItemForm(null));
itemFormClose.addEventListener("click", closeItemForm);
itemFormOverlay.addEventListener("click", (e) => {
  if (e.target === itemFormOverlay) closeItemForm();
});

itemForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const item = {
    id: document.getElementById("item-id").value || undefined,
    icon: document.getElementById("item-icon").value.trim(),
    name: document.getElementById("item-name").value.trim(),
    desc: document.getElementById("item-desc").value.trim(),
    price: parseFloat(document.getElementById("item-price").value) || 0,
    date: document.getElementById("item-date").value.trim() || null,
    special: document.getElementById("item-special").checked,
    active: document.getElementById("item-active").checked,
    sortOrder: parseInt(document.getElementById("item-sort").value, 10) || 0,
  };

  apiPost({ action: "menu_upsert", secret, item })
    .then((data) => {
      if (data.status === "success") {
        currentItems = data.items;
        renderItemList();
        closeItemForm();
        showToast(`${item.name} saved`);
      } else {
        showToast(data.message || "Failed to save item", true);
      }
    })
    .catch(() => showToast("Network error", true));
});

// ---------- Init ----------
if (secret) {
  apiGet(true)
    .then((data) => {
      if (data.status === "success") showAdminApp(data.items);
      else showLogin();
    })
    .catch(() => showLogin());
} else {
  showLogin();
}
