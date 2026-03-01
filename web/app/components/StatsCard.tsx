"use client";

interface Props {
  title: string;
  value: string;
  sub?: string;
  trend?: number; // % change vs previous year
  color?: string;
}

export default function StatsCard({ title, value, sub, trend, color = "green" }: Props) {
  const trendColor = trend === undefined ? "" : trend >= 0 ? "text-green-600" : "text-red-500";
  const trendArrow = trend === undefined ? "" : trend >= 0 ? "↑" : "↓";

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex flex-col gap-1">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
      <p className={`text-2xl font-bold text-gray-900`}>{value}</p>
      {sub && <p className="text-sm text-gray-500">{sub}</p>}
      {trend !== undefined && (
        <p className={`text-sm font-medium ${trendColor}`}>
          {trendArrow} {Math.abs(trend).toFixed(1)}% vs año anterior
        </p>
      )}
    </div>
  );
}
