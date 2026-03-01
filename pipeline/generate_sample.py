"""
Genera datos de muestra realistas para desarrollo/demo.
Basado en datos públicos del mercado de VE en España.

Uso:
    python generate_sample.py
"""
from __future__ import annotations

import json
import random
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

random.seed(42)

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "web" / "public" / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# ── Parámetros del mercado (estimaciones realistas España) ────────────────────
MONTHLY_BEV_2025 = {
    "01": 3200, "02": 2800, "03": 4500, "04": 4200, "05": 5100,
    "06": 6800, "07": 5400, "08": 3900, "09": 7200, "10": 6500,
    "11": 5800, "12": 7100,
}
MONTHLY_BEV_2026 = {
    "01": 3800, "02": 3400, "03": 0,  # Mar en curso
}

# Total matriculaciones turismos (BEV + todos) por mes
MONTHLY_TOTAL_2025 = {
    "01": 75000, "02": 68000, "03": 88000, "04": 82000, "05": 90000,
    "06": 95000, "07": 72000, "08": 55000, "09": 98000, "10": 92000,
    "11": 85000, "12": 78000,
}
MONTHLY_TOTAL_2026 = {
    "01": 78000, "02": 71000, "03": 0,
}

# Distribución motorización (% del total de turismos)
MOTORIZ_DIST_2025 = {
    "Gasolina": 51.5, "Diésel": 14.8, "HEV": 19.2,
    "PHEV": 5.1, "BEV": 6.8, "Gas": 0.9, "Otros": 1.7,
}
MOTORIZ_DIST_2026 = {
    "Gasolina": 50.1, "Diésel": 13.5, "HEV": 20.4,
    "PHEV": 5.6, "BEV": 7.8, "Gas": 0.8, "Otros": 1.8,
}

BRANDS = [
    ("Tesla", "Model Y", 0.22),
    ("Tesla", "Model 3", 0.10),
    ("Byd", "Atto 3", 0.08),
    ("Volkswagen", "Id.4", 0.07),
    ("Byd", "Dolphin", 0.06),
    ("Hyundai", "Ioniq 6", 0.05),
    ("Kia", "Ev6", 0.05),
    ("Bmw", "Ix1", 0.04),
    ("Peugeot", "E-208", 0.04),
    ("Renault", "Megane E-Tech", 0.04),
    ("Byd", "Seal", 0.03),
    ("Audi", "Q4 E-Tron", 0.03),
    ("Kia", "Ev3", 0.03),
    ("Mercedes", "Eqa", 0.03),
    ("Hyundai", "Ioniq 5", 0.03),
    ("Volkswagen", "Id.3", 0.02),
    ("Skoda", "Enyaq", 0.02),
    ("Cupra", "Born", 0.02),
    ("Mini", "Cooper Se", 0.01),
    ("Otros", "Otros", 0.03),
]

# ── Generadores ───────────────────────────────────────────────────────────────

def gen_daily(monthly_totals: dict[str, int], year: int) -> list[dict]:
    """Distribuye el total mensual en días laborables con ruido realista."""
    entries = []
    for month_str, total in monthly_totals.items():
        if total == 0:
            continue
        month = int(month_str)
        # Días del mes
        if month == 12:
            days = [date(year, month, d) for d in range(1, 32) if _valid(year, month, d)]
        else:
            next_month = date(year, month + 1 if month < 12 else 1, 1)
            first = date(year, month, 1)
            days = [first + timedelta(i) for i in range((next_month - first).days)]
        workdays = [d for d in days if d.weekday() < 5]
        if not workdays:
            continue
        counts = _distribute(total, len(workdays))
        for d, c in zip(workdays, counts):
            if d <= date(2026, 3, 1):  # no datos futuros
                entries.append({"date": d.isoformat(), "count": c})
    return sorted(entries, key=lambda x: x["date"])


def _valid(year, month, day):
    try:
        date(year, month, day)
        return True
    except ValueError:
        return False


def _distribute(total: int, n: int) -> list[int]:
    """Distribuye total en n valores con varianza realista."""
    base = [max(0, int(total / n * random.gauss(1, 0.3))) for _ in range(n)]
    diff = total - sum(base)
    # Ajuste para cuadrar el total
    for i in range(abs(diff)):
        idx = random.randint(0, n - 1)
        base[idx] += 1 if diff > 0 else max(0, base[idx] - 1) and -1 or 0
    return base


def gen_brands(monthly_bev: dict[str, int], year: int) -> dict[str, list]:
    months_data = {}
    for month_str, total in monthly_bev.items():
        if total == 0:
            continue
        key = f"{year}-{month_str}"
        rows = []
        for brand, model, share in BRANDS:
            count = max(1, int(total * share * random.gauss(1, 0.1)))
            rows.append({"brand": brand, "model": model, "count": count})
        rows.sort(key=lambda x: -x["count"])
        months_data[key] = rows
    return months_data


def gen_motorization(monthly_total: dict[str, int], dist: dict[str, float], year: int) -> dict:
    LABELS = {
        "BEV": "Eléctrico (BEV)", "PHEV": "Híbrido enchufable (PHEV)",
        "HEV": "Híbrido (HEV/MHEV)", "Gasolina": "Gasolina",
        "Diésel": "Diésel", "Gas": "GLP / GNC", "Otros": "Otros",
    }
    months_data = {}
    for month_str, total in monthly_total.items():
        if total == 0:
            continue
        key = f"{year}-{month_str}"
        rows = []
        for code, pct in dist.items():
            actual_pct = pct * random.gauss(1, 0.02)
            count = max(0, int(total * actual_pct / 100))
            rows.append({"type": LABELS[code], "code": code, "count": count, "pct": round(actual_pct, 1)})
        months_data[key] = {"total": total, "types": rows}
    return months_data


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("🎲 Generando datos de muestra...")

    today = "2026-03-01"

    # bev_daily_2025.json
    daily_2025 = gen_daily(MONTHLY_BEV_2025, 2025)
    _save("bev_daily_2025.json", {"year": 2025, "updated": today, "daily": daily_2025})

    # bev_daily_2026.json
    daily_2026 = gen_daily(MONTHLY_BEV_2026, 2026)
    _save("bev_daily_2026.json", {"year": 2026, "updated": today, "daily": daily_2026})

    # monthly_comparison.json
    def monthly_sums(daily: list[dict]) -> dict:
        months: dict = defaultdict(int)
        for e in daily:
            m = e["date"][5:7]
            months[m] += e["count"]
        return {m: {"total": c} for m, c in sorted(months.items())}

    _save("monthly_comparison.json", {
        "updated": today,
        "years": {
            "2025": monthly_sums(daily_2025),
            "2026": monthly_sums(daily_2026),
        }
    })

    # brands_models.json
    brands_2025 = gen_brands(MONTHLY_BEV_2025, 2025)
    brands_2026 = gen_brands(MONTHLY_BEV_2026, 2026)
    _save("brands_models.json", {
        "updated": today,
        "months": {**brands_2025, **brands_2026},
    })

    # motorization.json
    mot_2025 = gen_motorization(MONTHLY_TOTAL_2025, MOTORIZ_DIST_2025, 2025)
    mot_2026 = gen_motorization(MONTHLY_TOTAL_2026, MOTORIZ_DIST_2026, 2026)
    _save("motorization.json", {
        "updated": today,
        "months": {**mot_2025, **mot_2026},
    })

    # meta.json
    total_bev_2025 = sum(e["count"] for e in daily_2025)
    total_bev_2026 = sum(e["count"] for e in daily_2026)
    _save("meta.json", {
        "updated": today,
        "years": [2025, 2026],
        "summary": {
            "2025": {"total_bev": total_bev_2025},
            "2026": {"total_bev": total_bev_2026},
        }
    })

    print(f"✅ Datos generados en {DATA_DIR}")
    print(f"   2025: {total_bev_2025:,} BEV | 2026 YTD: {total_bev_2026:,} BEV")


def _save(name: str, data: dict):
    path = DATA_DIR / name
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  📄 {name}")


if __name__ == "__main__":
    main()
