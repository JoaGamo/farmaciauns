/**
 * Conversión entre `FechaISO` ("YYYY-MM-DD") y columnas `@db.Date` de Prisma.
 *
 * Prisma representa un `DATE` de Postgres como medianoche UTC, así que la
 * conversión usa UTC y el día nunca se corre por zona horaria. La usan la
 * agenda (`FranjaHoraria`) y los turnos (`Turno`).
 */

import type { FechaISO } from "./domain/agenda";

export function aFechaDb(fecha: FechaISO): Date {
  return new Date(`${fecha}T00:00:00.000Z`);
}

export function aFechaISO(fecha: Date): FechaISO {
  return fecha.toISOString().slice(0, 10);
}
