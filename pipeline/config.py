"""
DGT MATRABA – definición de campos del fichero de ancho fijo.
Posiciones 0-based, notación Python slice [start:end].
"""

# ── Posiciones de campos ─────────────────────────────────────────────────────
FIELDS = {
    "FECHA_MATRICULACION":  (0,   8),   # DDMMYYYY
    "MARCA":                (17,  47),  # 30 chars
    "MODELO":               (47,  67),  # 20 chars
    "COD_TIPO_VEHICULO":    (92,  95),  # '01'=turismo
    "CILINDRADA":           (95,  100),
    "CV_FISCALES":          (100, 106),
    "TARA_FICHA":           (106, 112),
    "NUM_PLAZAS":           (118, 120),
    "COD_PROVINCIA_LETRA":  (152, 154),
    "IND_NUEVO_USADO":      (178, 180), # ND/NX=nuevo, UD=usado
    "COD_MUNICIPIO_INE":    (192, 197),
    "MUNICIPIO_COMPRADOR":  (197, 228),
    "POTENCIA_CV":          (239, 242),
    "IND_OCASION":          (242, 243), # N=nuevo, S=segunda mano
    "FABRICANTE_NOMBRE":    (332, 402),
    "COD_CARROCERIA":       (430, 432), # AF=gasolina, AC=diésel
    "COD_COMBUSTIBLE":      (432, 434), # subcódigo combustible
    "NORMA_EMISION":        (437, 444), # EURO 5, EURO 6...
    "COD_CATEGORIA_VEH":    (449, 454), # 01000=M1 turismo
    "TIPO_HIBRIDO":         (454, 457), # HEV=híbrido, BEV=eléctrico
    "FECHA_ARCHIVO":        (706, 714), # DDMMYYYY
}

# ── Clasificación de tipo de turismo ─────────────────────────────────────────
# COD_TIPO_VEHICULO '01' o categoría M1 (01xxx)
TURISMO_COD_TIPOS = {"01", "1 ", " 1"}
TURISMO_CATEGORIA_PREFIX = "01"

# ── Clasificación de motorización ────────────────────────────────────────────
# NOTA: verificar con --explore en un fichero real si cambian los códigos
BEV_TIPO_HIBRIDO    = {"BEV", "ELE", "EV "}
BEV_CARROCERIA      = {"AE", "EL"}
BEV_COMBUSTIBLE     = {"16", "EL", "E ", " E"}

PHEV_TIPO_HIBRIDO   = {"HEV"}
PHEV_COMBUSTIBLE    = {"12", "14", "15"}   # PHEV tiene motor combustión

HEV_TIPO_HIBRIDO    = {"HEV"}              # HEV sin código PHEV

DIESEL_CARROCERIA   = {"AC", "AB", "AD"}
DIESEL_COMBUSTIBLE  = {"02", "03", "D ", " D"}

GASOLINA_CARROCERIA = {"AF", "AA", "AG", "AH"}
GASOLINA_COMBUSTIBLE = {"01", "G ", " G"}

GAS_COMBUSTIBLE     = {"06", "07", "08", "LP", "GN"}

# ── URL de descarga ───────────────────────────────────────────────────────────
BASE_URL = (
    "https://www.dgt.es/microdatos/salida/"
    "{year}/{month}/vehiculos/matriculaciones/"
    "export_mat_{date}.zip"
)

# URL para ficheros mensuales consolidados (disponibles para años pasados)
BASE_URL_MONTHLY = (
    "https://www.dgt.es/microdatos/salida/"
    "{year}/{month}/vehiculos/matriculaciones/"
    "export_mensual_mat_{yyyymm}.zip"
)

# ── Directorio de salida de datos (relativo a la raíz del proyecto) ───────────
DATA_OUTPUT_DIR = "web/public/data"
