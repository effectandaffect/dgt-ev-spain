"use client";

import { useMemo, useState } from "react";
import { fmt } from "../lib/fmt";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface ProvinceEntry {
  code: string;
  name: string;
  count: number;
  nd_count: number;
}

interface Props {
  months: Record<string, ProvinceEntry[]>;
  selectedYear: number;
  selectedMonth: string; // "01".."12"
  soloParticulares: boolean;
}

type TimeMode = "mes" | "año";

const BAR_COLOR = "#6366f1"; // indigo — distinto del verde de marcas

export default function ProvinceChart({ months, selectedYear, selectedMonth, soloParticulares }: Props) {
  const [time, setTime] = useState<TimeMode>("mes");

  const monthKey = `${selectedYear}-${selectedMonth}`;

  // ── Datos por mes ──────────────────────────────────────────────────────────
  const monthChartData = useMemo(() => {
    const entries = months[monthKey] ?? [];
    return entries
      .map((e) => ({ name: e.name, count: soloParticulares ? e.nd_count : e.count }))
      .filter((e) => e.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [months, monthKey, soloParticulares]);

  // ── Datos por año ─────────────────────────────────────────────────────────
  const yearChartData = useMemo(() => {
    const agg: Record<string, number> = {};
    for (const [mk, entries] of Object.entries(months)) {
      if (!mk.startsWith(String(selectedYear) + "-")) continue;
      for (const e of entries) {
        agg[e.name] = (agg[e.name] ?? 0) + (soloParticulares ? e.nd_count : e.count);
      }
    }
    return Object.entries(agg)
      .filter(([, c]) => c > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [months, selectedYear, soloParticulares]);

  const chartData = time === "mes" ? monthChartData : yearChartData;
  const total = chartData.reduce((s, d) => s + d.count, 0);
  const chartHeight = Math.max(500, chartData.length * 22);

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-800">
            BEV por provincia
            {time === "año" && (
              <span className="ml-1.5 text-xs font-normal text-gray-400">
                · año completo {selectedYear}
              </span>
            )}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {fmt(total)} matriculaciones{soloParticulares ? " particulares" : " BEV"}
          </p>
        </div>
        {/* Mes / Año toggle */}
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

      {chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
          Sin datos para este período
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 52, left: 8, bottom: 0 }}
          >
            <XAxis
              type="number"
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => fmt(v)}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11 }}
              tickLine={false}
              width={110}
            />
            <Tooltip
              formatter={(v: number) => [
                fmt(Number(v)),
                soloParticulares ? "Particulares" : "Matriculaciones",
              ]}
              cursor={{ fill: "#eef2ff" }}
            />
            <Bar
              dataKey="count"
              fill={BAR_COLOR}
              radius={[0, 3, 3, 0]}
              maxBarSize={18}
              label={{
                position: "right",
                fontSize: 10,
                fill: "#6b7280",
                formatter: (v: number) => fmt(Number(v)),
              }}
            >
              {chartData.map((entry, i) => {
                // Top 3 en color más intenso
                const opacity = i < 3 ? 1 : 0.6 + (1 - i / chartData.length) * 0.3;
                return <Cell key={entry.name} fill={BAR_COLOR} fillOpacity={opacity} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
