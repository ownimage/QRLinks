// STORAGE HELPERS
function loadStreams() {
  return JSON.parse(localStorage.getItem("planmydays_streams") || "[]");
}
function saveStreams(streams) {
  localStorage.setItem("planmydays_streams", JSON.stringify(streams));
}

function hideAllEditors() {
  document.getElementById("countdownContainer").classList.remove("d-none");
  document.getElementById("streamsEditor").classList.add("d-none");
  document.getElementById("imagesEditor").classList.add("d-none");
  document.getElementById("settingsPage").classList.add("d-none");
}

function updateNavState() {
  const nav = document.getElementById("mainNav");
  if (nav) nav.classList.toggle("nav-inactive", false);
}

function escapeHtml(str) {
  if (!str && str !== 0) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// TOUCH DRAG AND DROP (iOS fallback)
function addTouchDnD(container, cardSelector, getSrcId, reorderCallback) {
  let touchSrc = null;

  container.addEventListener("touchstart", e => {
    const card = e.target.closest(cardSelector);
    if (!card) return;
    touchSrc = getSrcId(card);
    card.classList.add("dragging");
  }, { passive: true });

  container.addEventListener("touchmove", e => {
    if (touchSrc === null || touchSrc === undefined) return;
    e.preventDefault();
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const target = el ? el.closest(cardSelector) : null;
    if (!target) return;
    container.querySelectorAll(cardSelector).forEach(c => c.classList.remove("drag-over-top", "drag-over-bottom"));
    const rect = target.getBoundingClientRect();
    target.classList.add(touch.clientY < rect.top + rect.height / 2 ? "drag-over-top" : "drag-over-bottom");
  }, { passive: false });

  container.addEventListener("touchend", e => {
    if (touchSrc === null || touchSrc === undefined) { touchSrc = null; return; }
    container.querySelectorAll(cardSelector).forEach(c => c.classList.remove("dragging", "drag-over-top", "drag-over-bottom"));
    const touch = e.changedTouches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const target = el ? el.closest(cardSelector) : null;
    if (target) {
      const dstSrc = getSrcId(target);
      if (touchSrc !== dstSrc) {
        const rect = target.getBoundingClientRect();
        const above = touch.clientY < rect.top + rect.height / 2;
        reorderCallback(touchSrc, dstSrc, above);
        touchSrc = null;
        return;
      }
    }
    touchSrc = null;
  }, { passive: true });

  container.addEventListener("touchcancel", () => {
    if (touchSrc === null || touchSrc === undefined) return;
    container.querySelectorAll(cardSelector).forEach(c => c.classList.remove("dragging", "drag-over-top", "drag-over-bottom"));
    touchSrc = null;
  }, { passive: true });
}

// MAIN PAGE RENDER
function renderMain() {
  const container = document.getElementById("countdownContainer");
  if (!container) return;
  container.innerHTML = "";

  const streams = loadStreams();

  if (streams.length === 0) {
    const msg = document.createElement("p");
    msg.className = "text-secondary";
    msg.textContent = "No links yet. Add some from the Links editor.";
    container.appendChild(msg);
    updateNavState();
    return;
  }

  streams.forEach(t => {
    const imgUrl = getImageDataUrl(t.image);
    const card = document.createElement("div");
    card.className = "card countdown-card mb-2";

    const qrBtnId = "qrBtn_" + (streams.indexOf(t));
    card.innerHTML = `
      <div class="row align-items-center">
        <div class="col-auto d-flex align-items-center" style="min-width:68px">
          ${imgUrl ? `<img src="${imgUrl}" class="date-img" style="max-width:48px;max-height:48px">` : ""}
        </div>
        <div class="col" style="min-width:0">
          <div class="d-flex align-items-center gap-2 mb-1">
            <h4 class="mb-0">${escapeHtml(t.title)}</h4>
            ${t.url ? `<span class="text-primary small">${escapeHtml(t.url)}</span>` : ""}
          </div>
          ${t.description ? `<div class="text-secondary small">${escapeHtml(t.description)}</div>` : ""}
        </div>
        ${t.url ? `
        <div class="col-auto ps-0">
          <button id="${qrBtnId}" class="btn btn-sm btn-primary p-1" title="QR" style="line-height:1">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 16 16">
              <path d="M0 0h6v6H0V0zm2 2v2h2V2H2z"/>
              <path d="M10 0h6v6h-6V0zm2 2v2h2V2h-2z"/>
              <path d="M0 10h6v6H0v-6zm2 2v2h2v-2H2z"/>
              <path d="M13 10h1v1h-1v-1zm-1 1h1v1h-1v-1zm-1 1h1v1h-1v-1zm2 0h1v1h-1v-1zm-1 1h1v1h-1v-1zm1 1h1v1h-1v-1zm-1 1h1v1h-1v-1zm3 0h1v1h-1v-1zm1-1h1v1h-1v-1zm-1-4h1v1h-1v-1zm1 2h1v1h-1v-1zm-5 1h1v1h-1v-1zm-1 1h1v1h-1v-1zm2-1h1v1h-1v-1z"/>
            </svg>
          </button>
        </div>
        ` : ""}
      </div>
    `;
    container.appendChild(card);
    if (t.url) {
      const qrBtn = document.getElementById(qrBtnId);
      if (qrBtn) {
        qrBtn.addEventListener("click", function(e) {
          e.stopPropagation();
          showQrModal(t.url, t.title);
        });
      }
    }
  });

  updateNavState();
}

// THREADS EDITOR
let editingIndex = -1;
let editBuffer = null;
let isNew = false;
let dragIndex = -1;

function openStreamsEditor() {
  document.getElementById("countdownContainer").classList.add("d-none");
  document.getElementById("streamsEditor").classList.remove("d-none");
  document.getElementById("settingsPage").classList.add("d-none");
  renderStreamsEditor();
}

function closeStreamsEditor() {
  document.getElementById("streamsEditor").classList.add("d-none");
  document.getElementById("countdownContainer").classList.remove("d-none");
  editingIndex = -1; editBuffer = null; isNew = false;
  renderMain();
}

function renderStreamsEditor() {
  const list = document.getElementById("streamEditorList");
  const addTile = document.getElementById("addStreamTile");
  const topTile = document.getElementById("addStreamTileTop");
  const filterEl = document.getElementById("streamEditorFilters");
  const singleEditor = document.getElementById("singleStreamEditor");

  list.innerHTML = ""; addTile.innerHTML = ""; topTile.innerHTML = ""; filterEl.innerHTML = ""; singleEditor.innerHTML = "";

  const streams = loadStreams();

  if (editingIndex >= 0) {
    list.classList.add("d-none"); addTile.classList.add("d-none");
    topTile.classList.add("d-none"); filterEl.classList.add("d-none");
    singleEditor.classList.remove("d-none");

    const t = streams[editingIndex];
    const data = editBuffer || t;

    singleEditor.innerHTML = `
      <div class="d-flex align-items-center mb-3">
        <h3 class="mb-0">${isNew ? "Add Link" : "Edit Link"}</h3>
      </div>
      <div class="card p-3 card-edited">
        <div class="mb-2">
          <label class="form-label">Title</label>
          <input class="form-control" value="${escapeHtml(data.title || "")}" oninput="editField('title', this.value)">
        </div>
        <div class="mb-2">
          <label class="form-label">URL</label>
          <input class="form-control" value="${escapeHtml(data.url || "")}" oninput="editField('url', this.value)">
        </div>
        <div class="mb-2">
          <label class="form-label">Description</label>
          <textarea class="form-control" rows="3" oninput="editField('description', this.value)">${escapeHtml(data.description || "")}</textarea>
        </div>
        <div class="mb-2">
          <label class="form-label">Image</label>
          <div class="d-flex align-items-center gap-2">
            <div style="width:50px;height:50px;border:1px solid var(--bs-border-color);border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center;flex-shrink:0" id="streamImagePreview">
              ${getImageDataUrl(data.image) ? `<img src="${getImageDataUrl(data.image)}" class="date-img" style="max-width:50px;max-height:50px">` : `<span class="text-secondary small">none</span>`}
            </div>
            <span class="small text-secondary" id="streamImageName">${escapeHtml(data.image || "")}</span>
            <button class="btn btn-primary btn-sm" onclick="openImagePicker(function(name){ editField('image', name); updateStreamImagePreview(name); })">Choose</button>
            ${data.image ? `<button class="btn btn-danger btn-sm" onclick="editField('image','');updateStreamImagePreview(null)">Remove</button>` : ""}
          </div>
        </div>
        <div class="d-flex gap-2 mt-3">
          <button class="btn btn-success editor-btn" onclick="doneEdit()">OK</button>
          <button class="btn btn-secondary editor-btn ms-auto" onclick="cancelEdit()">Cancel</button>
        </div>
      </div>
    `;
    updateNavState();
    return;
  }

  list.classList.remove("d-none"); addTile.classList.remove("d-none");
  topTile.classList.remove("d-none"); filterEl.classList.remove("d-none");
  singleEditor.classList.add("d-none");

  const sorted = [...streams].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

  sorted.forEach((t, displayIdx) => {
    const realIdx = streams.indexOf(t);
    const streamImgUrl = getImageDataUrl(t.image);

    const card = document.createElement("div");
    card.className = "card p-3 mb-3 stream-drag-card";
    card.draggable = true;
    card.dataset.index = realIdx;
    card.dataset.displayIdx = displayIdx;
    card.innerHTML = `
      <div class="d-flex align-items-center gap-2 mb-2">
        <div class="drag-handle text-secondary" style="cursor:grab;font-size:1.3rem;line-height:1">&#9776;</div>
        <div style="width:40px;height:40px;flex-shrink:0">${streamImgUrl ? `<img src="${streamImgUrl}" class="date-img" style="max-width:40px;max-height:40px">` : ""}</div>
        <div class="fw-bold editor-title">${escapeHtml(t.title)}</div>
      </div>
      ${t.url ? `<div class="small text-primary mb-2">${escapeHtml(t.url)}</div>` : ""}
      <div class="d-flex gap-2">
        <button class="btn btn-primary editor-btn" onclick="editStream(${realIdx})">Edit</button>
        <button class="btn btn-danger editor-btn" onclick="confirmDeleteStream(${realIdx})">Delete</button>
      </div>
    `;
    list.appendChild(card);
  });

    // drag and drop handlers — operates on sorted display order
    let dragDisplayIdx = -1;
    list.addEventListener("dragstart", e => {
      const card = e.target.closest(".stream-drag-card");
      if (!card) return;
      dragDisplayIdx = parseInt(card.dataset.displayIdx);
      card.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    list.addEventListener("dragend", e => {
      document.querySelectorAll(".stream-drag-card").forEach(c => c.classList.remove("dragging", "drag-over-top", "drag-over-bottom"));
      list.classList.remove("drag-before", "drag-after");
    });
    list.addEventListener("dragover", e => {
      e.preventDefault();
      if (dragDisplayIdx < 0) return;
      document.querySelectorAll(".stream-drag-card").forEach(c => c.classList.remove("drag-over-top", "drag-over-bottom"));
      list.classList.remove("drag-before", "drag-after");
      const target = e.target.closest(".stream-drag-card");
      if (target) {
        const rect = target.getBoundingClientRect();
        target.classList.add(e.clientY < rect.top + rect.height / 2 ? "drag-over-top" : "drag-over-bottom");
      } else {
        const cards = list.querySelectorAll(".stream-drag-card");
        if (cards.length > 0) {
          const firstRect = cards[0].getBoundingClientRect();
          const lastRect = cards[cards.length - 1].getBoundingClientRect();
          if (e.clientY < firstRect.top) list.classList.add("drag-before");
          else if (e.clientY > lastRect.bottom) list.classList.add("drag-after");
        }
      }
    });
    list.addEventListener("drop", e => {
      e.preventDefault();
      document.querySelectorAll(".stream-drag-card").forEach(c => c.classList.remove("drag-over-top", "drag-over-bottom"));
      list.classList.remove("drag-before", "drag-after");
      if (dragDisplayIdx < 0) return;
      const streams = loadStreams();
      const sorted = [...streams].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
      const [moved] = sorted.splice(dragDisplayIdx, 1);
      const target = e.target.closest(".stream-drag-card");
      let insertDisplayIdx;
      if (target) {
        const targetDisplayIdx = parseInt(target.dataset.displayIdx);
        const rect = target.getBoundingClientRect();
        const above = e.clientY < rect.top + rect.height / 2;
        const adjTarget = dragDisplayIdx < targetDisplayIdx ? targetDisplayIdx - 1 : targetDisplayIdx;
        insertDisplayIdx = above ? adjTarget : adjTarget + 1;
      } else {
        const cards = list.querySelectorAll(".stream-drag-card");
        if (cards.length > 0) {
          const firstRect = cards[0].getBoundingClientRect();
          insertDisplayIdx = e.clientY < firstRect.top ? 0 : sorted.length;
        } else {
          insertDisplayIdx = 0;
        }
      }
      sorted.splice(insertDisplayIdx, 0, moved);
      sorted.forEach((t, i) => t.sequence = i + 1);
      saveStreams(streams);
      dragDisplayIdx = -1;
      renderStreamsEditor();
    });

    // touch DnD fallback for iOS
    addTouchDnD(list, ".stream-drag-card", c => parseInt(c.dataset.displayIdx), (srcDisplayIdx, dstDisplayIdx, above) => {
      if (srcDisplayIdx === dstDisplayIdx) return;
      const streams = loadStreams();
      const sorted = [...streams].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
      const [moved] = sorted.splice(srcDisplayIdx, 1);
      const adjDst = srcDisplayIdx < dstDisplayIdx ? dstDisplayIdx - 1 : dstDisplayIdx;
      const insertAt = above ? adjDst : adjDst + 1;
      sorted.splice(insertAt, 0, moved);
      sorted.forEach((t, i) => t.sequence = i + 1);
      saveStreams(streams);
      renderStreamsEditor();
    });

  topTile.innerHTML = `
    <div class="d-flex gap-2">
      <button class="btn btn-primary editor-btn btn-wide" onclick="addNewStream()">Add Link</button>
      <button class="btn btn-success editor-btn btn-wide ms-auto" onclick="closeStreamsEditor()">Done</button>
    </div>
  `;
  updateNavState();
}

function editField(field, value) {
  if (!editBuffer) return;
  editBuffer[field] = value;
}

function updateStreamImagePreview(name) {
  const preview = document.getElementById("streamImagePreview");
  const nameEl = document.getElementById("streamImageName");
  if (!preview) return;
  const url = getImageDataUrl(name);
  if (url) {
    preview.innerHTML = `<img src="${url}" class="date-img" style="max-width:50px;max-height:50px">`;
    if (nameEl) nameEl.textContent = name;
  } else {
    preview.innerHTML = `<span class="text-secondary small">none</span>`;
    if (nameEl) nameEl.textContent = "";
  }
}
function editStream(index) {
  const streams = loadStreams();
  editBuffer = JSON.parse(JSON.stringify(streams[index]));
  editingIndex = index; isNew = false;
  renderStreamsEditor();
}

function cancelEdit() {
  if (isNew && editingIndex >= 0) {
    const streams = loadStreams();
    streams.splice(editingIndex, 1);
    saveStreams(streams);
  }
  editingIndex = -1; editBuffer = null; isNew = false;
  renderStreamsEditor();
}

function doneEdit() {
  if (editingIndex >= 0 && editBuffer) {
    const streams = loadStreams();
    streams[editingIndex] = editBuffer;
    saveStreams(streams);
  }
  editingIndex = -1; editBuffer = null; isNew = false;
  renderStreamsEditor();
}

function confirmDeleteStream(index) {
  editingIndex = index;
  const modalEl = document.getElementById("deleteConfirmModal");
  document.getElementById("deleteConfirmMessage").textContent = 'Delete this stream?';
  document.getElementById("deleteConfirmBtn").onclick = function() {
    const streams = loadStreams();
    streams.splice(index, 1);
    streams.forEach((t, i) => t.sequence = i + 1);
    saveStreams(streams);
    bootstrap.Modal.getInstance(modalEl).hide();
    editingIndex = -1; editBuffer = null; isNew = false;
    renderStreamsEditor();
  };
  new bootstrap.Modal(modalEl).show();
}

function addNewStream() {
  const streams = loadStreams();
  const seq = streams.length + 1;
  const newStream = { title: "New Link", sequence: seq, description: "", image: "" };
  streams.push(newStream);
  saveStreams(streams);
  editBuffer = JSON.parse(JSON.stringify(newStream));
  editingIndex = streams.length - 1; isNew = true;
  renderStreamsEditor();
  const el = document.getElementById("streamsEditor");
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

// SETTINGS
function openSettings() {
  document.getElementById("countdownContainer").classList.add("d-none");
  document.getElementById("streamsEditor").classList.add("d-none");
  document.getElementById("settingsPage").classList.remove("d-none");
  document.getElementById("settingsPage").style.display = "block";

  const savedTheme = localStorage.getItem("theme") || "darkly";
  const themeSel = document.getElementById("themeSelector");
  if (themeSel) themeSel.value = savedTheme;
  const savedFontSize = localStorage.getItem("fontSize") || "xlarge";
  const fontSizeSel = document.getElementById("fontSizeSelector");
  if (fontSizeSel) fontSizeSel.value = savedFontSize;
  const autoHide = localStorage.getItem("autoHideMenu") === "true";
  const autoHideCb = document.getElementById("autoHideMenu");
  if (autoHideCb) autoHideCb.checked = autoHide;
  const showDanger = localStorage.getItem("showDanger") === "true";
  const showDangerCb = document.getElementById("showDanger");
  if (showDangerCb) showDangerCb.checked = showDanger;
  ["clearAllDataRow", "refreshAppRow", "uploadStandardImagesRow"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle("d-none", !showDanger);
  });

  const qrContainer = document.getElementById("shareQrCode");
  if (qrContainer) {
    qrContainer.innerHTML = "";
    new QRCode(qrContainer, {
      text: "https://ownimage.github.io/QRLinks",
      width: 120,
      height: 120,
      margin: 8
    });
  }

  const savedIconSize = localStorage.getItem("iconSize") || "large";
  const iconSel = document.getElementById("iconSizeSelector");
  if (iconSel) iconSel.value = savedIconSize;
  const savedDensity = localStorage.getItem("density") || "normal";
  const densitySel = document.getElementById("densitySelector");
  if (densitySel) densitySel.value = savedDensity;
}

function closeSettings() {
  document.getElementById("settingsPage").classList.add("d-none");
  document.getElementById("settingsPage").style.display = "";
  document.getElementById("countdownContainer").classList.remove("d-none");
  delete document.getElementById("countdownContainer").dataset.showAll;
  renderMain();
}

function showQrModal(url, title) {
  const modalEl = document.getElementById("qrModal");
  document.getElementById("qrModalTitle").textContent = title || "QR Code";
  document.getElementById("qrModalUrl").textContent = url;
  const container = document.getElementById("qrModalCode");
  container.innerHTML = "";
  new QRCode(container, {
    text: url,
    width: 180,
    height: 180,
    margin: 8
  });
  const openBtn = document.getElementById("qrOpenBtn");
  if (openBtn) {
    openBtn.onclick = function() { window.open(url, "_blank"); };
  }
  new bootstrap.Modal(modalEl).show();
  modalEl.addEventListener("hidden.bs.modal", function() {
    container.innerHTML = "";
    if (openBtn) openBtn.onclick = null;
  }, { once: true });
}

function confirmClearAllData() {
  const modalEl = document.getElementById("deleteConfirmModal");
  document.getElementById("deleteConfirmMessage").textContent = "Clear ALL data? This cannot be undone.";
  document.getElementById("deleteConfirmBtn").onclick = function() {
    localStorage.removeItem("planmydays_streams");
    bootstrap.Modal.getInstance(modalEl).hide();
    closeSettings();
  };
  new bootstrap.Modal(modalEl).show();
}

function exportData() {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    streams: JSON.parse(localStorage.getItem("planmydays_streams") || "[]"),
    images: JSON.parse(localStorage.getItem("images") || "[]")
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const d = new Date();
  const ts = d.getFullYear() + String(d.getMonth()+1).padStart(2,"0") + String(d.getDate()).padStart(2,"0") + String(d.getHours()).padStart(2,"0") + String(d.getMinutes()).padStart(2,"0");
  a.download = `planmydays-backup-${ts}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const data = JSON.parse(evt.target.result);
        if (!data || (!data.streams && !data.images)) {
          alert("Invalid backup file: missing streams or images data.");
          return;
        }
        if (data.streams) localStorage.setItem("planmydays_streams", JSON.stringify(data.streams));
        if (data.images) localStorage.setItem("images", JSON.stringify(data.images));
        closeSettings();
        renderMain();
      } catch (err) {
        alert("Invalid JSON file.");
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

document.addEventListener("DOMContentLoaded", () => {
  const savedTheme = localStorage.getItem("theme") || "darkly";
  applyTheme(savedTheme);
  if (typeof seedSampleImages === "function") seedSampleImages();

  renderMain();
});

// PWA PULL-TO-REFRESH
(function() {
  if (!("serviceWorker" in navigator)) return;
  const THRESHOLD = 80;
  let startY = 0, pulling = false, pullDist = 0;
  const indicator = document.createElement("div");
  indicator.id = "pwa-pull-indicator";
  indicator.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:9999;display:flex;align-items:center;justify-content:center;height:0;overflow:hidden;background:var(--bs-body-bg);transition:height 0.1s;color:var(--bs-body-color)";
  indicator.textContent = "\u21E9 Pull to refresh";
  document.body.appendChild(indicator);
  const spinner = document.createElement("div");
  spinner.id = "pwa-pull-spinner";
  spinner.style.cssText = "position:fixed;top:30%;left:50%;transform:translate(-50%,-50%);z-index:10000;display:none;width:40px;height:40px;border:4px solid var(--bs-border-color);border-top-color:var(--bs-primary);border-radius:50%;animation:pwa-spin 0.6s linear infinite";
  document.body.appendChild(spinner);
  const style = document.createElement("style");
  style.textContent = "@keyframes pwa-spin{to{transform:translate(-50%,-50%) rotate(360deg)}}";
  document.head.appendChild(style);
  function adjustIcon(dist) {
    indicator.innerHTML = dist >= THRESHOLD ? "\u21E9 Release to refresh" : "\u21E9 Pull to refresh";
    indicator.style.height = Math.min(dist, 50) + "px";
  }
  document.addEventListener("touchstart", e => {
    if (window.scrollY !== 0) return;
    startY = e.touches[0].clientY; pulling = true; pullDist = 0;
  }, { passive: true });
  document.addEventListener("touchmove", e => {
    if (!pulling) return;
    const dy = e.touches[0].clientY - startY;
    if (dy <= 0) { pullDist = 0; return; }
    pullDist = dy; adjustIcon(dy);
  }, { passive: true });
  document.addEventListener("touchend", () => {
    if (!pulling) return;
    pulling = false; indicator.style.height = "0";
    if (pullDist >= THRESHOLD) { spinner.style.display = "block"; setTimeout(() => { location.reload(); }, 400); }
    pullDist = 0;
  }, { passive: true });
})();
