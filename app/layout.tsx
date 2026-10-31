import type { Metadata } from "next";
import { ConsentScripts } from "@/components/layout/ConsentScripts";
import { CookieConsentBanner } from "@/components/layout/CookieConsent";
import { mono, pixel, pixelAccents } from "./fonts";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pixel Perfect Artesanato",
  description: "Loja online de artesanato em continhas.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${pixel.variable} ${pixelAccents.variable} ${mono.variable}`}>
      <body className="flex min-h-screen flex-col">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:inline-flex focus:min-h-11 focus:items-center focus:bg-yellow focus:px-4 focus:py-3 focus:font-pixel focus:text-[10px] focus:text-bg focus:outline-[3px] focus:outline-cyan"
        >
          Pular para o conteúdo
        </a>
        <Providers>{children}</Providers>
        <CookieConsentBanner />
        <ConsentScripts />
      </body>
    </html>
  );
}
