"use client";

import { useActionState, useRef, useState } from "react";
import type { ReactNode } from "react";
import { FormInput } from "@/components/form-input";
import { actualizarDatosPaciente } from "@/app/profile-actions";
import { ESTADO_INICIAL } from "@/lib/form-state";

type PacienteDatos = {
  firstName: string;
  lastName: string;
  dni: string;
  birthDate: string | null;
  email: string;
  phone: string;
  coberturaId: string;
  numeroAfiliado: string;
};

type CoberturaDisponible = { id: string; nombre: string };

function formatearNacimiento(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("es-AR", { timeZone: "UTC" });
}

function formatearDni(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 8) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  }
  if (digits.length === 7) {
    return `${digits.slice(0, 1)}.${digits.slice(1, 4)}.${digits.slice(4)}`;
  }
  return value || "—";
}

export function MisDatosForm({
  paciente,
  coberturas,
}: {
  paciente: PacienteDatos;
  coberturas: CoberturaDisponible[];
}) {
  const [state, formAction, pending] = useActionState(
    actualizarDatosPaciente,
    ESTADO_INICIAL,
  );
  const [seleccionada, setSeleccionada] = useState(paciente.coberturaId);
  const [resetVersion, setResetVersion] = useState(0);
  const [restaurarOriginales, setRestaurarOriginales] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="flex flex-col gap-4">
      {state.errors._form && (
        <p
          role="alert"
          className="rounded-lg bg-error-container px-4 py-3 text-sm font-medium text-on-error-container"
        >
          {state.errors._form}
        </p>
      )}

      <section className="rounded-lg bg-surface-container-lowest p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-on-surface">Datos personales</h2>
            <span className="inline-flex items-center gap-1 rounded bg-primary-fixed px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-on-surface">
              <span aria-hidden="true" className="material-symbols-outlined text-[13px]">
                lock
              </span>
              Solo lectura
            </span>
          </div>
          <p className="text-xs text-on-surface-variant">
            Identidad civil validada institucionalmente.
          </p>
        </div>
        <div className="grid gap-x-4 gap-y-3 md:grid-cols-2">
          <ReadOnlyField label="Nombre" value={paciente.firstName} />
          <ReadOnlyField label="Apellido" value={paciente.lastName} />
          <ReadOnlyField label="DNI" value={formatearDni(paciente.dni)} />
          <ReadOnlyField
            label="Fecha de nacimiento"
            value={formatearNacimiento(paciente.birthDate)}
          />
        </div>
        <p className="mt-3 flex items-center gap-1.5 rounded bg-primary-fixed px-2 py-2 text-xs text-on-surface-variant">
          <span aria-hidden="true" className="material-symbols-outlined text-[14px]">
            info
          </span>
          Para modificar tus datos personales de identidad, comunicate con la administración de Sala Médica.
        </p>
      </section>

      <form
        ref={formRef}
        action={formAction}
        onSubmit={() => setRestaurarOriginales(false)}
        className="flex flex-col gap-4"
      >
        <section className="rounded-lg bg-surface-container-lowest p-4 shadow-sm sm:p-5">
          <div className="mb-3">
            <h2 className="text-base font-semibold text-on-surface">Contacto</h2>
            <p className="mt-0.5 text-xs text-on-surface-variant">
              Información utilizada para recordatorios de turnos y avisos de la clínica.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <FormInput
              key={`email-${resetVersion}-${state.values?.email ?? paciente.email}`}
              label="Correo electrónico"
              name="email"
              type="email"
              required
              autoComplete="email"
              defaultValue={
                restaurarOriginales
                  ? paciente.email
                  : state.values?.email ?? paciente.email
              }
              leadingIcon="mail"
              error={state.errors.email}
            />

            <FormInput
              key={`phone-${resetVersion}-${state.values?.phone ?? paciente.phone}`}
              label="Teléfono de contacto"
              name="phone"
              type="tel"
              required
              numeric
              pattern="[0-9+ ()-]+"
              allowedCharacters={/[0-9+ ()-]/}
              autoComplete="tel"
              defaultValue={
                restaurarOriginales
                  ? paciente.phone
                  : state.values?.phone ?? paciente.phone
              }
              hint="Mínimo 12 dígitos"
              leadingIcon="call"
              error={state.errors.phone}
            />
            <p className="text-[11px] text-on-surface-variant md:col-span-2 md:-mt-3">
              Incluí el código de área sin 0 ni 15 para avisos vía SMS/WhatsApp.
            </p>
          </div>
        </section>

        <section className="rounded-lg bg-surface-container-lowest p-4 shadow-sm sm:p-5">
          <div className="mb-3">
            <h2 className="text-base font-semibold text-on-surface">Cobertura médica</h2>
            <p className="mt-0.5 text-xs text-on-surface-variant">
              Seleccioná tu obra social o cobertura para la facturación y atención en turnos.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Obra social o prepaga" error={state.errors.coberturaId}>
              <select
                key={`cobertura-${state.values?.coberturaId ?? paciente.coberturaId}`}
                name="coberturaId"
                value={seleccionada}
                onChange={(event) => {
                  setSeleccionada(event.target.value);
                  setRestaurarOriginales(false);
                }}
                aria-invalid={Boolean(state.errors.coberturaId)}
                className="h-9 w-full rounded border border-outline-variant/50 bg-surface-container-lowest px-3 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">Particular</option>
                {coberturas.map((cobertura) => (
                  <option key={cobertura.id} value={cobertura.id}>
                    {cobertura.nombre}
                  </option>
                ))}
              </select>
              <span className="text-[11px] font-normal text-on-surface-variant">
                Seleccioná “Particular” si no contás con convenio activo.
              </span>
            </Field>

            {seleccionada ? (
              <Field label="Número de afiliado / credencial" error={state.errors.numeroAfiliado}>
                <div className="relative">
                  <span aria-hidden="true" className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-on-surface-variant">
                    badge
                  </span>
                  <input
                    key={`afiliado-${state.values?.numeroAfiliado ?? paciente.numeroAfiliado}`}
                    name="numeroAfiliado"
                    type="text"
                    required
                    defaultValue={state.values?.numeroAfiliado ?? paciente.numeroAfiliado}
                    aria-invalid={Boolean(state.errors.numeroAfiliado)}
                    className="h-9 w-full rounded border border-outline-variant/50 bg-surface-container-lowest pl-8 pr-3 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <span className="text-[11px] font-normal text-on-surface-variant">
                  Formato estándar según tu credencial médica vigente.
                </span>
              </Field>
            ) : (
              <p className="flex items-center rounded bg-surface-container-low p-4 text-sm text-on-surface-variant">
                La atención se realizará como paciente particular.
              </p>
            )}
          </div>
        </section>

        <div className="flex justify-end gap-3 border-t border-outline-variant/20 pt-3">
          <button
            type="button"
            onClick={() => {
              const form = formRef.current;
              if (!form) return;
              form.reset();
              const numeroAfiliado = form.elements.namedItem("numeroAfiliado");
              if (numeroAfiliado instanceof HTMLInputElement) {
                numeroAfiliado.value = paciente.numeroAfiliado;
              }
              setSeleccionada(paciente.coberturaId);
              setRestaurarOriginales(true);
              setResetVersion((version) => version + 1);
            }}
            className="inline-flex h-10 items-center justify-center gap-2 rounded border border-outline bg-surface-container-lowest px-5 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
              close
            </span>
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-10 min-w-32 items-center justify-center gap-2 rounded bg-black px-5 text-sm font-semibold text-white transition-colors hover:bg-on-surface disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
              {pending ? "progress_activity" : "save"}
            </span>
            {pending ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </form>

      <section className="mt-2 flex flex-wrap items-center justify-between gap-4 rounded-lg bg-primary-fixed p-4 sm:p-5">
        <div className="flex min-w-0 items-start gap-2">
          <span aria-hidden="true" className="material-symbols-outlined shrink-0 text-[18px] text-on-surface-variant">
            warning
          </span>
          <div>
            <h2 className="text-base font-semibold text-on-surface">Baja de cuenta</h2>
            <p className="mt-0.5 text-sm text-on-surface-variant">
              Al dar de baja tu cuenta, perderás el acceso al portal de turnos e historial en línea.
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled
          className="h-10 shrink-0 rounded border border-outline bg-surface-container-lowest px-4 text-xs font-semibold text-on-surface-variant disabled:cursor-not-allowed"
        >
          Dar de baja mi cuenta
        </button>
      </section>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-on-surface">
      <span className="flex items-center justify-between">
        {label}
        <span aria-hidden="true" className="material-symbols-outlined text-[12px] text-on-surface-variant">
          lock
        </span>
      </span>
      <input
        value={value}
        readOnly
        className="h-9 min-w-0 cursor-not-allowed rounded bg-primary-fixed/60 px-3 text-sm font-normal text-on-surface-variant"
      />
    </label>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold text-on-surface">
      {label}
      {children}
      {error && (
        <span role="alert" className="text-xs font-medium text-error">
          {error}
        </span>
      )}
    </label>
  );
}
