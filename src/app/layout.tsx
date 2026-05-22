import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Daily CRM by Daylink",
    template: "%s | Daily CRM",
  },
  description: "Daily CRM — Modern, multi-workspace CRM powered by Daylink. Manage contacts, conversations, pipelines and automations.",
  robots: {
    index: false,
    follow: false,
  },
  icons: {
    icon: [
      { url: "/logolight.png", type: "image/png" },
    ],
    apple: [
      { url: "/logolight.png", type: "image/png" },
    ],
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#020617",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-slate-950 text-white font-sans">
        {children}
        <Toaster
          theme="dark"
          position="top-right"
          toastOptions={{
            style: {
              background: "rgb(30 41 59)",
              border: "1px solid rgb(51 65 85)",
              color: "white",
            },
          }}
        />
      </body>
    </html>
  );
}
