"use client";

import { CalendarX2, CircleX, Info } from "lucide-react";
import { useActionState, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ESTADO_INICIAL } from "@/lib/form-state";
import { cancelarTurnoAction } from "./actions";

/**
 * Botón "Cancelar" de un turno de consulta en "Mis turnos" (US-31), con el
 * modal de confirmación del wireframe: "Volver" deja el turno reservado (CA2).
 */
export function CancelarTurno({
  turnoId,
  pregunta,
  detalle,
}: {
  turnoId: string;
  /** "¿Cancelar tu turno del lunes 23/11 a las 10:00 con Marcos Álvarez?" */
  pregunta: string;
  detalle: { etiqueta: string; valor: string }[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [state, formAction, pending] = useActionState(cancelarTurnoAction, ESTADO_INICIAL);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="rounded border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container"
      >
        Cancelar
      </button>

      <ConfirmDialog
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        etiqueta="Confirmación requerida"
        titulo="Cancelar turno"
        icono={<CalendarX2 className="h-5 w-5" />}
      >
        <p className="text-base font-semibold">{pregunta}</p>
        <dl className="flex flex-col gap-2 rounded-lg bg-surface-container-low p-4 text-sm">
          {detalle.map((d) => (
            <div key={d.etiqueta} className="flex flex-wrap justify-between gap-2">
              <dt className="text-on-surface-variant">{d.etiqueta}</dt>
              <dd className="text-right font-semibold">{d.valor}</dd>
            </div>
          ))}
        </dl>
        <p className="flex items-start gap-2 text-sm text-on-surface-variant">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Esta acción libera el turno para otros pacientes. Si necesitás otro
          horario, vas a tener que reservar uno nuevo.
        </p>
        {state.errors._form && (
          <p
            role="alert"
            className="rounded-lg bg-error-container px-4 py-3 text-sm font-medium text-on-error-container"
          >
            {state.errors._form}
          </p>
        )}
        <form action={formAction} className="flex flex-wrap justify-end gap-3">
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
            <CircleX className="h-4 w-4" aria-hidden="true" />
            {pending ? "Cancelando…" : "Cancelar turno"}
          </button>
        </form>
      </ConfirmDialog>
    </>
  );
}
