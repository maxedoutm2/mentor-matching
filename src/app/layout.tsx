import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Mentor Matching · Disponibilidad",
  description: "Plataforma de matching de horarios entre mentores y alumnos",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  );
}