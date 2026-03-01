"""
Pipeline principal: descarga datos de la DGT, parsea y genera JSON para la web.

Uso:
    python main.py                   # descarga hoy y actualiza
    python main.py --since 2025-01-01  # reconstruye desde fecha (lento)
    python main.py --explore          # muestra códigos únicos del último fichero
    python main.py --date 2026-02-28  # día concreto
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import date, timedelta
from pathlib import Path

# Añadir directorio actual al path para imports relativos
sys.path.insert(0, str(Path(__file__).parent))

from aggregator import DataStore, write_all
from downloader import download_range, download_zip
from parser import explore_codes

ROOT = Path(__file__).resolve().parents[1]
CACHE_DIR = ROOT / ".dgt_cache"
DATA_DIR = ROOT / "web" / "public" / "data"


def main():
    parser = argparse.ArgumentParser(description="Pipeline DGT Matriculaciones")
    parser.add_argument("--since",   help="Fecha inicio YYYY-MM-DD (reconstrucción)")
    parser.add_argument("--until",   help="Fecha fin YYYY-MM-DD (opcional, por defecto hoy)")
    parser.add_argument("--date",    help="Día concreto YYYY-MM-DD")
    parser.add_argument("--explore", action="store_true", help="Muestra códigos únicos")
    parser.add_argument("--no-cache", action="store_true", help="No usar caché local")
    args = parser.parse_args()

    cache = None if args.no_cache else CACHE_DIR

    # ── Modo exploración ──────────────────────────────────────────────────────
    if args.explore:
        today = date.today()
        print(f"🔍 Explorando códigos del fichero {today}...")
        data = download_zip(today, cache)
        if not data:
            # Intentar ayer
            data = download_zip(today - timedelta(days=1), cache)
        if not data:
            print("❌ No se pudo descargar fichero reciente.")
            sys.exit(1)
        result = explore_codes(data)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return

    # ── Determinar rango de fechas ─────────────────────────────────────────
    today = date.today()
    if args.date:
        start = end = date.fromisoformat(args.date)
    elif args.since:
        start = date.fromisoformat(args.since)
        end = date.fromisoformat(args.until) if args.until else today
    else:
        # Por defecto: hoy (o ayer si aún no publicado)
        start = end = today

    print(f"📅 Procesando {start} → {end}")

    # ── Cargar datos existentes (solo en modo actualización diaria, no en rebuild)
    store = DataStore()
    is_rebuild = bool(args.since)
    if not is_rebuild:
        # Actualización diaria: cargamos días previos del JSON para no perderlos
        _load_existing_data_into_store(store)

    # ── Descargar y procesar ──────────────────────────────────────────────────
    downloads = download_range(start, end, cache_dir=cache)
    if not downloads and start == end == today:
        # La DGT publica tarde, probar con ayer
        yesterday = today - timedelta(days=1)
        print(f"  ⚠️  Sin datos para hoy, probando {yesterday}...")
        downloads = download_range(yesterday, yesterday, cache_dir=cache)

    total_records = 0
    for d, data in sorted(downloads.items()):
        print(f"  🔄 Procesando {d.isoformat()}...")
        n = store.ingest_zip(data, d)
        total_records += n
        print(f"     {n:,} turismos procesados")

    if total_records == 0:
        print("⚠️  No se procesaron registros. Revisa la conexión y los rangos de fechas.")
        if not downloads:
            sys.exit(0)

    # ── Escribir JSON ──────────────────────────────────────────────────────────
    updated = today.isoformat()
    write_all(store, DATA_DIR, updated)
    print(f"\n✅ Pipeline completado. {total_records:,} registros procesados.")


def _load_existing_data_into_store(store: DataStore) -> None:
    """
    Re-carga los JSON ya generados en el store para no perder días anteriores.
    Solo carga bev_daily y motorization (los más importantes).
    """
    import datetime

    for bev_file in DATA_DIR.glob("bev_daily_*.json"):
        try:
            payload = json.loads(bev_file.read_text())
            year = payload["year"]
            for entry in payload.get("daily", []):
                store.bev_daily[year][entry["date"]] += entry["count"]
                nd = entry.get("nd_count", 0)
                if nd:
                    store.bev_daily_nd[year][entry["date"]] += nd
        except Exception:
            pass  # Si falla, simplemente re-descargamos

    # Nota: motorization y brands se recalculan de cero con --since
    # Para actualizaciones diarias, solo añadimos el nuevo día al bev_daily


if __name__ == "__main__":
    main()
