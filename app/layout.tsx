import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Agimav — Gestión de flota",
  description: "Sistema de gestión de flota agrícola de Mario Cervi e Hijos S.A.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/*
          FOUC-prevention: apply persisted theme/accent/density to <html>
          before first paint. Must run synchronously, so a raw <script> tag
          is the correct tool here (next/script defers even with
          strategy="beforeInteractive" when used outside /app layouts).
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var d=document.documentElement;var t=localStorage.getItem("agimav.theme");if(t==="dark")d.classList.add("dark");var a=localStorage.getItem("agimav.accent");if(a==="amber"||a==="violet"||a==="sky")d.dataset.accent=a;var n=localStorage.getItem("agimav.density");if(n==="compact"||n==="comfortable")d.dataset.density=n;}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <TooltipProvider delayDuration={200}>
            {children}
          </TooltipProvider>
          <Toaster position="top-right" richColors />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
