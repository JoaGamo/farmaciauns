"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApiError } from "@/lib/api";
import { requirePaciente } from "@/lib/authorization";
import type { FormState } from "@/lib/form-state";
import { cancelarTurno } from "@/lib/turno-service";

/**
 * US-31 (RF-22) — Cancelar un turno reservado.
 *
 * El servicio vuelve a comprobar que el turno sea del paciente de la sesión,
 * que siga reservado y que falten al menos 24 horas. Al cancelar, el horario
 * vuelve a quedar libre en la agenda del médico.
 */
export async function cancelarTurnoAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  // Autorización real (las server actions son alcanzables por POST directo).
  const paciente = await requirePaciente();
  const turnoId = formData.get("turnoId");

  try {
    await cancelarTurno(paciente.id, typeof turnoId === "string" ? turnoId : "", new Date());
  } catch (error) {
    if (error instanceof ApiError) {
      return { errors: { _form: error.message } };
    }
    console.error("Failed to cancel an appointment.", error);
    return { errors: { _form: "No se pudo cancelar el turno. Intentá nuevamente." } };
  }

  revalidatePath("/turnos", "layout");
  revalidatePath("/medico/agenda", "layout");
  redirect("/turnos?cancelado=1");
}
