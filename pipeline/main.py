"""
Pipeline principal: descarga datos de la DGT, parsea y genera JSON para la web.

Uso:
    python main.py                       # actualización diaria (procesa el mes en curso completo)
    python main.py --year 2025           # descarga año completo via archivos mensuales
    python main.py --since 2026-01-01    # reconstruye desde fecha con archivos diarios
    python main.py --explore             # muestra códigos únicos del último fichero
    python main.py --date 2026-02-28     # día concreto
"""
from __future__ import annotations

import argparse
import calendar
import json
import sys
from datetime import date, timedelta
from pathlib import Path

# Añadir directorio actual al path para imports relativos
sys.path.insert(0, str(Path(__file__).parent))

from aggregator import DataStore, write_all
from downloader import download_range, download_zip, download_year_monthly, download_monthly_zip
from parser import explore_codes

ROOT = Path(__file__).resolve().parents[1]
CACHE_DIR = ROOT / ".dgt_cache"
DATA_DIR = ROOT / "web" / "public" / "data"


def main():
    parser = argparse.ArgumentParser(description="Pipeline DGT Matriculaciones")
    parser.add_argument("--year",    type=int, help="Año completo via archivos mensuales (ej: 2025)")
    parser.add_argument("--since",   help="Fecha inicio YYYY-MM-DD (reconstrucción con diarios)")
    parser.add_argument("--until",   help="Fecha fin YYYY-MM-DD (opcional, por defecto hoy)")
    parser.add_argument("--date",    help="Día concreto YYYY-MM-DD")
    parser.add_argument("--explore", action="store_true", help="Muestra códigos únicos")
    parser.add_argument("--no-cache", action="store_true", help="No usar caché local")
    args = parser.parse_args()

    cache = None if args.no_cache else CACHE_DIR
    today = date.today()

    # ── Modo exploración ──────────────────────────────────────────────────────
    if args.explore:
        print(f"🔍 Explorando códigos del fichero {today}...")
        data = download_zip(today, cache)
        if not data:
            data = download_zip(today - timedelta(days=1), cache)
        if not data:
            print("❌ No se pudo descargar fichero reciente.")
            sys.exit(1)
        result = explore_codes(data)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return

    # ── Modo año completo via mensuales ───────────────────────────────────────
    if args.year:
        year = args.year
        print(f"📅 Descargando año {year} completo via archivos mensuales...")
        store = DataStore()  # Rebuild limpio — sin cargar JSONs previos

        monthly_data = download_year_monthly(year, cache_dir=cache)
        total_records = 0
        for month, data in sorted(monthly_data.items()):
            ref_date = date(year, month, 1)
            print(f"  🔄 Procesando mensual {year}-{month:02d}...")
            n = store.ingest_zip(data, ref_date)
            total_records += n
            print(f"     {n:,} turismos procesados")

        if total_records == 0:
            print("⚠️  No se procesaron registros.")
            sys.exit(1)

        # Re-procesar también el año en curso desde caché para marcas/motorización
        if year < today.year:
            current_year = today.year
            print(f"\n  🔄 Añadiendo {current_year} desde caché (marcas/motorización)...")
            for month in range(1, today.month + 1):
                data = download_monthly_zip(current_year, month, cache_dir=cache)
                if data:
                    ref = date(current_year, month, 1)
                    n = store.ingest_zip(data, ref)
                    print(f"     Mensual {current_year}-{month:02d}: {n:,} registros")
                else:
                    # Intentar con archivos diarios del año en curso (en caché)
                    m_start = date(current_year, month, 1)
                    last_day = calendar.monthrange(current_year, month)[1]
                    m_end = min(date(current_year, month, last_day), today)
                    daily = download_range(m_start, m_end, cache_dir=cache, delay=0)
                    for d, data_d in sorted(daily.items()):
                        store.ingest_zip(data_d, d)
                    if daily:
                        print(f"     Diarios {current_year}-{month:02d}: {len(daily)} días desde caché")

        write_all(store, DATA_DIR, today.isoformat())
        print(f"\n✅ Año {year} completado. {total_records:,} registros procesados.")
        return

    # ── Modo actualización diaria (por defecto) ────────────────────────────────
    # Procesa el mes en curso completo para mantener brands/motorización correctas
    # y añade el nuevo día a bev_daily
    if not args.since and not args.date:
        month_start = today.replace(day=1)
        print(f"📅 Actualización diaria: procesando {month_start} → {today}")

        store = DataStore()
        # Cargar bev_daily de meses ANTERIORES al mes en curso (solo bev_daily, no brands)
        _load_existing_data_into_store(store, before_date=month_start)

        # Descargar y procesar todo el mes en curso (marcas/motorización completas)
        downloads = download_range(month_start, today, cache_dir=cache)
        if not downloads:
            # Si no hay datos del mes en curso, probar ayer
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
            print("⚠️  No se procesaron registros.")
            sys.exit(0)

        write_all(store, DATA_DIR, today.isoformat())
        print(f"\n✅ Pipeline completado. {total_records:,} registros procesados.")
        return

    # ── Modo fecha concreta ────────────────────────────────────────────────────
    if args.date:
        start = end = date.fromisoformat(args.date)
        print(f"📅 Procesando {start}")
        store = DataStore()
        _load_existing_data_into_store(store, before_date=start)
        downloads = download_range(start, end, cache_dir=cache)
        total_records = 0
        for d, data in sorted(downloads.items()):
            n = store.ingest_zip(data, d)
            total_records += n
        write_all(store, DATA_DIR, today.isoformat())
        print(f"\n✅ {total_records:,} registros procesados.")
        return

    # ── Modo reconstrucción desde fecha (--since) ──────────────────────────────
    start = date.fromisoformat(args.since)
    end = date.fromisoformat(args.until) if args.until else today
    print(f"📅 Reconstruyendo {start} → {end}")

    store = DataStore()
    # Cargar bev_daily previo a la fecha de inicio
    _load_existing_data_into_store(store, before_date=start)

    downloads = download_range(start, end, cache_dir=cache)
    total_records = 0
    for d, data in sorted(downloads.items()):
        print(f"  🔄 Procesando {d.isoformat()}...")
        n = store.ingest_zip(data, d)
        total_records += n
        print(f"     {n:,} turismos procesados")

    if total_records == 0:
        print("⚠️  No se procesaron registros.")
        sys.exit(0)

    write_all(store, DATA_DIR, today.isoformat())
    print(f"\n✅ Pipeline completado. {total_records:,} registros procesados.")


def _load_existing_data_into_store(
    store: DataStore,
    before_date: date | None = None,
    exclude_year: int | None = None,
) -> None:
    """
    Re-carga los bev_daily JSON para no perder datos de meses anteriores.
    before_date: si se especifica, solo carga entradas anteriores a esa fecha.
    exclude_year: si se especifica, no carga ese año.
    """
    for bev_file in DATA_DIR.glob("bev_daily_*.json"):
        try:
            payload = json.loads(bev_file.read_text())
            year = payload["year"]
            if exclude_year and year == exclude_year:
                continue
            for entry in payload.get("daily", []):
                d_str = entry["date"]
                if before_date and d_str >= before_date.isoformat():
                    continue  # saltar fechas en o después de before_date
                store.bev_daily[year][d_str] += entry["count"]
                nd = entry.get("nd_count", 0)
                if nd:
                    store.bev_daily_nd[year][d_str] += nd
        except Exception:
            pass


if __name__ == "__main__":
    main()
