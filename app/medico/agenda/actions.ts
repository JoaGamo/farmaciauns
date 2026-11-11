"use server";

import { revalidatePath } from "next/cache";
import { ApiError } from "@/lib/api";
import { requireMedico } from "@/lib/authorization";
import type { FormState } from "@/lib/form-state";
import { marcarAusente } from "@/lib/turno-service";

/**
 * US-41 (RF-27) — Registrar que el paciente no asistió.
 *
 * El servicio comprueba que el turno sea del médico de la sesión, que siga
 * reservado y que sea de hoy o de un día anterior. Al refrescar la agenda, el
 * turno se ve como "Ausente" y ya no ofrece los botones.
 */
export async function marcarAusenteAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  // Autorización real (las server actions son alcanzables por POST directo).
  const medico = await requireMedico();
  const turnoId = formData.get("turnoId");

  try {
    await marcarAusente(medico.id, typeof turnoId === "string" ? turnoId : "", new Date());
  } catch (error) {
    if (error instanceof ApiError) {
      return { errors: { _form: error.message } };
    }
    console.error("Failed to mark an appointment as absent.", error);
    return { errors: { _form: "No se pudo registrar la ausencia. Intentá nuevamente." } };
  }

  revalidatePath("/medico/agenda", "layout");
  revalidatePath("/turnos", "layout");
  return { errors: {} };
}
