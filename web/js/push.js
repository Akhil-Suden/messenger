const publicKey =
  "BDO_EqRry3_K84zYCcDgJlpUkJ17HzSgoaqIj9zg8I1x90Cy2yUlTWAP66LFt_Rh7OYn1FJc1HJr1IRP1F0gQIg";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export async function subscribeUser() {
  if ("serviceWorker" in navigator && "PushManager" in window) {
    try {
      // Register the service worker
      const reg = await navigator.serviceWorker.register("/service-worker.js");

      // Wait until the service worker is ready and controlling the page
      const swReg = await navigator.serviceWorker.ready;

      // Check if already subscribed
      const existingSubscription = await swReg.pushManager.getSubscription();
      if (existingSubscription) {
        console.log("Already subscribed to push notifications");
        return;
      }

      // Subscribe the user
      const newSubscription = await swReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // Send to server
      const token = localStorage.getItem("token");
      await fetch("/api/subscribe", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newSubscription),
      });

      console.log("Push subscription successful");
    } catch (error) {
      console.error("Subscription failed:", error);
    }
  } else {
    console.warn("Push messaging is not supported.");
  }
}
