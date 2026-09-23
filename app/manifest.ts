import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VioEdu",
    short_name: "VioEdu",
    description: "Quản lý lịch học theo nhóm và học sinh",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f7fb",
    theme_color: "#4f46e5",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // The glyph sits well inside the safe zone, so the same art works masked.
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
