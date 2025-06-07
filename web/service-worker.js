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

self.addEventListener("install", (event) => {
  console.log("Service Worker installing...");
  // Perform install steps
  event.waitUntil(self.skipWaiting()); // Ensures the service worker activates immediately
});

self.addEventListener("activate", (event) => {
  console.log("Service Worker activated.");
  event.waitUntil(self.clients.claim()); // Makes the service worker take control immediately
});

self.addEventListener("push", function (event) {
  let title = "New Message";
  let options = {
    body: "You have a new message.",
    icon: "/favicon/favicon.svg",
    tag: "message-" + Date.now(),
  };

  if (event.data) {
    try {
      const data = event.data.json();
      title = data.Sender.Username || title;
      options.body = data.Content || options.body;
      options.icon = data.icon || options.icon;
    } catch (e) {
      console.error("Failed to parse push data as JSON:", e);
      options.body = event.data.text(); // Fallback to raw text
    }
  }

  event.waitUntil(self.registration.showNotification(title, options));

  console.log("Push event received:", event);
});
