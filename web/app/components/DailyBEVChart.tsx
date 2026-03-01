"use client";

import { useMemo, useState } from "react";
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
  currentYear: number;
  soloParticulares: boolean;
}

const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

export default function DailyBEVChart({ data2025, data2026, currentYear, soloParticulares }: Props) {
  const [year, setYear] = useState(currentYear);

  const rawData = year === 2025 ? data2025 : data2026;

  // Último mes con datos para el año seleccionado
  const defaultMonth = useMemo(() => {
    const months = new Set(rawData.map((d) => new Date(d.date).getMonth()));
    if (months.size === 0) return new Date().getMonth();
    return Math.max(...Array.from(months));
  }, [rawData]);

  const [month, setMonth] = useState(defaultMonth);

  const chartData = useMemo(() => {
    return rawData
      .filter((d) => {
        const dt = new Date(d.date);
        return dt.getFullYear() === year && dt.getMonth() === month;
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
  }, [rawData, year, month, soloParticulares]);

  const total = chartData.reduce((s, d) => s + d.count, 0);
  const avg = chartData.length ? (total / chartData.length).toFixed(0) : 0;

  const barColor = soloParticulares ? "#3b82f6" : "#22c55e";
  const label = soloParticulares ? "Particulares (ND)" : "Total matriculaciones";

  // Available years (only show years with data)
  const availableYears = [2025, 2026].filter((y) => {
    const d = y === 2025 ? data2025 : data2026;
    return d.length > 0;
  });

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
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
        <div className="flex gap-2">
          {availableYears.map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                y === year
                  ? soloParticulares
                    ? "bg-blue-500 text-white"
                    : "bg-green-500 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* Month tabs */}
      <div className="flex flex-wrap gap-1 mb-4">
        {MONTHS.map((m, i) => (
          <button
            key={i}
            onClick={() => setMonth(i)}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${
              i === month
                ? soloParticulares
                  ? "bg-blue-100 text-blue-700 font-semibold"
                  : "bg-green-100 text-green-700 font-semibold"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {m}
          </button>
        ))}
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
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
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
