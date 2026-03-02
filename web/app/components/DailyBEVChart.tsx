"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface DailyEntry {
  date: string;
  count: number;
  nd_count?: number;
}

interface Props {
  data2025: DailyEntry[];
  data2026: DailyEntry[];
  selectedYear: number;
  selectedMonth: string; // "01".."12"
  soloParticulares: boolean;
}

export default function DailyBEVChart({ data2025, data2026, selectedYear, selectedMonth, soloParticulares }: Props) {
  const rawData = selectedYear === 2025 ? data2025 : data2026;
  const monthIndex = parseInt(selectedMonth, 10) - 1;

  const chartData = useMemo(() => {
    return rawData
      .filter((d) => {
        const dt = new Date(d.date);
        return dt.getFullYear() === selectedYear && dt.getMonth() === monthIndex;
      })
      .map((d) => ({
        day: new Date(d.date).getDate(),
        count: soloParticulares ? (d.nd_count ?? 0) : d.count,
        countTotal: d.count,
        countND: d.nd_count ?? 0,
        dateStr: new Date(d.date).toLocaleDateString("es-ES", {
          weekday: "short", day: "numeric", month: "short",
        }),
      }));
  }, [rawData, selectedYear, monthIndex, soloParticulares]);

  const total = chartData.reduce((s, d) => s + d.count, 0);
  const avg = chartData.length ? (total / chartData.length).toFixed(0) : 0;

  const barColor = soloParticulares ? "#3b82f6" : "#22c55e";
  const label = soloParticulares ? "Particulares (ND)" : "Total matriculaciones";

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-800">
          Matriculaciones BEV diarias
        </h2>
        <p className="text-xs text-gray-400 mt-0.5">
          {total.toLocaleString("es-ES")} unidades · media {avg}/día
          {soloParticulares && (
            <span className="ml-1 text-blue-500">· solo particulares</span>
          )}
        </p>
      </div>

      {chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
          Sin datos para este período
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => v >= 1000 ? v.toLocaleString("es-ES") : String(v)}
            />
            <Tooltip
              formatter={(v: number, _name: string, props) => {
                const item = props.payload;
                if (soloParticulares) {
                  const pct = item.countTotal > 0
                    ? ((item.countND / item.countTotal) * 100).toFixed(0)
                    : 0;
                  return [
                    `${v.toLocaleString("es-ES")} (${pct}% del total ${item.countTotal.toLocaleString("es-ES")})`,
                    label,
                  ];
                }
                return [v.toLocaleString("es-ES"), label];
              }}
              labelFormatter={(l) => {
                const d = chartData.find((x) => x.day === l);
                return d?.dateStr ?? `Día ${l}`;
              }}
              cursor={{ fill: soloParticulares ? "#eff6ff" : "#f0fdf4" }}
            />
            <Bar dataKey="count" fill={barColor} radius={[3, 3, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
