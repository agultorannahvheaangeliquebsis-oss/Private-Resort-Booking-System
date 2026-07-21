import type { MetadataRoute } from "next";

// Web app manifest — makes the site installable to a phone home screen.
// See node_modules/next/dist/docs/.../metadata/manifest.md
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fabian's Azzure — Booking",
    short_name: "Azzure",
    description:
      "Reservation and availability management for Fabian's Azzure Private Resort.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0f4c81",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
