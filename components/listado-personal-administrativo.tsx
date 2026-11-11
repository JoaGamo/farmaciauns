"use client";

import { useState } from "react";
import {
  darDeBajaPersonalAdministrativo,
  reactivarPersonalAdministrativo,
} from "@/app/actions";
import { actualizarPersonalAdministrativoEnPanel } from "@/app/admin/staff-actions";
import { EditarStaffForm } from "@/components/editar-staff-form";
import type { UsuarioPublico } from "@/lib/domain/usuario";

type PersonalAdministrativo = UsuarioPublico & {
  createdAt: string;
  updatedAt: string;
};

const REGISTROS_POR_PAGINA = 10;

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

export function ListadoPersonalAdministrativo({
  usuarios,
}: {
  usuarios: PersonalAdministrativo[];
}) {
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(
    usuarios[0]?.id ?? null,
  );
  const [ordenAscendente, setOrdenAscendente] = useState(true);
  const [paginaActual, setPaginaActual] = useState(1);
  const [editando, setEditando] = useState(false);
  const [confirmarCambio, setConfirmarCambio] = useState(false);

  const ordenados = [...usuarios].sort((a, b) => {
    const orden =
      a.lastName.localeCompare(b.lastName, "es", { sensitivity: "base" }) ||
      a.firstName.localeCompare(b.firstName, "es", { sensitivity: "base" });
    return ordenAscendente ? orden : -orden;
  });
  const totalPaginas = Math.max(
    1,
    Math.ceil(ordenados.length / REGISTROS_POR_PAGINA),
  );
  const pagina = Math.min(paginaActual, totalPaginas);
  const primerIndice = (pagina - 1) * REGISTROS_POR_PAGINA;
  const usuariosVisibles = ordenados.slice(
    primerIndice,
    primerIndice + REGISTROS_POR_PAGINA,
  );
  const seleccionado =
    usuariosVisibles.find((usuario) => usuario.id === seleccionadoId) ??
    usuariosVisibles[0] ??
    null;

  function cambiarPagina(nuevaPagina: number) {
    const nuevoPrimerIndice = (nuevaPagina - 1) * REGISTROS_POR_PAGINA;
    setPaginaActual(nuevaPagina);
    setSeleccionadoId(ordenados[nuevoPrimerIndice]?.id ?? null);
    setEditando(false);
    setConfirmarCambio(false);
  }

  function alternarOrden() {
    const nuevoOrdenAscendente = !ordenAscendente;
    const nuevosOrdenados = [...usuarios].sort((a, b) => {
      const orden =
        a.lastName.localeCompare(b.lastName, "es", { sensitivity: "base" }) ||
        a.firstName.localeCompare(b.firstName, "es", { sensitivity: "base" });
      return nuevoOrdenAscendente ? orden : -orden;
    });
    setOrdenAscendente(nuevoOrdenAscendente);
    setPaginaActual(1);
    setSeleccionadoId(nuevosOrdenados[0]?.id ?? null);
    setEditando(false);
    setConfirmarCambio(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wider text-on-surface-variant sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Ruta de navegación" className="flex flex-wrap items-center gap-2">
          <span>Módulo administrativo</span>
          <span aria-hidden="true">/</span>
          <span>Personal de gestión</span>
          <span aria-hidden="true">/</span>
          <span className="text-on-surface">
            {editando ? "Modificar personal administrativo" : "Listado de personal administrativo"}
          </span>
        </nav>
        <span className="shrink-0 rounded bg-surface-container-high px-3 py-1 font-mono text-[10px]">
          ESTACIÓN: ADM-TERM-02
        </span>
      </div>

      <header>
        <h1 className="text-2xl font-bold tracking-tight text-on-surface">
          {editando
            ? "Modificar personal administrativo"
            : "Listado de personal administrativo"}
        </h1>
        <p className="mt-1 text-on-surface-variant">
          {editando
            ? "Actualizá los datos del agente administrativo registrado en la nómina institucional."
            : "Nómina institucional del personal de admisiones, recepción y secretaría."}
        </p>
      </header>

      <div className="grid min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-4 xl:col-span-5">
          <section className="min-w-0 overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-container-low px-4 py-3">
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
                  groups
                </span>
                <div>
                  <h2 className="text-sm font-semibold uppercase text-on-surface">
                    Nómina general
                  </h2>
                  <p className="text-xs text-on-surface-variant">
                    {usuarios.length} registro{usuarios.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={alternarOrden}
                className="rounded px-2 py-1 text-left font-mono text-[10px] font-semibold uppercase text-on-surface-variant hover:bg-surface-container-high"
                aria-label={`Cambiar orden por apellido a ${ordenAscendente ? "descendente" : "ascendente"}`}
              >
                Orden: Apellido {ordenAscendente ? "ASC" : "DESC"}
              </button>
            </div>
            <p className="flex items-center justify-between bg-primary-fixed px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
              Hacé clic para alternar registro en foco
              <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
                touch_app
              </span>
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[400px] table-fixed border-collapse text-left text-xs">
                <colgroup>
                  <col className="w-[54%]" />
                  <col className="w-[26%]" />
                  <col className="w-[20%]" />
                </colgroup>
                <thead>
                  <tr className="bg-surface-container-high text-[10px] uppercase tracking-wider text-on-surface-variant">
                    <th className="px-3 py-2" scope="col">Agente / legajo</th>
                    <th className="px-3 py-2" scope="col">DNI</th>
                    <th className="px-3 py-2 text-right" scope="col">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosVisibles.map((usuario) => {
                    const estaSeleccionado = usuario.id === seleccionado?.id;
                    return (
                      <tr
                        key={usuario.id}
                        onClick={() => {
                          setSeleccionadoId(usuario.id);
                          setEditando(false);
                          setConfirmarCambio(false);
                        }}
                        className={`cursor-pointer border-b border-surface-container-low transition-colors ${
                          estaSeleccionado
                            ? "bg-black font-semibold text-white"
                            : "text-on-surface hover:bg-surface-container-low"
                        }`}
                      >
                        <td className="min-w-0 px-3 py-2.5">
                          <span className="flex min-w-0 items-center gap-1.5 truncate" title={`${usuario.lastName}, ${usuario.firstName}`}>
                            {estaSeleccionado && editando && (
                              <span aria-hidden="true" className="material-symbols-outlined shrink-0 text-[14px]">
                                edit
                              </span>
                            )}
                            <span className="truncate">
                              {usuario.lastName}, {usuario.firstName}
                            </span>
                          </span>
                          <span
                            className={`block truncate font-mono text-[10px] ${
                              estaSeleccionado ? "text-white/80" : "text-on-surface-variant"
                            }`}
                            title={usuario.email}
                          >
                            {usuario.email}
                          </span>
                        </td>
                        <td className={`truncate px-3 py-2.5 font-mono ${estaSeleccionado ? "text-white/90" : "text-on-surface-variant"}`}>
                          {formatearDni(usuario.dni)}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className={`inline-flex rounded px-2 py-0.5 text-[9px] font-bold uppercase ${
                            estaSeleccionado
                              ? "bg-white text-black"
                              : usuario.active
                                ? "bg-surface-container-high text-on-surface"
                                : "bg-surface-container-highest text-on-surface-variant"
                          }`}>
                            {estaSeleccionado && editando
                              ? "En edición"
                              : usuario.active
                                ? "Activo"
                                : "Inactivo"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-2 border-t border-surface-container-high bg-surface-container-low px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="font-mono text-[10px] text-on-surface-variant">
                Mostrando {ordenados.length === 0 ? 0 : primerIndice + 1}-
                {Math.min(primerIndice + REGISTROS_POR_PAGINA, ordenados.length)}{" "}
                de {ordenados.length} registros • Pág. {pagina} de {totalPaginas}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pagina === 1}
                  onClick={() => cambiarPagina(pagina - 1)}
                  className="rounded border border-outline bg-surface-container-high px-3 py-1 text-[10px] font-semibold uppercase text-on-surface enabled:hover:bg-surface-container-highest disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={pagina === totalPaginas}
                  onClick={() => cambiarPagina(pagina + 1)}
                  className="rounded border border-outline bg-surface-container-high px-3 py-1 text-[10px] font-semibold uppercase text-on-surface enabled:hover:bg-surface-container-highest disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Siguiente
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-surface-container-high bg-surface-container-low px-4 py-2 font-mono text-[10px] text-on-surface-variant">
              <span>Última sincronización: datos institucionales</span>
              <span>SYS-ADMIN-NCL</span>
            </div>
          </section>

          <section className="flex min-w-0 items-start gap-3 rounded-xl bg-primary-fixed p-4">
            <span aria-hidden="true" className="material-symbols-outlined shrink-0 text-on-surface-variant">
              verified_user
            </span>
            <div className="min-w-0">
              <h2 className="font-mono text-[10px] font-semibold uppercase tracking-wider text-on-surface">
                Política de integridad de datos
              </h2>
              <p className="mt-1 break-words text-xs leading-5 text-on-surface-variant">
                Las modificaciones actualizan los datos de contacto y el legajo del agente en el padrón institucional.
              </p>
            </div>
          </section>
        </div>

        {seleccionado && (
          <section className="min-w-0 overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm xl:col-span-7">
            {editando ? (
              <EditarStaffForm
                key={seleccionado.id}
                staff={{
                  id: seleccionado.id,
                  firstName: seleccionado.firstName,
                  lastName: seleccionado.lastName,
                  dni: seleccionado.dni,
                  email: seleccionado.email,
                  phone: seleccionado.phone,
                  isActive: seleccionado.active,
                  createdAt: seleccionado.createdAt,
                  updatedAt: seleccionado.updatedAt,
                }}
                action={actualizarPersonalAdministrativoEnPanel}
                cancelarHref="/admin/personal"
                panelAdministrativo
                enPanel
                onCancel={() => setEditando(false)}
              />
            ) : (
              <PanelDetalle
                usuario={seleccionado}
                onEdit={() => setEditando(true)}
                onStatusChange={() => setConfirmarCambio(true)}
              />
            )}
            {confirmarCambio && !editando && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-primary/40 p-4 backdrop-blur-sm"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirmar-estado-admin-title"
                aria-describedby="confirmar-estado-admin-description"
                onClick={(event) => {
                  if (event.target === event.currentTarget) {
                    setConfirmarCambio(false);
                  }
                }}
              >
                <div className="w-full max-w-sm overflow-hidden rounded-lg bg-surface-container-lowest shadow-xl">
                  <div className="flex items-center justify-between gap-3 bg-primary-fixed px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="material-symbols-outlined text-[18px] text-primary"
                      >
                        {seleccionado.active ? "warning" : "autorenew"}
                      </span>
                      <h3
                        id="confirmar-estado-admin-title"
                        className="truncate text-sm font-semibold text-on-surface"
                      >
                        {seleccionado.active
                          ? "Confirmar baja de administrativo"
                          : "Confirmar reactivación de administrativo"}
                      </h3>
                    </div>
                    <button
                      type="button"
                      aria-label="Cerrar"
                      onClick={() => setConfirmarCambio(false)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-on-surface-variant hover:bg-surface-container-high"
                    >
                      <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                        close
                      </span>
                    </button>
                  </div>
                  <div className="flex flex-col gap-3 p-4">
                    <div>
                      <h4 className="text-base font-semibold text-on-surface">
                        {seleccionado.active
                          ? `¿Dar de baja a ${seleccionado.firstName} ${seleccionado.lastName}?`
                          : `¿Reactivar a ${seleccionado.firstName} ${seleccionado.lastName}?`}
                      </h4>
                      <p
                        id="confirmar-estado-admin-description"
                        className="mt-1 text-sm text-on-surface-variant"
                      >
                        {seleccionado.active
                          ? "No podrá iniciar sesión. Sus datos se conservarán."
                          : "Volverá a tener acceso al sistema con su cuenta."}
                      </p>
                    </div>
                    <div className="rounded-md bg-primary-fixed px-3 py-2 text-xs text-on-surface">
                      <div className="flex justify-between gap-3 border-b border-on-surface/10 py-1">
                        <span className="text-on-surface-variant">Agente:</span>
                        <span className="truncate font-semibold">
                          {seleccionado.firstName} {seleccionado.lastName}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3 border-b border-on-surface/10 py-1 font-mono">
                        <span className="font-sans text-on-surface-variant">DNI:</span>
                        <span>{formatearDni(seleccionado.dni)}</span>
                      </div>
                      <div className="flex justify-between gap-3 py-1">
                        <span className="text-on-surface-variant">Estado actual:</span>
                        <span className="font-mono text-[10px] font-bold">
                          {seleccionado.active ? "ACTIVO" : "INACTIVO"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 rounded-md bg-primary-fixed px-3 py-2 text-xs text-on-surface-variant">
                      <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
                        info
                      </span>
                      <p>
                        {seleccionado.active
                          ? "Esta acción inhabilitará su acceso y registrará la baja en el padrón activo."
                          : "Esta acción restablecerá su acceso y registrará la reactivación en el padrón institucional."}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col-reverse justify-end gap-2 bg-primary-fixed px-4 py-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => setConfirmarCambio(false)}
                      className="inline-flex h-9 items-center justify-center rounded border border-outline bg-surface-container-high px-4 text-xs font-medium text-on-surface hover:bg-surface-container-highest"
                    >
                      Cancelar
                    </button>
                    <form
                      action={seleccionado.active
                        ? darDeBajaPersonalAdministrativo
                        : reactivarPersonalAdministrativo}
                    >
                      <input type="hidden" name="id" value={seleccionado.id} />
                      <button
                        type="submit"
                        className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded bg-black px-4 text-xs font-semibold text-white hover:bg-on-surface"
                      >
                        <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
                          {seleccionado.active ? "person_remove" : "autorenew"}
                        </span>
                        {seleccionado.active ? "Dar de baja" : "Reactivar"}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function PanelDetalle({
  usuario,
  onEdit,
  onStatusChange,
}: {
  usuario: PersonalAdministrativo;
  onEdit: () => void;
  onStatusChange: () => void;
}) {
  const initials = `${usuario.firstName[0] ?? ""}${usuario.lastName[0] ?? ""}`;

  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-surface-container-high bg-surface-container-low px-5 py-3">
        <h2 className="font-semibold text-on-surface">Detalle del agente</h2>
        <span className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold ${
          usuario.active ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant"
        }`}>
          {usuario.active ? "ACTIVO" : "INACTIVO"}
        </span>
      </div>
      <div className="flex min-w-0 items-center gap-3 bg-primary-fixed p-5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-primary text-lg font-bold text-on-primary">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="max-w-full truncate text-lg font-bold text-on-surface" title={`${usuario.firstName} ${usuario.lastName}`}>
              {usuario.firstName} {usuario.lastName}
            </h3>
            <span className="rounded bg-primary px-2 py-0.5 text-[10px] font-bold text-on-primary">
              {usuario.active ? "ACTIVO" : "INACTIVO"}
            </span>
          </div>
          <p className="truncate text-xs text-on-surface-variant">
            Personal administrativo • ID: ADM-{usuario.dni.slice(-4)}
          </p>
        </div>
        <span className="hidden shrink-0 rounded bg-surface-container-high px-3 py-2 font-mono text-[10px] font-semibold sm:block">
          LEGAJO: #{usuario.dni.slice(-4)}
        </span>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-3 bg-surface-container-low/50 p-5 sm:grid-cols-2">
        <CampoDetalle label="Nombre" value={usuario.firstName} />
        <CampoDetalle label="Apellido" value={usuario.lastName} />
        <CampoDetalle label="DNI" value={formatearDni(usuario.dni)} />
        <CampoDetalle label="Estado laboral" value={usuario.active ? "Activo" : "Inactivo"} />
        <CampoDetalle label="Email institucional" value={usuario.email} full />
        <CampoDetalle label="Teléfono de contacto" value={usuario.phone || "—"} full />
      </div>
      <div className="mt-auto flex flex-col gap-3 p-5">
        <div className="grid gap-3 rounded-lg bg-primary-fixed p-3 sm:grid-cols-2">
          <div className="min-w-0 rounded bg-surface-container-lowest p-3">
            <span className="block text-[10px] uppercase text-on-surface-variant">Área y puesto</span>
            <span className="break-words text-sm font-semibold text-on-surface">Admisión Central - Box 02</span>
          </div>
          <div className="min-w-0 rounded bg-surface-container-lowest p-3">
            <span className="block text-[10px] uppercase text-on-surface-variant">Turno horario</span>
            <span className="break-words text-sm font-semibold text-on-surface">Matutino (07:00 - 15:00 hs)</span>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded bg-surface-container-high px-4 text-sm font-semibold text-on-surface hover:bg-surface-container"
          >
            <span aria-hidden="true" className="material-symbols-outlined">edit</span>
            Modificar
          </button>
          <button
            type="button"
            onClick={onStatusChange}
            className={`inline-flex h-10 flex-1 items-center justify-center gap-2 rounded px-4 text-sm font-semibold text-on-primary ${
              usuario.active ? "bg-error" : "bg-primary"
            }`}
          >
            <span aria-hidden="true" className="material-symbols-outlined">
              {usuario.active ? "person_off" : "person_check"}
            </span>
            {usuario.active ? "Dar de baja" : "Reactivar"}
          </button>
        </div>
      </div>
      <div className="flex flex-wrap justify-between gap-2 bg-primary-fixed px-5 py-3 font-mono text-[9px] font-semibold uppercase tracking-wide text-on-surface-variant">
        <span>Creación: {usuario.createdAt}</span>
        <span>Modificado: {usuario.updatedAt}</span>
      </div>
    </div>
  );
}

function CampoDetalle({
  label,
  value,
  full = false,
}: {
  label: string;
  value: string;
  full?: boolean;
}) {
  return (
    <div className={`min-w-0 rounded bg-surface-container-lowest p-3 ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-wide text-on-surface-variant">
        {label}
      </span>
      <span className="block truncate text-sm font-semibold text-on-surface" title={value}>
        {value}
      </span>
    </div>
  );
}
