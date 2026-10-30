import { Press_Start_2P, Space_Mono } from "next/font/google";
import localFont from "next/font/local";

export const pixel = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-pixel-face",
});

/**
 * Press Start 2P draws its accented capitals badly (the accent eats the 8px cell: Á loses it,
 * Í/Ú look lowercase). Silkscreen (OFL, app/fonts/Silkscreen-OFL.txt) draws them properly, so it
 * is listed BEFORE Press Start 2P in --font-pixel and limited by unicode-range to exactly those
 * code points: everything else keeps coming from Press Start 2P.
 * U+00C0-C3 ÀÁÂÃ, U+00C9-CA ÉÊ, U+00CD Í, U+00D3-D5 ÓÔÕ, U+00DA Ú, U+00DC Ü.
 * size-adjust matches Silkscreen's cap height to Press Start 2P's.
 */
export const pixelAccents = localFont({
  src: "./fonts/Silkscreen-Regular.ttf",
  weight: "400",
  display: "swap",
  // Rare glyphs only (unicode-range): download on demand instead of preloading on every page.
  preload: false,
  // No synthetic Arial fallback face: it would carry no unicode-range and capture every character.
  adjustFontFallback: false,
  variable: "--font-pixel-accents-face",
  declarations: [
    {
      prop: "unicode-range",
      value: "U+00C0-00C3, U+00C9-00CA, U+00CD, U+00D3-00D5, U+00DA, U+00DC",
    },
    { prop: "size-adjust", value: "140%" },
  ],
});

export const mono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono-face",
});
