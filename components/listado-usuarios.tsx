"use client";

import Link from "next/link";
import { useState } from "react";
import type { UsuarioPublico } from "@/lib/domain/usuario";
import { etiquetaRol } from "@/lib/domain/usuario";
import { eliminarUsuario } from "@/app/actions";

type AccionBaja = (formData: FormData) => void | Promise<void>;

function EstadoBadge({ activo }: { activo: boolean }) {
  if (activo) {
    return (
      <span className="inline-flex items-center rounded bg-primary px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-on-primary">
        Activo
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded bg-surface-container-high px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
      Inactivo
    </span>
  );
}

function iniciales(usuario: UsuarioPublico): string {
  const a = usuario.firstName.charAt(0).toUpperCase();
  const b = usuario.lastName.charAt(0).toUpperCase();
  return `${a}${b}`;
}

function formatearFecha(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "—";
  }
  return d.toLocaleDateString("es-AR");
}

function formatearDni(dni: string): string {
  const clean = dni.replace(/\D/g, "");
  if (clean.length === 8) {
    return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5)}`;
  }
  if (clean.length === 7) {
    return `${clean.slice(0, 1)}.${clean.slice(1, 4)}.${clean.slice(4)}`;
  }
  return dni || "—";
}

/**
 * Listado genérico con selección y detalle inline (SIN contraseña).
 * Se usa para US-12 (pacientes), US-13 (personal administrativo) y
 * US-10 (médicos, con `mostrarEspecialidad`).
 * Recibe usuarios YA serializados (`UsuarioPublico`, sin `passwordHash`).
 */
export function ListadoUsuarios({
  usuarios,
  mostrarEspecialidad = false,
  puedeEliminar = false,
  accionBaja = eliminarUsuario,
  accionReactivar,
  editarHrefBase,
  selectedUserId,
}: {
  usuarios: UsuarioPublico[];
  mostrarEspecialidad?: boolean;
  puedeEliminar?: boolean;
  accionBaja?: AccionBaja;
  accionReactivar?: AccionBaja;
  editarHrefBase?: string;
  selectedUserId?: string;
}) {
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(
    selectedUserId ?? usuarios[0]?.id ?? null,
  );
  const [confirmarReactivacion, setConfirmarReactivacion] = useState(false);

  const seleccionado =
    usuarios.find((u) => u.id === seleccionadoId) ?? usuarios[0] ?? null;

  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
      {/* Tabla */}
      <section className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm xl:col-span-8">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-surface-container text-xs uppercase tracking-wider text-on-surface-variant">
                <th className="w-12 px-4 py-2.5 text-center" scope="col">
                  SEL
                </th>
                <th className="px-4 py-2.5" scope="col">
                  Apellido y nombre
                </th>
                <th className="px-4 py-2.5" scope="col">
                  DNI
                </th>
                <th className="px-4 py-2.5" scope="col">
                  Email
                </th>
                {mostrarEspecialidad && (
                  <th className="px-4 py-2.5" scope="col">
                    Especialidad
                  </th>
                )}
                <th className="px-4 py-2.5 text-right" scope="col">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => {
                const seleccionado = u.id === seleccionadoId;
                return (
                  <tr
                    key={u.id}
                    onClick={() => {
                      setSeleccionadoId(u.id);
                      setConfirmarReactivacion(false);
                    }}
                    className={`cursor-pointer transition-colors ${
                      seleccionado
                        ? "bg-surface-container-high/70"
                        : "hover:bg-surface-container-low"
                    }`}
                  >
                    <td className="px-4 py-3 text-center">
                      <input
                        type="radio"
                        name="usuario-seleccionado"
                        readOnly
                        checked={seleccionado}
                        className="h-4 w-4 accent-black"
                        aria-label={`Seleccionar a ${u.lastName}, ${u.firstName}`}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-on-surface">
                      {u.lastName}, {u.firstName}
                    </td>
                    <td className="px-4 py-3 font-mono text-on-surface-variant">
                      {u.dni}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 font-mono text-xs text-on-surface-variant">
                      {u.email}
                    </td>
                    {mostrarEspecialidad && (
                      <td className="px-4 py-3 text-on-surface-variant">
                        {u.especialidad ?? "—"}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right">
                      <EstadoBadge activo={u.active} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-surface-container-high bg-surface-container-low px-4 py-2 text-xs text-on-surface-variant">
          {usuarios.length} registro{usuarios.length === 1 ? "" : "s"}
        </div>
      </section>

      {/* Detalle */}
      <aside className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm xl:col-span-4">
        {seleccionado ? (
          <>
            <div className="flex items-center justify-between border-b border-surface-container-high bg-surface-container-low px-4 py-3">
              <span className="text-sm font-semibold text-on-surface">
                Detalle
              </span>
              <EstadoBadge activo={seleccionado.active} />
            </div>
            <div className="flex flex-col gap-4 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-sm font-bold tracking-tight text-on-primary">
                  {iniciales(seleccionado)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-on-surface">
                    {seleccionado.firstName} {seleccionado.lastName}
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    {etiquetaRol(seleccionado.role)}
                  </p>
                </div>
              </div>
              <dl className="flex flex-col gap-2 rounded-lg bg-surface-container-low p-4 text-sm">
                <FilaDetalle etiqueta="Nombre" valor={seleccionado.firstName} />
                <FilaDetalle etiqueta="Apellido" valor={seleccionado.lastName} />
                <FilaDetalle
                  etiqueta="DNI"
                  valor={formatearDni(seleccionado.dni)}
                  mono
                />
                <FilaDetalle
                  etiqueta="Email"
                  valor={seleccionado.email}
                  mono
                />
                <FilaDetalle
                  etiqueta="Teléfono"
                  valor={seleccionado.phone || "—"}
                  mono
                />
                {mostrarEspecialidad && (
                  <FilaDetalle
                    etiqueta="Especialidad"
                    valor={seleccionado.especialidad ?? "—"}
                  />
                )}
                {seleccionado.role === "PACIENTE" && (
                  <FilaDetalle
                    etiqueta="Fecha de nacimiento"
                    valor={formatearFecha(seleccionado.birthDate)}
                  />
                )}
                {seleccionado.role === "PACIENTE" && (
                  <>
                    <FilaDetalle
                      etiqueta="Cobertura"
                      valor={seleccionado.coberturaNombre ?? "Particular"}
                    />
                    {seleccionado.coberturaNombre && (
                      <FilaDetalle
                        etiqueta="N° de afiliado"
                        valor={seleccionado.numeroAfiliado ?? "—"}
                        mono
                      />
                    )}
                  </>
                )}
                <FilaDetalle
                  etiqueta="Estado"
                  valor={seleccionado.active ? "Activo" : "Inactivo"}
                />
              </dl>
              {puedeEliminar && (
                seleccionado.active || !accionReactivar ? (
                  <form
                    action={accionBaja}
                    onSubmit={(e) => {
                      if (
                        !window.confirm(
                          `¿Dar de baja a ${seleccionado.firstName} ${seleccionado.lastName}? No va a poder iniciar sesión.`,
                        )
                      ) {
                        e.preventDefault();
                      }
                    }}
                    className="flex"
                  >
                    <input type="hidden" name="id" value={seleccionado.id} />
                    <button
                      type="submit"
                      className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded bg-error px-4 text-sm font-semibold text-on-primary transition-opacity hover:opacity-90"
                    >
                      Dar de baja
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmarReactivacion(true)}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded bg-primary px-4 text-sm font-semibold text-on-primary transition-colors hover:bg-secondary"
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                      refresh
                    </span>
                    Reactivar
                  </button>
                )
              )}
              {editarHrefBase && (
                <Link
                  href={`${editarHrefBase}/${seleccionado.id}/editar`}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded bg-surface-container-high px-4 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container"
                >
                  Modificar
                </Link>
              )}
            </div>
          </>
        ) : (
          <div className="p-5 text-sm text-on-surface-variant">
            Seleccioná un registro para ver el detalle.
          </div>
        )}
      </aside>

      {confirmarReactivacion &&
        seleccionado?.role === "PACIENTE" &&
        !seleccionado.active &&
        accionReactivar && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-primary/40 p-4 backdrop-blur-sm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirmar-reactivacion-paciente-title"
            aria-describedby="confirmar-reactivacion-paciente-description"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setConfirmarReactivacion(false);
              }
            }}
          >
            <div className="w-full max-w-xl overflow-hidden rounded-xl bg-surface-container-lowest shadow-2xl">
              <div className="flex items-start gap-5 p-6">
                <div className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-xl bg-primary-fixed text-on-surface">
                  <span
                    aria-hidden="true"
                    className="material-symbols-outlined text-[28px] leading-none"
                  >
                    refresh
                  </span>
                </div>
                <div className="min-w-0">
                  <h2
                    id="confirmar-reactivacion-paciente-title"
                    className="text-xl font-semibold tracking-tight text-on-surface"
                  >
                    ¿Reactivar la cuenta de {seleccionado.firstName} {seleccionado.lastName}?
                  </h2>
                  <p
                    id="confirmar-reactivacion-paciente-description"
                    className="mt-1 text-base leading-7 text-on-surface-variant"
                  >
                    La paciente volverá a tener acceso al portal, conservando su
                    historia clínica y pudiendo solicitar nuevos turnos en Sala
                    Médica.
                  </p>
                </div>
              </div>
              <dl className="mx-6 mb-6 flex flex-col gap-2 rounded-md border border-outline-variant/30 bg-primary-fixed/50 p-5 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="font-medium uppercase tracking-wide text-on-surface">
                    Paciente:
                  </dt>
                  <dd className="truncate text-base font-semibold text-on-surface">
                    {seleccionado.firstName} {seleccionado.lastName}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="font-medium uppercase tracking-wide text-on-surface">
                    DNI:
                  </dt>
                  <dd className="font-mono text-on-surface-variant">
                    {formatearDni(seleccionado.dni)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="font-medium uppercase tracking-wide text-on-surface">
                    Cobertura:
                  </dt>
                  <dd className="truncate font-mono text-on-surface-variant">
                    {seleccionado.coberturaNombre ?? "Particular"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="font-medium uppercase tracking-wide text-on-surface">
                    Estado actual:
                  </dt>
                  <dd>
                    <span className="rounded bg-surface-container-high px-2 py-1 font-mono text-xs font-bold uppercase text-on-surface-variant">
                      Inactivo
                    </span>
                  </dd>
                </div>
              </dl>
              <div className="flex flex-col-reverse justify-end gap-2 border-t border-outline-variant/20 bg-primary-fixed/60 px-6 py-5 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setConfirmarReactivacion(false)}
                  className="inline-flex h-12 items-center justify-center rounded-md border border-outline bg-surface-container-lowest px-7 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high"
                >
                  Cancelar
                </button>
                <form action={accionReactivar}>
                  <input type="hidden" name="id" value={seleccionado.id} />
                  <button
                    type="submit"
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-black px-7 text-sm font-semibold text-white transition-colors hover:bg-on-surface"
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                      refresh
                    </span>
                    Reactivar
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

function FilaDetalle({
  etiqueta,
  valor,
  mono,
}: {
  etiqueta: string;
  valor: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <dt className="shrink-0 text-xs uppercase tracking-wide text-on-surface-variant">
        {etiqueta}
      </dt>
      <dd
        className={`text-right font-medium text-on-surface ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {valor}
      </dd>
    </div>
  );
}
