"use client";

import { Check, UserX } from "lucide-react";
import { useActionState, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ESTADO_INICIAL } from "@/lib/form-state";
import { marcarAusenteAction } from "./actions";

/**
 * Botón "Ausente" de un turno reservado en "Mi agenda" (US-41), con el modal
 * de confirmación del wireframe. "Volver" deja el turno como estaba.
 */
export function AusenteTurno({
  turnoId,
  paciente,
  detalle,
}: {
  turnoId: string;
  paciente: string;
  /** "Turno: 08:20 – 08:40 hs · Clínica médica" */
  detalle: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [state, formAction, pending] = useActionState(marcarAusenteAction, ESTADO_INICIAL);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded bg-surface-container-low px-3 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container"
      >
        <UserX className="h-3.5 w-3.5" aria-hidden="true" />
        Ausente
      </button>

      <ConfirmDialog
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        etiqueta="Confirmación"
        titulo="Registrar ausencia"
        icono={<UserX className="h-5 w-5" />}
      >
        <div>
          <p className="text-base font-semibold">¿Marcar a {paciente} como ausente?</p>
          <p className="mt-1 text-sm text-on-surface-variant">{detalle}</p>
        </div>
        {state.errors._form && (
          <p
            role="alert"
            className="rounded-lg bg-error-container px-4 py-3 text-sm font-medium text-on-error-container"
          >
            {state.errors._form}
          </p>
        )}
        <form action={formAction} className="flex flex-wrap justify-end gap-3 border-t border-surface-container-high pt-4">
          <input type="hidden" name="turnoId" value={turnoId} />
          <button
            type="button"
            onClick={() => setAbierto(false)}
            className="inline-flex h-10 items-center rounded bg-surface-container-low px-5 text-sm font-semibold text-on-surface hover:bg-surface-container"
          >
            Volver
          </button>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-10 items-center gap-2 rounded bg-primary px-5 text-sm font-semibold text-on-primary hover:bg-secondary disabled:opacity-60"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            {pending ? "Registrando…" : "Confirmar"}
          </button>
        </form>
      </ConfirmDialog>
    </>
  );
}
