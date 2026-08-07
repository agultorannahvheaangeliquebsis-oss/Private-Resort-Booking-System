import "server-only";

// Unambiguous alphabet: no 0/O or 1/I, so a guest reading it aloud over the
// phone (or typing it on a small screen) can't confuse similar characters.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const LENGTH = 7;

/** A short, guest-facing booking code, e.g. "K7XM3PQ". Not cryptographic — just unguessable enough for a small resort's volume. */
export function generateReference(): string {
  let out = "";
  for (let i = 0; i < LENGTH; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}
