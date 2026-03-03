"""
Agrega los registros parseados y genera los JSON estáticos para la web.
"""
from __future__ import annotations

import json
import unicodedata
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
    "CITROEN": "Citroën", "CITROEËN": "Citroën",
}

def _norm_brand(raw: str) -> str:
    s = raw.strip()
    return _BRAND_MAP.get(s.upper(), s.title())

def _ascii_upper(s: str) -> str:
    """Convierte a mayúsculas eliminando diacríticos (para comparaciones sin acento)."""
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii").upper()

def _norm_model(brand_raw: str, model_raw: str) -> str:
    """
    Elimina prefijos de marketing y de marca del campo MODELO DGT.
    El orden importa: en DGT el MODELO viene como 'NUEVO CITROËN C3 TUR',
    primero hay que quitar 'NUEVO ', luego el prefijo de marca.
    Usa comparación sin acentos para cubrir 'CITROEN' vs 'CITROËN'.
    """
    b_len = len(brand_raw.strip())        # longitud real del campo MARCA
    b_fold = _ascii_upper(brand_raw)      # MARCA sin acentos en mayúsculas
    m = model_raw.strip()

    # 1. Eliminar prefijos de marketing (van ANTES del nombre en DGT)
    for prefix in ("NUEVO ", "NUEVA ", "NEW "):
        if m.upper().startswith(prefix):
            m = m[len(prefix):]
            break

    # 2. Eliminar prefijo de marca si está repetido tras quitar marketing
    #    (usa comparación sin acentos: 'CITROËN' == 'CITROEN' a efectos del match)
    m_fold = _ascii_upper(m)
    if m_fold.startswith(b_fold + " "):
        m = m[b_len + 1:]
    elif m_fold == b_fold:
        m = ""

    return m.title().strip()


# ── Mapa de provincias (código DGT → nombre) ──────────────────────────────────

_PROVINCE_MAP: dict[str, str] = {
    "A": "Alicante", "AB": "Albacete", "AL": "Almería", "AV": "Ávila",
    "B": "Barcelona", "BA": "Badajoz", "BI": "Vizcaya", "BU": "Burgos",
    "C": "A Coruña", "CA": "Cádiz", "CC": "Cáceres", "CE": "Ceuta",
    "CO": "Córdoba", "CR": "Ciudad Real", "CS": "Castellón", "CU": "Cuenca",
    "GC": "Las Palmas", "GI": "Girona", "GR": "Granada", "GU": "Guadalajara",
    "H": "Huelva", "HU": "Huesca", "IB": "Baleares",
    "J": "Jaén", "L": "Lleida", "LE": "León", "LO": "La Rioja", "LU": "Lugo",
    "M": "Madrid", "MA": "Málaga", "ME": "Melilla", "MU": "Murcia",
    "NA": "Navarra", "O": "Asturias", "OR": "Ourense",
    "P": "Palencia", "PM": "Baleares", "PO": "Pontevedra",
    "S": "Cantabria", "SA": "Salamanca", "SE": "Sevilla",
    "SG": "Segovia", "SO": "Soria", "SS": "Guipúzcoa",
    "T": "Tarragona", "TE": "Teruel", "TF": "S.C. Tenerife", "TO": "Toledo",
    "V": "Valencia", "VA": "Valladolid", "VI": "Álava",
    "Z": "Zaragoza", "ZA": "Zamora",
}


# ── Estructuras de datos ──────────────────────────────────────────────────────

class DataStore:
    def __init__(self):
        # BEV diario total: {year: {date_iso: count}}
        self.bev_daily: dict[int, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        # BEV diario solo particulares: {year: {date_iso: count}}
        self.bev_daily_nd: dict[int, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        # Totales por motorización total: {year: {month_str: {motorization: count}}}
        self.motorization: dict[int, dict[str, dict[str, int]]] = defaultdict(
            lambda: defaultdict(lambda: defaultdict(int))
        )
        # Totales por motorización solo particulares
        self.motorization_nd: dict[int, dict[str, dict[str, int]]] = defaultdict(
            lambda: defaultdict(lambda: defaultdict(int))
        )
        # Marcas/modelos BEV total: {year: {month_str: {(brand, model): count}}}
        self.brands: dict[int, dict[str, dict[tuple, int]]] = defaultdict(
            lambda: defaultdict(lambda: defaultdict(int))
        )
        # Marcas/modelos BEV solo particulares
        self.brands_nd: dict[int, dict[str, dict[tuple, int]]] = defaultdict(
            lambda: defaultdict(lambda: defaultdict(int))
        )
        # Provincias BEV total: {year: {month_str: {province_code: count}}}
        self.provinces: dict[int, dict[str, dict[str, int]]] = defaultdict(
            lambda: defaultdict(lambda: defaultdict(int))
        )
        # Provincias BEV solo particulares
        self.provinces_nd: dict[int, dict[str, dict[str, int]]] = defaultdict(
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
            canal = record.get("IND_NUEVO_USADO", "").strip()
            is_particular = (canal == "ND")

            # Acumular motorización
            self.motorization[year][month][motoriz] += 1
            if is_particular:
                self.motorization_nd[year][month][motoriz] += 1

            # Acumular BEV diario, marcas, provincias
            if motoriz == "BEV":
                self.bev_daily[year][date_iso] += 1
                if is_particular:
                    self.bev_daily_nd[year][date_iso] += 1

                brand = _norm_brand(record["MARCA"])
                model = _norm_model(record["MARCA"], record["MODELO"])
                self.brands[year][month][(brand, model)] += 1
                if is_particular:
                    self.brands_nd[year][month][(brand, model)] += 1

                prov_code = record.get("COD_PROVINCIA_LETRA", "").strip()
                if prov_code:
                    self.provinces[year][month][prov_code] += 1
                    if is_particular:
                        self.provinces_nd[year][month][prov_code] += 1

            count += 1
        return count


# ── Generadores de JSON ───────────────────────────────────────────────────────

def _load_past_months_from_json(store: DataStore, out_dir: Path) -> None:
    """
    Carga brands, motorization y provinces desde los JSON existentes para los
    meses que aún no están en el store (= meses anteriores al mes en curso).
    Esto evita que el modo de actualización diaria (que solo procesa el mes
    actual) sobreescriba con datos vacíos los meses históricos.
    """
    # ── brands_models.json ──────────────────────────────────────────────────
    brands_file = out_dir / "brands_models.json"
    if brands_file.exists():
        try:
            existing = json.loads(brands_file.read_text(encoding="utf-8"))
            for mk, entries in existing.get("months", {}).items():
                y, mo = int(mk[:4]), mk[5:7]
                if mo not in store.brands.get(y, {}):
                    for e in entries:
                        key = (e["brand"], e["model"])
                        store.brands[y][mo][key] = e["count"]
                        if nd := e.get("nd_count", 0):
                            store.brands_nd[y][mo][key] = nd
        except Exception:
            pass

    # ── motorization.json ───────────────────────────────────────────────────
    mot_file = out_dir / "motorization.json"
    if mot_file.exists():
        try:
            existing = json.loads(mot_file.read_text(encoding="utf-8"))
            for mk, data in existing.get("months", {}).items():
                y, mo = int(mk[:4]), mk[5:7]
                if mo not in store.motorization.get(y, {}):
                    for t in data.get("types", []):
                        code = t["code"]
                        store.motorization[y][mo][code] = t["count"]
                        if nd := t.get("nd_count", 0):
                            store.motorization_nd[y][mo][code] = nd
        except Exception:
            pass

    # ── provinces.json ──────────────────────────────────────────────────────
    prov_file = out_dir / "provinces.json"
    if prov_file.exists():
        try:
            existing = json.loads(prov_file.read_text(encoding="utf-8"))
            for mk, entries in existing.get("months", {}).items():
                y, mo = int(mk[:4]), mk[5:7]
                if mo not in store.provinces.get(y, {}):
                    for e in entries:
                        store.provinces[y][mo][e["code"]] = e["count"]
                        if nd := e.get("nd_count", 0):
                            store.provinces_nd[y][mo][e["code"]] = nd
        except Exception:
            pass


def write_all(store: DataStore, out_dir: Path, updated: str) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)

    # Preservar meses históricos de los JSON existentes (el modo diario solo
    # procesa el mes en curso; sin esto se perderían meses anteriores).
    _load_past_months_from_json(store, out_dir)

    _write_bev_daily(store, out_dir, updated)
    _write_monthly_comparison(store, out_dir, updated)
    _write_brands_models(store, out_dir, updated)
    _write_motorization(store, out_dir, updated)
    _write_provinces(store, out_dir, updated)
    _write_meta(store, out_dir, updated)
    print(f"✅ JSON escritos en {out_dir}")


def _write_bev_daily(store: DataStore, out_dir: Path, updated: str) -> None:
    for year, daily in store.bev_daily.items():
        nd_daily = store.bev_daily_nd.get(year, {})
        payload = {
            "year": year,
            "updated": updated,
            "daily": sorted(
                [{"date": d, "count": c, "nd_count": nd_daily.get(d, 0)}
                 for d, c in daily.items()],
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
                {"brand": b, "model": m, "count": c,
                 "nd_count": nd_combos.get((b, m), 0)}
                for (b, m), c in top
            ]
    _save(out_dir / "brands_models.json", {"updated": updated, "months": months_data})


def _write_motorization(store: DataStore, out_dir: Path, updated: str) -> None:
    LABELS = {
        "BEV": "Eléctrico (BEV)", "PHEV": "Híbrido enchufable (PHEV)",
        "HEV": "Híbrido (HEV/MHEV)", "Gasolina": "Gasolina",
        "Diésel": "Diésel", "Gas": "GLP / GNC", "Otros": "Otros",
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
                    "type": LABELS.get(code, code), "code": code,
                    "count": count,
                    "pct": round(count / total * 100, 1),
                    "nd_count": nd_count,
                    "nd_pct": round(nd_count / nd_total * 100, 1) if nd_total > 0 else 0.0,
                })
            months_data[key] = {"total": total, "nd_total": nd_total, "types": row}
    _save(out_dir / "motorization.json", {"updated": updated, "months": months_data})


def _write_provinces(store: DataStore, out_dir: Path, updated: str) -> None:
    months_data: dict[str, list] = {}
    for year, months in store.provinces.items():
        for month, provs in months.items():
            key = f"{year}-{month}"
            nd_provs = store.provinces_nd.get(year, {}).get(month, {})
            top = sorted(provs.items(), key=lambda x: -x[1])[:52]  # todas las provincias
            months_data[key] = [
                {
                    "code": code,
                    "name": _PROVINCE_MAP.get(code, code),
                    "count": cnt,
                    "nd_count": nd_provs.get(code, 0),
                }
                for code, cnt in top
            ]
    _save(out_dir / "provinces.json", {"updated": updated, "months": months_data})


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
