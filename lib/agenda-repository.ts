/**
 * Acceso a datos de la agenda médica (RF-01) sobre Prisma/Neon.
 *
 * Solo lee y escribe: las reglas de negocio (qué fechas se pueden tocar, qué
 * franjas son válidas) viven en `lib/domain/agenda.ts` y las aplican las
 * server actions antes de llamar acá.
 *
 * Las fechas viajan como `FechaISO` ("YYYY-MM-DD") y se guardan en columnas
 * `@db.Date`. La conversión a `Date` usa medianoche UTC, que es como Prisma
 * representa un `DATE` de Postgres, así el día nunca se corre por zona horaria.
 */

import type { FechaISO, FranjaConFecha } from "./domain/agenda";
import { aFechaDb, aFechaISO } from "./fecha-db";
import { getPrisma } from "./prisma";

/** Franja persistida, con la duración de turno que tenía al guardarse. */
export interface FranjaGuardada extends FranjaConFecha {
  duracionTurnoMin: number;
}

/** Rango de fechas inclusivo. */
export interface RangoFechas {
  desde: FechaISO;
  hasta: FechaISO;
}

const CAMPOS_FRANJA = {
  fecha: true,
  inicioMin: true,
  finMin: true,
  duracionTurnoMin: true,
} as const;

function aFranjaGuardada(fila: {
  fecha: Date;
  inicioMin: number;
  finMin: number;
  duracionTurnoMin: number;
}): FranjaGuardada {
  return { ...fila, fecha: aFechaISO(fila.fecha) };
}

/** Duración de turno configurada por el médico, o `null` si todavía no la definió. */
export async function obtenerDuracionTurno(medicoId: string): Promise<number | null> {
  const configuracion = await getPrisma().configuracionAgenda.findUnique({
    where: { medicoId },
    select: { duracionTurnoMin: true },
  });
  return configuracion?.duracionTurnoMin ?? null;
}

/** Franjas del médico dentro del rango, ordenadas por fecha y hora. */
export async function listarFranjas(
  medicoId: string,
  { desde, hasta }: RangoFechas,
): Promise<FranjaGuardada[]> {
  const filas = await getPrisma().franjaHoraria.findMany({
    where: { medicoId, fecha: { gte: aFechaDb(desde), lte: aFechaDb(hasta) } },
    select: CAMPOS_FRANJA,
    orderBy: [{ fecha: "asc" }, { inicioMin: "asc" }],
  });
  return filas.map(aFranjaGuardada);
}

/** Franjas del médico desde una fecha en adelante (para validar un cambio de duración). */
export async function listarFranjasDesde(
  medicoId: string,
  desde: FechaISO,
): Promise<FranjaGuardada[]> {
  const filas = await getPrisma().franjaHoraria.findMany({
    where: { medicoId, fecha: { gte: aFechaDb(desde) } },
    select: CAMPOS_FRANJA,
    orderBy: [{ fecha: "asc" }, { inicioMin: "asc" }],
  });
  return filas.map(aFranjaGuardada);
}

/**
 * Guarda la duración de turno (US-25) y la aplica a las franjas desde `desde`
 * en adelante. Las franjas anteriores conservan la duración que tenían.
 */
export async function guardarDuracionTurno(
  medicoId: string,
  duracionTurnoMin: number,
  desde: FechaISO,
): Promise<void> {
  const prisma = getPrisma();
  await prisma.$transaction([
    prisma.configuracionAgenda.upsert({
      where: { medicoId },
      create: { medicoId, duracionTurnoMin },
      update: { duracionTurnoMin },
    }),
    prisma.franjaHoraria.updateMany({
      where: { medicoId, fecha: { gte: aFechaDb(desde) } },
      data: { duracionTurnoMin },
    }),
  ]);
}

/**
 * Reemplaza las franjas del médico dentro del rango por `franjas` (US-26 y
 * US-28), en una sola transacción. Lo que queda fuera del rango, como las
 * fechas pasadas, no se toca. Con `franjas` vacío, cierra la agenda en el rango.
 */
export async function reemplazarFranjas(
  medicoId: string,
  rango: RangoFechas,
  franjas: FranjaConFecha[],
  duracionTurnoMin: number,
): Promise<void> {
  const prisma = getPrisma();
  await prisma.$transaction([
    prisma.franjaHoraria.deleteMany({
      where: {
        medicoId,
        fecha: { gte: aFechaDb(rango.desde), lte: aFechaDb(rango.hasta) },
      },
    }),
    prisma.franjaHoraria.createMany({
      data: franjas.map((franja) => ({
        medicoId,
        fecha: aFechaDb(franja.fecha),
        inicioMin: franja.inicioMin,
        finMin: franja.finMin,
        duracionTurnoMin,
      })),
    }),
  ]);
}
