// ---------- Menu data ----------
// Used instantly on load, and again if the live menu fetch below fails, so
// the site never shows a blank menu.
const FALLBACK_MENU = [
  {
    id: "jerk-sliders-shrimp",
    icon: "🍔",
    name: "Jerk Sliders and Pepper Shrimp",
    desc: "Jerk beef sliders paired with spicy pepper shrimp.",
    price: 20,
    date: "Saturday 8/15",
    special: true,
  },
  {
    id: "rice-peas-oxtail",
    icon: "🍲",
    name: "Rice and Peas Oxtail",
    desc: "Slow-braised oxtail served over rice and peas.",
    price: 30,
    date: "Sunday 8/26",
    special: true,
  },
  {
    id: "mac-cheese",
    icon: "🧀",
    name: "Mac n Cheese",
    desc: "Creamy baked mac and cheese.",
    price: 5,
    date: null,
    special: false,
  },
  {
    id: "plantain",
    icon: "🍌",
    name: "Plantain",
    desc: "Sweet fried plantain.",
    price: 5,
    date: null,
    special: false,
  },
];

let MENU = FALLBACK_MENU;

// Google Apps Script Web App URL for logging orders to a Google Sheet.
// See google-apps-script.gs for the script to deploy; paste the deployment URL here.
const SHEET_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxsCrvzTIlPa66yQxmioithK0icAN7oRKTlOfXsQNVQhFe6nT_FwIdCZuTCptoPJCA/exec";

// ---------- State ----------
const cart = {}; // { itemId: quantity }

// ---------- DOM refs ----------
const menuGrid = document.getElementById("menu-grid");
const cartToggle = document.getElementById("cart-toggle");
const cartCount = document.getElementById("cart-count");
const cartDrawer = document.getElementById("cart-drawer");
const cartOverlay = document.getElementById("cart-overlay");
const cartClose = document.getElementById("cart-close");
const cartItemsEl = document.getElementById("cart-items");
const cartTotalEl = document.getElementById("cart-total");
const checkoutBtn = document.getElementById("checkout-btn");
const checkoutOverlay = document.getElementById("checkout-overlay");
const checkoutClose = document.getElementById("checkout-close");
const checkoutForm = document.getElementById("checkout-form");
const reviewList = document.getElementById("review-list");
const reviewTotal = document.getElementById("review-total");
const toast = document.getElementById("toast");
const pickupSelect = document.getElementById("cust-pickup");

// ---------- Render menu ----------
function renderMenu() {
  menuGrid.innerHTML = MENU.map((item) => `
    <div class="menu-card ${item.special ? "special" : ""}">
      <div class="card-icon">${item.icon}</div>
      <h3 class="card-name">${item.name}</h3>
      <p class="card-desc">${item.desc}</p>
      ${item.date ? `<span class="card-date">${item.date}</span>` : ""}
      <div class="card-footer">
        <span class="card-price">$${item.price.toFixed(2)}</span>
        <button class="add-btn" data-id="${item.id}">Add +</button>
      </div>
    </div>
  `).join("");

  menuGrid.querySelectorAll(".add-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      addToCart(btn.dataset.id);
      showToast(`Added ${MENU.find((m) => m.id === btn.dataset.id).name}`);
    });
  });
}

// ---------- Render pickup date options ----------
function renderPickupOptions() {
  const dated = MENU.filter((item) => item.special && item.date);
  pickupSelect.innerHTML = `
    <option value="">Select a date</option>
    ${dated.map((item) => `<option value="${item.date}">${item.date} (${item.name})</option>`).join("")}
  `;
}

// ---------- Live menu fetch ----------
function fetchMenu() {
  if (!SHEET_WEBHOOK_URL) return;
  fetch(`${SHEET_WEBHOOK_URL}?action=menu`)
    .then((res) => res.json())
    .then((data) => {
      if (data.status === "success" && Array.isArray(data.items) && data.items.length) {
        MENU = data.items;
        renderMenu();
        renderPickupOptions();
      }
    })
    .catch(() => {}); // keep the fallback menu already on screen
}

// ---------- Cart logic ----------
function addToCart(id) {
  cart[id] = (cart[id] || 0) + 1;
  renderCart();
}

function changeQty(id, delta) {
  if (!cart[id]) return;
  cart[id] += delta;
  if (cart[id] <= 0) delete cart[id];
  renderCart();
}

function removeFromCart(id) {
  delete cart[id];
  renderCart();
}

function getCartEntries() {
  return Object.entries(cart).map(([id, qty]) => ({
    ...MENU.find((m) => m.id === id),
    qty,
  }));
}

function getCartTotal() {
  return getCartEntries().reduce((sum, item) => sum + item.price * item.qty, 0);
}

function getCartCount() {
  return Object.values(cart).reduce((sum, qty) => sum + qty, 0);
}

function renderCart() {
  const entries = getCartEntries();
  cartCount.textContent = getCartCount();

  if (entries.length === 0) {
    cartItemsEl.innerHTML = `<p class="cart-empty">Your cart is empty. Add something tasty!</p>`;
    checkoutBtn.disabled = true;
  } else {
    cartItemsEl.innerHTML = entries.map((item) => `
      <div class="cart-item">
        <div class="cart-item-icon">${item.icon}</div>
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">$${item.price.toFixed(2)} each</div>
        </div>
        <div class="qty-controls">
          <button class="qty-btn" data-action="dec" data-id="${item.id}">&minus;</button>
          <span>${item.qty}</span>
          <button class="qty-btn" data-action="inc" data-id="${item.id}">+</button>
        </div>
        <button class="remove-btn" data-action="remove" data-id="${item.id}" aria-label="Remove item">&times;</button>
      </div>
    `).join("");
    checkoutBtn.disabled = false;

    cartItemsEl.querySelectorAll("[data-action]").forEach((btn) => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      btn.addEventListener("click", () => {
        if (action === "inc") changeQty(id, 1);
        if (action === "dec") changeQty(id, -1);
        if (action === "remove") removeFromCart(id);
      });
    });
  }

  const total = getCartTotal();
  cartTotalEl.textContent = `$${total.toFixed(2)}`;
}

// ---------- Cart drawer open/close ----------
function openCart() {
  cartDrawer.classList.add("open");
  cartOverlay.classList.add("open");
}

function closeCart() {
  cartDrawer.classList.remove("open");
  cartOverlay.classList.remove("open");
}

cartToggle.addEventListener("click", openCart);
cartClose.addEventListener("click", closeCart);
cartOverlay.addEventListener("click", closeCart);

// ---------- Checkout model ----------
function openCheckout() {
  const entries = getCartEntries();
  reviewList.innerHTML = entries.map((item) => `
    <li><span>${item.qty} &times; ${item.name}</span><span>$${(item.price * item.qty).toFixed(2)}</span></li>
  `).join("");
  reviewTotal.textContent = `$${getCartTotal().toFixed(2)}`;
  closeCart();
  checkoutOverlay.classList.add("open");
}

function closeCheckout() {
  checkoutOverlay.classList.remove("open");
}

checkoutBtn.addEventListener("click", openCheckout);
checkoutClose.addEventListener("click", closeCheckout);
checkoutOverlay.addEventListener("click", (e) => {
  if (e.target === checkoutOverlay) closeCheckout();
});

// ---------- Submit order ----------
checkoutForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const name = document.getElementById("cust-name").value.trim();
  const phone = document.getElementById("cust-phone").value.trim();
  const pickup = document.getElementById("cust-pickup").value;
  const notes = document.getElementById("cust-notes").value.trim();

  const entries = getCartEntries();
  if (entries.length === 0) return;

  if (SHEET_WEBHOOK_URL) {
    fetch(SHEET_WEBHOOK_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        name,
        phone,
        pickup,
        items: entries.map((item) => `${item.qty} x ${item.name}`).join(", "),
        total: getCartTotal().toFixed(2),
        notes,
      }),
    }).catch(() => {}); // fire-and-forget; a failed log shouldn't block the order
  }

  // Reset everything
  Object.keys(cart).forEach((id) => delete cart[id]);
  renderCart();
  checkoutForm.reset();
  closeCheckout();
  showToast("Order sent! We'll confirm with you shortly.");
});

// ---------- Toast ----------
let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

// ---------- Flyer carousel ----------
const flyerSlides = document.querySelectorAll(".flyer-slide");
const flyerDots = document.querySelectorAll(".flyer-dot");
const flyerPrev = document.querySelector(".flyer-prev");
const flyerNext = document.querySelector(".flyer-next");
let flyerIndex = 0;
let flyerTimer;

function showFlyer(index) {
  flyerIndex = (index + flyerSlides.length) % flyerSlides.length;
  flyerSlides.forEach((slide, i) => slide.classList.toggle("active", i === flyerIndex));
  flyerDots.forEach((dot, i) => dot.classList.toggle("active", i === flyerIndex));
}

function startFlyerAutoplay() {
  clearInterval(flyerTimer);
  flyerTimer = setInterval(() => showFlyer(flyerIndex + 1), 5000);
}

if (flyerSlides.length) {
  flyerPrev.addEventListener("click", () => { showFlyer(flyerIndex - 1); startFlyerAutoplay(); });
  flyerNext.addEventListener("click", () => { showFlyer(flyerIndex + 1); startFlyerAutoplay(); });
  flyerDots.forEach((dot, i) => dot.addEventListener("click", () => { showFlyer(i); startFlyerAutoplay(); }));
  startFlyerAutoplay();
}

// ---------- Init ----------
renderMenu();
renderPickupOptions();
renderCart();
fetchMenu();
