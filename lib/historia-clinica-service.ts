/**
 * Servicio de Historia Clínica (Sprint 3: US-40 y US-42) sobre Prisma/Neon.
 *
 * Los registros son inmutables: este módulo solo los crea y los lee. Crear un
 * registro y pasar el turno a "Atendido" ocurre en la misma transacción.
 */

import { ApiError } from "./api";
import {
  MSG_TURNO_NO_CERRABLE,
  MSG_TURNO_NO_ENCONTRADO,
  momentoEnArgentina,
  puedeCerrarse,
  validarRegistroClinico,
  type DatosRegistroClinico,
  type EstadoTurno,
  type Horario,
} from "./domain/turno";
import { aFechaISO } from "./fecha-db";
import { getPrisma } from "./prisma";
import { especialidadFromEnum } from "./prisma-user-repository";
import { nombreCobertura, nombreCompleto } from "./turno-service";

/** Registro de la historia clínica tal como se muestra (US-40 y US-42). */
export interface RegistroDeHistoria extends Horario {
  id: string;
  medico: string;
  especialidad: string | null;
  diagnostico: string;
  tratamiento: string;
}

/** Datos de la pantalla "Atención de paciente" (US-40). */
export interface TurnoParaAtender extends Horario {
  id: string;
  estado: EstadoTurno;
  especialidad: string | null;
  medico: string;
  paciente: {
    id: string;
    nombreCompleto: string;
    dni: string | null;
    cobertura: string | null;
    numeroAfiliado: string | null;
  };
}

/** Historia clínica de un paciente, del turno más reciente al más antiguo. */
export async function historiaClinicaDePaciente(pacienteId: string): Promise<RegistroDeHistoria[]> {
  const filas = await getPrisma().registroClinico.findMany({
    where: { pacienteId },
    orderBy: [{ turno: { fecha: "desc" } }, { turno: { inicioMin: "desc" } }],
    select: {
      id: true,
      especialidad: true,
      diagnostico: true,
      tratamiento: true,
      medico: { select: { firstName: true, lastName: true } },
      turno: { select: { fecha: true, inicioMin: true, finMin: true } },
    },
  });
  return filas.map((f) => ({
    id: f.id,
    fecha: aFechaISO(f.turno.fecha),
    inicioMin: f.turno.inicioMin,
    finMin: f.turno.finMin,
    medico: nombreCompleto(f.medico),
    especialidad: especialidadFromEnum(f.especialidad),
    diagnostico: f.diagnostico,
    tratamiento: f.tratamiento,
  }));
}

/** Turno de consulta del médico, con los datos del paciente, o `null` si no es suyo. */
export async function obtenerTurnoParaAtender(
  medicoId: string,
  turnoId: string,
): Promise<TurnoParaAtender | null> {
  const turno = await getPrisma().turno.findFirst({
    where: { id: turnoId, medicoId, tipo: "CONSULTA" },
    select: {
      id: true,
      estado: true,
      fecha: true,
      inicioMin: true,
      finMin: true,
      especialidad: true,
      medico: { select: { firstName: true, lastName: true } },
      paciente: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          dni: true,
          numeroAfiliado: true,
          esParticular: true,
          cobertura: { select: { nombre: true } },
        },
      },
    },
  });
  if (!turno) {
    return null;
  }
  return {
    id: turno.id,
    estado: turno.estado,
    fecha: aFechaISO(turno.fecha),
    inicioMin: turno.inicioMin,
    finMin: turno.finMin,
    especialidad: especialidadFromEnum(turno.especialidad),
    medico: turno.medico ? nombreCompleto(turno.medico) : "",
    paciente: {
      id: turno.paciente.id,
      nombreCompleto: nombreCompleto(turno.paciente),
      dni: turno.paciente.dni,
      cobertura: nombreCobertura(turno.paciente),
      numeroAfiliado: turno.paciente.numeroAfiliado,
    },
  };
}

/**
 * Registra la atención de un turno (US-40): agrega el registro a la historia
 * clínica y pasa el turno a "Atendido", en una sola transacción. Solo turnos
 * reservados del médico, de hoy o de días anteriores (CA4).
 */
export async function registrarAtencion(
  medicoId: string,
  turnoId: string,
  datos: DatosRegistroClinico,
  ahora: Date,
): Promise<void> {
  const errores = validarRegistroClinico(datos);
  if (Object.keys(errores).length > 0) {
    throw new ApiError(422, Object.values(errores)[0]);
  }

  const hoy = momentoEnArgentina(ahora).fecha;
  await getPrisma().$transaction(async (tx) => {
    const turno = await tx.turno.findFirst({
      where: { id: turnoId, medicoId, tipo: "CONSULTA" },
      select: {
        estado: true,
        fecha: true,
        pacienteId: true,
        especialidad: true,
        medico: { select: { especialidad: true } },
      },
    });
    if (!turno) {
      throw new ApiError(404, MSG_TURNO_NO_ENCONTRADO);
    }
    if (!puedeCerrarse({ estado: turno.estado, fecha: aFechaISO(turno.fecha) }, hoy)) {
      throw new ApiError(409, MSG_TURNO_NO_CERRABLE);
    }
    const especialidad = turno.especialidad ?? turno.medico?.especialidad;
    if (!especialidad) {
      throw new ApiError(409, "El médico no tiene una especialidad asignada");
    }

    const actualizado = await tx.turno.updateMany({
      where: { id: turnoId, medicoId, estado: "RESERVADO" },
      data: { estado: "ATENDIDO" },
    });
    if (actualizado.count === 0) {
      throw new ApiError(409, MSG_TURNO_NO_CERRABLE);
    }

    await tx.registroClinico.create({
      data: {
        turnoId,
        pacienteId: turno.pacienteId,
        medicoId,
        especialidad,
        diagnostico: datos.diagnostico.trim(),
        tratamiento: datos.tratamiento.trim(),
      },
    });
  });
}
