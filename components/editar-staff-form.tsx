"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormInput } from "@/components/form-input";
import { ESTADO_INICIAL, type FormState } from "@/lib/form-state";

type StaffAction = (
  previousState: FormState,
  formData: FormData,
) => Promise<FormState>;

export function EditarStaffForm({
  staff,
  action,
  cancelarHref,
  mostrarAsignacionOperativa = false,
  panelAdministrativo = false,
  enPanel = false,
  onCancel,
}: {
  staff: {
    id: string;
    firstName: string;
    lastName: string;
    dni: string;
    email: string;
    phone: string;
    isActive?: boolean;
    createdAt?: string;
    updatedAt?: string;
  };
  action: StaffAction;
  cancelarHref: string;
  mostrarAsignacionOperativa?: boolean;
  panelAdministrativo?: boolean;
  enPanel?: boolean;
  onCancel?: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, ESTADO_INICIAL);
  const validarNombrePersonal = mostrarAsignacionOperativa || panelAdministrativo;
  const patronNombre = mostrarAsignacionOperativa
    ? "[\\p{L} '\\u2019]+"
    : "\\p{L}+(?:[ '\\u2019-]\\p{L}+)*";
  const caracteresNombre = mostrarAsignacionOperativa
    ? /[\p{L} '\u2019]/u
    : /[\p{L} '\u2019-]/u;

  return (
    <form
      action={formAction}
      className={`flex flex-col gap-6 ${enPanel ? "p-6" : ""}`}
    >
      <input type="hidden" name="id" value={staff.id} />
      {enPanel && (
        <div className="-mx-6 -mt-6 flex flex-wrap items-center gap-4 bg-primary-fixed p-6">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary text-2xl font-bold text-on-primary">
            {(staff.firstName[0] ?? "") + (staff.lastName[0] ?? "")}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                title={`${staff.firstName} ${staff.lastName}`}
                className="min-w-0 max-w-full truncate text-xl font-bold text-on-surface"
              >
                {staff.firstName} {staff.lastName}
              </h2>
              <span className="rounded bg-primary px-2 py-0.5 text-xs font-bold text-on-primary">
                {staff.isActive === false ? "INACTIVO" : "ACTIVO"}
              </span>
            </div>
            <p className="break-words text-sm text-on-surface-variant">
              {panelAdministrativo
                ? "Personal administrativo • ID: ADM-"
                : "Enfermera profesional / Cuidados generales • ID: ENF-"}
              {staff.dni.slice(-4)}
            </p>
          </div>
          <div className="flex min-w-0 items-center gap-2 break-all rounded bg-surface-container-high px-3 py-2 font-mono text-sm font-semibold text-on-surface">
            <span aria-hidden="true" className="material-symbols-outlined">
              badge
            </span>
            LEGAJO: #{staff.dni.slice(-4)}
          </div>
        </div>
      )}
      {state.errors._form && (
        <p
          role="alert"
          className="rounded-lg bg-error-container px-4 py-3 text-sm font-medium text-on-error-container"
        >
          {state.errors._form}
        </p>
      )}
      <div className="grid min-w-0 gap-5 md:grid-cols-2">
        <FormInput
          key={`firstName-${state.values?.firstName ?? staff.firstName}`}
          label="Nombre"
          name="firstName"
          required
          autoComplete="given-name"
          defaultValue={state.values?.firstName ?? staff.firstName}
          hint={validarNombrePersonal ? "Máximo 50 caracteres" : undefined}
          pattern={validarNombrePersonal ? patronNombre : undefined}
          allowedCharacters={validarNombrePersonal ? caracteresNombre : undefined}
          maxLength={validarNombrePersonal ? 50 : undefined}
          leadingIcon={mostrarAsignacionOperativa ? "person" : undefined}
          error={state.errors.firstName}
        />
        <FormInput
          key={`lastName-${state.values?.lastName ?? staff.lastName}`}
          label="Apellido"
          name="lastName"
          required
          autoComplete="family-name"
          defaultValue={state.values?.lastName ?? staff.lastName}
          hint={validarNombrePersonal ? "Máximo 50 caracteres" : undefined}
          pattern={validarNombrePersonal ? patronNombre : undefined}
          allowedCharacters={validarNombrePersonal ? caracteresNombre : undefined}
          maxLength={validarNombrePersonal ? 50 : undefined}
          leadingIcon={mostrarAsignacionOperativa ? "person" : undefined}
          error={state.errors.lastName}
        />

        <div className={`flex flex-col gap-1.5 ${mostrarAsignacionOperativa || panelAdministrativo ? "md:col-span-2" : ""}`}>
          <label htmlFor="dni" className="flex justify-between text-sm font-medium text-on-surface">
            <span>{enPanel ? "DNI (DOCUMENTO NACIONAL DE IDENTIDAD)" : "DNI"}</span>
            <span className="text-xs text-on-surface-variant">Inalterable</span>
          </label>
          <div className="relative">
            <span aria-hidden="true" className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant">
              lock
            </span>
            <input
              id="dni"
              value={staff.dni}
              disabled
              className="h-10 w-full cursor-not-allowed rounded bg-primary-fixed pl-11 pr-3 font-mono text-sm text-on-surface-variant opacity-90"
            />
          </div>
          <span className="text-xs text-on-surface-variant">
            El DNI no se puede modificar. Para rectificaciones de identidad acudí a Dirección Médica.
          </span>
        </div>

        <div
          className={
            mostrarAsignacionOperativa || panelAdministrativo
              ? "md:col-span-2"
              : undefined
          }
        >
          <FormInput
            key={`email-${state.values?.email ?? staff.email}`}
            label="Email institucional"
            name="email"
            type="email"
            required
            autoComplete="email"
            defaultValue={state.values?.email ?? staff.email}
            leadingIcon={mostrarAsignacionOperativa ? "alternate_email" : undefined}
            error={state.errors.email}
          />
        </div>
        <div
          className={
            mostrarAsignacionOperativa || panelAdministrativo
              ? "md:col-span-2"
              : undefined
          }
        >
          <FormInput
            key={`phone-${state.values?.phone ?? staff.phone}`}
            label="Teléfono de contacto"
            name="phone"
            type="tel"
            required
            numeric={validarNombrePersonal}
            pattern={validarNombrePersonal ? "[0-9+ ()-]+" : undefined}
            allowedCharacters={
              validarNombrePersonal ? /[0-9+ ()-]/ : undefined
            }
            autoComplete="tel"
            defaultValue={state.values?.phone ?? staff.phone}
            leadingIcon={mostrarAsignacionOperativa ? "call" : undefined}
            hint={validarNombrePersonal ? "Mínimo 12 dígitos" : undefined}
            error={state.errors.phone}
          />
        </div>
      </div>

      {mostrarAsignacionOperativa && (
        <section className="rounded-xl bg-primary-fixed p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-on-surface">
            <span aria-hidden="true" className="material-symbols-outlined">domain</span>
            Asignación operativa de planta (solo lectura)
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="min-w-0 rounded bg-surface-container-lowest p-3">
              <span className="block text-xs uppercase text-on-surface-variant">Sector de asignación</span>
              <span className="break-words font-semibold text-on-surface">Vacunatorio General / Inmunizaciones</span>
            </div>
            <div className="min-w-0 rounded bg-surface-container-lowest p-3">
              <span className="block text-xs uppercase text-on-surface-variant">Turno horario</span>
              <span className="break-words font-semibold text-on-surface">Matutino (07:00 - 15:00 hs)</span>
            </div>
          </div>
        </section>
      )}
      {panelAdministrativo && (
        <section className="rounded-xl bg-primary-fixed p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-on-surface">
            <span aria-hidden="true" className="material-symbols-outlined">
              domain
            </span>
            Asignación operativa de planta (solo lectura)
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="min-w-0 rounded bg-surface-container-lowest p-3">
              <span className="block text-xs uppercase text-on-surface-variant">
                Área y puesto
              </span>
              <span className="break-words font-semibold text-on-surface">
                Admisión Central - Box 02
              </span>
            </div>
            <div className="min-w-0 rounded bg-surface-container-lowest p-3">
              <span className="block text-xs uppercase text-on-surface-variant">
                Turno horario
              </span>
              <span className="break-words font-semibold text-on-surface">
                Matutino (07:00 - 15:00 hs)
              </span>
            </div>
          </div>
        </section>
      )}

      <div className="flex flex-col-reverse justify-between gap-3 border-t border-surface-container-high pt-5 sm:flex-row">
        {enPanel ? (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-10 items-center justify-center gap-2 rounded bg-primary-fixed px-5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
          >
            <span aria-hidden="true" className="material-symbols-outlined">close</span>
            Cancelar
          </button>
        ) : (
          <Link
            href={cancelarHref}
            className="inline-flex h-10 items-center justify-center gap-2 rounded bg-surface-container-high px-5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container"
          >
            <span aria-hidden="true" className="material-symbols-outlined">close</span>
            Cancelar
          </Link>
        )}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center gap-2 rounded bg-black px-5 text-sm font-semibold text-white transition-colors hover:bg-on-surface disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span aria-hidden="true" className="material-symbols-outlined">save</span>
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
      {enPanel && (
        <div className="-mx-6 -mb-6 flex flex-wrap justify-between gap-2 bg-primary-fixed px-6 py-3 font-mono text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
          <span>Creación: {staff.createdAt ?? "Registro institucional"}</span>
          <span>Modificado: {staff.updatedAt ?? "Registro institucional"}</span>
        </div>
      )}
    </form>
  );
}
