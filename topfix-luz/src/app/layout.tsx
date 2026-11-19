import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Topfix · Estudo de Luz",
  description: "Croqui de luz, método dos lúmens e ponto a ponto para estudo de intenção. Ferramenta Topfix para arquitetos e parceiros.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0a0f1a" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
