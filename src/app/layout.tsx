import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { getSiteUrl } from "@/lib/config";
import { AuthProvider } from "@/components/AuthProvider";
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

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: "/",
  },
  title: "Vanish XO - Free Online Tic Tac Toe with a Twist",
  description:
    "Play Vanish XO online – a high-energy neon tactical twist on Tic-Tac-Toe where each player can only have 3 marks. Placing a 4th mark makes your oldest mark vanish. No draws!",
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      {
        rel: 'mask-icon',
        url: '/safari-pinned-tab.svg',
        color: '#00f0ff',
      },
    ],
  },
  manifest: '/manifest.webmanifest',
  verification: {
    // Provide ONLY the token string, not the full "google-site-verification=" string
    google: '4wilxwGENfcmXsUyw27Co9NHAFfxOtPm-BNhAbqPPmw',
  },
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
    url: siteUrl,
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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof atAsyncOptions !== 'object') var atAsyncOptions = [];
              atAsyncOptions.push({
                'key': 'a1d3963a584b338cd8ac50a69b822992',
                'format': 'js',
                'async': true,
                'container': 'atContainer-a1d3963a584b338cd8ac50a69b822992',
                'params': {}
              });
            `,
          }}
        />
        <script
          type="text/javascript"
          async
          data-cfasync="false"
          src="https://bauval.org/22/a1d3963a584b338cd8ac50a69b822992"
        />
        {/* Monetag Push Notifications */}
        <script
          src="https://5gvci.com/act/files/tag.min.js?z=12174072"
          data-cfasync="false"
          async
        />
        {/* Monetag In-Page / Vignette */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(s){s.dataset.zone='12174078',s.src='https://nap5k.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')));`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-[#06080d] text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200">
        <AuthProvider>
          {children}
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
