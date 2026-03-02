"use client";

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
  const monthKey = `${selectedYear}-${selectedMonth}`;
  const monthData = months[monthKey];

  // Sort by count descending (use nd values when soloParticulares)
  const sorted = [...(monthData?.types ?? [])].sort((a, b) =>
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
    ? (monthData?.nd_total ?? 0)
    : (monthData?.total ?? 0);

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Cuota por motorización</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {monthData
              ? `${displayTotal.toLocaleString("es-ES")} turismos nuevos${soloParticulares ? " (particulares)" : ""}`
              : "Sin datos para este período"}
          </p>
        </div>
        {bevEntry && displayTotal > 0 && (
          <div className="bg-green-50 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full">
            BEV {bevPct.toFixed(1)}% · Electrificado {electrified}%
          </div>
        )}
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
                  {displayCount.toLocaleString("es-ES")}
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
