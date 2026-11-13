import { instanteDeTurno, type EstadoTurno } from "./turno";
import type { FechaISO } from "./agenda";

export const ANTICIPACION_RECORDATORIO_MS = 24 * 60 * 60 * 1000;

/** Un turno reservado es elegible mientras falte hasta un día para que empiece. */
export function estaEnVentanaRecordatorio(
  turno: { fecha: FechaISO; inicioMin: number; estado: EstadoTurno },
  ahora: Date,
): boolean {
  if (turno.estado !== "RESERVADO") {
    return false;
  }

  const faltaMs =
    instanteDeTurno(turno.fecha, turno.inicioMin).getTime() - ahora.getTime();
  return faltaMs > 0 && faltaMs <= ANTICIPACION_RECORDATORIO_MS;
}
