import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VioEdu",
  description: "Lịch học VioEdu theo nhóm",
  manifest: "/manifest.webmanifest",
};

// viewportFit "cover" is what makes env(safe-area-inset-*) resolve to a real
// value on iPhone; without it the bottom nav sits under the home indicator.
export const viewport: Viewport = {
  themeColor: "#4f46e5",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
