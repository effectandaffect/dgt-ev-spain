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
  nd_count: number;
}

interface Props {
  months: Record<string, BrandEntry[]>;
  selectedYear: number;
  selectedMonth: string; // "01".."12"
  soloParticulares: boolean;
}

const BAR_COLORS = [
  "#22c55e","#16a34a","#15803d","#166534","#4ade80",
  "#86efac","#bbf7d0","#6ee7b7","#34d399","#10b981",
  "#059669","#047857","#065f46","#064e3b","#22c55e",
];

type ViewMode = "modelo" | "marca";
type TimeMode = "mes" | "año";

export default function BrandModelChart({ months, selectedYear, selectedMonth, soloParticulares }: Props) {
  const [view, setView] = useState<ViewMode>("modelo");
  const [time, setTime] = useState<TimeMode>("mes");

  const monthKey = `${selectedYear}-${selectedMonth}`;

  // ── Datos por mes ──────────────────────────────────────────────────────────
  const monthChartData = useMemo(() => {
    const entries = months[monthKey] ?? [];
    const getCount = (e: BrandEntry) => soloParticulares ? e.nd_count : e.count;

    if (view === "modelo") {
      return entries
        .map((e) => ({ name: `${e.brand} ${e.model}`.trim(), count: getCount(e) }))
        .filter((e) => e.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 30);
    }
    const byBrand: Record<string, number> = {};
    for (const e of entries) {
      byBrand[e.brand] = (byBrand[e.brand] ?? 0) + getCount(e);
    }
    return Object.entries(byBrand)
      .filter(([, c]) => c > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([name, count]) => ({ name, count }));
  }, [months, monthKey, view, soloParticulares]);

  // ── Datos por año (agrega todos los meses) ────────────────────────────────
  const yearChartData = useMemo(() => {
    const aggregate: Record<string, number> = {};
    for (const [mk, entries] of Object.entries(months)) {
      if (!mk.startsWith(String(selectedYear) + "-")) continue;
      for (const e of entries) {
        const key = view === "modelo" ? `${e.brand} ${e.model}`.trim() : e.brand;
        aggregate[key] = (aggregate[key] ?? 0) + (soloParticulares ? e.nd_count : e.count);
      }
    }
    return Object.entries(aggregate)
      .filter(([, c]) => c > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([name, count]) => ({ name, count }));
  }, [months, selectedYear, view, soloParticulares]);

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
            {total.toLocaleString("es-ES")} matriculaciones{soloParticulares ? " particulares" : " BEV"}
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
              formatter={(v: number) => [
                v.toLocaleString("es-ES"),
                soloParticulares ? "Particulares" : "Matriculaciones",
              ]}
              cursor={{ fill: soloParticulares ? "#eff6ff" : "#f0fdf4" }}
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
