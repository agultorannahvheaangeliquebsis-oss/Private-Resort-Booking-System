import "server-only";
import { Resend } from "resend";
import type { BookingSlot } from "@prisma/client";
import { SLOT_LABELS, slotWindowLabel } from "./booking";
import { formatShortDate, formatTime } from "./dates";

const API_KEY = process.env.RESEND_API_KEY;
// Resend's shared test sender — works without a verified domain, but only
// delivers to the account owner's own inbox. Set EMAIL_FROM once a sending
// domain is verified.
const FROM = process.env.EMAIL_FROM || "onboarding@resend.dev";

let client: Resend | null = null;
function getClient(): Resend | null {
  if (client) return client;
  if (!API_KEY) return null;
  client = new Resend(API_KEY);
  return client;
}

function when(date: string, endDate: string): string {
  return date === endDate
    ? formatShortDate(date)
    : `${formatShortDate(date)} – ${formatShortDate(endDate)}`;
}

function wrap(title: string, bodyLines: string[]): string {
  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
      <h2 style="margin-bottom: 12px;">${title}</h2>
      ${bodyLines.map((l) => `<p style="margin: 4px 0;">${l}</p>`).join("\n")}
      <p style="margin-top: 20px; font-size: 12px; color: #64748b;">
        Fabian&apos;s Azzure Private Resort
      </p>
    </div>
  `;
}

/**
 * Send a transactional email to a guest. Best-effort: never throws — a
 * failed send must not fail the booking action that triggered it.
 */
async function sendGuestEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  try {
    const resend = getClient();
    if (!resend) {
      console.warn("[mailer] RESEND_API_KEY not set — skipping email.");
      return;
    }
    await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
  } catch (err) {
    console.error("[mailer] send failed:", err);
  }
}

export async function sendRequestReceivedEmail(opts: {
  to: string;
  guestName: string;
  reference: string;
  slot: BookingSlot;
  date: string;
  endDate: string;
}): Promise<void> {
  await sendGuestEmail({
    to: opts.to,
    subject: `We received your request · ${opts.reference}`,
    html: wrap(`Thanks, ${opts.guestName}!`, [
      `We received your booking request for <b>${SLOT_LABELS[opts.slot]}</b>, ${when(opts.date, opts.endDate)}.`,
      `Your reference code is <b>${opts.reference}</b> — use it on our status page to check whether it's been confirmed.`,
      `The owner will reach out to confirm your reservation and the exact time.`,
    ]),
  });
}

export async function sendBookingConfirmedEmail(opts: {
  to: string;
  guestName: string;
  reference: string;
  slot: BookingSlot;
  date: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
}): Promise<void> {
  const start = formatTime(opts.startTime);
  const end = formatTime(opts.endTime);
  const time = start && end ? `${start} – ${end}` : slotWindowLabel(opts.slot);

  await sendGuestEmail({
    to: opts.to,
    subject: `Booking confirmed · ${opts.reference}`,
    html: wrap(`You're confirmed, ${opts.guestName}!`, [
      `Your <b>${SLOT_LABELS[opts.slot]}</b> reservation for ${when(opts.date, opts.endDate)} is confirmed.`,
      `Time: <b>${time}</b>`,
      `Reference: <b>${opts.reference}</b>`,
      `We look forward to having you at Fabian&apos;s Azzure!`,
    ]),
  });
}

export async function sendRequestDeclinedEmail(opts: {
  to: string;
  guestName: string;
  reference: string;
  slot: BookingSlot;
  date: string;
  endDate: string;
}): Promise<void> {
  await sendGuestEmail({
    to: opts.to,
    subject: `About your request · ${opts.reference}`,
    html: wrap(`Hi ${opts.guestName},`, [
      `We're sorry — your request for <b>${SLOT_LABELS[opts.slot]}</b>, ${when(opts.date, opts.endDate)} couldn't be accommodated.`,
      `Feel free to check our calendar for other open dates and send a new request.`,
    ]),
  });
}
