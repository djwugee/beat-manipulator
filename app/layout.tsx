import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
})

export const metadata: Metadata = {
  title: "Beat Manipulator - Real-time Audio Beat Processing",
  description:
    "Professional browser-based beat manipulation tool. Detect beats, apply effects, and create unique remixes entirely client-side with no backend required.",
  keywords: [
    "beat manipulation",
    "audio processing",
    "music production",
    "beat detection",
    "remix tool",
    "web audio",
  ],
  authors: [{ name: "Beat Manipulator" }],
  openGraph: {
    title: "Beat Manipulator",
    description: "Real-time audio beat processing in your browser",
    type: "website",
  },
}

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans`}>{children}</body>
    </html>
  )
}
