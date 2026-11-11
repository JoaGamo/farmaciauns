/**
 * Servicio de Coberturas Médicas (RF-05b).
 *
 * Contiene la lógica de negocio (agregar/quitar cobertura de médico, listar
 * disponibles, asignar/leer cobertura de paciente) sobre Prisma/Neon.
 *
 * Los errores de dominio se lanzan como `ApiError` (status + mensaje) para que
 * los route handlers REST los conviertan a JSON, y las server actions a
 * `FormState`.
 */

import { getPrisma } from "./prisma";
import { ApiError } from "./api";
import {
  MSG_AFILIADO_OBLIGATORIO,
  MSG_COBERTURA_NO_DISPONIBLE,
  MSG_COBERTURA_NO_ENCONTRADA,
  MSG_COBERTURA_OBLIGATORIA,
  MSG_COBERTURA_YA_ACEPTADA,
  esNombreCoberturaVacio,
  normalizarNombreCobertura,
} from "./domain/cobertura";

export type CoberturaResumen = { id: string; nombre: string };

/** Catálogo completo (autocomplete). `q` filtra case-insensitive. */
export async function listarCatalogoCoberturas(q?: string) {
  const prisma = getPrisma();
  const termino = q?.trim();
  const where = termino
    ? { nombreNormalizado: { contains: normalizarNombreCobertura(termino) } }
    : undefined;

  return prisma.cobertura.findMany({
    where,
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true },
  });
}

/** Coberturas disponibles para pacientes (≥1 médico activo la acepta). */
export async function listarCoberturasDisponibles() {
  const prisma = getPrisma();
  return prisma.cobertura.findMany({
    where: {
      medicos: { some: { medico: { role: "MEDICO", isActive: true } } },
    },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true },
  });
}

/** Coberturas que un médico concreto acepta ("Mis coberturas"). */
export async function listarCoberturasDeMedico(medicoId: string) {
  const prisma = getPrisma();
  return prisma.cobertura.findMany({
    where: { medicos: { some: { medicoId } } },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true },
  });
}

/** True si la cobertura tiene ≥1 médico activo que la acepta. */
export async function coberturaEstaDisponible(
  coberturaId: string,
): Promise<boolean> {
  const prisma = getPrisma();
  const n = await prisma.medicoCobertura.count({
    where: { coberturaId, medico: { role: "MEDICO", isActive: true } },
  });
  return n > 0;
}

/**
 * Agrega una cobertura al médico (crea el catálogo si no existe y el vínculo).
 * La unicidad case-insensitive se garantiza vía `nombreNormalizado`.
 */
export async function agregarCoberturaAMedico(
  medicoId: string,
  nombre: string,
): Promise<{ id: string; nombre: string }> {
  if (esNombreCoberturaVacio(nombre)) {
    throw new ApiError(422, MSG_COBERTURA_OBLIGATORIA);
  }

  const prisma = getPrisma();
  const normalizado = normalizarNombreCobertura(nombre);

  return prisma.$transaction(async (tx) => {
    let cobertura = await tx.cobertura.findUnique({
      where: { nombreNormalizado: normalizado },
    });

    if (!cobertura) {
      cobertura = await tx.cobertura.create({
        data: { nombre: nombre.trim(), nombreNormalizado: normalizado },
      });
    }

    const yaAceptada = await tx.medicoCobertura.findUnique({
      where: {
        medicoId_coberturaId: { medicoId, coberturaId: cobertura.id },
      },
    });
    if (yaAceptada) {
      throw new ApiError(409, MSG_COBERTURA_YA_ACEPTADA);
    }

    await tx.medicoCobertura.create({
      data: { medicoId, coberturaId: cobertura.id },
    });

    return { id: cobertura.id, nombre: cobertura.nombre };
  });
}

/**
 * Desvincula una cobertura del médico. Borra SOLO el vínculo `MedicoCobertura`;
 * la `Cobertura` persiste para que los pacientes que ya la tienen la conserven
 * (US-20).
 */
export async function quitarCoberturaDeMedico(
  medicoId: string,
  coberturaId: string,
): Promise<void> {
  const prisma = getPrisma();
  const result = await prisma.medicoCobertura.deleteMany({
    where: { medicoId, coberturaId },
  });
  if (result.count === 0) {
    throw new ApiError(404, MSG_COBERTURA_NO_ENCONTRADA);
  }
}

/** Cobertura actual de un paciente (o `null` si es Particular). */
export async function obtenerCoberturaDePaciente(pacienteId: string) {
  const prisma = getPrisma();
  const paciente = await prisma.user.findUnique({
    where: { id: pacienteId },
    select: {
      role: true,
      cobertura: { select: { id: true, nombre: true } },
      numeroAfiliado: true,
      esParticular: true,
    },
  });

  if (!paciente || paciente.role !== "PACIENTE") {
    throw new ApiError(404, "Paciente no encontrado");
  }

  return {
    coberturaId: paciente.cobertura?.id ?? null,
    nombre: paciente.cobertura?.nombre ?? null,
    numeroAfiliado: paciente.numeroAfiliado ?? null,
    esParticular: paciente.esParticular,
  };
}

/**
 * Asigna (o cambia) la cobertura de un paciente.
 *
 * - `coberturaId = null` → "Particular": se descarta el nº de afiliado y se
 *   marca `esParticular` para distinguirlo de "nunca registró".
 * - `coberturaId` no null → la cobertura debe existir y estar disponible, y el
 *   nº de afiliado es obligatorio.
 */
export async function asignarCoberturaAPaciente(
  pacienteId: string,
  coberturaId: string | null,
  numeroAfiliado?: string | null,
) {
  const prisma = getPrisma();
  const paciente = await prisma.user.findUnique({
    where: { id: pacienteId },
    select: { id: true, role: true },
  });

  if (!paciente || paciente.role !== "PACIENTE") {
    throw new ApiError(404, "Paciente no encontrado");
  }

  if (!coberturaId) {
    await prisma.user.update({
      where: { id: pacienteId },
      data: { coberturaId: null, numeroAfiliado: null, esParticular: true },
    });
    return {
      coberturaId: null,
      nombre: null,
      numeroAfiliado: null,
      esParticular: true,
    };
  }

  const cobertura = await prisma.cobertura.findUnique({
    where: { id: coberturaId },
  });
  if (!cobertura) {
    throw new ApiError(404, MSG_COBERTURA_NO_ENCONTRADA);
  }

  const disponible = await coberturaEstaDisponible(coberturaId);
  if (!disponible) {
    throw new ApiError(422, MSG_COBERTURA_NO_DISPONIBLE);
  }

  const afiliado = numeroAfiliado?.trim();
  if (!afiliado) {
    throw new ApiError(422, MSG_AFILIADO_OBLIGATORIO);
  }

  await prisma.user.update({
    where: { id: pacienteId },
    data: { coberturaId, numeroAfiliado: afiliado, esParticular: false },
  });

  return {
    coberturaId,
    nombre: cobertura.nombre,
    numeroAfiliado: afiliado,
    esParticular: false,
  };
}

/**
 * US-52 — Actualiza contacto y cobertura del paciente en una única mutación.
 * La cobertura conserva las mismas reglas de disponibilidad y afiliación que
 * US-21.
 */
export async function actualizarDatosPaciente(
  pacienteId: string,
  datos: {
    email: string;
    phone: string;
    coberturaId: string | null;
    numeroAfiliado: string | null;
  },
): Promise<void> {
  const prisma = getPrisma();
  await prisma.$transaction(async (tx) => {
    const paciente = await tx.user.findUnique({
      where: { id: pacienteId },
      select: { role: true },
    });
    if (!paciente || paciente.role !== "PACIENTE") {
      throw new ApiError(404, "Paciente no encontrado");
    }

    let coberturaId: string | null = null;
    let numeroAfiliado: string | null = null;
    let esParticular = true;

    if (datos.coberturaId) {
      const cobertura = await tx.cobertura.findUnique({
        where: { id: datos.coberturaId },
        select: { id: true },
      });
      if (!cobertura) {
        throw new ApiError(404, MSG_COBERTURA_NO_ENCONTRADA);
      }

      const disponible = await tx.medicoCobertura.count({
        where: {
          coberturaId: datos.coberturaId,
          medico: { role: "MEDICO", isActive: true },
        },
      });
      if (disponible === 0) {
        throw new ApiError(422, MSG_COBERTURA_NO_DISPONIBLE);
      }

      numeroAfiliado = datos.numeroAfiliado?.trim() || null;
      if (!numeroAfiliado) {
        throw new ApiError(422, MSG_AFILIADO_OBLIGATORIO);
      }
      coberturaId = cobertura.id;
      esParticular = false;
    }

    await tx.user.update({
      where: { id: pacienteId },
      data: {
        email: datos.email,
        phone: datos.phone,
        coberturaId,
        numeroAfiliado,
        esParticular,
      },
    });
  });
}

/**
 * Devuelve un mapa `pacienteId → { coberturaNombre, numeroAfiliado }` para
 * mostrar la cobertura en los listados de pacientes (US-21 / S4).
 */
export async function coberturasDePacientes(pacienteIds: string[]) {
  const prisma = getPrisma();
  const mapa: Record<
    string,
    { coberturaNombre: string | null; numeroAfiliado: string | null }
  > = {};

  if (pacienteIds.length === 0) {
    return mapa;
  }

  const rows = await prisma.user.findMany({
    where: { id: { in: pacienteIds } },
    select: {
      id: true,
      cobertura: { select: { nombre: true } },
      numeroAfiliado: true,
    },
  });

  for (const row of rows) {
    mapa[row.id] = {
      coberturaNombre: row.cobertura?.nombre ?? null,
      numeroAfiliado: row.numeroAfiliado ?? null,
    };
  }

  return mapa;
}
