import apiClient from "../api/client";

/**
 * Converts a base64 VAPID key to a Uint8Array for the Push API.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if the browser supports push notifications.
 */
export function isPushSupported(): boolean {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Get the current notification permission status.
 */
export function getPermissionStatus(): NotificationPermission {
  if (!("Notification" in window)) return "denied";
  return Notification.permission;
}

/**
 * Request notification permission from the user.
 * Returns the permission result.
 */
export async function requestPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return "denied";
  return Notification.requestPermission();
}

/**
 * Register the service worker and subscribe to push notifications.
 *
 * Flow:
 * 1. Register the service worker (public/sw.js)
 * 2. Fetch the VAPID public key from the backend
 * 3. Subscribe to push via the Push API
 * 4. Send the subscription to the backend for storage
 */
export async function subscribeToPush(): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    /* Step 1: Register service worker */
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    /* Step 2: Get VAPID key from backend */
    const { data } = await apiClient.get<{ vapid_public_key: string }>(
      "/notifications/vapid-key",
    );

    if (!data.vapid_public_key) {
      console.warn("VAPID public key not configured on server");
      return false;
    }

    /* Step 3: Subscribe to push */
    const applicationServerKey = urlBase64ToUint8Array(data.vapid_public_key);
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as BufferSource,
      });
    }

    /* Step 4: Send subscription to backend */
    const subJson = subscription.toJSON();
    await apiClient.post("/notifications/subscribe", {
      endpoint: subJson.endpoint,
      p256dh: subJson.keys?.p256dh ?? "",
      auth: subJson.keys?.auth ?? "",
    });

    return true;
  } catch (error) {
    console.error("Push subscription failed:", error);
    return false;
  }
}

/**
 * Unsubscribe from push notifications.
 *
 * Removes the subscription from the browser and notifies the backend.
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return false;

    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return false;

    /* Unsubscribe from browser */
    await subscription.unsubscribe();

    /* Notify backend */
    await apiClient.delete("/notifications/unsubscribe", {
      data: { endpoint: subscription.endpoint },
    });

    return true;
  } catch (error) {
    console.error("Push unsubscription failed:", error);
    return false;
  }
}
