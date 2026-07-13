const themeConfig = (() => {
  const bw = "https://cdn.jsdelivr.net/npm/bootswatch@5.3.3/dist";
  return {
    cerulean:  { css: `${bw}/cerulean/bootstrap.min.css`,   bsTheme: "light" },
    cosmo:     { css: `${bw}/cosmo/bootstrap.min.css`,      bsTheme: "light" },
    cyborg:    { css: `${bw}/cyborg/bootstrap.min.css`,     bsTheme: "dark" },
    darkly:    { css: `${bw}/darkly/bootstrap.min.css`,     bsTheme: "dark" },
    flatly:    { css: `${bw}/flatly/bootstrap.min.css`,     bsTheme: "light" },
    journal:   { css: `${bw}/journal/bootstrap.min.css`,    bsTheme: "light" },
    litera:    { css: `${bw}/litera/bootstrap.min.css`,     bsTheme: "light" },
    lumen:     { css: `${bw}/lumen/bootstrap.min.css`,      bsTheme: "light" },
    lux:       { css: `${bw}/lux/bootstrap.min.css`,        bsTheme: "light" },
    materia:   { css: `${bw}/materia/bootstrap.min.css`,    bsTheme: "light" },
    minty:     { css: `${bw}/minty/bootstrap.min.css`,      bsTheme: "light" },
    morph:     { css: `${bw}/morph/bootstrap.min.css`,      bsTheme: "light" },
    pulse:     { css: `${bw}/pulse/bootstrap.min.css`,      bsTheme: "light" },
    quartz:    { css: `${bw}/quartz/bootstrap.min.css`,     bsTheme: "light" },
    sandstone: { css: `${bw}/sandstone/bootstrap.min.css`,  bsTheme: "light" },
    simplex:   { css: `${bw}/simplex/bootstrap.min.css`,    bsTheme: "light" },
    sketchy:   { css: `${bw}/sketchy/bootstrap.min.css`,    bsTheme: "light" },
    slate:     { css: `${bw}/slate/bootstrap.min.css`,      bsTheme: "dark" },
    solar:     { css: `${bw}/solar/bootstrap.min.css`,      bsTheme: "dark" },
    spacelab:  { css: `${bw}/spacelab/bootstrap.min.css`,   bsTheme: "light" },
    superhero: { css: `${bw}/superhero/bootstrap.min.css`,  bsTheme: "dark" },
    united:    { css: `${bw}/united/bootstrap.min.css`,     bsTheme: "light" },
    vapor:     { css: `${bw}/vapor/bootstrap.min.css`,      bsTheme: "dark" },
    yeti:      { css: `${bw}/yeti/bootstrap.min.css`,       bsTheme: "light" },
    zephyr:    { css: `${bw}/zephyr/bootstrap.min.css`,     bsTheme: "light" }
  };
})();

function applyTheme(name) {
  const config = themeConfig[name] || themeConfig.darkly;
  const link = document.getElementById("bootstrap-theme-css");
  if (link) link.href = config.css;
  document.documentElement.setAttribute("data-bs-theme", config.bsTheme);
  localStorage.setItem("qr_theme", name);
}

function changeTheme(name) {
  applyTheme(name);
}

// FONT SIZE
function changeFontSize(value) {
  localStorage.setItem("qr_fontSize", value);
  document.body.classList.remove("font-size-xsmall", "font-size-small", "font-size-normal", "font-size-large", "font-size-xlarge", "font-size-jumbo");
  if (value !== "normal") {
    document.body.classList.add("font-size-" + value);
  }
}

// ICON SIZE
function changeIconSize(value) {
  localStorage.setItem("qr_iconSize", value);
  document.body.classList.remove("icon-size-small", "icon-size-medium", "icon-size-large");
  document.body.classList.add("icon-size-" + value);
}

// TILE DENSITY
function changeDensity(value) {
  localStorage.setItem("qr_density", value);
  document.body.classList.remove("compact", "density-normal");
  if (value !== "normal") {
    document.body.classList.add(value);
  }
}

function changeShowDanger(enabled) {
  localStorage.setItem("qr_showDanger", enabled);
  ["clearAllDataRow", "refreshAppRow", "loadSampleLinksRow", "uploadStandardImagesRow"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle("d-none", !enabled);
  });
}

// AUTO-HIDE MENU
let autoHideTimer = null;
let autoHideCooldown = false;

function showNav() {
  const nav = document.getElementById("mainNav");
  if (nav) nav.classList.remove("nav-hidden");
}

function hideNav() {
  const nav = document.getElementById("mainNav");
  if (!nav) return;
  if (document.getElementById("settingsPage").classList.contains("d-none") &&
      document.getElementById("streamsEditor").classList.contains("d-none") &&
      document.getElementById("imagesEditor").classList.contains("d-none")) {
    nav.classList.add("nav-hidden");
    autoHideCooldown = true;
    setTimeout(() => { autoHideCooldown = false; }, 600);
  }
}

function resetAutoHideTimer() {
  if (autoHideCooldown) return;
  const enabled = localStorage.getItem("qr_autoHideMenu") === "true";
  if (!enabled) return;
  showNav();
  clearTimeout(autoHideTimer);
  autoHideTimer = setTimeout(hideNav, 4000);
}

let autoHideEventsBound = false;
const autoHideEvents = ["pointerdown", "pointerup", "touchstart", "click", "mousedown"];

function bindAutoHideEvents() {
  if (autoHideEventsBound) return;
  autoHideEvents.forEach(evt => {
    document.addEventListener(evt, resetAutoHideTimer, { passive: true });
    document.body.addEventListener(evt, resetAutoHideTimer, { passive: true });
  });
  window.addEventListener("scroll", resetAutoHideTimer, { passive: true });
  autoHideEventsBound = true;
}

function unbindAutoHideEvents() {
  if (!autoHideEventsBound) return;
  autoHideEvents.forEach(evt => {
    document.removeEventListener(evt, resetAutoHideTimer);
    document.body.removeEventListener(evt, resetAutoHideTimer);
  });
  window.removeEventListener("scroll", resetAutoHideTimer);
  autoHideEventsBound = false;
}

function changeAutoHideMenu(enabled) {
  localStorage.setItem("qr_autoHideMenu", enabled);
  document.body.classList.toggle("auto-hide-menu", enabled);
  if (enabled) {
    bindAutoHideEvents();
    resetAutoHideTimer();
  } else {
    unbindAutoHideEvents();
    clearTimeout(autoHideTimer);
    document.getElementById("mainNav").classList.remove("nav-hidden");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const savedFontSize = localStorage.getItem("qr_fontSize") || "xlarge";
  if (savedFontSize !== "normal") {
    document.body.classList.add("font-size-" + savedFontSize);
  }

  const savedIconSize = localStorage.getItem("qr_iconSize") || "large";
  document.body.classList.add("icon-size-" + savedIconSize);

  const savedDensity = localStorage.getItem("qr_density") || "normal";
  if (savedDensity !== "normal") {
    document.body.classList.add(savedDensity);
  }

  const autoHide = localStorage.getItem("qr_autoHideMenu") === "true";
  if (autoHide) {
    document.body.classList.add("auto-hide-menu");
    bindAutoHideEvents();
    resetAutoHideTimer();
  }
});
