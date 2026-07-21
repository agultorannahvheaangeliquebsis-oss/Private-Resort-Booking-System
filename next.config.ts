import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow accessing the dev server from other devices on the LAN (e.g. testing
  // on a phone or iPad). Without this, Next.js blocks the dev-only client JS,
  // so pages render but nothing interactive (buttons, calendar) works.
  allowedDevOrigins: ["192.168.1.4"],

  async headers() {
    return [
      {
        // Never cache the service worker, so notification logic updates roll
        // out immediately instead of being pinned to a stale version.
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
