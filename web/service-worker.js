self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open("messenger-cache").then((cache) => {
      return cache.addAll([
        "/",
        "/static/index.html",
        "/favicon/favicon.ico",
        "/favicon/favicon.svg",
        "/favicon/apple-touch-icon.png",
        "/favicon/favicon-96x96.png",
        "/static/js/main.js",
        "/static/js/messages.js",
        "/static/js/socket.js",
        "/static/js/auth.js",
        "/static/styles.css",
      ]);
    })
  );
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});
