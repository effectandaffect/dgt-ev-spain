"""
Parser del fichero de ancho fijo MATRABA de la DGT.
"""
from __future__ import annotations

import io
import zipfile
from datetime import date, datetime
from pathlib import Path
from typing import Generator

from config import FIELDS, TURISMO_COD_TIPOS, TURISMO_CATEGORIA_PREFIX


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
        # El zip contiene un único fichero .txt
        name = zf.namelist()[0]
        with zf.open(name) as fh:
            # Primera línea = cabecera informativa, la saltamos
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
    f = FIELDS
    try:
        return {k: line[s:e].strip() for k, (s, e) in f.items()}
    except Exception:
        return None


# ── Filtros ───────────────────────────────────────────────────────────────────

def is_turismo(r: dict) -> bool:
    """Turismo = tipo 01 o categoría M1 (01xxx), solo vehículos nuevos."""
    tipo = r["COD_TIPO_VEHICULO"]
    cat  = r["COD_CATEGORIA_VEH"]
    nuevo = r["IND_NUEVO_USADO"] in ("ND", "NX", "N")
    is_car = tipo in TURISMO_COD_TIPOS or cat.startswith(TURISMO_CATEGORIA_PREFIX)
    return is_car and nuevo


# ── Clasificación de motorización ─────────────────────────────────────────────

def get_motorization(r: dict) -> str:
    """Devuelve la motorización del vehículo."""
    carroceria  = r["COD_CARROCERIA"]
    combustible = r["COD_COMBUSTIBLE"]
    hibrido     = r["TIPO_HIBRIDO"]
    cilindrada  = r["CILINDRADA"]

    from config import (
        BEV_TIPO_HIBRIDO, BEV_CARROCERIA, BEV_COMBUSTIBLE,
        PHEV_TIPO_HIBRIDO, PHEV_COMBUSTIBLE,
        HEV_TIPO_HIBRIDO,
        DIESEL_CARROCERIA, DIESEL_COMBUSTIBLE,
        GASOLINA_CARROCERIA, GASOLINA_COMBUSTIBLE,
        GAS_COMBUSTIBLE,
    )

    # BEV: tipo_hibrido indica eléctrico, o carrocería/combustible eléctrico,
    #       o cilindrada 0 con potencia (fallback)
    if (hibrido in BEV_TIPO_HIBRIDO
            or carroceria in BEV_CARROCERIA
            or combustible in BEV_COMBUSTIBLE):
        return "BEV"

    # Fallback BEV: cilindrada vacía o 0 con código HEV vacío
    cil = cilindrada.lstrip("0") or "0"
    if cil == "0" and not hibrido:
        potencia = r.get("POTENCIA_CV", "").strip()
        if potencia and potencia.lstrip("0"):
            return "BEV"

    # PHEV (híbrido enchufable): HEV + código de combustible PHEV
    if hibrido in PHEV_TIPO_HIBRIDO and combustible in PHEV_COMBUSTIBLE:
        return "PHEV"

    # HEV (híbrido no enchufable)
    if hibrido in HEV_TIPO_HIBRIDO:
        return "HEV"

    # Diésel
    if carroceria in DIESEL_CARROCERIA or combustible in DIESEL_COMBUSTIBLE:
        return "Diésel"

    # Gasolina
    if carroceria in GASOLINA_CARROCERIA or combustible in GASOLINA_COMBUSTIBLE:
        return "Gasolina"

    # GLP / GNC
    if combustible in GAS_COMBUSTIBLE:
        return "Gas"

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
    """
    Devuelve los valores únicos de los campos de clasificación.
    Útil para descubrir los códigos reales del primer fichero descargado.
    """
    from collections import Counter
    combos: Counter = Counter()
    n = 0
    for r in iter_records(source):
        if not is_turismo(r):
            continue
        key = (
            r["COD_CARROCERIA"],
            r["COD_COMBUSTIBLE"],
            r["TIPO_HIBRIDO"],
        )
        combos[key] += 1
        n += 1
        if n >= max_records:
            break
    return {
        "total_turismos": n,
        "combos_carroceria_combustible_hibrido": dict(combos.most_common(40)),
    }
