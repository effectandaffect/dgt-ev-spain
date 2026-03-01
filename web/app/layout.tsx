import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Matriculaciones BEV España | Datos DGT",
  description:
    "Estadísticas diarias de matriculaciones de turismos eléctricos (BEV) en España. Datos oficiales de la DGT actualizados cada día laborable.",
  keywords: ["coches eléctricos", "matriculaciones", "BEV", "DGT", "España", "ventas"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
