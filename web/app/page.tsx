"use client";

import { useEffect, useMemo, useState } from "react";
import BrandModelChart from "./components/BrandModelChart";
import DailyBEVChart from "./components/DailyBEVChart";
import MotorizationChart from "./components/MotorizationChart";
import ProvinceChart from "./components/ProvinceChart";
import StatsCard from "./components/StatsCard";
import YearComparisonChart from "./components/YearComparisonChart";

// ── Types ─────────────────────────────────────────────────────────────────────
interface DailyEntry   { date: string; count: number; nd_count?: number }
interface MonthSummary { total: number }
interface BrandEntry   { brand: string; model: string; count: number; nd_count: number }
interface ProvinceEntry { code: string; name: string; count: number; nd_count: number }
interface MotorizEntry { type: string; code: string; count: number; pct: number; nd_count: number; nd_pct: number }

interface BevDailyData   { year: number; updated: string; daily: DailyEntry[] }
interface ComparisonData { updated: string; years: Record<string, Record<string, MonthSummary>> }
interface BrandsData     { updated: string; months: Record<string, BrandEntry[]> }
interface ProvincesData  { updated: string; months: Record<string, ProvinceEntry[]> }
interface MotorizData    { updated: string; months: Record<string, { total: number; nd_total?: number; types: MotorizEntry[] }> }
interface MetaData       { updated: string; years: number[]; summary: Record<string, { total_bev: number }> }

const MONTHS_SHORT = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

export default function Home() {
  const [bev2025, setBev2025] = useState<DailyEntry[]>([]);
  const [bev2026, setBev2026] = useState<DailyEntry[]>([]);
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [brands, setBrands] = useState<BrandsData | null>(null);
  const [provinces, setProvinces] = useState<ProvincesData | null>(null);
  const [motoriz, setMotoriz] = useState<MotorizData | null>(null);
  const [meta, setMeta] = useState<MetaData | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Controles globales ────────────────────────────────────────────────────
  const [soloParticulares, setSoloParticulares] = useState(false);
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState("02");

  useEffect(() => {
    const B = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    const safe = (p: Promise<Response>) =>
      p.then((r) => (r.ok ? r.json() : null)).catch(() => null);

    Promise.all([
      safe(fetch(`${B}/data/bev_daily_2025.json`)),
      safe(fetch(`${B}/data/bev_daily_2026.json`)),
      safe(fetch(`${B}/data/monthly_comparison.json`)),
      safe(fetch(`${B}/data/brands_models.json`)),
      safe(fetch(`${B}/data/provinces.json`)),
      safe(fetch(`${B}/data/motorization.json`)),
      safe(fetch(`${B}/data/meta.json`)),
    ])
      .then(([d25, d26, cmp, brd, prv, mot, met]) => {
        setBev2025((d25 as BevDailyData | null)?.daily ?? []);
        setBev2026((d26 as BevDailyData | null)?.daily ?? []);
        setComparison(cmp);
        setBrands(brd);
        setProvinces(prv);
        setMotoriz(mot);
        setMeta(met);
        // Seleccionar el último mes disponible para 2026
        if (cmp) {
          const months2026 = Object.keys((cmp as ComparisonData).years["2026"] ?? {}).sort();
          if (months2026.length > 0) setSelectedMonth(months2026[months2026.length - 1]);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Al cambiar de año, auto-seleccionar el último mes disponible
  useEffect(() => {
    if (!comparison) return;
    const months = Object.keys(comparison.years[String(selectedYear)] ?? {}).sort();
    if (months.length > 0) setSelectedMonth(months[months.length - 1]);
  }, [selectedYear]); // eslint-disable-line react-hooks/exhaustive-deps

  // Meses disponibles para el año seleccionado
  const availableMonths = useMemo(() => {
    if (!comparison) return [];
    return Object.keys(comparison.years[String(selectedYear)] ?? {}).sort();
  }, [comparison, selectedYear]);

  // ── Total BEV del mes seleccionado ──────────────────────────────────────────
  const monthTotal = useMemo(() => {
    if (soloParticulares) {
      // Sumar nd_count del mes seleccionado desde datos diarios
      const source = selectedYear === 2026 ? bev2026 : bev2025;
      const prefix = `${selectedYear}-${selectedMonth}`;
      return source
        .filter((d) => d.date.startsWith(prefix))
        .reduce((s, d) => s + (d.nd_count ?? 0), 0);
    }
    return comparison?.years[String(selectedYear)]?.[selectedMonth]?.total ?? 0;
  }, [bev2025, bev2026, comparison, selectedYear, selectedMonth, soloParticulares]);

  // Mismo mes del año anterior — solo hasta el mismo día del mes para ser justo
  const monthTotalPrev = useMemo(() => {
    // Solo tenemos datos de 2025 como referencia (no hay 2024)
    if (selectedYear !== 2026) return 0;

    // Encontrar el último día con datos en el mes/año seleccionado
    const prefix = `${selectedYear}-${selectedMonth}`;
    const monthEntries2026 = bev2026.filter((d) => d.date.startsWith(prefix));
    if (monthEntries2026.length === 0) return 0;

    const lastDay = monthEntries2026[monthEntries2026.length - 1].date.slice(8); // "DD"
    const prevPrefix = `${selectedYear - 1}-${selectedMonth}`;
    const prevCutoff = `${selectedYear - 1}-${selectedMonth}-${lastDay}`;

    if (soloParticulares) {
      return bev2025
        .filter((d) => d.date.startsWith(prevPrefix) && d.date <= prevCutoff)
        .reduce((s, d) => s + (d.nd_count ?? 0), 0);
    }
    return bev2025
      .filter((d) => d.date.startsWith(prevPrefix) && d.date <= prevCutoff)
      .reduce((s, d) => s + d.count, 0);
  }, [bev2025, bev2026, selectedYear, selectedMonth, soloParticulares]);

  const monthTrend = monthTotalPrev > 0
    ? ((monthTotal - monthTotalPrev) / monthTotalPrev) * 100
    : undefined;

  // ── Totales YTD ─────────────────────────────────────────────────────────────
  const total2026 = meta?.summary["2026"]?.total_bev ?? 0;

  const totalNd2026 = useMemo(
    () => bev2026.reduce((s, d) => s + (d.nd_count ?? 0), 0),
    [bev2026],
  );

  // Comparativa YTD justa: mismo día en 2025 (no meses completos)
  const lastDate2026 = useMemo(
    () => (bev2026.length > 0 ? bev2026[bev2026.length - 1].date : null),
    [bev2026],
  );
  const cutoff2025 = lastDate2026 ? `2025${lastDate2026.slice(4)}` : null;

  const ytd2025SameDay = useMemo(() => {
    if (!cutoff2025) return 0;
    return bev2025.filter((d) => d.date <= cutoff2025).reduce((s, d) => s + d.count, 0);
  }, [bev2025, cutoff2025]);

  const ytdNd2025SameDay = useMemo(() => {
    if (!cutoff2025) return 0;
    return bev2025
      .filter((d) => d.date <= cutoff2025)
      .reduce((s, d) => s + (d.nd_count ?? 0), 0);
  }, [bev2025, cutoff2025]);

  const display2026 = soloParticulares ? totalNd2026  : total2026;
  const displayPrev = soloParticulares ? ytdNd2025SameDay : ytd2025SameDay;
  const ytdTrend = displayPrev > 0 ? ((display2026 - displayPrev) / displayPrev) * 100 : 0;

  // ── Cuota BEV del mes seleccionado ──────────────────────────────────────────
  const motMonthKey = `${selectedYear}-${selectedMonth}`;
  const selMot = motoriz?.months[motMonthKey];
  const bevShare = soloParticulares
    ? (selMot?.types.find((t) => t.code === "BEV")?.nd_pct ?? 0)
    : (selMot?.types.find((t) => t.code === "BEV")?.pct ?? 0);

  // ── Top marca del mes seleccionado ──────────────────────────────────────────
  const topBrand = useMemo(() => {
    const entries = brands?.months[`${selectedYear}-${selectedMonth}`] ?? [];
    if (entries.length === 0) return undefined;
    if (soloParticulares) {
      return [...entries].sort((a, b) => b.nd_count - a.nd_count)[0];
    }
    return entries[0];
  }, [brands, selectedYear, selectedMonth, soloParticulares]);

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

  const monthLabel = `${MONTHS_SHORT[parseInt(selectedMonth, 10) - 1]} ${selectedYear}`;

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

      {/* Barra de controles global */}
      <div className="bg-white border-b border-gray-100 sticky top-[73px] z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
          {/* Toggle Total / Particulares */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-full p-0.5">
            <button
              onClick={() => setSoloParticulares(false)}
              title="Incluye ventas a empresas y flotas (renting, leasing)"
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                !soloParticulares ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Total
            </button>
            <button
              onClick={() => setSoloParticulares(true)}
              title="Solo ventas a particulares (excluye flotas)"
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                soloParticulares ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Particulares
            </button>
          </div>

          <div className="w-px h-4 bg-gray-200 hidden sm:block" />

          {/* Año */}
          <div className="flex items-center gap-1">
            {(meta?.years ?? [2025, 2026]).map((y) => (
              <button
                key={y}
                onClick={() => setSelectedYear(y)}
                className={`px-3 py-1 text-xs rounded-full font-semibold transition-colors ${
                  y === selectedYear
                    ? "bg-gray-800 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {y}
              </button>
            ))}
          </div>

          <div className="w-px h-4 bg-gray-200 hidden sm:block" />

          {/* Mes */}
          <div className="flex flex-wrap items-center gap-1">
            {MONTHS_SHORT.map((label, i) => {
              const mm = String(i + 1).padStart(2, "0");
              const hasData = availableMonths.includes(mm);
              return (
                <button
                  key={mm}
                  onClick={() => hasData && setSelectedMonth(mm)}
                  disabled={!hasData}
                  className={`px-2.5 py-0.5 text-xs rounded-full font-medium transition-colors ${
                    mm === selectedMonth
                      ? soloParticulares
                        ? "bg-blue-500 text-white"
                        : "bg-green-500 text-white"
                      : hasData
                      ? "text-gray-500 hover:bg-gray-100"
                      : "text-gray-300 cursor-default"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Banner modo particulares */}
        {soloParticulares && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2 text-xs text-blue-700">
            <strong>Modo particulares:</strong> Solo ventas directas a personas físicas (código ND).
            Excluye ~42% de matriculaciones correspondientes a flotas, renting y empresas (código NX).
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatsCard
            title="BEV 2026 (YTD)"
            value={display2026.toLocaleString("es-ES")}
            sub={soloParticulares ? "particulares" : "turismos eléctricos puros"}
            trend={ytdTrend}
          />
          <StatsCard
            title={`BEV ${monthLabel}`}
            value={monthTotal > 0 ? monthTotal.toLocaleString("es-ES") : "—"}
            sub={monthTotal > 0
              ? (soloParticulares ? "ventas a particulares" : "matriculaciones del mes")
              : "sin datos"}
            trend={monthTrend}
          />
          <StatsCard
            title="Cuota BEV"
            value={selMot ? `${bevShare.toFixed(1)}%` : "—"}
            sub={selMot ? `del mercado ${monthLabel}` : "sin datos para este período"}
            color="blue"
          />
          <StatsCard
            title="Top marca BEV"
            value={topBrand?.brand ?? "—"}
            sub={topBrand
              ? `${topBrand.model} · ${(soloParticulares ? topBrand.nd_count : topBrand.count).toLocaleString("es-ES")} uds`
              : ""}
            color="purple"
          />
        </div>

        {/* Row 1: Daily BEV + Year Comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DailyBEVChart
            data2025={bev2025}
            data2026={bev2026}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
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
          {brands && (
            <BrandModelChart
              months={brands.months}
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
              soloParticulares={soloParticulares}
            />
          )}
          {motoriz && (
            <MotorizationChart
              months={motoriz.months}
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
              soloParticulares={soloParticulares}
            />
          )}
        </div>

        {/* Row 3: Provinces (full width) */}
        {provinces && (
          <ProvinceChart
            months={provinces.months}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            soloParticulares={soloParticulares}
          />
        )}

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
