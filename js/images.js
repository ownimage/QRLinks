let editingImageIndex = -1;
let isNewImage = false;
let editImageBackup = null;
let imageNameSearch = "";
let imagesPage = 0;
let imagesTotalPages = 1;
const IMAGES_PAGE_SIZE = 30;

function loadImages() {
  return JSON.parse(localStorage.getItem("qr_images") || "[]");
}

function saveImages(images) {
  localStorage.setItem("qr_images", JSON.stringify(images));
}

function getImageColors(dataUrl) {
  if (!dataUrl || !dataUrl.startsWith("data:image/svg+xml,")) {
    return { line: "", fill: "", strokeWidth: "" };
  }
  const svgPart = dataUrl.substring("data:image/svg+xml,".length);
  const decoded = decodeURIComponent(svgPart);
  const decodeVal = v => v && v.startsWith("%23") ? "#" + v.substring(3) : v;
  const lineMatch = decoded.match(/\bstroke\s*=\s*["']([^"']+)["']/i);
  const fillMatch = decoded.match(/\bfill\s*=\s*["']([^"']+)["']/i);
  const swMatch = decoded.match(/\bstroke-width\s*=\s*["']([^"']+)["']/i);
  return {
    line: lineMatch ? decodeVal(lineMatch[1]) : "",
    fill: fillMatch ? decodeVal(fillMatch[1]) : "",
    strokeWidth: swMatch ? swMatch[1] : ""
  };
}

function updateSvgColor(dataUrl, attr, newColor) {
  if (!dataUrl || !dataUrl.startsWith("data:image/svg+xml,")) return dataUrl;
  const svgPart = dataUrl.substring("data:image/svg+xml,".length);
  const decoded = decodeURIComponent(svgPart);
  const regex = new RegExp(`\\b${attr}\\s*=\\s*["'][^"']*["']`, 'g');
  const encoded = newColor && newColor.startsWith("#")
    ? newColor
    : newColor || "none";
  const updated = decoded.replace(regex, (m) => {
    const quote = m.includes('"') ? '"' : "'";
    return `${attr}=${quote}${encoded}${quote}`;
  });
  return "data:image/svg+xml," + encodeURIComponent(updated);
}

function renderImagesEditor() {
  const list = document.getElementById("imagesList");
  const topTile = document.getElementById("addImageTileTop");
  const filterEl = document.getElementById("imageFilters");
  const singleEditor = document.getElementById("singleImageEditor");

  list.innerHTML = "";
  topTile.innerHTML = "";
  filterEl.innerHTML = "";
  singleEditor.innerHTML = "";

  const images = loadImages();

  if (editingImageIndex >= 0) {
    list.classList.add("d-none");
    topTile.classList.add("d-none");
    filterEl.classList.add("d-none");
    singleEditor.classList.remove("d-none");

    const img = images[editingImageIndex];
    const hasData = img.data && img.data.length > 0;
    const colors = getImageColors(img.data);
    const lineVal = colors.line !== "none" ? colors.line : (img._prevStroke || "#000000");
    const fillVal = colors.fill !== "none" ? colors.fill : (img._prevFill || "#ffffff");

    const heading = isNewImage ? "Add Image" : "Edit Image";
    singleEditor.innerHTML = `
      <div class="d-flex align-items-center mb-3">
        <h3 class="mb-0">${heading}</h3>
        <button class="btn btn-outline-secondary ms-auto" onclick="cancelImageEdit()">Back</button>
      </div>
      <div class="card p-3 card-edited">
        <div class="row align-items-center">
          <div class="col-auto" style="width:130px;flex:0 0 auto">
            ${hasData
              ? `<img src="${img.data}" class="date-img">`
              : `<div class="date-img d-flex align-items-center justify-content-center text-secondary border rounded">No image</div>`
            }
            <button class="btn btn-primary btn-sm mt-2 w-100 text-nowrap" onclick="openImageUpload(${editingImageIndex})">Upload</button>
          </div>
          <div class="col">
            <input class="form-control" value="${escapeHtml(img.name)}" onchange="editImageField('name', this.value); checkDuplicateName()" oninput="checkDuplicateName()">
            <div id="imageNameError" class="text-danger mt-1" style="display:none">ERROR: There is already an image with this name.</div>
            <div class="d-flex gap-2 mt-2 align-items-center flex-wrap">
              <button class="btn btn-success editor-btn" onclick="doneImageEdit(${editingImageIndex})">OK</button>
              <label class="form-label mb-0">Line:</label>
              <input type="color" value="${lineVal}" oninput="editImageColor(${editingImageIndex}, 'stroke', this.value)">
              <label class="form-check-label mb-0">
                <input type="checkbox" ${colors.line === 'none' || !colors.line ? 'checked' : ''} onchange="editImageStrokeNone(${editingImageIndex}, this.checked)">
                none
              </label>
              <label class="form-label mb-0">Fill:</label>
              <input type="color" value="${fillVal}" oninput="editImageColor(${editingImageIndex}, 'fill', this.value)">
              <label class="form-check-label mb-0">
                <input type="checkbox" ${colors.fill === 'none' || !colors.fill ? 'checked' : ''} onchange="editImageFillNone(${editingImageIndex}, this.checked)">
                none
              </label>
              <label class="form-label mb-0">Width:</label>
              <input type="number" min="0.5" max="10" step="0.5" value="${colors.strokeWidth || '2'}" style="width:60px" class="form-control form-control-sm d-inline-block" oninput="editImageStrokeWidth(${editingImageIndex}, this.value)">
            </div>
          </div>
            <div class="col-auto d-flex align-items-center">
              <button class="btn btn-secondary editor-btn" onclick="cancelImageEdit()">Cancel</button>
            </div>
        </div>
      </div>
    `;

    updateNavState();
    return;
  }

  list.classList.remove("d-none");
  topTile.classList.remove("d-none");
  filterEl.classList.remove("d-none");
  singleEditor.classList.add("d-none");

  const filtered = images.filter((img, index) => {
    if (imageNameSearch && !img.name.toLowerCase().includes(imageNameSearch.toLowerCase())) return false;
    return true;
  }).sort((a, b) => a.name.localeCompare(b.name));

  imagesTotalPages = Math.ceil(filtered.length / IMAGES_PAGE_SIZE) || 1;
  if (imagesPage >= imagesTotalPages) imagesPage = imagesTotalPages - 1;
  const start = imagesPage * IMAGES_PAGE_SIZE;
  const pageItems = filtered.slice(start, start + IMAGES_PAGE_SIZE);

  pageItems.forEach((img) => {
    const card = document.createElement("div");
    card.className = "card p-3 mb-3";
    const colors = getImageColors(img.data);
    card.innerHTML = `
      <div class="row align-items-center">
        <div class="col-auto" style="width:130px;flex:0 0 auto">
          <img src="${img.data}" class="date-img">
        </div>
        <div class="col">
          <div class="mb-1">${escapeHtml(img.name)}</div>
          <div class="d-flex gap-2 align-items-center flex-wrap">
            <button class="btn btn-primary editor-btn" onclick="startEditImage(${images.indexOf(img)})">Edit</button>
            <button class="btn btn-info editor-btn mx-auto" onclick="duplicateImage(${images.indexOf(img)})">Duplicate</button>
            <button class="btn btn-danger editor-btn" onclick="confirmDeleteImage(${images.indexOf(img)})">Delete</button>
          </div>
        </div>
      </div>
    `;
    list.appendChild(card);
  });

  if (imagesTotalPages > 1) {
    const nav = document.createElement("div");
    nav.className = "d-flex justify-content-center align-items-center gap-3 mt-3 mb-2";
    nav.innerHTML = `
      <button class="btn btn-outline-secondary btn-sm" onclick="imagesPage=Math.max(0,imagesPage-1);renderImagesEditor()" ${imagesPage === 0 ? 'disabled' : ''}>Previous</button>
      <span class="text-nowrap">Page ${imagesPage + 1} of ${imagesTotalPages}</span>
      <button class="btn btn-outline-secondary btn-sm" onclick="imagesPage=Math.min(imagesTotalPages-1,imagesPage+1);renderImagesEditor()" ${imagesPage >= imagesTotalPages - 1 ? 'disabled' : ''}>Next</button>
    `;
    list.appendChild(nav);
  }

  topTile.innerHTML = `
    <div class="d-flex gap-2">
      <button class="btn btn-primary editor-btn btn-wide" onclick="addNewImage()">Add Image</button>
      <button class="btn btn-success editor-btn btn-wide ms-auto" onclick="closeImagesEditor()">Done</button>
    </div>
  `;

  filterEl.classList.remove("d-none");
  filterEl.innerHTML = `
    <div class="d-flex gap-2 align-items-center">
      <input class="form-control" type="search" placeholder="Search image names..." value="${escapeHtml(imageNameSearch)}" oninput="setImageNameSearch(this.value)">
      <button class="btn btn-outline-secondary btn-sm" onclick="imageNameSearch='';imagesPage=0;renderImagesEditor()">Clear</button>
    </div>
  `;
  updateNavState();
}

function setImageNameSearch(val) {
  imageNameSearch = val;
  imagesPage = 0;
  renderImagesEditor();
  const input = document.querySelector('#imageFilters input[type="search"]');
  if (input) {
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }
}

function startEditImage(index) {
  const images = loadImages();
  editImageBackup = JSON.parse(JSON.stringify(images[index]));
  editingImageIndex = index;
  isNewImage = false;
  renderImagesEditor();
  checkDuplicateName();
}

function duplicateImage(index) {
  const images = loadImages();
  if (index < 0 || index >= images.length) return;
  const src = images[index];

  let baseName = src.name.replace(/\s*\(\d+\)\s*$/, "").trim();
  const trailingNum = baseName.match(/^(.*?)\s+(\d+)$/);

  const existingNames = new Set(images.map(i => i.name));
  let newName;

  if (trailingNum) {
    const namePart = trailingNum[1];
    let num = parseInt(trailingNum[2], 10);
    while (existingNames.has(`${namePart} ${num + 1}`)) num++;
    newName = `${namePart} ${num + 1}`;
  } else {
    let n = 2;
    while (existingNames.has(`${baseName} ${n}`)) n++;
    newName = `${baseName} ${n}`;
  }

  const copy = JSON.parse(JSON.stringify(src));
  copy.name = newName;
  images.push(copy);
  saveImages(images);

  editingImageIndex = images.length - 1;
  isNewImage = false;
  editImageBackup = JSON.parse(JSON.stringify(copy));
  renderImagesEditor();
}

function editImageField(field, value) {
  const images = loadImages();
  if (editingImageIndex < 0 || editingImageIndex >= images.length) return;
  const trimmed = value.trim();
  if (field === 'name') {
    const oldName = images[editingImageIndex].name;
    if (oldName !== trimmed) {
      images[editingImageIndex].name = trimmed;
      saveImages(images);
      renderImagesEditor();
      return;
    }
  }
  images[editingImageIndex][field] = trimmed;
  saveImages(images);
}

function editImageColor(index, attr, value) {
  const images = loadImages();
  if (index < 0 || index >= images.length) return;
  const img = images[index];
  img.data = updateSvgColor(img.data, attr, value);
  img.lineColor = attr === 'stroke' ? value : img.lineColor;
  img.fillColor = attr === 'fill' ? value : img.fillColor;
  saveImages(images);
  const editedCard = document.querySelector('#singleImageEditor .card.card-edited');
  if (editedCard) {
    const imgEl = editedCard.querySelector('img.date-img');
    if (imgEl) imgEl.src = img.data;
  }
}

function editImageFillNone(index, checked) {
  const images = loadImages();
  if (index < 0 || index >= images.length) return;
  const img = images[index];
  if (checked) {
    const colors = getImageColors(img.data);
    img._prevFill = colors.fill && colors.fill !== "none" ? colors.fill : null;
    img.data = updateSvgColor(img.data, "fill", "none");
    img.fillColor = "none";
  } else {
    const restore = img._prevFill || "#000000";
    img.data = updateSvgColor(img.data, "fill", restore);
    img.fillColor = restore;
  }
  saveImages(images);
  const editedCard = document.querySelector('#singleImageEditor .card.card-edited');
  if (editedCard) {
    const imgEl = editedCard.querySelector('img.date-img');
    if (imgEl) imgEl.src = img.data;
  }
}

function editImageStrokeNone(index, checked) {
  const images = loadImages();
  if (index < 0 || index >= images.length) return;
  const img = images[index];
  if (checked) {
    const colors = getImageColors(img.data);
    img._prevStroke = colors.line && colors.line !== "none" ? colors.line : null;
    img.data = updateSvgColor(img.data, "stroke", "none");
    img.lineColor = "none";
  } else {
    const restore = img._prevStroke || "#000000";
    img.data = updateSvgColor(img.data, "stroke", restore);
    img.lineColor = restore;
  }
  saveImages(images);
  const editedCard = document.querySelector('#singleImageEditor .card.card-edited');
  if (editedCard) {
    const imgEl = editedCard.querySelector('img.date-img');
    if (imgEl) imgEl.src = img.data;
  }
}

function editImageStrokeWidth(index, value) {
  const images = loadImages();
  if (index < 0 || index >= images.length) return;
  const img = images[index];
  if (!img.data || !img.data.startsWith("data:image/svg+xml,")) return;
  const svgPart = img.data.substring("data:image/svg+xml,".length);
  const decoded = decodeURIComponent(svgPart);
  if (/\bstroke-width\s*=/i.test(decoded)) {
    img.data = updateSvgColor(img.data, "stroke-width", value || "2");
  } else {
    const updated = decoded.replace(/^<svg/i, `<svg stroke-width="${value || "2"}"`);
    img.data = "data:image/svg+xml," + encodeURIComponent(updated);
  }
  img.strokeWidth = value;
  saveImages(images);
  const editedCard = document.querySelector('#singleImageEditor .card.card-edited');
  if (editedCard) {
    const imgEl = editedCard.querySelector('img.date-img');
    if (imgEl) imgEl.src = img.data;
  }
}

function normalizeSvgForEditing(svgText) {
  svgText = svgText.replace(/<\?xml[^>]*\?>/g, "").replace(/<!--[\s\S]*?-->/g, "");
  const rootHasStroke = /<svg[^>]*\bstroke\s*=/i.test(svgText);
  const rootHasFill = /<svg[^>]*\bfill\s*=/i.test(svgText);
  const firstStroke = svgText.match(/\bstroke\s*=\s*["']([^"']+)["']/i);
  const firstFill = svgText.match(/\bfill\s*=\s*["']([^"']+)["']/i);
  if (!rootHasStroke) {
    const val = firstStroke ? firstStroke[1] : "currentColor";
    svgText = svgText.replace(/<svg/i, `<svg stroke="${val}"`);
  }
  if (!rootHasFill) {
    const val = firstFill ? firstFill[1] : "none";
    svgText = svgText.replace(/<svg/i, `<svg fill="${val}"`);
  }
  return svgText;
}

function openImageUpload(index) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      const images = loadImages();
      if (index < 0 || index >= images.length) return;
      if (file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg")) {
        const svgText = normalizeSvgForEditing(evt.target.result);
        images[index].data = "data:image/svg+xml," + encodeURIComponent(svgText);
      } else {
        images[index].data = evt.target.result;
      }
      saveImages(images);
      renderImagesEditor();
    };
    if (file.type === "image/svg+xml" || (file.name && file.name.toLowerCase().endsWith(".svg"))) {
      reader.readAsText(file);
    } else {
      reader.readAsDataURL(file);
    }
  };
  input.click();
}

function addNewImage() {
  const images = loadImages();
  const name = "New Image " + (images.length + 1);
  images.push({ name, data: "" });
  saveImages(images);
  imageNameSearch = "";
  editingImageIndex = images.length - 1;
  isNewImage = true;
  renderImagesEditor();
  const editorEl = document.getElementById("imagesEditor");
  if (editorEl) editorEl.scrollIntoView({ behavior: "smooth", block: "start" });
  checkDuplicateName();
}

function checkDuplicateName() {
  const images = loadImages();
  const input = document.querySelector('#singleImageEditor .card-edited input.form-control');
  if (!input) return;
  const trimmed = input.value.trim();
  const hasDuplicate = images.some((img, i) => i !== editingImageIndex && img.name === trimmed);
  const errorEl = document.getElementById("imageNameError");
  const okBtn = document.querySelector('#singleImageEditor .btn-success.editor-btn');
  if (errorEl) errorEl.style.display = hasDuplicate ? "block" : "none";
  if (okBtn) okBtn.disabled = hasDuplicate;
}

function doneImageEdit(index) {
  const images = loadImages();
  if (images.some((img, i) => i !== index && img.name === images[index].name)) return;
  editingImageIndex = -1;
  isNewImage = false;
  editImageBackup = null;
  renderImagesEditor();
}

function cancelImageEdit() {
  if (editingImageIndex >= 0) {
    const images = loadImages();
    if (isNewImage) {
      images.splice(editingImageIndex, 1);
    } else if (editImageBackup) {
      images[editingImageIndex] = editImageBackup;
    }
    saveImages(images);
  }
  editingImageIndex = -1;
  isNewImage = false;
  editImageBackup = null;
  renderImagesEditor();
}

function confirmDeleteImage(index) {
  const images = loadImages();
  const name = images[index].name;

  const modalEl = document.getElementById("deleteConfirmModal");
  document.getElementById("deleteConfirmMessage").innerHTML =
    `Delete image "<strong>${escapeHtml(name)}</strong>"?`;
  document.getElementById("deleteConfirmBtn").onclick = function() {
    bootstrap.Modal.getInstance(modalEl).hide();
    deleteImage(index);
  };
  new bootstrap.Modal(modalEl).show();
}

function deleteImage(index) {
  const images = loadImages();
  images.splice(index, 1);
  saveImages(images);
  renderImagesEditor();
}

function openImagesEditor() {
  document.getElementById("countdownContainer").classList.add("d-none");
  document.getElementById("streamsEditor").classList.add("d-none");
  document.getElementById("settingsPage").classList.add("d-none");
  document.getElementById("imagesEditor").classList.remove("d-none");
  imagesPage = 0;
  renderImagesEditor();
}

function closeImagesEditor() {
  document.getElementById("imagesEditor").classList.add("d-none");
  document.getElementById("countdownContainer").classList.remove("d-none");
  editingImageIndex = -1;
  isNewImage = false;
  editImageBackup = null;
  renderMain();
}

function getImageByName(name) {
  if (!name) return null;
  const images = loadImages();
  return images.find(i => i.name === name) || null;
}
function getImageDataUrl(name) {
  const img = getImageByName(name);
  return img ? img.data : null;
}

let imagePickerCallback = null;
let imagePickerSearch = "";

function openImagePicker(callback) {
  imagePickerCallback = callback;
  imagePickerSearch = "";
  const modalEl = document.getElementById("imagePickerModal");
  modalEl.addEventListener("hidden.bs.modal", function onHide() {
    modalEl.removeEventListener("hidden.bs.modal", onHide);
    imagePickerCallback = null;
    imagePickerSearch = "";
  });
  new bootstrap.Modal(modalEl).show();
  renderImagePicker();
  setTimeout(() => {
    const input = modalEl.querySelector(".image-picker-search");
    if (input) { input.focus(); input.value = ""; }
  }, 200);
}

function closeImagePicker() {
  const modalEl = document.getElementById("imagePickerModal");
  const modal = bootstrap.Modal.getInstance(modalEl);
  if (modal) modal.hide();
  imagePickerCallback = null;
  imagePickerSearch = "";
}

function renderImagePicker() {
  const modal = document.getElementById("imagePickerModal");
  const list = modal.querySelector(".image-picker-list");
  list.innerHTML = "";

  const images = loadImages();
  const filtered = images.filter(img => {
    if (imagePickerSearch && !img.name.toLowerCase().includes(imagePickerSearch.toLowerCase())) return false;
    return true;
  }).sort((a, b) => a.name.localeCompare(b.name));

  if (filtered.length === 0) {
    list.innerHTML = `<div class="text-secondary w-100 text-center py-4">${imagePickerSearch ? "No images match your search." : "No images available."}</div>`;
    return;
  }

  filtered.forEach(img => {
    const item = document.createElement("div");
    item.className = "image-picker-item text-center";
    item.style.cssText = "width:95px;cursor:pointer;border:2px solid transparent;border-radius:8px;padding:6px;transition:border-color 0.15s";
    item.innerHTML = `<img src="${img.data}" class="date-img" style="width:64px;height:64px;object-fit:contain;display:block;margin:0 auto"><div style="font-size:0.75rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:4px">${escapeHtml(img.name)}</div>`;
    item.onclick = () => { selectImagePickerItem(img.name); };
    item.onmouseenter = () => { item.style.borderColor = "var(--bs-primary)"; };
    item.onmouseleave = () => { item.style.borderColor = "transparent"; };
    list.appendChild(item);
  });
}

function selectImagePickerItem(name) {
  if (imagePickerCallback) imagePickerCallback(name);
  closeImagePicker();
}

function filterImagePicker(val) {
  imagePickerSearch = val;
  renderImagePicker();
}

function clearImagePickerFilter() {
  imagePickerSearch = "";
  const input = document.querySelector(".image-picker-search");
  if (input) input.value = "";
  renderImagePicker();
}

function seedSampleImages() {
  if (localStorage.getItem("qr_images")) return;
  fetch("sampleImages.json?v=" + (typeof BUILD_NUMBER !== "undefined" ? BUILD_NUMBER : Date.now()))
    .then(res => res.json())
    .then(data => {
      if (data && data.images) {
        saveImages(data.images);
      }
    })
    .catch(() => {});
}

function showUploadDialog() {
  let dlg = document.getElementById("uploadProgressDialog");
  if (!dlg) {
    dlg = document.createElement("div");
    dlg.id = "uploadProgressDialog";
    dlg.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center";
    dlg.innerHTML = '<div style="background:var(--bs-body-bg,#1e1e1e);padding:2rem;border-radius:12px;text-align:center;min-width:200px;box-shadow:0 8px 32px rgba(0,0,0,0.3)">'
      + '<div class="spinner-border mb-3" role="status"></div>'
      + '<div>Uploading Standard Images…</div></div>';
    document.body.appendChild(dlg);
  }
  dlg.classList.remove("d-none");
}

function hideUploadDialog() {
  const dlg = document.getElementById("uploadProgressDialog");
  if (dlg) dlg.classList.add("d-none");
}

function uploadStandardImages() {
  showUploadDialog();
  fetch("sampleImages.json?v=" + (typeof BUILD_NUMBER !== "undefined" ? BUILD_NUMBER : Date.now()))
    .then(res => res.json())
    .then(data => {
      if (!data || !data.images) return;
      const existing = loadImages();
      const existingNames = new Set(existing.map(img => img.name));
      let added = 0;
      data.images.forEach(img => {
        if (!existingNames.has(img.name)) {
          existing.push(img);
          existingNames.add(img.name);
          added++;
        }
      });
      if (added > 0) {
        saveImages(existing);
        renderImagesEditor();
      }
    })
    .catch(() => {})
    .finally(() => hideUploadDialog());
}