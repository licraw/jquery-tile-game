import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-figtree"
});

export const metadata: Metadata = {
  title: {
    default: "Soft Arcade",
    template: "%s | Soft Arcade"
  },
  description: "Soft Arcade is a growing collection of small, polished browser games.",
  metadataBase: new URL("https://softarcadegames.com"),
  other: {
    "google-adsense-account": "ca-pub-3807807572005100"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={figtree.variable}>
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3807807572005100"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
