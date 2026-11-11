"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApiError } from "@/lib/api";
import { requireMedico } from "@/lib/authorization";
import { validarRegistroClinico } from "@/lib/domain/turno";
import type { FormState } from "@/lib/form-state";
import { registrarAtencion } from "@/lib/historia-clinica-service";

function leerString(formData: FormData, campo: string): string {
  const valor = formData.get(campo);
  return typeof valor === "string" ? valor : "";
}

/**
 * US-40 (RF-06a) — Guardar el diagnóstico y el tratamiento de una consulta.
 *
 * Indica qué campo falta (CA2). El servicio vuelve a validar, comprueba que el
 * turno sea del médico de la sesión, que siga reservado y que no sea de un día
 * futuro (CA4), y en una transacción agrega el registro y pasa el turno a
 * "Atendido" (CA1).
 */
export async function registrarAtencionAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  // Autorización real (las server actions son alcanzables por POST directo).
  const medico = await requireMedico();

  const turnoId = leerString(formData, "turnoId");
  const fecha = leerString(formData, "fecha");
  const datos = {
    diagnostico: leerString(formData, "diagnostico"),
    tratamiento: leerString(formData, "tratamiento"),
  };

  const errores = validarRegistroClinico(datos);
  if (Object.keys(errores).length > 0) {
    return { errors: errores, values: datos };
  }

  try {
    await registrarAtencion(medico.id, turnoId, datos, new Date());
  } catch (error) {
    if (error instanceof ApiError) {
      return { errors: { _form: error.message }, values: datos };
    }
    console.error("Failed to record a consultation.", error);
    return {
      errors: { _form: "No se pudo guardar la atención. Intentá nuevamente." },
      values: datos,
    };
  }

  revalidatePath("/medico/agenda", "layout");
  revalidatePath("/turnos", "layout");
  revalidatePath("/historia-clinica");
  const destino = /^\d{4}-\d{2}-\d{2}$/.test(fecha)
    ? `/medico/agenda?mes=${fecha.slice(0, 7)}&dia=${fecha}&atendido=1`
    : "/medico/agenda?atendido=1";
  redirect(destino);
}
