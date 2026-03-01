"""
Descargador de ficheros MATRABA de la DGT.
"""
from __future__ import annotations

import time
from datetime import date, timedelta
from pathlib import Path

import requests

from config import BASE_URL, BASE_URL_MONTHLY

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; DGT-matriculaciones-bot/1.0; "
        "+https://github.com/tu-usuario/dgt-ev-spain)"
    )
}
TIMEOUT = 30


def build_url(d: date) -> str:
    return BASE_URL.format(
        year=d.year,
        month=d.month,
        date=d.strftime("%Y%m%d"),
    )


def download_zip(d: date, cache_dir: Path | None = None) -> bytes | None:
    """
    Descarga el ZIP de matriculaciones de un día concreto.
    Si cache_dir se proporciona, guarda/lee el fichero en disco.
    Devuelve bytes o None si no está disponible.
    """
    if cache_dir:
        cache_path = cache_dir / f"export_mat_{d.strftime('%Y%m%d')}.zip"
        if cache_path.exists():
            return cache_path.read_bytes()

    url = build_url(d)
    try:
        resp = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        data = resp.content
        if cache_dir:
            cache_dir.mkdir(parents=True, exist_ok=True)
            cache_path.write_bytes(data)
        return data
    except requests.RequestException as e:
        print(f"  ⚠️  Error descargando {url}: {e}")
        return None


def download_monthly_zip(year: int, month: int, cache_dir: Path | None = None) -> bytes | None:
    """
    Descarga el ZIP mensual consolidado de un mes concreto.
    Solo disponible para años pasados (2025 y anteriores).
    """
    if cache_dir:
        cache_path = cache_dir / f"export_mensual_mat_{year}{month:02d}.zip"
        if cache_path.exists():
            return cache_path.read_bytes()

    url = BASE_URL_MONTHLY.format(year=year, month=month, yyyymm=f"{year}{month:02d}")
    try:
        resp = requests.get(url, headers=HEADERS, timeout=60)
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        data = resp.content
        if cache_dir:
            cache_dir.mkdir(parents=True, exist_ok=True)
            cache_path.write_bytes(data)
        return data
    except requests.RequestException as e:
        print(f"  ⚠️  Error descargando {url}: {e}")
        return None


def download_year_monthly(
    year: int,
    cache_dir: Path | None = None,
    delay: float = 2.0,
) -> dict[int, bytes]:
    """
    Descarga los 12 archivos mensuales de un año completo.
    Devuelve {month: bytes}.
    """
    results: dict[int, bytes] = {}
    for month in range(1, 13):
        print(f"  ⬇️  Descargando mensual {year}-{month:02d}...")
        data = download_monthly_zip(year, month, cache_dir)
        if data:
            results[month] = data
            print(f"     ✅ {len(data):,} bytes")
        else:
            print(f"     ⏭  No disponible")
        time.sleep(delay)
    return results


def download_range(
    start: date,
    end: date,
    cache_dir: Path | None = None,
    delay: float = 1.0,
) -> dict[date, bytes]:
    """
    Descarga todos los días entre start y end (inclusive).
    Omite fines de semana y festivos nacionales básicos.
    """
    results: dict[date, bytes] = {}
    current = start
    while current <= end:
        # La DGT solo publica días laborables
        if current.weekday() < 5:
            print(f"  ⬇️  Descargando {current.isoformat()}...")
            data = download_zip(current, cache_dir)
            if data:
                results[current] = data
                print(f"     ✅ {len(data):,} bytes")
            else:
                print(f"     ⏭  No disponible")
            time.sleep(delay)
        current += timedelta(days=1)
    return results
