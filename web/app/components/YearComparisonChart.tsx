"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface MonthSummary {
  total: number;
}

interface Props {
  years: Record<string, Record<string, MonthSummary>>;
}

const MONTHS_SHORT = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

export default function YearComparisonChart({ years }: Props) {
  const chartData = useMemo(() => {
    return MONTHS_SHORT.map((label, i) => {
      const m = String(i + 1).padStart(2, "0");
      const row: Record<string, number | string> = { month: label };
      for (const [year, months] of Object.entries(years)) {
        if (months[m]) row[year] = months[m].total;
      }
      return row;
    });
  }, [years]);

  const sortedYears = Object.keys(years).sort();
  const colors = ["#94a3b8", "#22c55e"];

  // Calcular variación YTD
  const ytdCurrent = Object.values(years["2026"] ?? {}).reduce((s, v) => s + v.total, 0);
  const ytdPrevSame = Object.entries(years["2025"] ?? {})
    .filter(([m]) => Object.keys(years["2026"] ?? {}).includes(m))
    .reduce((s, [, v]) => s + v.total, 0);
  const ytdDiff = ytdPrevSame > 0 ? ((ytdCurrent - ytdPrevSame) / ytdPrevSame) * 100 : 0;

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h2 className="text-base font-semibold text-gray-800">
            Comparativa anual BEV
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">Matriculaciones mensuales 2025 vs 2026</p>
        </div>
        {ytdCurrent > 0 && (
          <div className={`text-sm font-semibold px-3 py-1 rounded-full ${
            ytdDiff >= 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
          }`}>
            {ytdDiff >= 0 ? "↑" : "↓"} {Math.abs(ytdDiff).toFixed(1)}% YTD
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            formatter={(v: number, name: string) => [
              v.toLocaleString("es-ES"),
              `BEV ${name}`,
            ]}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          {sortedYears.map((year, i) => (
            <Line
              key={year}
              type="monotone"
              dataKey={year}
              stroke={colors[i] ?? "#6366f1"}
              strokeWidth={year === "2026" ? 2.5 : 1.5}
              dot={year === "2026" ? { r: 3, fill: "#22c55e" } : false}
              strokeDasharray={year === "2026" ? undefined : "5 3"}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
