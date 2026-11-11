/**
 * Servicio de Turnos (Sprint 3: US-29, US-30, US-31, US-41 y la agenda de
 * US-27) sobre Prisma/Neon.
 *
 * Las reglas de tiempo y estado viven en `lib/domain/turno.ts`; acá se leen y
 * escriben los datos y se aplican esas reglas dentro de transacciones. Los
 * errores de negocio se lanzan como `ApiError` (igual que coberturas y stock),
 * para que las server actions los muestren y una futura API REST los convierta
 * en JSON.
 *
 * Los ids de paciente y de médico los recibe siempre de la sesión
 * (`requirePaciente` / `requireMedico`), nunca del formulario.
 */

import type { $Enums } from "@/generated/prisma/client";
import { listarFranjas, type RangoFechas } from "./agenda-repository";
import { ApiError } from "./api";
import { generarTurnos, type FechaISO } from "./domain/agenda";
import {
  MSG_MEDICO_NO_DISPONIBLE,
  MSG_PACIENTE_YA_TIENE_TURNO,
  MSG_TURNO_NO_CANCELABLE,
  MSG_TURNO_NO_CERRABLE,
  MSG_TURNO_NO_DISPONIBLE,
  MSG_TURNO_NO_ENCONTRADO,
  claveSlot,
  esFuturo,
  horariosLibres,
  momentoEnArgentina,
  motivoNoCancelable,
  puedeCerrarse,
  rangoReservable,
  seSuperponen,
  type EstadoTurno,
  type Horario,
  type TipoTurno,
} from "./domain/turno";
import { aFechaDb, aFechaISO } from "./fecha-db";
import { getPrisma } from "./prisma";
import { especialidadFromEnum } from "./prisma-user-repository";

// ---------------------------------------------------------------------------
// Tipos que consumen las páginas
// ---------------------------------------------------------------------------

export interface MedicoReservable {
  id: string;
  nombreCompleto: string;
  matricula: string | null;
  especialidad: string | null;
  coberturas: { id: string; nombre: string }[];
}

/** Turno tal como lo ve el paciente en "Mis turnos" (US-30). */
export interface TurnoDePaciente extends Horario {
  id: string;
  tipo: TipoTurno;
  estado: EstadoTurno;
  medico: string | null;
  especialidad: string | null;
  vacuna: string | null;
}

/** Turno tal como lo ve el médico en su agenda (US-27 con cambios del Sprint 3). */
export interface TurnoDeAgenda extends Horario {
  id: string;
  estado: EstadoTurno;
  paciente: { nombreCompleto: string; dni: string | null; cobertura: string | null };
}

function nombreCompleto(persona: { firstName: string | null; lastName: string | null }) {
  return `${persona.firstName ?? ""} ${persona.lastName ?? ""}`.trim();
}

function nombreCobertura(paciente: {
  esParticular: boolean;
  cobertura: { nombre: string } | null;
}): string | null {
  return paciente.cobertura?.nombre ?? (paciente.esParticular ? "Particular" : null);
}

/**
 * Qué columna única se violó en un error P2002 de Prisma, o `null` si el error
 * es otro. Con el adapter de Neon el nombre de la columna puede venir en
 * `meta` o en el mensaje, así que se buscan ambos.
 */
function columnaUnicaViolada(error: unknown): "slotMedico" | "slotPaciente" | "otra" | null {
  if (typeof error !== "object" || error === null || !("code" in error) || error.code !== "P2002") {
    return null;
  }
  const detalle = `${JSON.stringify((error as { meta?: unknown }).meta ?? {})} ${String(
    (error as { message?: unknown }).message ?? "",
  )}`;
  if (detalle.includes("slotPaciente")) return "slotPaciente";
  if (detalle.includes("slotMedico")) return "slotMedico";
  return "otra";
}

// ---------------------------------------------------------------------------
// US-29 — Reservar turno
// ---------------------------------------------------------------------------

const SELECT_MEDICO_RESERVABLE = {
  id: true,
  firstName: true,
  lastName: true,
  matricula: true,
  especialidad: true,
  coberturasAceptadas: {
    select: { cobertura: { select: { id: true, nombre: true } } },
    orderBy: { cobertura: { nombre: "asc" } },
  },
} as const;

function aMedicoReservable(fila: {
  id: string;
  firstName: string | null;
  lastName: string | null;
  matricula: string | null;
  especialidad: $Enums.Especialidad | null;
  coberturasAceptadas: { cobertura: { id: string; nombre: string } }[];
}): MedicoReservable {
  return {
    id: fila.id,
    nombreCompleto: nombreCompleto(fila),
    matricula: fila.matricula,
    especialidad: especialidadFromEnum(fila.especialidad),
    coberturas: fila.coberturasAceptadas.map((c) => c.cobertura),
  };
}

/** Médicos activos de una especialidad, con las coberturas que aceptan (CA4). */
export async function listarMedicosReservables(
  especialidad: $Enums.Especialidad,
): Promise<MedicoReservable[]> {
  const filas = await getPrisma().user.findMany({
    where: { role: "MEDICO", isActive: true, especialidad },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: SELECT_MEDICO_RESERVABLE,
  });
  return filas.map(aMedicoReservable);
}

/** Un médico activo, o `null` si no existe o está dado de baja. */
export async function obtenerMedicoReservable(medicoId: string): Promise<MedicoReservable | null> {
  const fila = await getPrisma().user.findFirst({
    where: { id: medicoId, role: "MEDICO", isActive: true },
    select: SELECT_MEDICO_RESERVABLE,
  });
  return fila ? aMedicoReservable(fila) : null;
}

/** Horarios libres de un médico, de hoy en adelante (pasos 2 y 3 de US-29). */
export async function horariosLibresDeMedico(medicoId: string, ahora: Date): Promise<Horario[]> {
  const prisma = getPrisma();
  const activo = await prisma.user.count({ where: { id: medicoId, role: "MEDICO", isActive: true } });
  if (activo === 0) {
    throw new ApiError(404, MSG_MEDICO_NO_DISPONIBLE);
  }

  const rango = rangoReservable(momentoEnArgentina(ahora).fecha);
  const [franjas, ocupados] = await Promise.all([
    listarFranjas(medicoId, rango),
    prisma.turno.findMany({
      where: {
        medicoId,
        estado: { not: "CANCELADO" },
        fecha: { gte: aFechaDb(rango.desde), lte: aFechaDb(rango.hasta) },
      },
      select: { fecha: true, inicioMin: true, finMin: true },
    }),
  ]);

  return horariosLibres(
    franjas,
    ocupados.map((o) => ({ ...o, fecha: aFechaISO(o.fecha) })),
    ahora,
  );
}

/**
 * Reserva un turno de consulta (US-29). En una transacción vuelve a comprobar
 * que el médico siga activo, que el horario exista en sus franjas, que sea
 * futuro y que no se superponga con otro turno del médico ni del paciente.
 * Si dos reservas llegan a la vez, las columnas únicas `slotMedico` /
 * `slotPaciente` hacen fallar la segunda (CA2 y CA3).
 */
export async function reservarTurno(
  datos: { pacienteId: string; medicoId: string; fecha: FechaISO; inicioMin: number },
  ahora: Date,
): Promise<{ id: string }> {
  const { pacienteId, medicoId, fecha, inicioMin } = datos;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !Number.isInteger(inicioMin)) {
    throw new ApiError(422, MSG_TURNO_NO_DISPONIBLE);
  }

  try {
    return await getPrisma().$transaction(async (tx) => {
      const medico = await tx.user.findFirst({
        where: { id: medicoId, role: "MEDICO", isActive: true },
        select: { especialidad: true },
      });
      if (!medico?.especialidad) {
        throw new ApiError(409, MSG_MEDICO_NO_DISPONIBLE);
      }

      const franjas = await tx.franjaHoraria.findMany({
        where: { medicoId, fecha: aFechaDb(fecha) },
        select: { inicioMin: true, finMin: true, duracionTurnoMin: true },
      });
      const turnoDeFranja = franjas
        .flatMap((f) => generarTurnos(f, f.duracionTurnoMin).turnos)
        .find((t) => t.inicioMin === inicioMin);
      const horario = turnoDeFranja && { fecha, inicioMin, finMin: turnoDeFranja.finMin };
      if (!horario || !esFuturo(horario, ahora)) {
        throw new ApiError(409, MSG_TURNO_NO_DISPONIBLE);
      }

      const delDia = await tx.turno.findMany({
        where: {
          fecha: aFechaDb(fecha),
          estado: { not: "CANCELADO" },
          OR: [{ medicoId }, { pacienteId }],
        },
        select: { medicoId: true, pacienteId: true, inicioMin: true, finMin: true },
      });
      const choca = (t: { inicioMin: number; finMin: number }) =>
        seSuperponen(horario, { fecha, inicioMin: t.inicioMin, finMin: t.finMin });
      if (delDia.some((t) => t.medicoId === medicoId && choca(t))) {
        throw new ApiError(409, MSG_TURNO_NO_DISPONIBLE);
      }
      if (delDia.some((t) => t.pacienteId === pacienteId && choca(t))) {
        throw new ApiError(409, MSG_PACIENTE_YA_TIENE_TURNO);
      }

      return tx.turno.create({
        data: {
          tipo: "CONSULTA",
          pacienteId,
          medicoId,
          especialidad: medico.especialidad,
          fecha: aFechaDb(fecha),
          inicioMin,
          finMin: horario.finMin,
          slotMedico: claveSlot(medicoId, fecha, inicioMin),
          slotPaciente: claveSlot(pacienteId, fecha, inicioMin),
        },
        select: { id: true },
      });
    });
  } catch (error) {
    const columna = columnaUnicaViolada(error);
    if (columna === "slotPaciente") throw new ApiError(409, MSG_PACIENTE_YA_TIENE_TURNO);
    if (columna !== null) throw new ApiError(409, MSG_TURNO_NO_DISPONIBLE);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// US-30 y US-31 — Mis turnos y cancelación
// ---------------------------------------------------------------------------

/** Todos los turnos del paciente, de consulta y de vacunación (US-30). */
export async function listarTurnosDePaciente(pacienteId: string): Promise<TurnoDePaciente[]> {
  const filas = await getPrisma().turno.findMany({
    where: { pacienteId },
    orderBy: [{ fecha: "asc" }, { inicioMin: "asc" }],
    select: {
      id: true,
      tipo: true,
      estado: true,
      fecha: true,
      inicioMin: true,
      finMin: true,
      especialidad: true,
      medico: { select: { firstName: true, lastName: true } },
      vacuna: { select: { nombre: true } },
    },
  });
  return filas.map((f) => ({
    id: f.id,
    tipo: f.tipo,
    estado: f.estado,
    fecha: aFechaISO(f.fecha),
    inicioMin: f.inicioMin,
    finMin: f.finMin,
    medico: f.medico ? nombreCompleto(f.medico) : null,
    especialidad: especialidadFromEnum(f.especialidad),
    vacuna: f.vacuna?.nombre ?? null,
  }));
}

/**
 * Cancela un turno de consulta del paciente (US-31): solo si está reservado y
 * faltan al menos 24 horas. El horario vuelve a quedar libre porque las
 * columnas de slot pasan a `null`.
 */
export async function cancelarTurno(pacienteId: string, turnoId: string, ahora: Date): Promise<void> {
  const prisma = getPrisma();
  const turno = await prisma.turno.findFirst({
    where: { id: turnoId, pacienteId },
    select: { tipo: true, estado: true, fecha: true, inicioMin: true, finMin: true },
  });
  if (!turno) {
    throw new ApiError(404, MSG_TURNO_NO_ENCONTRADO);
  }

  const motivo = motivoNoCancelable({ ...turno, fecha: aFechaISO(turno.fecha) }, ahora);
  if (motivo) {
    throw new ApiError(409, motivo);
  }

  const resultado = await prisma.turno.updateMany({
    where: { id: turnoId, pacienteId, estado: "RESERVADO" },
    data: { estado: "CANCELADO", slotMedico: null, slotPaciente: null },
  });
  if (resultado.count === 0) {
    throw new ApiError(409, MSG_TURNO_NO_CANCELABLE);
  }
}

// ---------------------------------------------------------------------------
// Agenda del médico (US-27) y US-41 — Ausente
// ---------------------------------------------------------------------------

/** Turnos no cancelados del médico en el rango (los cancelados liberan el horario). */
export async function listarTurnosDeMedico(
  medicoId: string,
  rango: RangoFechas,
): Promise<TurnoDeAgenda[]> {
  const filas = await getPrisma().turno.findMany({
    where: {
      medicoId,
      estado: { not: "CANCELADO" },
      fecha: { gte: aFechaDb(rango.desde), lte: aFechaDb(rango.hasta) },
    },
    orderBy: [{ fecha: "asc" }, { inicioMin: "asc" }],
    select: {
      id: true,
      estado: true,
      fecha: true,
      inicioMin: true,
      finMin: true,
      paciente: {
        select: {
          firstName: true,
          lastName: true,
          dni: true,
          esParticular: true,
          cobertura: { select: { nombre: true } },
        },
      },
    },
  });
  return filas.map((f) => ({
    id: f.id,
    estado: f.estado,
    fecha: aFechaISO(f.fecha),
    inicioMin: f.inicioMin,
    finMin: f.finMin,
    paciente: {
      nombreCompleto: nombreCompleto(f.paciente),
      dni: f.paciente.dni,
      cobertura: nombreCobertura(f.paciente),
    },
  }));
}

/**
 * Turnos reservados del médico desde una fecha en adelante. Los usa la
 * configuración de la agenda para no romper reservas (cambios del Sprint 3
 * sobre US-25 y US-28).
 */
export async function turnosReservadosDesde(
  medicoId: string,
  desde: FechaISO,
): Promise<TurnoDeAgenda[]> {
  const turnos = await listarTurnosDeMedico(medicoId, { desde, hasta: "9999-12-31" });
  return turnos.filter((t) => t.estado === "RESERVADO");
}

/** Marca como ausente un turno reservado del médico, de hoy o de días anteriores (US-41). */
export async function marcarAusente(medicoId: string, turnoId: string, ahora: Date): Promise<void> {
  const prisma = getPrisma();
  const turno = await prisma.turno.findFirst({
    where: { id: turnoId, medicoId, tipo: "CONSULTA" },
    select: { estado: true, fecha: true },
  });
  if (!turno) {
    throw new ApiError(404, MSG_TURNO_NO_ENCONTRADO);
  }
  const hoy = momentoEnArgentina(ahora).fecha;
  if (!puedeCerrarse({ estado: turno.estado, fecha: aFechaISO(turno.fecha) }, hoy)) {
    throw new ApiError(409, MSG_TURNO_NO_CERRABLE);
  }

  const resultado = await prisma.turno.updateMany({
    where: { id: turnoId, medicoId, estado: "RESERVADO" },
    data: { estado: "AUSENTE" },
  });
  if (resultado.count === 0) {
    throw new ApiError(409, MSG_TURNO_NO_CERRABLE);
  }
}

export { nombreCobertura, nombreCompleto };
