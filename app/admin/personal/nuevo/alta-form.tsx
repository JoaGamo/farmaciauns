"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registrarPersonalAdministrativo } from "@/app/actions";
import { FormInput } from "@/components/form-input";
import { ESTADO_INICIAL } from "@/lib/form-state";

/**
 * Formulario de alta de personal administrativo (US-07).
 * Client component: usa `useActionState` (React 19) con la server action
 * `registrarPersonalAdministrativo`.
 */
export function AltaPersonalAdministrativoForm() {
  const [state, formAction, pending] = useActionState(
    registrarPersonalAdministrativo,
    ESTADO_INICIAL,
  );
  const errores = state.errors;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {errores._form && (
        <div
          role="alert"
          className="rounded-lg bg-error-container px-4 py-3 text-sm font-medium text-on-error-container"
        >
          {errores._form}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <FormInput
          label="Nombre"
          name="firstName"
          required
          error={errores.firstName}
          hint="Máximo 50 caracteres"
          placeholder="Ej. Mariana Lucía"
          pattern="\p{L}+(?:[ '\u2019-]\p{L}+)*"
          allowedCharacters={/[\p{L} '\u2019-]/u}
          maxLength={50}
          autoComplete="given-name"
          defaultValue={state.values?.firstName}
        />
        <FormInput
          label="Apellido"
          name="lastName"
          required
          error={errores.lastName}
          hint="Máximo 50 caracteres"
          placeholder="Ej. Fernández"
          pattern="\p{L}+(?:[ '\u2019-]\p{L}+)*"
          allowedCharacters={/[\p{L} '\u2019-]/u}
          maxLength={50}
          autoComplete="family-name"
          defaultValue={state.values?.lastName}
        />
        <FormInput
          label="DNI"
          name="dni"
          required
          numeric
          error={errores.dni}
          hint="Solo números · mínimo 7 dígitos"
          placeholder="Ej. 32901450"
          defaultValue={state.values?.dni}
        />
        <FormInput
          label="Email"
          name="email"
          type="email"
          required
          error={errores.email}
          placeholder="nombre@salamedica.org.ar"
          autoComplete="email"
          defaultValue={state.values?.email}
        />
        <FormInput
          label="Teléfono"
          name="phone"
          type="tel"
          required
          numeric
          pattern="[0-9+ ()-]+"
          allowedCharacters={/[0-9+ ()-]/}
          error={errores.phone}
          hint="Mínimo 12 dígitos"
          placeholder="+54 11 4872-9010"
          autoComplete="tel"
          defaultValue={state.values?.phone}
        />
      </div>

      <div className="flex justify-end gap-3 border-t border-surface-container-high pt-5">
        <Link
          href="/admin/personal"
          className="inline-flex h-10 items-center justify-center gap-2 rounded bg-surface-container px-5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center gap-2 rounded bg-primary px-5 text-sm font-semibold text-on-primary transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Enviando invitación…" : "Registrar y enviar invitación"}
        </button>
      </div>
    </form>
  );
}
