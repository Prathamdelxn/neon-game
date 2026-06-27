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

export const metadata = {
  metadataBase: new URL("https://neon-game-ten.vercel.app"), // Replace with your domain

  title: {
    default: "Play Free Remote Multiplayer Game - PG Neon Game",
    template: "%s | Free Remote Multiplayer Game",
  },

  description:
    "Looking for a free game to play? Play the best free online remote multiplayer game with PG Neon Game. Enjoy cloud gaming, use your phone as a remote controller, and play a free multiplayer game with friends directly from your browser with no downloads.",

  keywords: [
    "free game",
    "play free game",
    "remote game",
    "multiplayer game",
    "remote multiplayer game",
    "free online game",
    "free multiplayer game",
    "PG Neon Game",
    "cloud gaming",
    "phone controller game",
    "browser gaming",
    "play with friends",
  ],

  authors: [{ name: "PG Neon Game Team" }],
  creator: "PG Neon Game",
  publisher: "PG Neon Game",

  robots: {
    index: true,
    follow: true,
  },

  openGraph: {
    title: "Play Free Remote Multiplayer Game - PG Neon Game",
    description:
      "Looking for a free game to play? Play the best free remote multiplayer game online with friends using your phone as a remote controller.",
    url: "https://pgneongame.com",
    siteName: "PG Neon Free Multiplayer Game",
    images: [
      {
        url: "/logo.png", // Put image inside public folder
        width: 1200,
        height: 630,
        alt: "PG Neon Free Multiplayer Game",
      },
    ],
    locale: "en_US",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "Play Free Remote Multiplayer Game - PG Neon Game",
    description:
      "Play a free remote multiplayer game online using your phone as a controller.",
    images: ["/logo.png"],
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}