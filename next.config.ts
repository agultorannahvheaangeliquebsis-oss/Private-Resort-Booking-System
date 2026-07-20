import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow accessing the dev server from other devices on the LAN (e.g. testing
  // on a phone or iPad). Without this, Next.js blocks the dev-only client JS,
  // so pages render but nothing interactive (buttons, calendar) works.
  allowedDevOrigins: ["192.168.1.4"],
};

export default nextConfig;
