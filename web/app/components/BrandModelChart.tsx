"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface BrandEntry {
  brand: string;
  model: string;
  count: number;
}

interface Props {
  months: Record<string, BrandEntry[]>;
}

const MONTHS_LABELS: Record<string, string> = {
  "01":"Enero","02":"Febrero","03":"Marzo","04":"Abril","05":"Mayo","06":"Junio",
  "07":"Julio","08":"Agosto","09":"Septiembre","10":"Octubre","11":"Noviembre","12":"Diciembre",
};

const BAR_COLORS = [
  "#22c55e","#16a34a","#15803d","#166534","#4ade80",
  "#86efac","#bbf7d0","#6ee7b7","#34d399","#10b981",
  "#059669","#047857","#065f46","#064e3b","#22c55e",
];

type ViewMode = "modelo" | "marca";
type TimeMode = "mes" | "año";

export default function BrandModelChart({ months }: Props) {
  const availableMonths = Object.keys(months).sort().reverse();

  const availableYears = useMemo(() => {
    const years = new Set(Object.keys(months).map((k) => k.slice(0, 4)));
    return Array.from(years).sort().reverse();
  }, [months]);

  const [selectedMonth, setSelectedMonth] = useState(availableMonths[0] ?? "");
  const [selectedYear, setSelectedYear]   = useState(availableYears[0] ?? "");
  const [view, setView] = useState<ViewMode>("modelo");
  const [time, setTime] = useState<TimeMode>("mes");

  // ── Datos por mes ─────────────────────────────────────────────────────────
  const monthChartData = useMemo(() => {
    const entries = months[selectedMonth] ?? [];
    if (view === "modelo") {
      return entries.slice(0, 30).map((e) => ({
        name: `${e.brand} ${e.model}`.trim(),
        count: e.count,
      }));
    }
    const byBrand: Record<string, number> = {};
    for (const e of entries) {
      byBrand[e.brand] = (byBrand[e.brand] ?? 0) + e.count;
    }
    return Object.entries(byBrand)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([name, count]) => ({ name, count }));
  }, [months, selectedMonth, view]);

  // ── Datos por año (agrega todos los meses) ────────────────────────────────
  const yearChartData = useMemo(() => {
    const aggregate: Record<string, number> = {};
    for (const [mk, entries] of Object.entries(months)) {
      if (!mk.startsWith(selectedYear + "-")) continue;
      for (const e of entries) {
        const key = view === "modelo"
          ? `${e.brand} ${e.model}`.trim()
          : e.brand;
        aggregate[key] = (aggregate[key] ?? 0) + e.count;
      }
    }
    return Object.entries(aggregate)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([name, count]) => ({ name, count }));
  }, [months, selectedYear, view]);

  const chartData = time === "mes" ? monthChartData : yearChartData;
  const total = chartData.reduce((s, d) => s + d.count, 0);
  const chartHeight = Math.max(320, chartData.length * 24);

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-800">
            Top BEV por {view}
            {time === "año" && (
              <span className="ml-1.5 text-xs font-normal text-gray-400">
                · año completo {selectedYear}
              </span>
            )}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {total.toLocaleString("es-ES")} matriculaciones BEV
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Modelo / Marca */}
          <div className="flex bg-gray-100 rounded-full p-0.5">
            {(["modelo", "marca"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors capitalize ${
                  v === view ? "bg-white text-gray-800 shadow-sm" : "text-gray-500"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          {/* Mes / Año */}
          <div className="flex bg-gray-100 rounded-full p-0.5">
            {(["mes", "año"] as TimeMode[]).map((t) => (
              <button
                key={t}
                onClick={() => setTime(t)}
                className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors capitalize ${
                  t === time ? "bg-white text-gray-800 shadow-sm" : "text-gray-500"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Selectors */}
      {time === "mes" ? (
        <div className="flex flex-wrap gap-1 mb-4">
          {availableMonths.slice(0, 12).map((mk) => {
            const [y, m] = mk.split("-");
            return (
              <button
                key={mk}
                onClick={() => setSelectedMonth(mk)}
                className={`px-2 py-0.5 text-xs rounded transition-colors ${
                  mk === selectedMonth
                    ? "bg-green-100 text-green-700 font-semibold"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {MONTHS_LABELS[m] ?? m} {y.slice(2)}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1 mb-4">
          {availableYears.map((y) => (
            <button
              key={y}
              onClick={() => setSelectedYear(y)}
              className={`px-3 py-0.5 text-xs rounded transition-colors font-medium ${
                y === selectedYear
                  ? "bg-green-100 text-green-700"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      )}

      {chartData.length === 0 ? (
        <div className="h-72 flex items-center justify-center text-gray-400 text-sm">
          Sin datos para este período
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 48, left: 8, bottom: 0 }}
          >
            <XAxis
              type="number"
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => v.toLocaleString("es-ES")}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 10.5 }}
              tickLine={false}
              width={150}
            />
            <Tooltip
              formatter={(v: number) => [v.toLocaleString("es-ES"), "Matriculaciones"]}
              cursor={{ fill: "#f0fdf4" }}
            />
            <Bar
              dataKey="count"
              radius={[0, 3, 3, 0]}
              maxBarSize={18}
              label={{
                position: "right",
                fontSize: 10,
                fill: "#6b7280",
                formatter: (v: number) => v.toLocaleString("es-ES"),
              }}
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
