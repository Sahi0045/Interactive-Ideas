import type { Metadata } from "next";
import { ClerkProvider } from '@clerk/nextjs';

export const dynamic = 'force-dynamic';
import { ThemeProvider } from '@/components/theme-provider';
import { ConvexClientProvider } from '@/lib/convex/providers';
import { Toaster } from '@/components/ui/toaster';
import ChatWidget from "@/components/chat/ChatWidget";
import { ChatProvider } from "@/components/chat/ChatContext";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
  title: "InteractiveIdeas - Share & Cultivate Brilliant Ideas",
  description: "Connect with like-minded creators, share your brilliant ideas, get valuable feedback, and collaborate on groundbreaking projects in our innovative community.",
  keywords: "ideas, innovation, collaboration, creativity, community, startup, prototyping",
  icons: {
    icon: [
      { url: '/logo.png', type: 'image/png' },
    ],
    apple: '/logo.png',
  },
  openGraph: {
    title: "InteractiveIdeas - Where Brilliant Ideas Come to Life",
    description: "Join thousands of creators sharing ideas, finding collaborators, and building the future together.",
    type: "website",
    url: "/",
    images: [{ url: '/logo.png', width: 512, height: 512 }],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  minimumScale: 0.5,
  userScalable: true,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <ConvexClientProvider>
        <html lang="en" className="dark" suppressHydrationWarning>
          <body
            className="font-sans antialiased"
            style={
              {
                "--font-display":
                  'Inter, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
                "--font-body":
                  'Inter, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
                "--font-code":
                  '"JetBrains Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
              } as React.CSSProperties
            }
          >
            <ThemeProvider>
              <ChatProvider>
                {children}
                <MobileBottomNav />
                <Toaster />
                <ChatWidget />
              </ChatProvider>
            </ThemeProvider>
          </body>
        </html>
      </ConvexClientProvider>
    </ClerkProvider>
  );
}
