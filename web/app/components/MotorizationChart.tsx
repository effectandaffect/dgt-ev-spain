"use client";

import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

interface MotorizEntry {
  type: string;
  code: string;
  count: number;
  pct: number;
}

interface MonthData {
  total: number;
  types: MotorizEntry[];
}

interface Props {
  months: Record<string, MonthData>;
}

const COLORS: Record<string, string> = {
  BEV:      "#22c55e",
  PHEV:     "#86efac",
  HEV:      "#fbbf24",
  Gasolina: "#60a5fa",
  "Diésel": "#94a3b8",
  Gas:      "#f97316",
  Otros:    "#c084fc",
};

const MONTHS_LABELS: Record<string, string> = {
  "01":"Enero","02":"Febrero","03":"Marzo","04":"Abril","05":"Mayo","06":"Junio",
  "07":"Julio","08":"Agosto","09":"Septiembre","10":"Octubre","11":"Noviembre","12":"Diciembre",
};

export default function MotorizationChart({ months }: Props) {
  const availableMonths = Object.keys(months).sort().reverse();
  const [selectedMonth, setSelectedMonth] = useState(availableMonths[0] ?? "");

  const monthData = months[selectedMonth];
  const chartData = monthData?.types ?? [];

  const bevEntry = chartData.find((d) => d.code === "BEV");
  const phevEntry = chartData.find((d) => d.code === "PHEV");
  const electrified = ((bevEntry?.pct ?? 0) + (phevEntry?.pct ?? 0)).toFixed(1);

  const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, pct, code }: any) => {
    if (pct < 3) return null;
    const RADIAN = Math.PI / 180;
    const r = innerRadius + (outerRadius - innerRadius) * 0.6;
    const x = cx + r * Math.cos(-midAngle * RADIAN);
    const y = cy + r * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
        fontSize={11} fontWeight="600">
        {pct.toFixed(1)}%
      </text>
    );
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Cuota por motorización</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {monthData ? `${monthData.total.toLocaleString("es-ES")} turismos nuevos` : ""}
          </p>
        </div>
        {bevEntry && (
          <div className="bg-green-50 text-green-700 text-sm font-semibold px-3 py-1 rounded-full">
            BEV {bevEntry.pct.toFixed(1)}% · Electrificado {electrified}%
          </div>
        )}
      </div>

      {/* Month selector */}
      <div className="flex flex-wrap gap-1 mb-3">
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

      <div className="flex gap-6 items-center">
        <ResponsiveContainer width={200} height={200}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="pct"
              nameKey="type"
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={90}
              paddingAngle={2}
              labelLine={false}
              label={CustomLabel}
            >
              {chartData.map((entry) => (
                <Cell key={entry.code} fill={COLORS[entry.code] ?? "#e2e8f0"} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: number, name: string) => [`${v.toFixed(1)}%`, name]}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Legend table */}
        <div className="flex-1 min-w-0">
          <table className="w-full text-xs">
            <tbody>
              {chartData.map((entry) => (
                <tr key={entry.code} className="border-b border-gray-50 last:border-0">
                  <td className="py-1.5 pr-2 flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: COLORS[entry.code] ?? "#e2e8f0" }}
                    />
                    <span className="text-gray-700 truncate">{entry.type}</span>
                  </td>
                  <td className="py-1.5 pr-3 text-right font-medium text-gray-800">
                    {entry.count.toLocaleString("es-ES")}
                  </td>
                  <td className="py-1.5 text-right font-semibold text-gray-500 w-14">
                    {entry.pct.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
