import "server-only";
import webpush from "web-push";
import { prisma } from "@/lib/prisma";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
// Contact address the push service can reach if there's a problem with our
// requests. Configured via env (see .env / Vercel), never hardcoded.
const CONTACT = process.env.VAPID_SUBJECT || "mailto:no-reply@localhost";

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  if (!PUBLIC_KEY || !PRIVATE_KEY) return false;
  webpush.setVapidDetails(CONTACT, PUBLIC_KEY, PRIVATE_KEY);
  configured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

/**
 * Send a push notification to every ADMIN who has enabled notifications.
 * Best-effort: never throws — callers (e.g. booking creation) must not fail
 * because a notification could not be delivered. Dead subscriptions (410/404)
 * are pruned automatically.
 */
export async function notifyAdmins(payload: PushPayload): Promise<void> {
  try {
    if (!ensureConfigured()) {
      console.warn("[push] VAPID keys not set — skipping notification.");
      return;
    }

    const subs = await prisma.pushSubscription.findMany({
      where: { user: { role: "ADMIN" } },
    });
    if (subs.length === 0) return;

    const body = JSON.stringify(payload);

    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body
          );
        } catch (err: unknown) {
          const status =
            typeof err === "object" && err !== null && "statusCode" in err
              ? (err as { statusCode?: number }).statusCode
              : undefined;
          // 404/410 mean the subscription is dead — remove it.
          if (status === 404 || status === 410) {
            await prisma.pushSubscription
              .deleteMany({ where: { endpoint: s.endpoint } })
              .catch(() => {});
          } else {
            console.error("[push] send failed:", err);
          }
        }
      })
    );
  } catch (err) {
    console.error("[push] notifyAdmins error:", err);
  }
}
