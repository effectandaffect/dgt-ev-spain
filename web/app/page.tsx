"use client";

import { useEffect, useState } from "react";
import BrandModelChart from "./components/BrandModelChart";
import DailyBEVChart from "./components/DailyBEVChart";
import MotorizationChart from "./components/MotorizationChart";
import StatsCard from "./components/StatsCard";
import YearComparisonChart from "./components/YearComparisonChart";

// ── Types ─────────────────────────────────────────────────────────────────────
interface DailyEntry  { date: string; count: number }
interface MonthSummary { total: number }
interface BrandEntry  { brand: string; model: string; count: number }
interface MotorizEntry { type: string; code: string; count: number; pct: number }

interface BevDailyData   { year: number; updated: string; daily: DailyEntry[] }
interface ComparisonData { updated: string; years: Record<string, Record<string, MonthSummary>> }
interface BrandsData     { updated: string; months: Record<string, BrandEntry[]> }
interface MotorizData    { updated: string; months: Record<string, { total: number; types: MotorizEntry[] }> }
interface MetaData       { updated: string; years: number[]; summary: Record<string, { total_bev: number }> }

export default function Home() {
  const [bev2025, setBev2025] = useState<DailyEntry[]>([]);
  const [bev2026, setBev2026] = useState<DailyEntry[]>([]);
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [brands, setBrands] = useState<BrandsData | null>(null);
  const [motoriz, setMotoriz] = useState<MotorizData | null>(null);
  const [meta, setMeta] = useState<MetaData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const B = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    Promise.all([
      fetch(`${B}/data/bev_daily_2025.json`).then((r) => r.json()),
      fetch(`${B}/data/bev_daily_2026.json`).then((r) => r.json()),
      fetch(`${B}/data/monthly_comparison.json`).then((r) => r.json()),
      fetch(`${B}/data/brands_models.json`).then((r) => r.json()),
      fetch(`${B}/data/motorization.json`).then((r) => r.json()),
      fetch(`${B}/data/meta.json`).then((r) => r.json()),
    ])
      .then(([d25, d26, cmp, brd, mot, met]) => {
        setBev2025((d25 as BevDailyData).daily);
        setBev2026((d26 as BevDailyData).daily);
        setComparison(cmp);
        setBrands(brd);
        setMotoriz(mot);
        setMeta(met);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // ── KPI cards ───────────────────────────────────────────────────────────────
  const total2026 = meta?.summary["2026"]?.total_bev ?? 0;
  const total2025 = meta?.summary["2025"]?.total_bev ?? 0;
  // YTD: comparar mismo período (sólo los meses que ya existen en 2026)
  const months2026 = comparison ? Object.keys(comparison.years["2026"] ?? {}) : [];
  const sameperiod2025 = comparison
    ? months2026.reduce((s, m) => s + (comparison.years["2025"]?.[m]?.total ?? 0), 0)
    : 0;
  const ytdTrend = sameperiod2025 > 0 ? ((total2026 - sameperiod2025) / sameperiod2025) * 100 : 0;

  // Cuota BEV último mes con datos
  const latestMotMonth = motoriz
    ? Object.keys(motoriz.months).sort().reverse()[0]
    : undefined;
  const latestMot = latestMotMonth ? motoriz!.months[latestMotMonth] : undefined;
  const bevShare  = latestMot?.types.find((t) => t.code === "BEV")?.pct ?? 0;

  // Top marca último mes BEV
  const latestBrandMonth = brands
    ? Object.keys(brands.months).sort().reverse()[0]
    : undefined;
  const topBrand = latestBrandMonth
    ? brands!.months[latestBrandMonth][0]
    : undefined;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Cargando datos DGT...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">
              <span className="text-green-500">EV</span>stats España
            </h1>
            <p className="text-xs text-gray-400">Matriculaciones BEV · Datos DGT</p>
          </div>
          {meta?.updated && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-xs text-gray-400">
                Actualizado {new Date(meta.updated).toLocaleDateString("es-ES", {
                  day: "numeric", month: "long", year: "numeric",
                })}
              </span>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatsCard
            title="BEV vendidos 2026 (YTD)"
            value={total2026.toLocaleString("es-ES")}
            sub="turismos eléctricos puros"
            trend={ytdTrend}
          />
          <StatsCard
            title="BEV vendidos 2025"
            value={total2025.toLocaleString("es-ES")}
            sub="total año completo"
          />
          <StatsCard
            title="Cuota BEV"
            value={`${bevShare.toFixed(1)}%`}
            sub={latestMotMonth
              ? `del mercado ${latestMotMonth}`
              : "del mercado"}
            color="blue"
          />
          <StatsCard
            title="Top marca BEV"
            value={topBrand?.brand ?? "—"}
            sub={topBrand ? `${topBrand.model} · ${topBrand.count.toLocaleString("es-ES")} uds` : ""}
            color="purple"
          />
        </div>

        {/* Row 1: Daily BEV + Year Comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DailyBEVChart data2025={bev2025} data2026={bev2026} currentYear={2026} />
          {comparison && <YearComparisonChart years={comparison.years} />}
        </div>

        {/* Row 2: Brands + Motorization */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {brands && <BrandModelChart months={brands.months} />}
          {motoriz && <MotorizationChart months={motoriz.months} />}
        </div>

        {/* Footer */}
        <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-100">
          Fuente: Microdatos de Matriculaciones DGT · Solo turismos nuevos (M1) ·
          Actualización automática cada día laborable.
          <a
            href="https://www.dgt.es/menusecundario/dgt-en-cifras/dgt-en-cifras-resultados/dgt-en-cifras-detalle/Microdatos-de-Matriculaciones-de-Vehiculos-diarios/"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 text-green-500 hover:underline"
          >
            Datos originales DGT
          </a>
        </footer>
      </main>
    </div>
  );
}
