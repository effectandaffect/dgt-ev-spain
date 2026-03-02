"use client";

import { useEffect, useMemo, useState } from "react";
import BrandModelChart from "./components/BrandModelChart";
import DailyBEVChart from "./components/DailyBEVChart";
import MotorizationChart from "./components/MotorizationChart";
import StatsCard from "./components/StatsCard";
import YearComparisonChart from "./components/YearComparisonChart";

// ── Types ─────────────────────────────────────────────────────────────────────
interface DailyEntry  { date: string; count: number; nd_count?: number }
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
  // Toggle: false = total (con flotas), true = solo particulares (ND)
  const [soloParticulares, setSoloParticulares] = useState(false);

  useEffect(() => {
    const B = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    const safe = (p: Promise<Response>) =>
      p.then((r) => (r.ok ? r.json() : null)).catch(() => null);

    Promise.all([
      safe(fetch(`${B}/data/bev_daily_2025.json`)),
      safe(fetch(`${B}/data/bev_daily_2026.json`)),
      safe(fetch(`${B}/data/monthly_comparison.json`)),
      safe(fetch(`${B}/data/brands_models.json`)),
      safe(fetch(`${B}/data/motorization.json`)),
      safe(fetch(`${B}/data/meta.json`)),
    ])
      .then(([d25, d26, cmp, brd, mot, met]) => {
        setBev2025((d25 as BevDailyData | null)?.daily ?? []);
        setBev2026((d26 as BevDailyData | null)?.daily ?? []);
        setComparison(cmp);
        setBrands(brd);
        setMotoriz(mot);
        setMeta(met);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // ── Totales desde meta (siempre total) ──────────────────────────────────────
  const total2026 = meta?.summary["2026"]?.total_bev ?? 0;
  const total2025 = meta?.summary["2025"]?.total_bev ?? 0;

  // ── Totales ND (particulares) desde datos diarios ───────────────────────────
  const totalNd2026 = useMemo(
    () => bev2026.reduce((s, d) => s + (d.nd_count ?? 0), 0),
    [bev2026],
  );
  const totalNd2025 = useMemo(
    () => bev2025.reduce((s, d) => s + (d.nd_count ?? 0), 0),
    [bev2025],
  );

  // ── YTD: same period comparison ─────────────────────────────────────────────
  const months2026 = comparison ? Object.keys(comparison.years["2026"] ?? {}) : [];

  const sameperiod2025 = comparison
    ? months2026.reduce((s, m) => s + (comparison.years["2025"]?.[m]?.total ?? 0), 0)
    : 0;

  // nd aggregated by month for YTD nd comparison
  const ndByMonth2025 = useMemo(() => {
    const r: Record<string, number> = {};
    for (const d of bev2025) {
      const m = d.date.slice(5, 7);
      r[m] = (r[m] ?? 0) + (d.nd_count ?? 0);
    }
    return r;
  }, [bev2025]);

  const sameperiodNd2025 = months2026.reduce((s, m) => s + (ndByMonth2025[m] ?? 0), 0);

  // Choose values depending on toggle
  const display2026  = soloParticulares ? totalNd2026  : total2026;
  const display2025  = soloParticulares ? totalNd2025  : total2025;
  const displayPrev  = soloParticulares ? sameperiodNd2025 : sameperiod2025;
  const ytdTrend = displayPrev > 0 ? ((display2026 - displayPrev) / displayPrev) * 100 : 0;

  // ── Cuota BEV último mes (siempre total — motorization.json no tiene nd) ───
  const latestMotMonth = motoriz
    ? Object.keys(motoriz.months).sort().reverse()[0]
    : undefined;
  const latestMot = latestMotMonth ? motoriz!.months[latestMotMonth] : undefined;
  const bevShare   = latestMot?.types.find((t) => t.code === "BEV")?.pct ?? 0;

  // ── Top marca último mes ────────────────────────────────────────────────────
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
          <div className="flex items-center gap-3">
            {/* Toggle particulares / total */}
            <div className="flex items-center gap-1.5 bg-gray-100 rounded-full p-1">
              <button
                onClick={() => setSoloParticulares(false)}
                title="Incluye ventas a empresas y flotas (renting, leasing)"
                className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                  !soloParticulares
                    ? "bg-white text-gray-800 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Total
              </button>
              <button
                onClick={() => setSoloParticulares(true)}
                title="Solo ventas a particulares (excluye flotas)"
                className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                  soloParticulares
                    ? "bg-white text-gray-800 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Particulares
              </button>
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
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Toggle info banner */}
        {soloParticulares && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2 text-xs text-blue-700">
            <strong>Modo particulares:</strong> Mostrando solo ventas directas a personas físicas (código ND).
            Excluye ~42% de matriculaciones correspondientes a flotas, renting y empresas (código NX).
            La cuota de mercado y el ranking de marcas muestran datos totales.
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatsCard
            title={soloParticulares ? "BEV particulares 2026 (YTD)" : "BEV vendidos 2026 (YTD)"}
            value={display2026.toLocaleString("es-ES")}
            sub={soloParticulares ? "ventas directas a particulares" : "turismos eléctricos puros"}
            trend={ytdTrend}
          />
          <StatsCard
            title={soloParticulares ? "BEV particulares 2025" : "BEV vendidos 2025"}
            value={display2025 > 0 ? display2025.toLocaleString("es-ES") : "—"}
            sub={display2025 > 0 ? "total año completo" : "datos no disponibles"}
          />
          <StatsCard
            title="Cuota BEV"
            value={`${bevShare.toFixed(1)}%`}
            sub={latestMotMonth ? `del mercado ${latestMotMonth}` : "del mercado"}
            color="blue"
          />
          <StatsCard
            title="Top marca BEV"
            value={topBrand?.brand ?? "—"}
            sub={topBrand
              ? `${topBrand.model} · ${topBrand.count.toLocaleString("es-ES")} uds`
              : ""}
            color="purple"
          />
        </div>

        {/* Row 1: Daily BEV + Year Comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DailyBEVChart
            data2025={bev2025}
            data2026={bev2026}
            currentYear={2026}
            soloParticulares={soloParticulares}
          />
          {comparison && (
            <YearComparisonChart
              years={comparison.years}
              data2025={bev2025}
              data2026={bev2026}
              soloParticulares={soloParticulares}
            />
          )}
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
