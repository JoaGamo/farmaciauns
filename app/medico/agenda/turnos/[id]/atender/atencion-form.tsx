"use client";

import Link from "next/link";
import { ArrowLeft, CircleCheck, Info } from "lucide-react";
import { useActionState } from "react";
import { ESTADO_INICIAL } from "@/lib/form-state";
import { registrarAtencionAction } from "./actions";

/**
 * Formulario "Registrar atención" de US-40: Diagnóstico y Tratamiento,
 * ambos obligatorios. Cada error aparece debajo de su campo (CA2).
 */
export function AtencionForm({
  turnoId,
  fecha,
  hrefAgenda,
}: {
  turnoId: string;
  fecha: string;
  hrefAgenda: string;
}) {
  const [state, formAction, pending] = useActionState(registrarAtencionAction, ESTADO_INICIAL);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="turnoId" value={turnoId} />
      <input type="hidden" name="fecha" value={fecha} />

      {state.errors._form && (
        <p
          role="alert"
          className="rounded-lg bg-error-container px-4 py-3 text-sm font-medium text-on-error-container"
        >
          {state.errors._form}
        </p>
      )}

      <Campo
        nombre="diagnostico"
        etiqueta="Diagnóstico"
        placeholder="Ingresá el diagnóstico clínico del paciente…"
        error={state.errors.diagnostico}
        valor={state.values?.diagnostico}
      />
      <Campo
        nombre="tratamiento"
        etiqueta="Tratamiento"
        placeholder="Indicaciones terapéuticas, pautas de alarma o tratamiento farmacológico…"
        error={state.errors.tratamiento}
        valor={state.values?.tratamiento}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-container-high pt-5">
        <Link
          href={hrefAgenda}
          className="inline-flex h-10 items-center gap-2 rounded border border-outline-variant px-4 text-sm font-semibold text-on-surface hover:bg-surface-container"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver a la agenda
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center gap-2 rounded bg-primary px-5 text-sm font-semibold text-on-primary hover:bg-secondary disabled:opacity-60"
        >
          <CircleCheck className="h-4 w-4" aria-hidden="true" />
          {pending ? "Guardando…" : "Guardar atención"}
        </button>
      </div>

      <p className="flex items-start gap-2 rounded-lg bg-surface-container-low px-4 py-3 text-xs text-on-surface-variant">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        Al guardar, el turno pasa a &quot;Atendido&quot; y el registro se incorpora a la
        historia clínica del paciente. Después no se puede editar ni borrar.
      </p>
    </form>
  );
}

function Campo({
  nombre,
  etiqueta,
  placeholder,
  error,
  valor,
}: {
  nombre: "diagnostico" | "tratamiento";
  etiqueta: string;
  placeholder: string;
  error: string | undefined;
  valor: string | undefined;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={nombre} className="flex items-center gap-1 text-sm font-semibold text-on-surface">
        {etiqueta}
        <span aria-hidden="true" className="text-error">*</span>
        <span className="ml-auto text-xs font-normal text-on-surface-variant">Obligatorio</span>
      </label>
      <textarea
        id={nombre}
        name={nombre}
        required
        rows={5}
        defaultValue={valor}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${nombre}-error` : undefined}
        className={`w-full rounded border-0 px-3 py-2 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 ${
          error
            ? "bg-error-container/30 focus:ring-error/40"
            : "bg-surface-container-low focus:bg-surface-container-lowest focus:ring-primary/40"
        }`}
      />
      {error && (
        <span id={`${nombre}-error`} role="alert" className="text-xs font-medium text-error">
          {error}
        </span>
      )}
    </div>
  );
}
