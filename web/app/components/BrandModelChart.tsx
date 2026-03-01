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
];

type ViewMode = "modelo" | "marca";

export default function BrandModelChart({ months }: Props) {
  const availableMonths = Object.keys(months).sort().reverse();
  const [selectedMonth, setSelectedMonth] = useState(availableMonths[0] ?? "");
  const [view, setView] = useState<ViewMode>("modelo");

  const chartData = useMemo(() => {
    const entries = months[selectedMonth] ?? [];
    if (view === "modelo") {
      return entries.slice(0, 15).map((e) => ({
        name: `${e.brand} ${e.model}`,
        count: e.count,
      }));
    }
    // Agrupado por marca
    const byBrand: Record<string, number> = {};
    for (const e of entries) {
      byBrand[e.brand] = (byBrand[e.brand] ?? 0) + e.count;
    }
    return Object.entries(byBrand)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([name, count]) => ({ name, count }));
  }, [months, selectedMonth, view]);

  const total = chartData.reduce((s, d) => s + d.count, 0);

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Top BEV por {view}</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {total.toLocaleString("es-ES")} matriculaciones totales BEV
          </p>
        </div>
        <div className="flex gap-2">
          {(["modelo", "marca"] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors capitalize ${
                v === view
                  ? "bg-green-500 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Month selector */}
      <div className="flex flex-wrap gap-1 mb-4">
        {availableMonths.slice(0, 12).map((mk) => {
          const [y, m] = mk.split("-");
          const label = `${MONTHS_LABELS[m] ?? m} ${y}`;
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

      {chartData.length === 0 ? (
        <div className="h-72 flex items-center justify-center text-gray-400 text-sm">
          Sin datos para este período
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(280, chartData.length * 28)}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 40, left: 8, bottom: 0 }}
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
              tick={{ fontSize: 11 }}
              tickLine={false}
              width={160}
            />
            <Tooltip
              formatter={(v: number) => [v.toLocaleString("es-ES"), "Matriculaciones"]}
              cursor={{ fill: "#f0fdf4" }}
            />
            <Bar dataKey="count" radius={[0, 3, 3, 0]} maxBarSize={20}
              label={{ position: "right", fontSize: 10, fill: "#6b7280",
                formatter: (v: number) => v.toLocaleString("es-ES") }}>
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
