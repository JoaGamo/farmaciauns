/**
 * Dominio de turnos e historia clínica (Sprint 3: US-29, US-30, US-31, US-40,
 * US-41 y US-42) — tipos y reglas PURAS.
 *
 * Igual que `agenda.ts`: sin I/O, determinista y usable en servidor y cliente.
 * Usa las mismas convenciones de la agenda: fechas como `FechaISO`
 * ("YYYY-MM-DD") y horas como minutos desde las 00:00, en hora de Argentina.
 *
 * "Ahora" siempre llega por parámetro, para poder testear los bordes (las 24
 * horas justas de US-31, un turno de hoy que ya empezó, etc.).
 */

import {
  MESES_HACIA_ADELANTE,
  generarTurnos,
  mesDeFecha,
  sumarMeses,
  ultimoDiaDelMes,
  type FechaISO,
} from "./agenda";
import { MSG_CAMPO_OBLIGATORIO, type CampoError } from "./usuario";

// ---------------------------------------------------------------------------
// Tipos (espejo de los enums de Prisma, sin importar Prisma)
// ---------------------------------------------------------------------------

export type TipoTurno = "CONSULTA" | "VACUNACION";

export type EstadoTurno = "RESERVADO" | "ATENDIDO" | "AUSENTE" | "CANCELADO";

/** Horario de un día: lo mínimo para comparar turnos entre sí. */
export interface Horario {
  fecha: FechaISO;
  inicioMin: number;
  finMin: number;
}

/** Datos de un turno que usan las reglas de este módulo. */
export interface TurnoBase extends Horario {
  tipo: TipoTurno;
  estado: EstadoTurno;
}

/** Franja guardada de la agenda, con la duración vigente al guardarla. */
export interface FranjaConDuracion extends Horario {
  duracionTurnoMin: number;
}

export interface DatosRegistroClinico {
  diagnostico: string;
  tratamiento: string;
}

// ---------------------------------------------------------------------------
// Constantes y mensajes (textos exactos de los CA donde los hay)
// ---------------------------------------------------------------------------

/**
 * Argentina usa UTC−3 todo el año (sin horario de verano desde 2009), así que
 * el desplazamiento es fijo y se puede calcular sin `Intl`.
 */
export const DESPLAZAMIENTO_ARGENTINA_MIN = -180;
/** US-31: se puede cancelar hasta 24 horas antes del turno. */
export const HORAS_MINIMAS_CANCELACION = 24;
/** Tope defensivo para diagnóstico y tratamiento (no lo fija ningún CA). */
export const LARGO_MAXIMO_TEXTO_CLINICO = 5000;

export const MSG_TURNO_NO_DISPONIBLE = "Este turno ya no está disponible";
export const MSG_MEDICO_NO_DISPONIBLE = "El médico no está disponible para reservar turnos";
export const MSG_TURNO_NO_ENCONTRADO = "No encontramos el turno";
export const MSG_PACIENTE_YA_TIENE_TURNO =
  "Ya tenés un turno que se superpone con ese horario";
export const MSG_SIN_TURNOS_MEDICO = "No hay turnos disponibles para este médico";
export const MSG_SIN_TURNOS_RESERVADOS = "No tenés turnos reservados";
export const MSG_CANCELACION_FUERA_DE_PLAZO =
  "Solo se puede cancelar hasta 24 horas antes";
export const MSG_TURNO_NO_CANCELABLE = "Este turno no se puede cancelar";
export const MSG_TURNO_NO_CERRABLE =
  "Solo se pueden registrar turnos reservados de hoy o de días anteriores";
export const MSG_HISTORIA_VACIA = "Todavía no tenés registros en tu historia clínica";
export const MSG_TEXTO_CLINICO_LARGO = `Puede tener hasta ${LARGO_MAXIMO_TEXTO_CLINICO} caracteres`;

const ETIQUETAS_ESTADO: Record<EstadoTurno, string> = {
  RESERVADO: "Reservado",
  ATENDIDO: "Atendido",
  AUSENTE: "Ausente",
  CANCELADO: "Cancelado",
};

const ETIQUETAS_TIPO: Record<TipoTurno, string> = {
  CONSULTA: "Consulta",
  VACUNACION: "Vacunación",
};

export function etiquetaEstado(estado: EstadoTurno): string {
  return ETIQUETAS_ESTADO[estado];
}

export function etiquetaTipo(tipo: TipoTurno): string {
  return ETIQUETAS_TIPO[tipo];
}

// ---------------------------------------------------------------------------
// Tiempo
// ---------------------------------------------------------------------------

/** Instante absoluto en que empieza un turno (`fecha` + `inicioMin`, hora de Argentina). */
export function instanteDeTurno(fecha: FechaISO, inicioMin: number): Date {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const medianocheUtc = Date.UTC(anio, mes - 1, dia);
  return new Date(medianocheUtc + (inicioMin - DESPLAZAMIENTO_ARGENTINA_MIN) * 60_000);
}

/** Fecha y minuto del día en hora de Argentina para un instante dado. */
export function momentoEnArgentina(ahora: Date): { fecha: FechaISO; minuto: number } {
  const local = new Date(ahora.getTime() + DESPLAZAMIENTO_ARGENTINA_MIN * 60_000);
  return {
    fecha: local.toISOString().slice(0, 10),
    minuto: local.getUTCHours() * 60 + local.getUTCMinutes(),
  };
}

/** True si el turno todavía no empezó. */
export function esFuturo(horario: Pick<Horario, "fecha" | "inicioMin">, ahora: Date): boolean {
  return instanteDeTurno(horario.fecha, horario.inicioMin).getTime() > ahora.getTime();
}

// ---------------------------------------------------------------------------
// Horarios
// ---------------------------------------------------------------------------

/** Dos horarios del mismo día se superponen si se pisan; tocarse no cuenta. */
export function seSuperponen(a: Horario, b: Horario): boolean {
  return a.fecha === b.fecha && a.inicioMin < b.finMin && b.inicioMin < a.finMin;
}

/**
 * Clave de las columnas únicas `slotMedico` / `slotPaciente` del modelo
 * `Turno`. Se guarda mientras el turno no está cancelado.
 */
export function claveSlot(id: string, fecha: FechaISO, inicioMin: number): string {
  return `${id}|${fecha}|${inicioMin}`;
}

/**
 * Horarios libres de un médico (US-29): los turnos que generan sus franjas,
 * menos los que se superponen con un turno activo (no cancelado) y menos los
 * que ya empezaron. Ordenados por fecha y hora.
 */
export function horariosLibres(
  franjas: FranjaConDuracion[],
  ocupados: Horario[],
  ahora: Date,
): Horario[] {
  return franjas
    .flatMap((franja) =>
      generarTurnos(franja, franja.duracionTurnoMin).turnos.map((t) => ({
        fecha: franja.fecha,
        inicioMin: t.inicioMin,
        finMin: t.finMin,
      })),
    )
    .filter((h) => esFuturo(h, ahora))
    .filter((h) => !ocupados.some((o) => seSuperponen(h, o)))
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.inicioMin - b.inicioMin);
}

/**
 * Fechas en las que se ofrecen turnos (US-29): desde hoy hasta el último mes
 * en que el médico puede cargar disponibilidad (decisión 3: sin otro límite).
 */
export function rangoReservable(hoy: FechaISO): { desde: FechaISO; hasta: FechaISO } {
  return {
    desde: hoy,
    hasta: ultimoDiaDelMes(sumarMeses(mesDeFecha(hoy), MESES_HACIA_ADELANTE)),
  };
}

/** Fechas (sin repetir, ordenadas) que tienen al menos un horario libre. */
export function diasConHorarios(horarios: Horario[]): FechaISO[] {
  return [...new Set(horarios.map((h) => h.fecha))].sort();
}

/**
 * Turnos reservados que dejarían de existir con un nuevo conjunto de franjas
 * (cambios del Sprint 3 sobre US-25 y US-28). Un turno sigue cubierto si las
 * nuevas franjas generan exactamente ese horario.
 */
export function turnosSinCubrir<T extends Horario>(
  turnos: T[],
  franjas: FranjaConDuracion[],
): T[] {
  const generados = new Set(
    franjas.flatMap((f) =>
      generarTurnos(f, f.duracionTurnoMin).turnos.map(
        (t) => `${f.fecha}|${t.inicioMin}|${t.finMin}`,
      ),
    ),
  );
  return turnos.filter((t) => !generados.has(`${t.fecha}|${t.inicioMin}|${t.finMin}`));
}

// ---------------------------------------------------------------------------
// Reglas por estado
// ---------------------------------------------------------------------------

/**
 * US-30: "Próximos" son los turnos reservados que todavía no empezaron, del más
 * cercano al más lejano. Todo lo demás va a "Anteriores", del más reciente al
 * más antiguo, con su estado (un turno pasado que el médico no cerró se ve
 * como Reservado).
 */
export function clasificarTurnos<T extends TurnoBase>(
  turnos: T[],
  ahora: Date,
): { proximos: T[]; anteriores: T[] } {
  const porMomento = (a: T, b: T) =>
    a.fecha.localeCompare(b.fecha) || a.inicioMin - b.inicioMin;
  const proximos = turnos
    .filter((t) => t.estado === "RESERVADO" && esFuturo(t, ahora))
    .sort(porMomento);
  const anteriores = turnos
    .filter((t) => !proximos.includes(t))
    .sort((a, b) => porMomento(b, a));
  return { proximos, anteriores };
}

/**
 * US-31: motivo por el que el paciente no puede cancelar el turno, o `null` si
 * puede. Solo consultas reservadas, con al menos 24 horas de anticipación.
 */
export function motivoNoCancelable(turno: TurnoBase, ahora: Date): string | null {
  if (turno.tipo !== "CONSULTA" || turno.estado !== "RESERVADO") {
    return MSG_TURNO_NO_CANCELABLE;
  }
  const faltaMs = instanteDeTurno(turno.fecha, turno.inicioMin).getTime() - ahora.getTime();
  if (faltaMs < HORAS_MINIMAS_CANCELACION * 60 * 60_000) {
    return MSG_CANCELACION_FUERA_DE_PLAZO;
  }
  return null;
}

/**
 * US-40 y US-41: "Atender" y "Ausente" solo se ofrecen en turnos reservados de
 * hoy o de días anteriores.
 */
export function puedeCerrarse(
  turno: Pick<TurnoBase, "estado" | "fecha">,
  hoy: FechaISO,
): boolean {
  return turno.estado === "RESERVADO" && turno.fecha <= hoy;
}

// ---------------------------------------------------------------------------
// Historia clínica (US-40)
// ---------------------------------------------------------------------------

/** Valida diagnóstico y tratamiento; devuelve los errores por campo. */
export function validarRegistroClinico(datos: DatosRegistroClinico): CampoError {
  const errores: CampoError = {};
  for (const campo of ["diagnostico", "tratamiento"] as const) {
    const valor = datos[campo].trim();
    if (valor === "") {
      errores[campo] = MSG_CAMPO_OBLIGATORIO;
    } else if (valor.length > LARGO_MAXIMO_TEXTO_CLINICO) {
      errores[campo] = MSG_TEXTO_CLINICO_LARGO;
    }
  }
  return errores;
}
