"use client";

import { useEffect, useState } from "react";
import { subscribeUser, unsubscribeUser } from "@/app/actions/push";

// VAPID public key is a base64url string that must be passed to the browser
// as a Uint8Array.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export function PushToggle() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      setSupported(true);
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => setSubscribed(!!sub))
        .catch(() => {});
    }
  }, []);

  async function enable() {
    setError(null);
    if (!VAPID_KEY) {
      setError("Notifications aren't configured on the server yet.");
      return;
    }
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_KEY),
      });
      const res = await subscribeUser(JSON.parse(JSON.stringify(sub)));
      if (!res.ok) throw new Error(res.error);
      setSubscribed(true);
    } catch (e) {
      const denied =
        typeof Notification !== "undefined" && Notification.permission === "denied";
      setError(
        denied
          ? "Notifications are blocked. Enable them in your browser settings."
          : "Couldn't enable notifications. Try again."
      );
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await unsubscribeUser(sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch {
      setError("Couldn't turn off notifications.");
    } finally {
      setBusy(false);
    }
  }

  if (!supported) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={subscribed ? disable : enable}
        disabled={busy}
        aria-pressed={subscribed}
        title={subscribed ? "Booking alerts are on" : "Get notified of new bookings"}
        className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition disabled:opacity-60 ${
          subscribed
            ? "border-sky-border bg-sky-panel text-navy-700 hover:bg-white"
            : "border-navy-700 bg-navy-700 text-white hover:bg-navy-800"
        }`}
      >
        {busy ? "…" : subscribed ? "🔔 Alerts on" : "🔔 Enable alerts"}
      </button>
      {error && (
        <p className="absolute right-0 top-full mt-1 w-56 rounded-md border border-sky-border bg-white p-2 text-xs text-sunset-500 shadow">
          {error}
        </p>
      )}
    </div>
  );
}
