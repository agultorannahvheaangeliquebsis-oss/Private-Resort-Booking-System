"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Shape the browser's PushSubscription serializes to (via JSON.stringify).
export type SerializedSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

/** Persist (or refresh) the current user's device push subscription. */
export async function subscribeUser(sub: SerializedSubscription) {
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: "Not signed in." };

  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return { ok: false as const, error: "Invalid subscription." };
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: {
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      userId: session.user.id,
    },
    update: {
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      userId: session.user.id,
    },
  });

  return { ok: true as const };
}

/** Remove a device subscription (on unsubscribe). */
export async function unsubscribeUser(endpoint: string) {
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: "Not signed in." };

  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
  return { ok: true as const };
}
