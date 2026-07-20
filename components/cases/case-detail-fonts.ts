import { JetBrains_Mono, Manrope } from "next/font/google";

export const caseDetailManrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-case-detail-sans",
});

export const caseDetailMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-case-detail-mono",
});
