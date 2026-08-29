// Paste this into your Apps Script project (Extensions > Apps Script from
// within the Sheet, or a standalone project at script.google.com), replacing
// everything currently there, then create a NEW deployment version. The
// existing /exec URL stays the same, so js/script.js and admin/js/admin.js
// do not need to change. See SETUP STEPS at the bottom.

var SHEET_ID = "1F87LrES5CiflnZOI4xbJggCnd_cqFvW6KQGJ6uYFzsQ";

// Set this to a password of your choosing before deploying. Menu edits are
// rejected until this is non-empty, so the admin portal fails closed by
// default rather than being open to anyone who finds the URL.
//
// NOTE: this file is kept in sync with what's actually deployed, including
// the real password below. Don't commit this file to a public repo as-is —
// treat it the same as any other secret.
var ADMIN_PASSWORD = "ItNice2026!";

// ---------- Entry points ----------

function doGet(e) {
  var action = e.parameter.action;
  if (action === "menu") return handleMenuGet(e);
  return jsonResponse({ status: "ok" });
}

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var action = data.action || "order";

  if (action === "order") return handleOrderPost(data);
  if (action === "menu_upsert") return handleMenuUpsert(data);
  if (action === "menu_delete") return handleMenuDelete(data);
  return jsonResponse({ status: "error", message: "Unknown action" });
}

// ---------- Orders ----------

function handleOrderPost(data) {
  var sheet = getOrdersSheet();
  sheet.appendRow([
    new Date(),
    data.name || "",
    data.phone || "",
    data.pickup || "",
    data.items || "",
    data.total || "",
    data.notes || "",
  ]);
  return jsonResponse({ status: "success" });
}

function getOrdersSheet() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  return ss.getSheetByName("Orders") || ss.getSheets()[0];
}

// ---------- Menu ----------

function handleMenuGet(e) {
  var secret = e.parameter.secret;
  var isAdminRequest = secret !== undefined && secret !== "";

  if (isAdminRequest) {
    if (!ADMIN_PASSWORD || secret !== ADMIN_PASSWORD) {
      return jsonResponse({ status: "error", message: "Unauthorized" });
    }
    return jsonResponse({ status: "success", items: readMenu(true) });
  }

  return jsonResponse({ status: "success", items: readMenu(false) });
}

function handleMenuUpsert(data) {
  if (!ADMIN_PASSWORD || data.secret !== ADMIN_PASSWORD) {
    return jsonResponse({ status: "error", message: "Unauthorized" });
  }
  upsertMenuItem(data.item || {});
  return jsonResponse({ status: "success", items: readMenu(true) });
}

function handleMenuDelete(data) {
  if (!ADMIN_PASSWORD || data.secret !== ADMIN_PASSWORD) {
    return jsonResponse({ status: "error", message: "Unauthorized" });
  }
  deleteMenuItem(data.id);
  return jsonResponse({ status: "success", items: readMenu(true) });
}

function getMenuSheet() {
  return SpreadsheetApp.openById(SHEET_ID).getSheetByName("Menu");
}

function readMenu(includeInactive) {
  var sheet = getMenuSheet();
  var values = sheet.getDataRange().getValues();
  var rows = values.slice(1); // skip header row

  var items = rows
    .filter(function (r) { return r[0]; }) // skip blank rows
    .map(function (r) {
      return {
        id: String(r[0]),
        icon: r[1] || "",
        name: r[2] || "",
        desc: r[3] || "",
        price: Number(r[4]) || 0,
        date: r[5] ? String(r[5]) : null,
        special: r[6] === true || r[6] === "TRUE" || r[6] === "true",
        active: !(r[7] === false || r[7] === "FALSE" || r[7] === "false"),
        sortOrder: Number(r[8]) || 0,
      };
    });

  if (!includeInactive) items = items.filter(function (i) { return i.active; });

  items.sort(function (a, b) { return a.sortOrder - b.sortOrder; });
  return items;
}

function upsertMenuItem(item) {
  var sheet = getMenuSheet();
  var values = sheet.getDataRange().getValues();

  var id = item.id;
  if (!id) id = slugify(item.name) + "-" + Math.floor(Math.random() * 10000);

  var rowValues = [
    id,
    item.icon || "",
    item.name || "",
    item.desc || "",
    Number(item.price) || 0,
    item.date || "",
    !!item.special,
    item.active !== false,
    Number(item.sortOrder) || 0,
  ];

  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === id) {
      sheet.getRange(i + 1, 1, 1, rowValues.length).setValues([rowValues]);
      return;
    }
  }
  sheet.appendRow(rowValues);
}

function deleteMenuItem(id) {
  var sheet = getMenuSheet();
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
}

function slugify(name) {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ---------- Helpers ----------

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/*
STATUS: deployed and live (Version 2, Aug 25 2026). The Menu tab exists and
is seeded, and admin.html has been tested end-to-end (add/edit/hide/delete
all confirmed working, order logging confirmed unaffected).

Admin login password: ItNice2026! (matches ADMIN_PASSWORD above). Change it
any time by editing ADMIN_PASSWORD and redeploying (see step below) — the
admin.html login has no way to change it itself.

If you ever need to redeploy after editing this script again:
  Save, then Deploy > Manage deployments > pencil icon on the existing
  deployment > Version: New version > Deploy. Using "New version" on the
  SAME deployment keeps the /exec URL unchanged, so nothing in js/script.js
  or js/admin.js needs to be touched.

Notes:
- The customer-facing site (js/script.js) fetches ?action=menu with no
  secret, which only returns active items — this is a public, unauthenticated
  read (no password needed for customers to see the menu).
- admin.html always sends the password as `secret` on every request; a wrong
  or missing password gets `{status:"error"}` and the admin page shows the
  login screen again.
- Menu tab columns: id | icon | name | desc | price | date | special | active | sortOrder
- The "date" column must stay Plain Text formatted — Sheets will otherwise
  auto-convert values like "Sunday 8/26" into a real Date and silently
  "correct" it to whatever weekday that date actually falls on, breaking
  both the display and the pickup-date matching on the site.
*/
