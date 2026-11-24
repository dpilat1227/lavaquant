import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { CARD_ALT, CARD_PATH, DESCRIPTION, TITLE } from "@/lib/siteMeta";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://quant.drew.fun"),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    siteName: "LavaQuant",
    images: [{ url: CARD_PATH, width: 1200, height: 630, type: "image/png", alt: CARD_ALT }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: CARD_PATH, width: 1200, height: 630, alt: CARD_ALT }],
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased h-full`}>
        {children}
      </body>
    </html>
  );
}
