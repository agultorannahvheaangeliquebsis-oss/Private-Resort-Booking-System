"use server";

import Anthropic from "@anthropic-ai/sdk";
import type { BookingSlot } from "@prisma/client";
import { BOOKING_SLOTS } from "@/lib/booking";
import { todayKey } from "@/lib/dates";

export type ParsedBooking = {
  guestName: string | null;
  checkInDate: string | null; // "YYYY-MM-DD"
  checkOutDate: string | null; // "YYYY-MM-DD"
  timeSlot: BookingSlot | null;
  numberOfGuests: number | null;
};

export type ParseBookingState =
  | { ok: true; data: ParsedBooking }
  | { ok: false; error: string };

const SCHEMA = {
  type: "object",
  properties: {
    guestName: { anyOf: [{ type: "string" }, { type: "null" }] },
    checkInDate: {
      anyOf: [
        { type: "string", description: "ISO date, YYYY-MM-DD" },
        { type: "null" },
      ],
    },
    checkOutDate: {
      anyOf: [
        { type: "string", description: "ISO date, YYYY-MM-DD" },
        { type: "null" },
      ],
    },
    timeSlot: {
      anyOf: [{ type: "string", enum: BOOKING_SLOTS }, { type: "null" }],
    },
    numberOfGuests: { anyOf: [{ type: "integer" }, { type: "null" }] },
  },
  required: [
    "guestName",
    "checkInDate",
    "checkOutDate",
    "timeSlot",
    "numberOfGuests",
  ],
  additionalProperties: false,
} as const;

const client = new Anthropic();

export async function parseBookingInquiry(
  text: string
): Promise<ParseBookingState> {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Paste the guest's message first." };

  let response;
  try {
    response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: SCHEMA },
      },
      system:
        `Extract resort booking details from a guest inquiry, usually pasted from a Facebook Messenger chat. ` +
        `Today's date is ${todayKey()} (Asia/Manila). Resolve relative or partial dates ` +
        `("this Saturday", "July 25", "next weekend") against today, picking the nearest ` +
        `future occurrence when the year is not stated. ` +
        `"timeSlot" is one of DAY (day tour), NIGHT (evening into next morning), or OVERNIGHT ` +
        `(afternoon check-in to next-day checkout) — infer it from wording like "overnight", ` +
        `"day tour", or explicit times; a multi-day stay is always OVERNIGHT. ` +
        `If a field is missing, ambiguous, or not stated in the text, return null for it — ` +
        `never guess or invent a value.`,
      messages: [{ role: "user", content: trimmed }],
    });
  } catch (error) {
    console.error("parseBookingInquiry: Anthropic API call failed", error);
    const message =
      error instanceof Anthropic.AuthenticationError
        ? "The AI parser isn't configured (missing or invalid API key). Please fill in the form manually."
        : "Couldn't reach the parser right now. Please fill in the form manually.";
    return { ok: false, error: message };
  }

  if (response.stop_reason === "refusal") {
    return { ok: false, error: "Couldn't parse that message. Please fill in the form manually." };
  }

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    return { ok: false, error: "Got an unexpected response. Please fill in the form manually." };
  }

  try {
    const data = JSON.parse(block.text) as ParsedBooking;
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Couldn't parse that message. Please fill in the form manually." };
  }
}
