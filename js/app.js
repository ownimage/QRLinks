// STORAGE HELPERS
function loadStreams() {
  const streams = JSON.parse(localStorage.getItem("planmydays_streams") || "[]");
  let nextId = Date.now();
  let changed = false;
  streams.forEach(t => {
    (t.jobs || []).forEach(j => {
      if (!j.id) { j.id = "job_" + (nextId++); changed = true; }
    });
  });
  if (changed) saveStreams(streams);
  return streams;
}
function saveStreams(streams) {
  localStorage.setItem("planmydays_streams", JSON.stringify(streams));
}

function hideAllEditors() {
  document.getElementById("countdownContainer").classList.remove("d-none");
  document.getElementById("streamsEditor").classList.add("d-none");
  document.getElementById("jobsEditor").classList.add("d-none");
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

// JOB COMPLETION STORAGE
function loadCompletedJobs() {
  const data = localStorage.getItem("planmydays_completed");
  return data ? JSON.parse(data) : [];
}
function saveCompletedJobs(ids) {
  localStorage.setItem("planmydays_completed", JSON.stringify(ids));
}

// TODAY PAGE ORDER
function loadTodayOrder() {
  const data = localStorage.getItem("planmydays_today_order");
  return data ? JSON.parse(data) : null;
}
function saveTodayOrder(order) {
  localStorage.setItem("planmydays_today_order", JSON.stringify(order));
}

// MAIN PAGE RENDER
function addScheduleJobsToOrder(order) {
  const streams = loadStreams();
  const existing = new Set(order);
  const jobMap = {};
  streams.forEach(t => {
    (t.jobs || []).forEach(j => {
      jobMap[j.id] = j;
      if (j.active !== false && shouldShowJobToday(j) && !existing.has(j.id)) {
        order.push(j.id);
        existing.add(j.id);
      }
    });
  });
  order.sort((a, b) => {
    const ta = jobMap[a]?.time;
    const tb = jobMap[b]?.time;
    if (!ta && !tb) return 0;
    if (!ta) return 1;
    if (!tb) return -1;
    return ta.localeCompare(tb);
  });
  return order;
}

function ensureTodayList() {
  const today = new Date().toISOString().slice(0, 10);
  const lastGen = localStorage.getItem("planmydays_last_gen");
  const existingOrder = loadTodayOrder();
  if (lastGen === today && existingOrder) return;

  if (!existingOrder) {
    const order = addScheduleJobsToOrder([]);
    saveTodayOrder(order);
    saveCompletedJobs([]);
    localStorage.setItem("planmydays_last_gen", today);
    return;
  }

  // date changed: carry over uncompleted + add new schedule-matching jobs
  const completed = loadCompletedJobs();
  const carried = existingOrder.filter(id => !completed.includes(id));
  const merged = addScheduleJobsToOrder(carried);
  saveTodayOrder(merged);
  saveCompletedJobs([]);
  localStorage.setItem("planmydays_last_gen", today);
}

function renderMain() {
  const container = document.getElementById("countdownContainer");
  if (!container) return;
  container.innerHTML = "";

  const now = new Date();
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dateStr = `${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]}, ${now.getFullYear()}`;

  const headingRow = document.createElement("div");
  headingRow.className = "d-flex align-items-center gap-2 mb-3";
  const dateHeading = document.createElement("h2");
  dateHeading.className = "mb-0";
  dateHeading.textContent = dateStr;
  headingRow.appendChild(dateHeading);
  const addBtn = document.createElement("button");
  addBtn.className = "btn btn-primary editor-btn ms-auto";
  addBtn.innerHTML = "&#43; Add card";
  addBtn.onclick = function() { showAddCardForm(); };
  headingRow.appendChild(addBtn);
  container.appendChild(headingRow);

  // inline add form (hidden initially)
  const addForm = document.createElement("div");
  addForm.id = "addCardForm";
  addForm.className = "card p-3 mb-3 d-none";
  container.appendChild(addForm);

  ensureTodayList();

  const streams = loadStreams();
  const completed = loadCompletedJobs();
  const todayOrder = loadTodayOrder() || [];
  const todaySet = new Set(todayOrder);

  const allJobs = [];
  streams.forEach(t => {
    (t.jobs || []).forEach(j => {
      if (j.active !== false && todaySet.has(j.id)) {
        allJobs.push({ job: j, streamTitle: t.title, streamIdx: streams.indexOf(t) });
      }
    });
  });

  const orderMap = {};
  todayOrder.forEach((id, i) => { orderMap[id] = i; });
  allJobs.sort((a, b) => (orderMap[a.job.id] !== undefined ? orderMap[a.job.id] : 999) - (orderMap[b.job.id] !== undefined ? orderMap[b.job.id] : 999));

  const cardContainer = document.createElement("div");
  cardContainer.id = "todayCardList";

  if (allJobs.length === 0) {
    const msg = document.createElement("p");
    msg.className = "text-secondary";
    msg.textContent = "No active jobs yet. Add streams with active jobs to get started.";
    container.appendChild(msg);
    updateNavState();
    return;
  }

  allJobs.forEach(({ job, streamTitle, streamIdx }) => {
    const isDone = completed.includes(job.id);
    const streams = loadStreams();
    const stream = streams[streamIdx] || {};
    const streamImageUrl = getImageDataUrl(stream.image);
    const jobImageUrl = getImageDataUrl(job.image);
    const card = document.createElement("div");
    card.className = `card countdown-card mb-2 today-drag-card ${isDone ? "opacity-50" : ""}`;
    card.draggable = true;
    card.dataset.jobId = job.id;
    card.dataset.streamIdx = streamIdx;
    card.innerHTML = `
      <div class="row align-items-center">
        <div class="col-auto d-flex align-items-center">
          <div class="drag-handle text-secondary" style="cursor:grab;font-size:1.2rem;line-height:1;display:flex;align-items:center">&#9776;</div>
          <div class="form-check mb-0 ms-1 pe-0 d-flex align-items-center" style="min-height:0;padding-left:0">
            <input class="form-check-input job-checkbox m-0 position-static" type="checkbox" data-job-id="${escapeHtml(job.id)}" ${isDone ? "checked" : ""}>
          </div>
        </div>
        <div class="col-auto d-flex align-items-center gap-1 px-0" style="min-width:68px">
          <div style="width:32px;height:32px;display:flex;align-items:center;justify-content:center">${streamImageUrl ? `<img src="${streamImageUrl}" class="date-img" style="max-width:32px;max-height:32px">` : ""}</div>
          <div style="width:32px;height:32px;display:flex;align-items:center;justify-content:center">${jobImageUrl ? `<img src="${jobImageUrl}" class="date-img" style="max-width:32px;max-height:32px">` : ""}</div>
        </div>
        <div class="col" style="min-width:0">
          <div class="d-flex align-items-center gap-2 mb-1">
            <h4 class="mb-0" style="${isDone ? 'text-decoration:line-through' : ''}">${escapeHtml(job.title)}</h4>
          </div>
          <div class="text-secondary small">${escapeHtml(streamTitle)}</div>
          ${job.description ? `<div class="mt-1 text-secondary small">${escapeHtml(job.description)}</div>` : ""}
        </div>
      </div>
    `;
    cardContainer.appendChild(card);
  });

  container.appendChild(cardContainer);

  // checkbox change handler
  container.querySelectorAll(".job-checkbox").forEach(cb => {
    cb.addEventListener("change", function() {
      const jobId = this.dataset.jobId;
      const card = this.closest(".today-drag-card");
      if (this.checked) {
        const streamIdx = card ? parseInt(card.dataset.streamIdx) : -1;
        const streams = loadStreams();
        const stream = streams[streamIdx];
        if (stream && stream.title === "Ad Hoc") {
          const job = (stream.jobs || []).find(j => j.id === jobId);
          const modalEl = document.getElementById("deleteConfirmModal");
          const confirmBtn = document.getElementById("deleteConfirmBtn");
          document.getElementById("deleteConfirmMessage").innerHTML = `Remove "<strong>${escapeHtml(job?.title || jobId)}</strong>" from Ad Hoc?`;
          confirmBtn.className = "btn btn-danger editor-btn btn-wide";
          confirmBtn.textContent = "Remove";
          const cbRef = this;
          let confirmed = false;
          confirmBtn.onclick = function() {
            confirmed = true;
            bootstrap.Modal.getInstance(modalEl).hide();
            removeAdhocJob(streamIdx, jobId, cbRef);
          };
          modalEl.addEventListener("hidden.bs.modal", function() {
            if (!confirmed) { cbRef.checked = false; }
          }, { once: true });
          new bootstrap.Modal(modalEl).show();
          return;
        } else {
          markJobDone(jobId, this);
        }
      } else {
        let completed = loadCompletedJobs();
        completed = completed.filter(id => id !== jobId);
        saveCompletedJobs(completed);
        if (card) {
          card.classList.toggle("opacity-50", false);
          const titleEl = card.querySelector("h4");
          if (titleEl) titleEl.style.textDecoration = "none";
        }
      }
    });
  });

function removeAdhocJob(streamIdx, jobId, cbRef) {
  const streams = loadStreams();
  const stream = streams[streamIdx];
  if (stream) {
    const jobs = stream.jobs || [];
    const idx = jobs.findIndex(j => j.id === jobId);
    if (idx >= 0) jobs.splice(idx, 1);
    stream.jobs = jobs;
    saveStreams(streams);
  }
  markJobDone(jobId, cbRef);
  renderMain();
}

function markJobDone(jobId, cbRef) {
  let completed = loadCompletedJobs();
  if (!completed.includes(jobId)) completed.push(jobId);
  saveCompletedJobs(completed);
  const card = cbRef.closest(".today-drag-card");
  if (card) {
    card.classList.toggle("opacity-50", true);
    const titleEl = card.querySelector("h4");
    if (titleEl) titleEl.style.textDecoration = "line-through";
  }
}

  // today page drag and drop
  let todayDragSrc = null;
  cardContainer.addEventListener("dragstart", e => {
    const card = e.target.closest(".today-drag-card");
    if (!card) return;
    todayDragSrc = card.dataset.jobId;
    card.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
  });
  cardContainer.addEventListener("dragend", e => {
    cardContainer.querySelectorAll(".today-drag-card").forEach(c => c.classList.remove("dragging", "drag-over-top", "drag-over-bottom"));
  });
  cardContainer.addEventListener("dragover", e => {
    e.preventDefault();
    const target = e.target.closest(".today-drag-card");
    if (!target || !todayDragSrc) return;
    cardContainer.querySelectorAll(".today-drag-card").forEach(c => c.classList.remove("drag-over-top", "drag-over-bottom"));
    const rect = target.getBoundingClientRect();
    target.classList.add(e.clientY < rect.top + rect.height / 2 ? "drag-over-top" : "drag-over-bottom");
  });
  cardContainer.addEventListener("drop", e => {
    e.preventDefault();
    cardContainer.querySelectorAll(".today-drag-card").forEach(c => c.classList.remove("drag-over-top", "drag-over-bottom"));
    const target = e.target.closest(".today-drag-card");
    if (!target || !todayDragSrc || target.dataset.jobId === todayDragSrc) { todayDragSrc = null; return; }
    const cards = [...cardContainer.querySelectorAll(".today-drag-card")];
    const ids = cards.map(c => c.dataset.jobId);
    const srcIdx = ids.indexOf(todayDragSrc);
    const dstIdx = ids.indexOf(target.dataset.jobId);
    if (srcIdx < 0 || dstIdx < 0) { todayDragSrc = null; return; }
    ids.splice(srcIdx, 1);
    const rect = target.getBoundingClientRect();
    const above = e.clientY < rect.top + rect.height / 2;
    const insertAt = srcIdx < dstIdx ? (above ? dstIdx - 1 : dstIdx) : (above ? dstIdx : dstIdx + 1);
    ids.splice(insertAt, 0, todayDragSrc);
    saveTodayOrder(ids);
    todayDragSrc = null;
    renderMain();
  });

  // touch DnD fallback for iOS
  addTouchDnD(cardContainer, ".today-drag-card", c => c.dataset.jobId, (srcId, dstId, above) => {
    const cards = [...cardContainer.querySelectorAll(".today-drag-card")];
    const ids = cards.map(c => c.dataset.jobId);
    const srcIdx = ids.indexOf(srcId);
    const dstIdx = ids.indexOf(dstId);
    if (srcIdx < 0 || dstIdx < 0) return;
    ids.splice(srcIdx, 1);
    const insertAt = srcIdx < dstIdx ? (above ? dstIdx - 1 : dstIdx) : (above ? dstIdx : dstIdx + 1);
    ids.splice(insertAt, 0, srcId);
    saveTodayOrder(ids);
    renderMain();
  });

  updateNavState();
}

function showAddCardForm() {
  const form = document.getElementById("addCardForm");
  if (!form) return;
  form.classList.toggle("d-none");
  if (form.classList.contains("d-none")) return;
  form.innerHTML = `
    <div class="mb-2">
      <input class="form-control" id="newCardTitle" placeholder="Job title" value="">
    </div>
    <div class="mb-2">
      <textarea class="form-control" id="newCardDesc" placeholder="Description (optional)" rows="2"></textarea>
    </div>
    <div class="d-flex gap-2">
      <button class="btn btn-primary editor-btn" onclick="addTodayCard()">Add</button>
      <button class="btn btn-secondary editor-btn" onclick="document.getElementById('addCardForm').classList.add('d-none')">Cancel</button>
    </div>
  `;
}

function addTodayCard() {
  const title = document.getElementById("newCardTitle").value.trim();
  if (!title) return;
  const desc = document.getElementById("newCardDesc").value.trim();
  const streams = loadStreams();
  let stream = streams.find(t => t.title === "Ad Hoc");
  if (!stream) {
    stream = { title: "Ad Hoc", sequence: streams.length + 1, jobs: [] };
    streams.push(stream);
  }
  const jobs = stream.jobs || [];
  const newJob = { id: "job_" + Date.now(), title, sequence: jobs.length + 1, description: desc, active: true, frequency: "daily" };
  jobs.push(newJob);
  stream.jobs = jobs;
  saveStreams(streams);
  const order = loadTodayOrder() || [];
  const allActive = [];
  streams.forEach(t => { (t.jobs || []).forEach(j => { if (j.active !== false) allActive.push(j.id); }); });
  const remaining = allActive.filter(id => order.includes(id));
  remaining.push(newJob.id);
  saveTodayOrder(remaining);
  renderMain();
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

  document.getElementById("jobsEditor").classList.add("d-none");
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
        <h3 class="mb-0">${isNew ? "Add Stream" : "Edit Stream"}</h3>
      </div>
      <div class="card p-3 card-edited">
        <div class="mb-2">
          <label class="form-label">Title</label>
          <input class="form-control" value="${escapeHtml(data.title || "")}" oninput="editField('title', this.value)">
        </div>
        <div class="mb-2">
          <label class="form-label">Tab</label>
          <select class="form-select" onchange="editField('tab', this.value)">
            <option value="progress" ${(data.tab || "progress") === "progress" ? "selected" : ""}>Progress</option>
            <option value="maintenance" ${data.tab === "maintenance" ? "selected" : ""}>Maintenance</option>
          </select>
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
            <button class="btn btn-outline-primary btn-sm" onclick="openImagePicker(function(name){ editField('image', name); updateStreamImagePreview(name); })">Choose</button>
            ${data.image ? `<button class="btn btn-outline-danger btn-sm" onclick="editField('image','');updateStreamImagePreview(null)">Remove</button>` : ""}
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
    card.innerHTML = `
      <div class="d-flex align-items-center gap-2 mb-2">
        <div class="drag-handle text-secondary" style="cursor:grab;font-size:1.3rem;line-height:1">&#9776;</div>
        <div style="width:40px;height:40px;flex-shrink:0">${streamImgUrl ? `<img src="${streamImgUrl}" class="date-img" style="max-width:40px;max-height:40px">` : ""}</div>
        <div class="fw-bold editor-title">${escapeHtml(t.title)}</div>
        <span class="badge bg-${(t.tab || "progress") === "progress" ? "primary" : "secondary"} ms-auto">${escapeHtml(t.tab || "progress")}</span>
      </div>
      <div class="d-flex gap-2">
        <button class="btn btn-primary editor-btn" onclick="editStream(${realIdx})">Edit</button>
        <button class="btn btn-info editor-btn" onclick="openJobsEditor(${realIdx})">Jobs</button>
        <button class="btn btn-danger editor-btn" onclick="confirmDeleteStream(${realIdx})">Delete</button>
      </div>
    `;
    list.appendChild(card);
  });

    // drag and drop handlers
    let dragSrcIndex = -1;
    list.addEventListener("dragstart", e => {
      const card = e.target.closest(".stream-drag-card");
      if (!card) return;
      dragSrcIndex = parseInt(card.dataset.index);
      card.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    list.addEventListener("dragend", e => {
      document.querySelectorAll(".stream-drag-card").forEach(c => c.classList.remove("dragging", "drag-over-top", "drag-over-bottom"));
    });
    list.addEventListener("dragover", e => {
      e.preventDefault();
      const target = e.target.closest(".stream-drag-card");
      if (!target || dragSrcIndex < 0) return;
      document.querySelectorAll(".stream-drag-card").forEach(c => c.classList.remove("drag-over-top", "drag-over-bottom"));
      const rect = target.getBoundingClientRect();
      target.classList.add(e.clientY < rect.top + rect.height / 2 ? "drag-over-top" : "drag-over-bottom");
    });
    list.addEventListener("drop", e => {
      e.preventDefault();
      document.querySelectorAll(".stream-drag-card").forEach(c => c.classList.remove("drag-over-top", "drag-over-bottom"));
      const target = e.target.closest(".stream-drag-card");
      if (!target || dragSrcIndex < 0) return;
      const dropIndex = parseInt(target.dataset.index);
      if (dropIndex === dragSrcIndex) { dragSrcIndex = -1; return; }
      const streams = loadStreams();
      const [moved] = streams.splice(dragSrcIndex, 1);
      const rect = target.getBoundingClientRect();
      const above = e.clientY < rect.top + rect.height / 2;
      let insertAt;
      if (dragSrcIndex < dropIndex) {
        const actualDropIdx = dropIndex - 1;
        insertAt = above ? actualDropIdx : actualDropIdx + 1;
      } else {
        insertAt = above ? dropIndex : dropIndex + 1;
      }
      streams.splice(insertAt, 0, moved);
      streams.forEach((t, i) => t.sequence = i + 1);
      saveStreams(streams);
      dragSrcIndex = -1;
      renderStreamsEditor();
    });

    // touch DnD fallback for iOS
    addTouchDnD(list, ".stream-drag-card", c => parseInt(c.dataset.index), (srcIdx, dstIdx, above) => {
      if (srcIdx === dstIdx) return;
      const s = loadStreams();
      const [moved] = s.splice(srcIdx, 1);
      let insertAt;
      if (srcIdx < dstIdx) {
        const actualDropIdx = dstIdx - 1;
        insertAt = above ? actualDropIdx : actualDropIdx + 1;
      } else {
        insertAt = above ? dstIdx : dstIdx + 1;
      }
      s.splice(insertAt, 0, moved);
      s.forEach((t, i) => t.sequence = i + 1);
      saveStreams(s);
      renderStreamsEditor();
    });

  topTile.innerHTML = `
    <div class="d-flex gap-2">
      <button class="btn btn-primary editor-btn btn-wide" onclick="addNewStream()">Add Stream</button>
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
function updateJobImagePreview(name) {
  const preview = document.getElementById("jobImagePreview");
  const nameEl = document.getElementById("jobImageName");
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
  const newStream = { title: "New Stream", sequence: seq, description: "", jobs: [], tab: "progress" };
  streams.push(newStream);
  saveStreams(streams);
  editBuffer = JSON.parse(JSON.stringify(newStream));
  editingIndex = streams.length - 1; isNew = true;
  renderStreamsEditor();
  const el = document.getElementById("streamsEditor");
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

// JOBS EDITOR
let jobsStreamIndex = -1;
let jobsEditingIdx = -1;
let jobsBuffer = null;
let isNewJob = false;

function openJobsEditor(streamIdx) {
  jobsEditingIdx = -1; jobsBuffer = null; isNewJob = false;
  jobsStreamIndex = streamIdx;
  document.getElementById("streamsEditorHeader").classList.add("d-none");
  document.getElementById("streamEditorList").classList.add("d-none");
  document.getElementById("addStreamTile").classList.add("d-none");
  document.getElementById("addStreamTileTop").classList.add("d-none");
  document.getElementById("streamEditorFilters").classList.add("d-none");
  document.getElementById("singleStreamEditor").classList.add("d-none");
  document.getElementById("jobsEditor").classList.remove("d-none");
  renderJobsEditor();
}

function closeJobsEditor() {
  document.getElementById("jobsEditor").classList.add("d-none");
  document.getElementById("streamsEditorHeader").classList.remove("d-none");
  document.getElementById("streamEditorList").classList.remove("d-none");
  document.getElementById("addStreamTile").classList.remove("d-none");
  document.getElementById("addStreamTileTop").classList.remove("d-none");
  document.getElementById("streamEditorFilters").classList.remove("d-none");
  jobsStreamIndex = -1; jobsEditingIdx = -1; jobsBuffer = null; isNewJob = false;
  renderStreamsEditor();
}

function renderJobsEditor() {
  const streams = loadStreams();
  const stream = streams[jobsStreamIndex];
  if (!stream) { closeJobsEditor(); return; }

  const jobs = stream.jobs || [];
  const header = document.getElementById("jobsEditorHeader");
  const list = document.getElementById("jobsList");
  const addTile = document.getElementById("addJobTile");
  const topTile = document.getElementById("addJobTileTop");
  const singleEditor = document.getElementById("singleJobEditor");

  list.innerHTML = ""; addTile.innerHTML = ""; topTile.innerHTML = ""; singleEditor.innerHTML = "";

  const streamImgUrl = getImageDataUrl(stream.image);
  document.getElementById("jobsEditorTitle").innerHTML = `Stream: ${streamImgUrl ? `<img src="${streamImgUrl}" class="date-img mx-1" style="max-width:32px;max-height:32px;vertical-align:middle">` : ""}${escapeHtml(stream.title)}`;

  list.classList.remove("d-none"); addTile.classList.remove("d-none");
  topTile.classList.remove("d-none"); singleEditor.classList.add("d-none");

  const sorted = [...jobs].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

  sorted.forEach((j, displayIdx) => {
    const realIdx = jobs.indexOf(j);
    const scheduleText = getScheduleText(j.schedule);
    const jobImgUrl = getImageDataUrl(j.image);
    const card = document.createElement("div");
    card.className = "card p-3 mb-3 stream-drag-card";
    card.draggable = true;
    card.dataset.index = realIdx;
    card.innerHTML = `
      <div class="d-flex align-items-center gap-2">
        <div class="drag-handle text-secondary" style="cursor:grab;font-size:1.3rem;line-height:1">&#9776;</div>
        <div style="width:40px;height:40px;flex-shrink:0">${jobImgUrl ? `<img src="${jobImgUrl}" class="date-img" style="max-width:40px;max-height:40px">` : ""}</div>
        <div class="flex-fill" style="min-width:0">
          <div class="fw-bold editor-title mb-1">${escapeHtml(j.title)}</div>
          <div class="d-flex gap-2 align-items-center small text-secondary">
            <label class="form-check-label mb-0 me-1" style="cursor:pointer">
              <input class="form-check-input active-toggle" type="checkbox" data-job-idx="${realIdx}" ${j.active !== false ? "checked" : ""} style="cursor:pointer">
              Active
            </label>
            <span class="badge bg-primary">${escapeHtml(scheduleText)}</span>
            ${j.sleepUntil ? `<span class="badge bg-info">Sleep: ${escapeHtml(formatDate(j.sleepUntil))}</span>` : ""}
            ${j.time ? `<span class="badge bg-secondary">${escapeHtml(j.time)}</span>` : ""}
          </div>
          ${j.description ? `<div class="mt-1 text-secondary small">${escapeHtml(j.description.substring(0, 80))}${j.description.length > 80 ? "..." : ""}</div>` : ""}
        </div>
        <div class="d-flex gap-2 flex-shrink-0">
          <button class="btn btn-primary editor-btn" onclick="editJob(${realIdx})">Edit</button>
          <button class="btn btn-danger editor-btn" onclick="confirmDeleteJob(${realIdx})">Delete</button>
        </div>
      </div>
    `;
    list.appendChild(card);
  });

  // active toggle handler
  list.querySelectorAll(".active-toggle").forEach(cb => {
    cb.addEventListener("change", function() {
      const idx = parseInt(this.dataset.jobIdx);
      const streams = loadStreams();
      const jobs = streams[jobsStreamIndex].jobs || [];
      if (jobs[idx]) jobs[idx].active = this.checked;
      saveStreams(streams);
      renderJobsEditor();
    });
  });

  // job drag and drop
  let jobDragSrc = -1;
  list.addEventListener("dragstart", e => {
    const card = e.target.closest(".stream-drag-card");
    if (!card) return;
    jobDragSrc = parseInt(card.dataset.index);
    card.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
  });
  list.addEventListener("dragend", e => {
    list.querySelectorAll(".stream-drag-card").forEach(c => c.classList.remove("dragging", "drag-over-top", "drag-over-bottom"));
  });
  list.addEventListener("dragover", e => {
    e.preventDefault();
    const target = e.target.closest(".stream-drag-card");
    if (!target || jobDragSrc < 0) return;
    list.querySelectorAll(".stream-drag-card").forEach(c => c.classList.remove("drag-over-top", "drag-over-bottom"));
    const rect = target.getBoundingClientRect();
    target.classList.add(e.clientY < rect.top + rect.height / 2 ? "drag-over-top" : "drag-over-bottom");
  });
  list.addEventListener("drop", e => {
    e.preventDefault();
    list.querySelectorAll(".stream-drag-card").forEach(c => c.classList.remove("drag-over-top", "drag-over-bottom"));
    const target = e.target.closest(".stream-drag-card");
    if (!target || jobDragSrc < 0) return;
    const dropIndex = parseInt(target.dataset.index);
    if (dropIndex === jobDragSrc) { jobDragSrc = -1; return; }
    const streams = loadStreams();
    const jobs = streams[jobsStreamIndex].jobs || [];
    const [moved] = jobs.splice(jobDragSrc, 1);
    const rect = target.getBoundingClientRect();
    const above = e.clientY < rect.top + rect.height / 2;
    let insertAt;
    if (jobDragSrc < dropIndex) {
      insertAt = above ? dropIndex - 1 : dropIndex;
    } else {
      insertAt = above ? dropIndex : dropIndex + 1;
    }
    jobs.splice(insertAt, 0, moved);
    jobs.forEach((jb, i) => jb.sequence = i + 1);
    streams[jobsStreamIndex].jobs = jobs;
    saveStreams(streams);
    jobDragSrc = -1;
    renderJobsEditor();
  });

  // touch DnD fallback for iOS
  addTouchDnD(list, ".stream-drag-card", c => parseInt(c.dataset.index), (srcIdx, dstIdx, above) => {
    if (srcIdx === dstIdx) return;
    const streams = loadStreams();
    const jobs = streams[jobsStreamIndex].jobs || [];
    const [moved] = jobs.splice(srcIdx, 1);
    let insertAt;
    if (srcIdx < dstIdx) {
      insertAt = above ? dstIdx - 1 : dstIdx;
    } else {
      insertAt = above ? dstIdx : dstIdx + 1;
    }
    jobs.splice(insertAt, 0, moved);
    jobs.forEach((jb, i) => jb.sequence = i + 1);
    streams[jobsStreamIndex].jobs = jobs;
    saveStreams(streams);
    renderJobsEditor();
  });

  topTile.innerHTML = `
    <div class="d-flex gap-2">
      <button class="btn btn-primary editor-btn btn-wide" onclick="addNewJob()">Add Job</button>
      <button class="btn btn-success editor-btn btn-wide ms-auto" onclick="closeJobsEditor()">Done</button>
    </div>
  `;
  updateNavState();
}

function jobField(field, value) {
  if (!jobsBuffer) return;
  jobsBuffer[field] = value;
  if (field === "active") renderJobsEditor();
}
function jobTimeChanged() {
  const h = document.getElementById("jobTimeHour").value;
  const m = document.getElementById("jobTimeMin").value;
  jobField("time", h && m ? h + ":" + m : "");
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getScheduleText(schedule) {
  if (!schedule) return "Every day";
  const s = schedule.type || "daily";
  if (s === "daily") return "Every day";
  if (s === "weekdays") return "Weekdays (Mon\u2013Fri)";
  if (s === "weekends") return "Weekends (Sat\u2013Sun)";
  if (s === "days") {
    const names = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    return (schedule.days || []).map(d => names[d]).join(", ");
  }
  if (s === "monthly") return (schedule.date || 1) + "th of every month";
  return "Every day";
}

let scheduleModalCallback = null;

function openScheduleModal() {
  const s = (jobsBuffer && jobsBuffer.schedule) || { type: "daily" };
  document.querySelectorAll('input[name="scheduleType"]').forEach(r => r.checked = r.value === s.type);
  document.getElementById("schedDaysOptions").classList.toggle("d-none", s.type !== "days");
  document.getElementById("schedMonthlyOptions").classList.toggle("d-none", s.type !== "monthly");
  for (let i = 0; i < 7; i++) {
    document.getElementById("schedDay" + i).checked = (s.days || []).includes(i);
  }
  const mSel = document.getElementById("schedMonthlyDay");
  mSel.innerHTML = "";
  for (let i = 1; i <= 31; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = i;
    if (i === (s.date || 1)) opt.selected = true;
    mSel.appendChild(opt);
  }
  new bootstrap.Modal(document.getElementById("scheduleModal")).show();
}

function closeScheduleModal() {
  const modal = bootstrap.Modal.getInstance(document.getElementById("scheduleModal"));
  if (modal) modal.hide();
}

function onScheduleTypeChange() {
  const val = document.querySelector('input[name="scheduleType"]:checked');
  const type = val ? val.value : "daily";
  document.getElementById("schedDaysOptions").classList.toggle("d-none", type !== "days");
  document.getElementById("schedMonthlyOptions").classList.toggle("d-none", type !== "monthly");
}

function saveScheduleModal() {
  const type = (document.querySelector('input[name="scheduleType"]:checked') || {}).value || "daily";
  let schedule = { type: type };
  if (type === "days") {
    schedule.days = [];
    for (let i = 0; i < 7; i++) {
      if (document.getElementById("schedDay" + i).checked) schedule.days.push(i);
    }
    if (schedule.days.length === 0) schedule = { type: "daily" };
  } else if (type === "monthly") {
    schedule.date = parseInt(document.getElementById("schedMonthlyDay").value, 10) || 1;
  }
  jobField("schedule", schedule);
  const el = document.getElementById("jobScheduleText");
  if (el) el.textContent = getScheduleText(schedule);
  closeScheduleModal();
}

function shouldShowJobToday(job) {
  if (job.sleepUntil) {
    const today = new Date().toISOString().slice(0, 10);
    if (today < job.sleepUntil) return false;
  }
  const s = job.schedule || { type: "daily" };
  const type = s.type || "daily";
  if (type === "daily") return true;
  if (type === "weekdays") { const d = new Date().getDay(); return d >= 1 && d <= 5; }
  if (type === "weekends") { const d = new Date().getDay(); return d === 0 || d === 6; }
  if (type === "days") return (s.days || []).includes(new Date().getDay());
  if (type === "monthly") return new Date().getDate() === (s.date || 1);
  return true;
}

function getJobEditFormHTML(data) {
  return `
    <div class="row mb-1">
      <div class="col">
        <label class="form-label">Title</label>
      </div>
      <div class="col-auto d-flex align-items-center">
        <div class="form-check mb-0">
          <input class="form-check-input" type="checkbox" id="jobActiveCb" ${data.active !== false ? "checked" : ""} onchange="jobField('active', this.checked)">
          <label class="form-check-label" for="jobActiveCb">Active</label>
        </div>
      </div>
    </div>
    <div class="mb-2">
      <input class="form-control" value="${escapeHtml(data.title || "")}" oninput="jobField('title', this.value)">
    </div>
    <div class="mb-2">
      <label class="form-label">Image</label>
      <div class="d-flex align-items-center gap-2">
        <div style="width:50px;height:50px;border:1px solid var(--bs-border-color);border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center;flex-shrink:0" id="jobImagePreview">
          ${getImageDataUrl(data.image) ? `<img src="${getImageDataUrl(data.image)}" class="date-img" style="max-width:50px;max-height:50px">` : `<span class="text-secondary small">none</span>`}
        </div>
        <span class="small text-secondary" id="jobImageName">${escapeHtml(data.image || "")}</span>
        <button class="btn btn-primary btn-sm" onclick="openImagePicker(function(name){ jobField('image', name); updateJobImagePreview(name); })">Choose</button>
        ${data.image ? `<button class="btn btn-danger btn-sm" onclick="jobField('image','');updateJobImagePreview(null)">Remove</button>` : ""}
      </div>
    </div>
    <div class="mb-2">
      <label class="form-label">Description</label>
      <textarea class="form-control" rows="3" oninput="jobField('description', this.value)">${escapeHtml(data.description || "")}</textarea>
    </div>
    <div class="row mb-2">
      <div class="col-auto d-flex align-items-center">
        <div class="form-check mb-0">
          <input class="form-check-input" type="checkbox" id="jobSuffixCb" ${data.suffix ? "checked" : ""} onchange="jobField('suffix', this.checked)">
          <label class="form-check-label" for="jobSuffixCb">Suffix</label>
        </div>
      </div>
      <div class="col">
        <select class="form-select" onchange="jobField('dayType', this.value)">
          <option value="dayOfYear" ${(data.dayType || "dayOfYear") === "dayOfYear" ? "selected" : ""}>Day of Year</option>
          <option value="dayOfMonth" ${data.dayType === "dayOfMonth" ? "selected" : ""}>Day of Month</option>
          <option value="dayOfWeek" ${data.dayType === "dayOfWeek" ? "selected" : ""}>Day of Week</option>
        </select>
      </div>
      <div class="col">
        <select class="form-select" onchange="jobField('mod', this.value)">
          <option value="" ${!data.mod ? "selected" : ""}>None</option>
          <option value="2" ${data.mod === "2" ? "selected" : ""}>2</option>
          <option value="3" ${data.mod === "3" ? "selected" : ""}>3</option>
          <option value="4" ${data.mod === "4" ? "selected" : ""}>4</option>
          <option value="5" ${data.mod === "5" ? "selected" : ""}>5</option>
          <option value="6" ${data.mod === "6" ? "selected" : ""}>6</option>
          <option value="7" ${data.mod === "7" ? "selected" : ""}>7</option>
        </select>
      </div>
    </div>
    <div class="mb-2">
      <label class="form-label">Schedule</label>
      <div class="d-flex align-items-center gap-2">
        <span id="jobScheduleText">${escapeHtml(getScheduleText(data.schedule))}</span>
        <button class="btn btn-primary btn-sm" onclick="openScheduleModal()">Change</button>
      </div>
    </div>
    <div class="row mb-2">
      <div class="col">
        <label class="form-label">Sleep Until</label>
        <input class="form-control" id="jobSleepUntil" value="${escapeHtml(data.sleepUntil || "")}" placeholder="Pick a date">
      </div>
    </div>
    <div class="row mb-2">
      <div class="col">
        <label class="form-label">Schedule Time</label>
        <div class="d-flex gap-2">
          <select class="form-select" id="jobTimeHour" onchange="jobTimeChanged()" style="width:auto">
            <option value="" ${!data.time ? "selected" : ""}>-</option>
            ${Array.from({length: 24}, (_, i) => {
              const h = String(i).padStart(2, "0");
              const cur = data.time ? data.time.split(":")[0] : "";
              return `<option value="${h}" ${cur === h ? "selected" : ""}>${h}</option>`;
            }).join("")}
          </select>
          <span class="align-self-center">:</span>
          <select class="form-select" id="jobTimeMin" onchange="jobTimeChanged()" style="width:auto">
            <option value="" ${!data.time ? "selected" : ""}>-</option>
            <option value="00" ${data.time && data.time.split(":")[1] === "00" ? "selected" : ""}>00</option>
            <option value="15" ${data.time && data.time.split(":")[1] === "15" ? "selected" : ""}>15</option>
            <option value="30" ${data.time && data.time.split(":")[1] === "30" ? "selected" : ""}>30</option>
            <option value="45" ${data.time && data.time.split(":")[1] === "45" ? "selected" : ""}>45</option>
          </select>
        </div>
      </div>
    </div>
  `;
}

function showJobEditModal() {
  if (!jobsBuffer) return;
  const data = jobsBuffer;
  const title = isNewJob ? "Add Job" : "Edit Job";
  document.getElementById("jobEditModalTitle").textContent = title;
  document.getElementById("jobEditModalBody").innerHTML = getJobEditFormHTML(data);
  const fpInput = document.getElementById("jobSleepUntil");
  if (fpInput) {
    if (fpInput._flatpickr) fpInput._flatpickr.destroy();
    flatpickr(fpInput, {
      dateFormat: "Y-m-d",
      allowInput: true,
      monthSelectorType: "dropdown",
      onChange: function(selectedDates, dateStr) {
        jobField("sleepUntil", dateStr);
      }
    });
  }
  new bootstrap.Modal(document.getElementById("jobEditModal")).show();
}

function editJob(index) {
  const streams = loadStreams();
  const jobs = streams[jobsStreamIndex].jobs || [];
  jobsBuffer = JSON.parse(JSON.stringify(jobs[index]));
  if (jobsBuffer.sleepUntil) {
    const today = new Date().toISOString().slice(0, 10);
    if (jobsBuffer.sleepUntil < today) jobsBuffer.sleepUntil = "";
  }
  jobsEditingIdx = index; isNewJob = false;
  renderJobsEditor();
  showJobEditModal();
}

function cancelJobEdit() {
  const modal = bootstrap.Modal.getInstance(document.getElementById("jobEditModal"));
  if (modal) modal.hide();
  if (isNewJob && jobsEditingIdx >= 0) {
    const streams = loadStreams();
    const jobs = streams[jobsStreamIndex].jobs || [];
    jobs.splice(jobsEditingIdx, 1);
    streams[jobsStreamIndex].jobs = jobs;
    saveStreams(streams);
  }
  jobsEditingIdx = -1; jobsBuffer = null; isNewJob = false;
  renderJobsEditor();
}

function doneJobEdit() {
  if (jobsEditingIdx >= 0 && jobsBuffer) {
    const streams = loadStreams();
    const jobs = streams[jobsStreamIndex].jobs || [];
    jobs[jobsEditingIdx] = jobsBuffer;
    streams[jobsStreamIndex].jobs = jobs;
    saveStreams(streams);
  }
  const modal = bootstrap.Modal.getInstance(document.getElementById("jobEditModal"));
  if (modal) modal.hide();
  jobsEditingIdx = -1; jobsBuffer = null; isNewJob = false;
  renderJobsEditor();
}

function confirmDeleteJob(index) {
  jobsEditingIdx = index;
  const modalEl = document.getElementById("deleteConfirmModal");
  document.getElementById("deleteConfirmMessage").textContent = 'Delete this job?';
  document.getElementById("deleteConfirmBtn").onclick = function() {
    const streams = loadStreams();
    const jobs = streams[jobsStreamIndex].jobs || [];
    jobs.splice(index, 1);
    jobs.forEach((j, i) => j.sequence = i + 1);
    streams[jobsStreamIndex].jobs = jobs;
    saveStreams(streams);
    bootstrap.Modal.getInstance(modalEl).hide();
    jobsEditingIdx = -1; jobsBuffer = null; isNewJob = false;
    renderJobsEditor();
  };
  new bootstrap.Modal(modalEl).show();
}

function addNewJob() {
  const streams = loadStreams();
  const jobs = streams[jobsStreamIndex].jobs || [];
  const seq = jobs.length + 1;
  const newJob = { id: "job_" + Date.now(), title: "New Job", sequence: seq, description: "", active: true, frequency: "daily", time: "", sleepUntil: "", schedule: { type: "daily" } };
  jobs.push(newJob);
  streams[jobsStreamIndex].jobs = jobs;
  saveStreams(streams);
  jobsBuffer = JSON.parse(JSON.stringify(newJob));
  jobsEditingIdx = jobs.length - 1; isNewJob = true;
  renderJobsEditor();
  showJobEditModal();
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
