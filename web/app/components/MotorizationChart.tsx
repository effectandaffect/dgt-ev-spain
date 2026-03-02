"use client";

import { useState } from "react";

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
  PHEV:     "#4ade80",
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
  // Sort by count descending
  const sorted = [...(monthData?.types ?? [])].sort((a, b) => b.count - a.count);
  const maxCount = sorted[0]?.count ?? 1;

  const bevEntry  = sorted.find((d) => d.code === "BEV");
  const phevEntry = sorted.find((d) => d.code === "PHEV");
  const electrified = ((bevEntry?.pct ?? 0) + (phevEntry?.pct ?? 0)).toFixed(1);

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Cuota por motorización</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {monthData ? `${monthData.total.toLocaleString("es-ES")} turismos nuevos` : ""}
          </p>
        </div>
        {bevEntry && (
          <div className="bg-green-50 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full">
            BEV {bevEntry.pct.toFixed(1)}% · Electrificado {electrified}%
          </div>
        )}
      </div>

      {/* Month selector */}
      <div className="flex flex-wrap gap-1 mb-5">
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

      {/* Bar chart */}
      <div className="space-y-2.5">
        {sorted.map((entry) => {
          const barPct = (entry.count / maxCount) * 100;
          const color = COLORS[entry.code] ?? "#e2e8f0";
          return (
            <div key={entry.code} className="flex items-center gap-2.5">
              {/* Label */}
              <div className="w-32 shrink-0 flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs text-gray-700 truncate leading-tight">
                  {entry.type}
                </span>
              </div>
              {/* Bar */}
              <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                <div
                  className="h-5 rounded-full transition-all duration-300"
                  style={{ width: `${barPct}%`, backgroundColor: color, opacity: 0.85 }}
                />
              </div>
              {/* Count */}
              <div className="w-20 shrink-0 text-right text-xs font-semibold text-gray-800 tabular-nums">
                {entry.count.toLocaleString("es-ES")}
              </div>
              {/* Pct */}
              <div className="w-10 shrink-0 text-right text-xs text-gray-400 tabular-nums">
                {entry.pct.toFixed(1)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
