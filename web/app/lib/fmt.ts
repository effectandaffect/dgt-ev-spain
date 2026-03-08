/** Formatea un número entero con puntos de miles (estilo español). */
export function fmt(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
