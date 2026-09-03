import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Expedição Piraíba — Pesca Esportiva",
  description: "Você pesca. A gente organiza o resto.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
