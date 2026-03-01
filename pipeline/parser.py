"""
Parser del fichero de ancho fijo MATRABA de la DGT.

Códigos verificados con datos reales (feb 2026):
  - Turismo (M1):   COD_TIPO_VEHICULO='02'  y/o  COD_CATEGORIA_VEH starts '1000'
  - BEV:            TIPO_HIBRIDO='EV'  AND  CILINDRADA='0'
  - PHEV:           TIPO_HIBRIDO='EV'  AND  CILINDRADA > 0
  - HEV:            TIPO_HIBRIDO='HEV' AND  CILINDRADA > 0
  - Gasolina/Diésel/Gas: clasificados por COD_CARROCERIA y CILINDRADA
"""
from __future__ import annotations

import io
import zipfile
from datetime import date, datetime
from pathlib import Path
from typing import Generator

from config import FIELDS


# ── Lectura del fichero ───────────────────────────────────────────────────────

def iter_records(source: Path | bytes) -> Generator[dict, None, None]:
    """
    Itera sobre los registros de un fichero MATRABA.
    Acepta un Path a un .zip o los bytes del .zip en memoria.
    """
    if isinstance(source, bytes):
        zf = zipfile.ZipFile(io.BytesIO(source))
    else:
        zf = zipfile.ZipFile(source)

    with zf:
        name = zf.namelist()[0]
        with zf.open(name) as fh:
            first = True
            for raw in fh:
                line = raw.decode("iso-8859-1").rstrip("\r\n")
                if first:
                    first = False
                    continue
                if len(line) < 714:
                    continue
                record = _parse_line(line)
                if record:
                    yield record


def _parse_line(line: str) -> dict | None:
    try:
        return {k: line[s:e].strip() for k, (s, e) in FIELDS.items()}
    except Exception:
        return None


# ── Filtros ───────────────────────────────────────────────────────────────────

def is_turismo(r: dict) -> bool:
    """
    Turismo nuevo = COD_TIPO_VEHICULO '02' O categoría M1 (1000x).
    VERIFICADO con datos reales: Tesla, BYD, Renault, VW usan cod_tipo='02'.
    """
    tipo  = r["COD_TIPO_VEHICULO"]
    cat   = r["COD_CATEGORIA_VEH"]
    nuevo = r["IND_NUEVO_USADO"] in ("ND", "NX", "N", "")
    is_car = tipo == "02" or cat.startswith("1000")
    return is_car and nuevo


# ── Clasificación de motorización ─────────────────────────────────────────────

def _cil_zero(r: dict) -> bool:
    """True si la cilindrada es 0 (eléctrico puro)."""
    return r["CILINDRADA"].lstrip("0") == ""


def get_motorization(r: dict) -> str:
    """
    Clasifica la motorización basándose en los códigos reales DGT (verificados).

    Lógica probada con datos de feb 2026:
      BEV  = TIPO_HIBRIDO='EV' + CILINDRADA=0  (Tesla, BYD BEV, Renault 5, KIA EV3...)
      PHEV = TIPO_HIBRIDO='EV' + CILINDRADA>0  (VW T-ROC PHEV, Peugeot 2008 HYBRID...)
      HEV  = TIPO_HIBRIDO='HEV'                (Renault Rafale, VW Tiguan MHEV...)
      resto clasificado por COD_CARROCERIA
    """
    hibr  = r["TIPO_HIBRIDO"]
    carr  = r["COD_CARROCERIA"]

    if hibr == "EV":
        return "BEV" if _cil_zero(r) else "PHEV"

    if hibr == "HEV":
        return "HEV"

    # Sin marcador híbrido → clasificar por carrocería/combustible
    # Códigos verificados: AC=diésel, AF=gasolina alt, AB=gasolina, AA=gasolina,
    #                      BB=furgoneta/comercial, AD=diésel alt
    if carr in ("AC", "AD"):
        return "Diésel"
    if carr in ("AF", "AA", "AB", "AH", "AG"):
        return "Gasolina"
    if carr == "AE":
        return "Gas"

    # Fallback: si cilindrada=0 sin marca híbrida → podría ser BEV legacy
    if _cil_zero(r) and r.get("POTENCIA_CV", "").lstrip("0"):
        return "BEV"

    return "Otros"


# ── Conversión de fecha ───────────────────────────────────────────────────────

def parse_date(ddmmyyyy: str) -> date | None:
    """Convierte 'DDMMYYYY' en datetime.date."""
    try:
        return datetime.strptime(ddmmyyyy, "%d%m%Y").date()
    except Exception:
        return None


# ── Utilidad: explorar códigos únicos ─────────────────────────────────────────

def explore_codes(source: Path | bytes, max_records: int = 50_000) -> dict:
    """Muestra los combos de clasificación más frecuentes. Útil para verificar códigos."""
    from collections import Counter
    combos: Counter = Counter()
    n = 0
    for r in iter_records(source):
        if not is_turismo(r):
            continue
        key = (r["COD_CARROCERIA"], r["COD_COMBUSTIBLE"], r["TIPO_HIBRIDO"], r["CILINDRADA"])
        combos[key] += 1
        n += 1
        if n >= max_records:
            break
    return {
        "total_turismos": n,
        "combos": dict(combos.most_common(40)),
    }
