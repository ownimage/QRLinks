const BUILD_NUMBER = "202607062100";

const CACHE = "qrlinks-" + BUILD_NUMBER;

const PRECACHE_URLS = [
  ".",
  "index.html",
  "manifest.json",
  "icon.svg",
  "sampleImages.json",
  "sampleLinks.json",
  "css/styles.css",
  "js/settings.js",
  "js/app.js",
  "js/images.js"
];

const CDN_CACHE = "qrlinks-cdn-v1";

const THEME_CACHE_PREFIX = "qrlinks-theme-";

const BOOTSWATCH_BASE = "https://cdn.jsdelivr.net/npm/bootswatch@5.3.3/dist/";

const PRECACHE_CDN = [
  "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js",
  "https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.js",
  "https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.css",
  "https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"
];

const ALL_THEMES = ["cerulean","cosmo","cyborg","darkly","flatly","journal","litera","lumen","lux","materia","minty","morph","pulse","quartz","sandstone","simplex","sketchy","slate","solar","spacelab","superhero","united","vapor","yeti","zephyr"];

function isBootswatchTheme(url) {
  return url.startsWith(BOOTSWATCH_BASE) && url.endsWith("/bootstrap.min.css");
}

function themeNameFromUrl(url) {
  if (!isBootswatchTheme(url)) return null;
  const parts = url.replace(BOOTSWATCH_BASE, "").split("/");
  return parts[0];
}

function getThemeCacheName(theme) {
  return THEME_CACHE_PREFIX + theme;
}

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE_URLS)).then(() => {
      return caches.open(CDN_CACHE).then(cache => {
        return Promise.allSettled(PRECACHE_CDN.map(url =>
          cache.add(url).catch(() => {})
        ));
      });
    }).then(() => {
      return Promise.allSettled(ALL_THEMES.map(theme =>
        caches.open(getThemeCacheName(theme)).then(cache =>
          cache.add(BOOTSWATCH_BASE + theme + "/bootstrap.min.css").catch(() => {})
        )
      ));
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      const activePrefixes = [CACHE, CDN_CACHE, THEME_CACHE_PREFIX];
      return Promise.all(
        keys.filter(k => !activePrefixes.some(p => k === p || k.startsWith(p)))
              .map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const url = event.request.url;
  const req = event.request;
  if (req.method !== "GET") return;

  if (isBootswatchTheme(url)) {
    const theme = themeNameFromUrl(url);
    event.respondWith(
      caches.open(getThemeCacheName(theme)).then(cache => {
        return cache.match(url).then(cached => {
          const fetchPromise = fetch(req).then(response => {
            if (response && response.status === 200) {
              cache.put(url, response.clone());
            }
            return response;
          }).catch(() => cached);
          return cached || fetchPromise;
        });
      })
    );
    return;
  }

  if (url.startsWith("https://cdn.")) {
    event.respondWith(
      caches.open(CDN_CACHE).then(cache => {
        return cache.match(url).then(cached => {
          const fetchPromise = fetch(req).then(response => {
            if (response && response.status === 200) {
              cache.put(url, response.clone());
            }
            return response;
          }).catch(() => cached);
          return cached || fetchPromise;
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE).then(cache => {
      return cache.match(req).then(cached => {
        const fetchPromise = fetch(req).then(response => {
          if (response && response.status === 200) {
            cache.put(req, response.clone());
          }
          return response;
        }).catch(() => cached);
        return cached || fetchPromise;
      });
    })
  );
});