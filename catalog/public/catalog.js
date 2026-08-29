const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = (value = "") => String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
const formatDate = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(`${value.replace(" ", "T")}Z`)) : "Never";

const state = {
  me: null,
  csrf: "",
  setupToken: "",
  catalog: { boxes: [], items: [] },
  query: "",
  filter: "all",
  detail: null,
  toastTimer: null
};

const auth = $("#auth");
const app = $("#app");
const catalogView = $("#catalogView");
const detailView = $("#detailView");
const usersView = $("#usersView");
const entityDialog = $("#entityDialog");
const entityForm = $("#entityForm");
const moveDialog = $("#moveDialog");
const moveForm = $("#moveForm");
const userDialog = $("#userDialog");
const confirmDialog = $("#confirmDialog");

function readSetupToken() {
  const params = new URLSearchParams(location.hash.slice(1));
  state.setupToken = params.get("setup") || "";
  if (state.setupToken) history.replaceState({}, "", location.pathname + location.search);
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && typeof options.body !== "string") {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }
  if (options.method && options.method !== "GET" && state.csrf) headers["X-CSRF-Token"] = state.csrf;
  const response = await fetch(path, { ...options, headers, credentials: "same-origin" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && !path.includes("/login")) showAuth(false);
    throw new Error(data.error || "Request failed");
  }
  return data;
}

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("is-visible");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => el.classList.remove("is-visible"), 2600);
}

function showAuth(setupRequired) {
  app.hidden = true;
  auth.hidden = false;
  const setupAllowed = setupRequired && state.setupToken;
  $("#loginForm").hidden = setupRequired;
  $("#setupForm").hidden = !setupAllowed;
  if (setupRequired) {
    $("#authTitle").textContent = setupAllowed ? "Set up catalog" : "Setup link required";
    $("#authCopy").textContent = setupAllowed
      ? "Create the first administrator. You can add other team members after signing in."
      : "Open the private one-time setup link from the catalog administrator.";
  } else {
    $("#authTitle").textContent = "Equipment catalog";
    $("#authCopy").textContent = "Sign in to locate, identify, and move equipment in A101.";
  }
}

async function establishSession() {
  try {
    const result = await api("/api/me");
    state.me = result.user;
    state.csrf = result.csrf;
    auth.hidden = true;
    app.hidden = false;
    $("#accountName").textContent = state.me.name;
    $("#usersNav").hidden = state.me.role !== "admin";
    await loadCatalog();
    await renderRoute();
  } catch {
    const status = await api("/api/status");
    showAuth(status.setupRequired);
  }
}

async function loadCatalog() {
  state.catalog = await api("/api/catalog");
}

function navigate(path) {
  history.pushState({}, "", path);
  renderRoute();
}

async function renderRoute() {
  if (!state.me) return;
  const path = location.pathname;
  catalogView.hidden = true;
  detailView.hidden = true;
  usersView.hidden = true;
  $$(".topbar__nav button").forEach((button) => button.classList.remove("is-active"));

  try {
    if (path.startsWith("/box/")) {
      detailView.hidden = false;
      await renderBoxDetail(path.split("/")[2]);
    } else if (path.startsWith("/item/")) {
      detailView.hidden = false;
      await renderItemDetail(path.split("/")[2]);
    } else if (path === "/users" && state.me.role === "admin") {
      usersView.hidden = false;
      $("#usersNav").classList.add("is-active");
      await renderUsers();
    } else {
      if (path !== "/") history.replaceState({}, "", "/");
      catalogView.hidden = false;
      $("[data-route='/']", $(".topbar__nav")).classList.add("is-active");
      renderCatalog();
    }
  } catch (error) {
    detailView.innerHTML = `<button class="back" data-route="/">← Back to catalog</button><div class="empty"><strong>Could not open record</strong>${escapeHtml(error.message)}</div>`;
  }
  $("#workspace").focus({ preventScroll: true });
  scrollTo({ top: 0, behavior: "instant" });
}

function catalogRows() {
  const boxes = state.catalog.boxes.map((box) => ({
    type: "box", id: box.id, public_id: box.public_id, title: `Box ${box.code}`, subtitle: box.name,
    location: box.current_location, status: box.status, holder: box.checked_out_to, last_holder: box.last_holder,
    search: `${box.code} ${box.name} ${box.description} ${box.room_location} ${box.current_location} ${box.checked_out_to || ""}`
  }));
  const items = state.catalog.items.map((item) => ({
    type: "item", id: item.id, public_id: item.public_id, title: item.name,
    subtitle: item.asset_tag || (item.box_code ? `Inside Box ${item.box_code}` : "Loose item"),
    location: item.resolved_location, status: item.resolved_status, holder: item.resolved_holder, last_holder: item.last_holder,
    search: `${item.name} ${item.asset_tag || ""} ${item.description} ${item.identifying_notes} ${item.box_code || ""} ${item.resolved_location} ${item.resolved_holder || ""}`
  }));
  const query = state.query.toLowerCase();
  return [...boxes, ...items].filter((row) => {
    if (state.filter === "boxes" && row.type !== "box") return false;
    if (state.filter === "items" && row.type !== "item") return false;
    if (state.filter === "checked_out" && row.status !== "checked_out") return false;
    return !query || row.search.toLowerCase().includes(query);
  });
}

function renderCatalog() {
  const rows = catalogRows();
  const boxCount = state.catalog.boxes.length;
  const itemCount = state.catalog.items.length;
  const outCount = [...state.catalog.boxes, ...state.catalog.items].filter((entry) => (entry.resolved_status || entry.status) === "checked_out").length;
  $("#catalogSummary").textContent = `${boxCount} ${boxCount === 1 ? "box" : "boxes"} · ${itemCount} ${itemCount === 1 ? "item" : "items"} · ${outCount} checked out`;
  $$("[data-filter]").forEach((button) => button.classList.toggle("is-active", button.dataset.filter === state.filter));
  if (!rows.length) {
    $("#inventory").innerHTML = `<div class="empty"><strong>${state.query ? "Nothing matches that search" : "Catalog is empty"}</strong>${state.query ? "Try another name, tag, box, or location." : "Add a box or item to start tracking A101 equipment."}</div>`;
    return;
  }
  $("#inventory").innerHTML = `
    <div class="inventory-head"><span>Name</span><span>Status</span><span>Location</span><span>Current / last holder</span><span></span></div>
    ${rows.map((row) => `
      <button class="inventory-row" data-open-type="${row.type}" data-public-id="${escapeHtml(row.public_id)}">
        <span class="inventory-name"><span class="inventory-name__type">${row.type === "box" ? "BOX" : "ITEM"}</span><span><strong>${escapeHtml(row.title)}</strong><span>${escapeHtml(row.subtitle)}</span></span></span>
        <span class="inventory-cell"><span class="status ${row.status === "checked_out" ? "status--out" : ""}">${row.status === "checked_out" ? "Checked out" : "Available"}</span></span>
        <span class="inventory-cell">${escapeHtml(row.location)}</span>
        <span class="inventory-cell">${escapeHtml(row.holder || row.last_holder || "—")}<small>${row.holder ? "Has it now" : row.last_holder ? "Last holder" : "No checkout history"}</small></span>
        <span class="row-arrow" aria-hidden="true">›</span>
      </button>`).join("")}`;
}

function historyMarkup(history) {
  if (!history.length) return `<p class="detail-copy">No movement history yet.</p>`;
  return `<ul class="history">${history.map((entry) => {
    const route = [entry.from_location, entry.to_location].filter(Boolean).join(" → ");
    return `<li><time>${escapeHtml(formatDate(entry.created_at))}</time><div><strong>${escapeHtml(entry.action.replace("_", " "))}</strong>${route ? `<p>${escapeHtml(route)}</p>` : ""}${entry.holder ? `<p>${escapeHtml(entry.holder)}</p>` : ""}${entry.notes ? `<p>${escapeHtml(entry.notes)}</p>` : ""}<p>Recorded by ${escapeHtml(entry.actor_name || "Unknown user")}</p></div></li>`;
  }).join("")}</ul>`;
}

function statusText(record) {
  return record.status === "checked_out" ? `Checked out to ${record.checked_out_to}` : "Available";
}

function actionButtons(type, record) {
  const movesWithBox = type === "item" && record.box_status === "checked_out" && record.status !== "checked_out";
  return `
    <button class="button button--secondary" data-edit-type="${type}">Edit</button>
    ${movesWithBox
      ? `<span class="button button--quiet" aria-disabled="true">Moves with Box ${escapeHtml(record.box_code)}</span>`
      : record.status === "checked_out"
      ? `<button class="button button--primary" data-move-action="returned" data-entity-type="${type}" data-id="${record.id}">Return</button>`
      : `<button class="button button--primary" data-move-action="checked_out" data-entity-type="${type}" data-id="${record.id}">Check out</button>`}
    ${movesWithBox ? "" : `<button class="button button--quiet" data-move-action="relocated" data-entity-type="${type}" data-id="${record.id}">Relocate</button>`}
    <button class="button button--quiet" data-delete-type="${type}" data-id="${record.id}" data-name="${escapeHtml(type === "box" ? `Box ${record.code}` : record.name)}">Delete</button>`;
}

function qrPanel(type, record) {
  return `<aside class="qr-panel"><img src="/api/qr/${type}/${encodeURIComponent(record.public_id)}.svg" alt="QR code for ${escapeHtml(type === "box" ? `Box ${record.code}` : record.name)}" /><h2>Scan to identify</h2><p>This code opens this exact ${type} after login. Print it and attach it to the equipment.</p><a href="/api/qr/${type}/${encodeURIComponent(record.public_id)}.svg" target="_blank" rel="noopener">Open printable QR →</a></aside>`;
}

async function renderBoxDetail(publicId) {
  const data = await api(`/api/boxes/${encodeURIComponent(publicId)}`);
  state.detail = { type: "box", ...data };
  const box = data.box;
  detailView.innerHTML = `
    <button class="back" data-route="/">← Back to catalog</button>
    <header class="detail-head"><div><h1>Box ${escapeHtml(box.code)}</h1><div class="detail-head__meta"><span>${escapeHtml(box.name)}</span><span>·</span><span class="status ${box.status === "checked_out" ? "status--out" : ""}">${escapeHtml(statusText(box))}</span></div></div><div class="detail-head__actions">${actionButtons("box", box)}</div></header>
    <div class="detail-grid"><div>
      <dl class="facts"><div class="fact"><dt>Home in A101</dt><dd>${escapeHtml(box.room_location)}</dd></div><div class="fact"><dt>Current location</dt><dd>${escapeHtml(box.current_location)}</dd></div><div class="fact"><dt>Who has it now</dt><dd>${escapeHtml(box.checked_out_to || "Nobody")}</dd></div><div class="fact"><dt>Last holder</dt><dd>${escapeHtml(box.last_holder || "No checkout history")}</dd></div></dl>
      ${box.description ? `<section class="detail-section"><h2>About this box</h2><p class="detail-copy">${escapeHtml(box.description)}</p></section>` : ""}
      <section class="detail-section"><div class="page-head"><div><h2>Contents</h2><p>${data.items.length} ${data.items.length === 1 ? "item" : "items"}</p></div><button class="button button--secondary" data-add="item" data-box-id="${box.id}">Add item to box</button></div><div class="contents">${data.items.length ? data.items.map((item) => `<button class="content-row" data-open-type="item" data-public-id="${escapeHtml(item.public_id)}"><span><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.asset_tag || item.identifying_notes || "No identifying notes yet")}</span></span><span>Qty ${item.quantity} · ›</span></button>`).join("") : `<p class="empty">No items recorded in this box.</p>`}</div></section>
      <section class="detail-section"><h2>Movement history</h2>${historyMarkup(data.history)}</section>
    </div>${qrPanel("box", box)}</div>`;
}

async function renderItemDetail(publicId) {
  const data = await api(`/api/items/${encodeURIComponent(publicId)}`);
  state.detail = { type: "item", ...data };
  const item = data.item;
  detailView.innerHTML = `
    <button class="back" data-route="/">← Back to catalog</button>
    <header class="detail-head"><div><h1>${escapeHtml(item.name)}</h1><div class="detail-head__meta"><span>${escapeHtml(item.asset_tag || "No asset tag")}</span><span>·</span><span class="status ${item.resolved_status === "checked_out" ? "status--out" : ""}">${item.resolved_status === "checked_out" ? `Checked out to ${escapeHtml(item.resolved_holder || "Unknown")}` : "Available"}</span></div></div><div class="detail-head__actions">${actionButtons("item", item)}</div></header>
    <div class="detail-grid"><div>
      <dl class="facts"><div class="fact"><dt>Stored in</dt><dd>${item.box_public_id ? `<a href="/box/${escapeHtml(item.box_public_id)}" data-route="/box/${escapeHtml(item.box_public_id)}">Box ${escapeHtml(item.box_code)} · ${escapeHtml(item.box_name)}</a>` : "No box"}</dd></div><div class="fact"><dt>Quantity</dt><dd>${item.quantity}</dd></div><div class="fact"><dt>Home location</dt><dd>${escapeHtml(item.room_location)}</dd></div><div class="fact"><dt>Current location</dt><dd>${escapeHtml(item.resolved_location)}</dd></div><div class="fact"><dt>Who has it now</dt><dd>${escapeHtml(item.resolved_holder || "Nobody")}</dd></div><div class="fact"><dt>Last holder</dt><dd>${escapeHtml(item.last_holder || "No checkout history")}</dd></div></dl>
      <section class="detail-section"><h2>What is it?</h2><p class="detail-copy">${escapeHtml(item.description || "No description yet. Add the proper name, purpose, and how to recognize it.")}</p></section>
      <section class="detail-section"><h2>Identifying details</h2><p class="detail-copy">${escapeHtml(item.identifying_notes || "No visual identifying details yet.")}</p></section>
      <section class="detail-section"><h2>Movement history</h2>${historyMarkup(data.history)}</section>
    </div>${qrPanel("item", item)}</div>`;
}

function fillBoxOptions(selected = "") {
  const select = entityForm.elements.box_id;
  select.innerHTML = `<option value="">No box</option>${state.catalog.boxes.map((box) => `<option value="${box.id}" ${String(box.id) === String(selected) ? "selected" : ""}>Box ${escapeHtml(box.code)} · ${escapeHtml(box.name)}</option>`).join("")}`;
}

function openEntityForm(type, record = null, boxId = "") {
  entityForm.reset();
  entityForm.elements.entity_type.value = type;
  entityForm.elements.id.value = record?.id || "";
  $("#boxFields").hidden = type !== "box";
  $("#itemFields").hidden = type !== "item";
  $("#entityDialogTitle").textContent = `${record ? "Edit" : "Add"} ${type}`;
  $("#entityDialogCopy").textContent = type === "box" ? "Give the box a physical home in A101." : "Name it so the next person can identify it from the QR page.";
  $("#entityError").textContent = "";
  if (type === "box") {
    entityForm.elements.code.value = record?.code || "";
    entityForm.elements.box_name.value = record?.name || "";
    entityForm.elements.box_room_location.value = record?.room_location || "";
    entityForm.elements.box_description.value = record?.description || "";
  } else {
    fillBoxOptions(record?.box_id || boxId);
    entityForm.elements.item_name.value = record?.name || "";
    entityForm.elements.quantity.value = record?.quantity || 1;
    entityForm.elements.asset_tag.value = record?.asset_tag || "";
    entityForm.elements.item_room_location.value = record?.room_location || (boxId ? `Inside Box ${state.catalog.boxes.find((box) => box.id === Number(boxId))?.code || ""}` : "");
    entityForm.elements.item_description.value = record?.description || "";
    entityForm.elements.identifying_notes.value = record?.identifying_notes || "";
  }
  entityDialog.showModal();
}

async function submitEntity() {
  const type = entityForm.elements.entity_type.value;
  const id = entityForm.elements.id.value;
  const body = type === "box" ? {
    code: entityForm.elements.code.value,
    name: entityForm.elements.box_name.value,
    room_location: entityForm.elements.box_room_location.value,
    description: entityForm.elements.box_description.value
  } : {
    name: entityForm.elements.item_name.value,
    quantity: entityForm.elements.quantity.value,
    asset_tag: entityForm.elements.asset_tag.value,
    box_id: entityForm.elements.box_id.value || null,
    room_location: entityForm.elements.item_room_location.value,
    description: entityForm.elements.item_description.value,
    identifying_notes: entityForm.elements.identifying_notes.value
  };
  await api(`/api/${type === "box" ? "boxes" : "items"}${id ? `/${id}` : ""}`, { method: id ? "PATCH" : "POST", body });
  entityDialog.close();
  await loadCatalog();
  toast(`${type === "box" ? "Box" : "Item"} saved`);
  if (id && state.detail) await renderRoute(); else { history.replaceState({}, "", "/"); renderRoute(); }
}

function openMoveForm(action, type, id) {
  moveForm.reset();
  moveForm.elements.action.value = action;
  moveForm.elements.entity_type.value = type;
  moveForm.elements.id.value = id;
  $("#moveError").textContent = "";
  $("#holderField").hidden = action !== "checked_out";
  $("#locationField").hidden = false;
  const labels = { checked_out: "Check out equipment", returned: "Return equipment", relocated: "Change location" };
  $("#moveDialogTitle").textContent = labels[action];
  $("#moveDialogCopy").textContent = action === "returned" ? "Leave location blank to return it to its recorded home." : "This update becomes part of the permanent movement history.";
  moveForm.elements.location.required = action !== "returned";
  moveForm.elements.holder.required = action === "checked_out";
  moveDialog.showModal();
}

async function submitMove() {
  await api("/api/move", { method: "POST", body: Object.fromEntries(new FormData(moveForm)) });
  moveDialog.close();
  await loadCatalog();
  await renderRoute();
  toast("Movement recorded");
}

async function confirmDelete(type, id, name) {
  $("#confirmCopy").textContent = `${name} leaves the active catalog. Movement history stays preserved.`;
  confirmDialog.showModal();
  const confirmed = await new Promise((resolve) => confirmDialog.addEventListener("close", () => resolve(confirmDialog.returnValue === "confirm"), { once: true }));
  if (!confirmed) return;
  await api(`/api/${type === "box" ? "boxes" : type === "item" ? "items" : "users"}/${id}`, { method: "DELETE" });
  if (type === "user") await renderUsers();
  else {
    await loadCatalog();
    history.replaceState({}, "", "/");
    await renderRoute();
  }
  toast(`${name} deleted`);
}

async function renderUsers() {
  const { users } = await api("/api/users");
  usersView.innerHTML = `<header class="page-head"><div><h1>People</h1><p>Accounts with access to the equipment catalog.</p></div><button class="button button--primary" id="addUserButton">Add person</button></header><div class="people">${users.map((user) => `<div class="person"><div><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.email)}</small></div><div><small>Last login</small>${escapeHtml(formatDate(user.last_login_at))}</div><span class="person__role">${escapeHtml(user.role)}</span>${user.id === state.me.id ? `<span></span>` : `<button class="icon-button" data-delete-type="user" data-id="${user.id}" data-name="${escapeHtml(user.name)}" aria-label="Delete ${escapeHtml(user.name)}">×</button>`}</div>`).join("")}</div>`;
}

document.addEventListener("click", async (event) => {
  const closeDialog = event.target.closest("[data-close-dialog]");
  if (closeDialog) {
    closeDialog.closest("dialog")?.close();
    return;
  }
  const route = event.target.closest("[data-route]");
  if (route) { event.preventDefault(); navigate(route.dataset.route); return; }
  const filterRoute = event.target.closest("[data-filter-route]");
  if (filterRoute) { state.filter = filterRoute.dataset.filterRoute; navigate("/"); renderCatalog(); return; }
  const filter = event.target.closest("[data-filter]");
  if (filter) { state.filter = filter.dataset.filter; renderCatalog(); return; }
  const open = event.target.closest("[data-open-type]");
  if (open) { navigate(`/${open.dataset.openType}/${open.dataset.publicId}`); return; }
  const add = event.target.closest("[data-add]");
  if (add) { openEntityForm(add.dataset.add, null, add.dataset.boxId || ""); return; }
  const edit = event.target.closest("[data-edit-type]");
  if (edit && state.detail) { openEntityForm(edit.dataset.editType, state.detail[edit.dataset.editType]); return; }
  const move = event.target.closest("[data-move-action]");
  if (move) { openMoveForm(move.dataset.moveAction, move.dataset.entityType, move.dataset.id); return; }
  const remove = event.target.closest("[data-delete-type]");
  if (remove) {
    try { await confirmDelete(remove.dataset.deleteType, remove.dataset.id, remove.dataset.name); }
    catch (error) { toast(error.message); }
    return;
  }
  if (event.target.closest("#addUserButton")) { $("#userForm").reset(); $("#userError").textContent = ""; userDialog.showModal(); }
});

$("#catalogSearch").addEventListener("input", (event) => { state.query = event.target.value; renderCatalog(); });
window.addEventListener("popstate", renderRoute);

$("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#loginError").textContent = "";
  try {
    await api("/api/login", { method: "POST", body: Object.fromEntries(new FormData(event.currentTarget)) });
    await establishSession();
  } catch (error) { $("#loginError").textContent = error.message; }
});

$("#setupForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#setupError").textContent = "";
  try {
    await api("/api/setup", { method: "POST", headers: { "X-Setup-Token": state.setupToken }, body: Object.fromEntries(new FormData(event.currentTarget)) });
    state.setupToken = "";
    await establishSession();
  } catch (error) { $("#setupError").textContent = error.message; }
});

$("#logoutButton").addEventListener("click", async () => {
  await api("/api/logout", { method: "POST" });
  state.me = null; state.csrf = ""; showAuth(false);
});

entityForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#entityError").textContent = "";
  try { await submitEntity(); } catch (error) { $("#entityError").textContent = error.message; }
});
moveForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#moveError").textContent = "";
  try { await submitMove(); } catch (error) { $("#moveError").textContent = error.message; }
});
$("#userForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#userError").textContent = "";
  try {
    await api("/api/users", { method: "POST", body: Object.fromEntries(new FormData(event.currentTarget)) });
    userDialog.close(); await renderUsers(); toast("Login created");
  } catch (error) { $("#userError").textContent = error.message; }
});

readSetupToken();
establishSession();
