import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fabian's Azzure — Booking Dashboard",
  description:
    "Reservation and availability management for Fabian's Azzure Private Resort.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={poppins.variable}>
      <body className="brand-app-bg min-h-screen font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
