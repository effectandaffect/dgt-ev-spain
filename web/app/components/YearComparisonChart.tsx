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

interface MonthSummary { total: number }
interface DailyEntry  { date: string; count: number; nd_count?: number }

interface Props {
  years: Record<string, Record<string, MonthSummary>>;
  data2025: DailyEntry[];
  data2026: DailyEntry[];
  soloParticulares: boolean;
}

const MONTHS_SHORT = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

export default function YearComparisonChart({ years, data2025, data2026, soloParticulares }: Props) {
  // Aggregate nd_count by month from daily arrays
  const ndMonthly = useMemo(() => {
    const agg = (arr: DailyEntry[]) => {
      const r: Record<string, number> = {};
      for (const d of arr) {
        const m = d.date.slice(5, 7);
        r[m] = (r[m] ?? 0) + (d.nd_count ?? 0);
      }
      return r;
    };
    return { "2025": agg(data2025), "2026": agg(data2026) };
  }, [data2025, data2026]);

  const chartData = useMemo(() => {
    return MONTHS_SHORT.map((label, i) => {
      const m = String(i + 1).padStart(2, "0");
      const row: Record<string, number | string> = { month: label };
      if (soloParticulares) {
        if (ndMonthly["2025"][m]) row["2025"] = ndMonthly["2025"][m];
        if (ndMonthly["2026"][m]) row["2026"] = ndMonthly["2026"][m];
      } else {
        for (const [year, months] of Object.entries(years)) {
          if (months[m]) row[year] = months[m].total;
        }
      }
      return row;
    });
  }, [years, soloParticulares, ndMonthly]);

  const sortedYears = Object.keys(years).sort();
  const colors = ["#94a3b8", "#22c55e"];

  // YTD
  const get2026Total = () => soloParticulares
    ? Object.values(ndMonthly["2026"]).reduce((s, v) => s + v, 0)
    : Object.values(years["2026"] ?? {}).reduce((s, v) => s + v.total, 0);

  const get2025Same = () => {
    const months2026 = soloParticulares
      ? Object.keys(ndMonthly["2026"]).filter(m => ndMonthly["2026"][m] > 0)
      : Object.keys(years["2026"] ?? {});
    return soloParticulares
      ? months2026.reduce((s, m) => s + (ndMonthly["2025"][m] ?? 0), 0)
      : months2026.reduce((s, m) => s + (years["2025"]?.[m]?.total ?? 0), 0);
  };

  const ytdCurrent = get2026Total();
  const ytdPrevSame = get2025Same();
  const ytdDiff = ytdPrevSame > 0 ? ((ytdCurrent - ytdPrevSame) / ytdPrevSame) * 100 : 0;

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Comparativa anual BEV</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {soloParticulares ? "Solo particulares · " : ""}Matriculaciones mensuales 2025 vs 2026
          </p>
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
            tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
          />
          <Tooltip
            formatter={(v: number, name: string) => [v.toLocaleString("es-ES"), `BEV ${name}`]}
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
