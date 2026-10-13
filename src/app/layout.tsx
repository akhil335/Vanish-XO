import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#06080d",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Vanish XO - Free Online Tic Tac Toe with a Twist",
  description:
    "Play Vanish XO online – a high-energy neon tactical twist on Tic-Tac-Toe where each player can only have 3 marks. Placing a 4th mark makes your oldest mark vanish. No draws!",
  keywords: [
    "Vanish XO",
    "Tic Tac Toe with a twist",
    "vanishing tic tac toe",
    "memory tic tac toe",
    "3 mark tic tac toe",
    "online neon game",
    "tactical tic tac toe",
  ],
  authors: [{ name: "Vanish XO Team" }],
  openGraph: {
    title: "Vanish XO - Free Online Tic Tac Toe with a Twist",
    description:
      "A fast-paced neon twist on Tic-Tac-Toe: you only get 3 marks. Place a 4th and your oldest vanishes. Zero draws, pure tactics!",
    type: "website",
    locale: "en_US",
    siteName: "Vanish XO",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vanish XO - Free Online Tic Tac Toe with a Twist",
    description:
      "A fast-paced neon twist on Tic-Tac-Toe: you only get 3 marks. Place a 4th and your oldest vanishes. Zero draws, pure tactics!",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-[#06080d] text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200">
        {children}
      </body>
    </html>
  );
}
