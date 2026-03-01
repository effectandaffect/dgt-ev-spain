"""
Agrega los registros parseados y genera los JSON estáticos para la web.
"""
from __future__ import annotations

import json
from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import Iterable

from parser import get_motorization, is_turismo, iter_records, parse_date


# ── Estructuras de datos ──────────────────────────────────────────────────────

class DataStore:
    def __init__(self):
        # BEV diario: {year: {date_iso: count}}
        self.bev_daily: dict[int, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        # Totales por motorización: {year: {month_str: {motorization: count}}}
        self.motorization: dict[int, dict[str, dict[str, int]]] = defaultdict(
            lambda: defaultdict(lambda: defaultdict(int))
        )
        # Marcas/modelos BEV: {year: {month_str: {(brand, model): count}}}
        self.brands: dict[int, dict[str, dict[tuple, int]]] = defaultdict(
            lambda: defaultdict(lambda: defaultdict(int))
        )

    def ingest_zip(self, data: bytes, file_date: date) -> int:
        """Procesa un ZIP de un día y acumula los datos. Devuelve registros procesados."""
        count = 0
        for record in iter_records(data):
            if not is_turismo(record):
                continue
            d = parse_date(record["FECHA_MATRICULACION"])
            if not d:
                d = file_date
            year = d.year
            month = d.strftime("%m")
            date_iso = d.isoformat()

            motoriz = get_motorization(record)

            # Acumular motorización total
            self.motorization[year][month][motoriz] += 1

            # Acumular BEV diario y por marca/modelo
            if motoriz == "BEV":
                self.bev_daily[year][date_iso] += 1
                brand = record["MARCA"].title().strip()
                model = record["MODELO"].title().strip()
                self.brands[year][month][(brand, model)] += 1

            count += 1
        return count


# ── Generadores de JSON ───────────────────────────────────────────────────────

def write_all(store: DataStore, out_dir: Path, updated: str) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)

    _write_bev_daily(store, out_dir, updated)
    _write_monthly_comparison(store, out_dir, updated)
    _write_brands_models(store, out_dir, updated)
    _write_motorization(store, out_dir, updated)
    _write_meta(store, out_dir, updated)
    print(f"✅ JSON escritos en {out_dir}")


def _write_bev_daily(store: DataStore, out_dir: Path, updated: str) -> None:
    for year, daily in store.bev_daily.items():
        payload = {
            "year": year,
            "updated": updated,
            "daily": sorted(
                [{"date": d, "count": c} for d, c in daily.items()],
                key=lambda x: x["date"],
            ),
        }
        _save(out_dir / f"bev_daily_{year}.json", payload)


def _write_monthly_comparison(store: DataStore, out_dir: Path, updated: str) -> None:
    years_data: dict[str, dict[str, dict]] = {}
    for year, months in store.bev_daily.items():
        monthly: dict[str, int] = defaultdict(int)
        for date_iso, count in months.items():
            month = date_iso[5:7]
            monthly[month] += count
        years_data[str(year)] = {
            m: {"total": c} for m, c in sorted(monthly.items())
        }
    _save(out_dir / "monthly_comparison.json", {"updated": updated, "years": years_data})


def _write_brands_models(store: DataStore, out_dir: Path, updated: str) -> None:
    months_data: dict[str, list] = {}
    for year, months in store.brands.items():
        for month, combos in months.items():
            key = f"{year}-{month}"
            top = sorted(combos.items(), key=lambda x: -x[1])[:20]
            months_data[key] = [
                {"brand": b, "model": m, "count": c} for (b, m), c in top
            ]
    _save(out_dir / "brands_models.json", {"updated": updated, "months": months_data})


def _write_motorization(store: DataStore, out_dir: Path, updated: str) -> None:
    LABELS = {
        "BEV": "Eléctrico (BEV)",
        "PHEV": "Híbrido enchufable (PHEV)",
        "HEV": "Híbrido (HEV/MHEV)",
        "Gasolina": "Gasolina",
        "Diésel": "Diésel",
        "Gas": "GLP / GNC",
        "Otros": "Otros",
    }
    ORDER = ["Gasolina", "Diésel", "HEV", "PHEV", "BEV", "Gas", "Otros"]
    months_data: dict[str, list] = {}
    for year, months in store.motorization.items():
        for month, mots in months.items():
            key = f"{year}-{month}"
            total = sum(mots.values())
            if total == 0:
                continue
            row = []
            for code in ORDER:
                count = mots.get(code, 0)
                row.append({
                    "type": LABELS.get(code, code),
                    "code": code,
                    "count": count,
                    "pct": round(count / total * 100, 1),
                })
            months_data[key] = {"total": total, "types": row}
    _save(out_dir / "motorization.json", {"updated": updated, "months": months_data})


def _write_meta(store: DataStore, out_dir: Path, updated: str) -> None:
    years = sorted(store.bev_daily.keys())
    meta: dict = {"updated": updated, "years": years, "summary": {}}
    for year in years:
        total_bev = sum(store.bev_daily[year].values())
        meta["summary"][str(year)] = {"total_bev": total_bev}
    _save(out_dir / "meta.json", meta)


def _save(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  📄 {path.name}")
