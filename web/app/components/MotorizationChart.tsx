"use client";

import { useMemo, useState } from "react";
import { fmt } from "../lib/fmt";

interface MotorizEntry {
  type: string;
  code: string;
  count: number;
  pct: number;
  nd_count: number;
  nd_pct: number;
}

interface MonthData {
  total: number;
  nd_total?: number;
  types: MotorizEntry[];
}

interface Props {
  months: Record<string, MonthData>;
  selectedYear: number;
  selectedMonth: string; // "01".."12"
  soloParticulares: boolean;
}

type TimeMode = "mes" | "año";

const COLORS: Record<string, string> = {
  BEV:      "#22c55e",
  PHEV:     "#4ade80",
  HEV:      "#fbbf24",
  Gasolina: "#60a5fa",
  "Diésel": "#94a3b8",
  Gas:      "#f97316",
  Otros:    "#c084fc",
};

export default function MotorizationChart({ months, selectedYear, selectedMonth, soloParticulares }: Props) {
  const [time, setTime] = useState<TimeMode>("mes");

  const monthKey = `${selectedYear}-${selectedMonth}`;

  // ── Vista mes ──────────────────────────────────────────────────────────────
  const monthData = months[monthKey];

  // ── Vista año: agrega todos los meses del año seleccionado ─────────────────
  const yearData = useMemo((): MonthData | undefined => {
    let total = 0;
    let nd_total = 0;
    const agg: Record<string, { type: string; count: number; nd_count: number }> = {};

    for (const [mk, data] of Object.entries(months)) {
      if (!mk.startsWith(String(selectedYear) + "-")) continue;
      total += data.total;
      nd_total += data.nd_total ?? 0;
      for (const t of data.types) {
        if (!agg[t.code]) agg[t.code] = { type: t.type, count: 0, nd_count: 0 };
        agg[t.code].count += t.count;
        agg[t.code].nd_count += t.nd_count;
      }
    }

    if (total === 0) return undefined;

    const types: MotorizEntry[] = Object.entries(agg).map(([code, d]) => ({
      code,
      type: d.type,
      count: d.count,
      pct: Math.round((d.count / total) * 1000) / 10,
      nd_count: d.nd_count,
      nd_pct: nd_total > 0 ? Math.round((d.nd_count / nd_total) * 1000) / 10 : 0,
    }));

    return { total, nd_total, types };
  }, [months, selectedYear]);

  const activeData = time === "mes" ? monthData : yearData;

  // Ordenar por count descendente según modo
  const sorted = [...(activeData?.types ?? [])].sort((a, b) =>
    soloParticulares ? b.nd_count - a.nd_count : b.count - a.count
  );
  const maxCount = sorted[0]
    ? (soloParticulares ? sorted[0].nd_count : sorted[0].count)
    : 1;

  const bevEntry  = sorted.find((d) => d.code === "BEV");
  const phevEntry = sorted.find((d) => d.code === "PHEV");
  const bevPct  = soloParticulares ? (bevEntry?.nd_pct  ?? 0) : (bevEntry?.pct  ?? 0);
  const phevPct = soloParticulares ? (phevEntry?.nd_pct ?? 0) : (phevEntry?.pct ?? 0);
  const electrified = (bevPct + phevPct).toFixed(1);

  const displayTotal = soloParticulares
    ? (activeData?.nd_total ?? 0)
    : (activeData?.total ?? 0);

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Cuota por motorización</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {activeData
              ? `${fmt(displayTotal)} turismos${soloParticulares ? " particulares" : ""}`
              : "Sin datos para este período"}
            {time === "año" && <span className="ml-1">· año completo {selectedYear}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {bevEntry && displayTotal > 0 && (
            <div className="bg-green-50 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full">
              BEV {bevPct.toFixed(1)}% · Electrificado {electrified}%
            </div>
          )}
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
      </div>

      {/* Bar chart */}
      {sorted.length === 0 || displayTotal === 0 ? (
        <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
          Sin datos para este período
        </div>
      ) : (
        <div className="space-y-2.5">
          {sorted.map((entry) => {
            const displayCount = soloParticulares ? entry.nd_count : entry.count;
            const displayPct   = soloParticulares ? entry.nd_pct   : entry.pct;
            const barPct = maxCount > 0 ? (displayCount / maxCount) * 100 : 0;
            const color = COLORS[entry.code] ?? "#e2e8f0";
            return (
              <div key={entry.code} className="flex items-center gap-2.5">
                {/* Label */}
                <div className="w-32 shrink-0 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-xs text-gray-700 truncate leading-tight">{entry.type}</span>
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
                  {fmt(displayCount)}
                </div>
                {/* Pct */}
                <div className="w-10 shrink-0 text-right text-xs text-gray-400 tabular-nums">
                  {displayPct.toFixed(1)}%
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
