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


# ── Normalización de nombres de marcas/modelos ────────────────────────────────

_BRAND_MAP: dict[str, str] = {
    "BYD": "BYD", "BMW": "BMW", "MG": "MG", "SEAT": "SEAT",
    "KIA": "Kia", "VW": "Volkswagen", "VOLKSWAGEN": "Volkswagen",
    "MINI": "Mini", "MERCEDES-BENZ": "Mercedes-Benz",
}

def _norm_brand(raw: str) -> str:
    s = raw.strip()
    return _BRAND_MAP.get(s.upper(), s.title())

def _norm_model(brand_raw: str, model_raw: str) -> str:
    """Elimina prefijo de marca del modelo si está repetido (ej: 'BYD BYD DOLPHIN SURF')."""
    b = brand_raw.strip().upper()
    m = model_raw.strip()
    if m.upper().startswith(b + " "):
        m = m[len(b) + 1:]
    elif m.upper() == b:
        m = ""
    return m.title().strip()


# ── Estructuras de datos ──────────────────────────────────────────────────────

class DataStore:
    def __init__(self):
        # BEV diario total: {year: {date_iso: count}}
        self.bev_daily: dict[int, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        # BEV diario solo particulares (IND_NUEVO_USADO='ND'): {year: {date_iso: count}}
        self.bev_daily_nd: dict[int, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        # Totales por motorización total: {year: {month_str: {motorization: count}}}
        self.motorization: dict[int, dict[str, dict[str, int]]] = defaultdict(
            lambda: defaultdict(lambda: defaultdict(int))
        )
        # Totales por motorización solo particulares: {year: {month_str: {motorization: count}}}
        self.motorization_nd: dict[int, dict[str, dict[str, int]]] = defaultdict(
            lambda: defaultdict(lambda: defaultdict(int))
        )
        # Marcas/modelos BEV total: {year: {month_str: {(brand, model): count}}}
        self.brands: dict[int, dict[str, dict[tuple, int]]] = defaultdict(
            lambda: defaultdict(lambda: defaultdict(int))
        )
        # Marcas/modelos BEV solo particulares: {year: {month_str: {(brand, model): count}}}
        self.brands_nd: dict[int, dict[str, dict[tuple, int]]] = defaultdict(
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
            # IND_NUEVO_USADO: 'ND' = venta a particular, 'NX' = flota/empresa
            canal = record.get("IND_NUEVO_USADO", "").strip()
            is_particular = (canal == "ND")

            # Acumular motorización total
            self.motorization[year][month][motoriz] += 1
            # Acumular motorización particulares
            if is_particular:
                self.motorization_nd[year][month][motoriz] += 1

            # Acumular BEV diario y por marca/modelo
            if motoriz == "BEV":
                self.bev_daily[year][date_iso] += 1
                if is_particular:
                    self.bev_daily_nd[year][date_iso] += 1
                brand = _norm_brand(record["MARCA"])
                model = _norm_model(record["MARCA"], record["MODELO"])
                self.brands[year][month][(brand, model)] += 1
                if is_particular:
                    self.brands_nd[year][month][(brand, model)] += 1

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
        nd_daily = store.bev_daily_nd.get(year, {})
        payload = {
            "year": year,
            "updated": updated,
            "daily": sorted(
                [
                    {
                        "date": d,
                        "count": c,
                        "nd_count": nd_daily.get(d, 0),  # solo particulares (ND)
                    }
                    for d, c in daily.items()
                ],
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
            nd_combos = store.brands_nd.get(year, {}).get(month, {})
            top = sorted(combos.items(), key=lambda x: -x[1])[:30]
            months_data[key] = [
                {
                    "brand": b,
                    "model": m,
                    "count": c,
                    "nd_count": nd_combos.get((b, m), 0),
                }
                for (b, m), c in top
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
    months_data: dict[str, dict] = {}
    for year, months in store.motorization.items():
        for month, mots in months.items():
            key = f"{year}-{month}"
            total = sum(mots.values())
            if total == 0:
                continue
            nd_mots = store.motorization_nd.get(year, {}).get(month, {})
            nd_total = sum(nd_mots.values())
            row = []
            for code in ORDER:
                count = mots.get(code, 0)
                nd_count = nd_mots.get(code, 0)
                row.append({
                    "type": LABELS.get(code, code),
                    "code": code,
                    "count": count,
                    "pct": round(count / total * 100, 1),
                    "nd_count": nd_count,
                    "nd_pct": round(nd_count / nd_total * 100, 1) if nd_total > 0 else 0.0,
                })
            months_data[key] = {"total": total, "nd_total": nd_total, "types": row}
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
