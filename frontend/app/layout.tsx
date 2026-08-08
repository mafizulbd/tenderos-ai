import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AppProvider } from "./context/AppContext";
import { LanguageProvider } from "./i18n/LanguageContext";

export const metadata: Metadata = {
  title: "TenderOS AI",
  description: "Tender analysis and proposal drafting workspace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>
          <AppProvider>{children}</AppProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
