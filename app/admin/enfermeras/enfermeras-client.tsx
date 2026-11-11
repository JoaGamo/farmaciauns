"use client";

import { useState } from "react";
import {
  darDeBajaEnfermera,
  reactivarEnfermera,
} from "@/app/actions";
import { actualizarEnfermeraEnPanel } from "@/app/admin/staff-actions";
import { EditarStaffForm } from "@/components/editar-staff-form";

const ENFERMERAS_POR_PAGINA = 10;

export interface EnfermeraItem {
  id: string;
  firstName: string | null;
  lastName: string | null;
  dni: string | null;
  email: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface EnfermerasClientProps {
  enfermeras: EnfermeraItem[];
}

function formatDni(dni: string | null | undefined): string {
  if (!dni) return "S/D";
  const clean = dni.replace(/\D/g, "");
  if (clean.length === 8) {
    return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5)}`;
  }
  if (clean.length === 7) {
    return `${clean.slice(0, 1)}.${clean.slice(1, 4)}.${clean.slice(4)}`;
  }
  return dni;
}

export function EnfermerasClient({ enfermeras }: EnfermerasClientProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortAscending, setSortAscending] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [confirmStatusChange, setConfirmStatusChange] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(
    enfermeras[0]?.id ?? null
  );

  const orderedEnfermeras = [...enfermeras].sort((a, b) => {
    const order =
      (a.lastName ?? "").localeCompare(b.lastName ?? "", "es", {
        sensitivity: "base",
      }) ||
      (a.firstName ?? "").localeCompare(b.firstName ?? "", "es", {
        sensitivity: "base",
      });
    return sortAscending ? order : -order;
  });
  const pageCount = Math.max(
    1,
    Math.ceil(orderedEnfermeras.length / ENFERMERAS_POR_PAGINA),
  );
  const page = Math.min(currentPage, pageCount);
  const firstIndex = (page - 1) * ENFERMERAS_POR_PAGINA;
  const visibleEnfermeras = orderedEnfermeras.slice(
    firstIndex,
    firstIndex + ENFERMERAS_POR_PAGINA,
  );
  const selectedEnfermera =
    visibleEnfermeras.find((enfermera) => enfermera.id === selectedId) ??
    visibleEnfermeras[0] ??
    null;

  function goToPage(nextPage: number) {
    const nextFirstIndex = (nextPage - 1) * ENFERMERAS_POR_PAGINA;
    setCurrentPage(nextPage);
    setSelectedId(orderedEnfermeras[nextFirstIndex]?.id ?? null);
    setIsEditing(false);
    setConfirmStatusChange(false);
  }

  function toggleSortOrder() {
    const nextAscending = !sortAscending;
    const nextOrder = [...enfermeras].sort((a, b) => {
      const order =
        (a.lastName ?? "").localeCompare(b.lastName ?? "", "es", {
          sensitivity: "base",
        }) ||
        (a.firstName ?? "").localeCompare(b.firstName ?? "", "es", {
          sensitivity: "base",
        });
      return nextAscending ? order : -order;
    });
    setSortAscending(nextAscending);
    setCurrentPage(1);
    setSelectedId(nextOrder[0]?.id ?? null);
    setIsEditing(false);
    setConfirmStatusChange(false);
  }

  return (
    <div className="flex flex-col gap-space-lg w-full">
      {/* Breadcrumb & Workflow Metadata */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm mb-space-md">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-space-xs font-mono text-label-sm font-label-sm text-on-surface-variant tracking-wider uppercase"
        >
          <span>MÓDULO CLÍNICO</span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span>EQUIPO DE ENFERMERÍA</span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-on-surface font-semibold">LISTADO DE ENFERMERAS</span>
        </nav>
        <div className="flex items-center gap-space-sm font-mono text-label-sm font-label-sm text-on-surface-variant">
          <span className="inline-flex items-center gap-1.5 px-space-xs py-0.5 rounded-lg bg-surface-container-high">
            <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
            SINCRONIZADO
          </span>
          <span>NODO-ENF-04</span>
        </div>
      </div>

      {/* Header Section */}
      <header className="flex flex-col gap-space-xs mb-space-lg">
        <div className="flex items-center gap-space-sm">
          <div className="w-2.5 h-6 bg-primary rounded-xs"></div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
            Listado de enfermeras
          </h1>
        </div>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-4xl">
          Padrón maestro de personal de enfermería y cuidados clínicos asistenciales. Registro
          administrativo exclusivo de consulta institucional para control de dotación, licencias y
          turnos operativos.
        </p>
      </header>

      {/* Empty State vs Content */}
      {enfermeras.length === 0 ? (
        <div className="w-full bg-surface-container-lowest rounded-xl p-space-xl shadow-sm flex flex-col items-center justify-center text-center py-16">
          <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant mb-space-md">
            <span className="material-symbols-outlined text-[32px]">folder_off</span>
          </div>
          <h3 className="font-headline-md text-headline-md text-on-surface font-semibold mb-space-xs">
            No hay enfermeras registradas
          </h3>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-lg mb-space-md">
            No se encontraron registros de personal de enfermería en el padrón del centro de salud.
          </p>
          <div className="p-space-sm px-space-md rounded-lg bg-surface-container-low max-w-xl text-left flex items-start gap-space-sm">
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant shrink-0 mt-0.5">
              lock_clock
            </span>
            <p className="font-body-sm text-body-sm text-on-surface-variant font-mono">
              <strong className="font-semibold text-on-surface">AVISO DEL SISTEMA:</strong> La
              función de alta y carga masiva para este perfil se encuentra programada para el siguiente
              ciclo de despliegue institucional. Comuníquese con la Dirección Médica para
              importaciones directas de padrón.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg mb-space-xl">
          {/* Left Column: Master Table (7 Cols) */}
          <div className="xl:col-span-7 flex min-w-0 flex-col gap-space-md">
          <div className="flex min-w-0 flex-col bg-surface-container-lowest rounded-xl shadow-sm">
            {/* Table Header Bar */}
            <div className="p-space-md flex flex-wrap items-center justify-between gap-space-sm bg-surface-container-low rounded-t-xl">
              <div className="flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-[20px] text-on-surface">
                  medical_services
                </span>
                <span className="font-label-lg text-label-lg text-on-surface tracking-tight uppercase font-semibold">
                  Nómina de enfermería
                </span>
                <span className="font-mono text-label-sm font-label-sm px-space-xs py-0.5 rounded bg-surface-container-highest text-on-surface font-semibold">
                  {enfermeras.length} REGISTROS
                </span>
              </div>
              <button
                type="button"
                onClick={toggleSortOrder}
                aria-label={`Cambiar orden por apellido a ${sortAscending ? "descendente" : "ascendente"}`}
                className="flex items-center gap-space-xs rounded px-2 py-1 font-mono text-label-sm font-label-sm text-on-surface-variant hover:bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                <span className="material-symbols-outlined text-[16px]">swap_vert</span>
                <span>ORDENADO: APELLIDO ({sortAscending ? "ASC" : "DESC"}) · HACÉ CLIC PARA ALTERNAR</span>
              </button>
            </div>

            {/* Table Container */}
            <div className="w-full min-w-0 overflow-x-auto">
              <table className="w-full min-w-[620px] table-fixed text-left font-body-sm text-body-sm text-on-surface">
                <colgroup>
                  <col className="w-10" />
                  <col className="w-[30%]" />
                  <col className="w-[20%]" />
                  <col className="w-[30%]" />
                  <col className="w-[15%]" />
                </colgroup>
                <thead>
                  <tr className="bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider font-mono">
                    <th className="py-space-sm px-space-md w-10 text-center" scope="col">
                      SEL
                    </th>
                    <th className="py-space-sm px-space-md" scope="col">
                      Apellido y nombre
                    </th>
                    <th className="py-space-sm px-space-md font-mono" scope="col">
                      DNI
                    </th>
                    <th className="py-space-sm px-space-md" scope="col">
                      Email
                    </th>
                    <th className="py-space-sm px-space-md text-right" scope="col">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-transparent font-mono">
                  {visibleEnfermeras.map((enf) => {
                    const isSelected = selectedEnfermera?.id === enf.id;

                    return (
                      <tr
                        key={enf.id}
                        onClick={() => {
                          setSelectedId(enf.id);
                          setIsEditing(false);
                          setConfirmStatusChange(false);
                        }}
                        className={`transition-colors cursor-pointer border-b border-surface-container-low ${
                          isSelected
                            ? "bg-primary text-on-primary shadow-sm font-medium"
                            : "hover:bg-surface-container-low group"
                        }`}
                      >
                        <td className="py-space-sm px-space-md text-center">
                          {isSelected ? (
                            <div className="w-4 h-4 rounded-full bg-on-primary flex items-center justify-center mx-auto">
                              <div className="w-2 h-2 rounded-full bg-primary"></div>
                            </div>
                          ) : (
                            <div className="w-4 h-4 rounded-full bg-surface-container-highest mx-auto flex items-center justify-center">
                              <div className="w-1.5 h-1.5 rounded-full bg-surface-container-lowest"></div>
                            </div>
                          )}
                        </td>
                        <td
                          className={`py-space-sm px-space-md font-body-sm text-body-sm ${
                            isSelected
                              ? "font-bold text-on-primary"
                              : "font-semibold text-on-surface"
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-space-xs">
                            <span className="block min-w-0 truncate" title={`${enf.lastName}, ${enf.firstName}`}>
                              {enf.lastName}, {enf.firstName}
                            </span>
                            {isSelected && (
                              <span className="material-symbols-outlined text-[16px] text-on-primary">
                                arrow_forward
                              </span>
                            )}
                          </div>
                        </td>
                        <td
                          className={`py-space-sm px-space-md font-mono ${
                            isSelected ? "text-on-primary/90" : "text-on-surface-variant"
                          }`}
                        >
                          {formatDni(enf.dni)}
                        </td>
                        <td
                          className={`py-space-sm px-space-md font-mono ${
                            isSelected ? "text-on-primary/90" : "text-on-surface-variant"
                          }`}
                        >
                          <span className="block truncate" title={enf.email}>
                            {enf.email}
                          </span>
                        </td>
                        <td className="py-space-sm px-space-md text-right">
                          <span
                            className={`inline-flex items-center px-space-xs py-0.5 rounded text-label-sm font-label-sm font-mono font-semibold ${
                              isSelected
                                ? "bg-surface-container-lowest text-primary font-bold tracking-wide"
                                : enf.isActive
                                ? "bg-surface-container-high text-on-surface"
                                : "bg-surface-container-highest text-on-surface-variant line-through"
                            }`}
                          >
                            {enf.isActive ? "ACTIVO" : "INACTIVO"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination / Status Bar */}
            <div className="mt-auto p-space-md bg-surface-container-low rounded-b-xl flex flex-col sm:flex-row items-center justify-between gap-space-xs font-mono text-label-sm font-label-sm text-on-surface-variant">
              <div className="flex items-center gap-space-xs">
                <span className="w-2 h-2 rounded-full bg-primary"></span>
                <span>
                  Mostrando {enfermeras.length === 0 ? 0 : firstIndex + 1}-
                  {Math.min(firstIndex + ENFERMERAS_POR_PAGINA, enfermeras.length)}{" "}
                  de {enfermeras.length} registros • Pág. {page} de {pageCount}
                </span>
              </div>
              <div className="flex items-center gap-space-xs">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => goToPage(page - 1)}
                  className="px-space-sm py-1 rounded bg-surface-container-high text-on-surface-variant uppercase font-mono text-label-sm enabled:hover:bg-surface-container-highest disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={page === pageCount}
                  onClick={() => goToPage(page + 1)}
                  className="px-space-sm py-1 rounded bg-surface-container-high text-on-surface-variant uppercase font-mono text-label-sm enabled:hover:bg-surface-container-highest disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </div>
          <section className="flex min-w-0 items-start gap-space-sm rounded-xl bg-primary-fixed p-space-md">
            <span aria-hidden="true" className="material-symbols-outlined shrink-0 text-on-surface-variant">
              policy
            </span>
            <div className="min-w-0">
              <h2 className="font-label-sm text-label-sm font-mono font-semibold uppercase tracking-wider text-on-surface">
                Política de integridad de datos
              </h2>
              <p className="mt-1 break-words font-body-sm text-body-sm text-on-surface-variant">
                Cualquier modificación de teléfono o correo institucional quedará asentada en el libro de eventos del sistema central con estampa de tiempo e identificación de operador.
              </p>
            </div>
          </section>
          </div>

          {/* Right Column: Detail Panel (Ficha técnica de sólo lectura) (5 Cols) */}
          {selectedEnfermera && (
            <div className="xl:col-span-5 flex min-w-0 flex-col overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm">
              {isEditing && (
                <EditarStaffForm
                  key={selectedEnfermera.id}
                  staff={{
                    id: selectedEnfermera.id,
                    firstName: selectedEnfermera.firstName ?? "",
                    lastName: selectedEnfermera.lastName ?? "",
                    dni: selectedEnfermera.dni ?? "",
                    email: selectedEnfermera.email,
                    phone: selectedEnfermera.phone ?? "",
                    isActive: selectedEnfermera.isActive,
                    createdAt: selectedEnfermera.createdAt,
                    updatedAt: selectedEnfermera.updatedAt,
                  }}
                  action={actualizarEnfermeraEnPanel}
                  cancelarHref="/admin/enfermeras"
                  mostrarAsignacionOperativa
                  enPanel
                  onCancel={() => setIsEditing(false)}
                />
              )}
              {!isEditing && (
                <div className="flex min-w-0 flex-1 flex-col">
              {/* Detail Header */}
              <div className="p-space-md bg-surface-container-low flex items-center justify-between gap-space-sm">
                <div className="flex items-center gap-space-sm">
                  <span className="material-symbols-outlined text-[20px] text-on-surface">
                    clinical_notes
                  </span>
                  <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                    Detalle de la profesional
                  </span>
                </div>
                <span
                  className={`px-space-sm py-0.5 rounded font-mono text-label-sm font-label-sm font-bold tracking-wider ${
                    selectedEnfermera.isActive
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container-highest text-secondary"
                  }`}
                >
                  {selectedEnfermera.isActive ? "ACTIVO" : "INACTIVO"}
                </span>
              </div>

              {/* Technical Profile Banner */}
              <div className="p-space-lg bg-surface-container-lowest">
                <div className="flex items-center gap-space-md">
                  <div className="h-16 w-16 shrink-0 rounded-xl bg-primary text-on-primary flex items-center justify-center font-headline-lg text-headline-lg font-bold shadow-sm">
                    {(selectedEnfermera.firstName?.[0] || "") +
                      (selectedEnfermera.lastName?.[0] || "")}
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <div className="flex items-center gap-space-xs">
                      <span className="font-mono text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider">
                        ID #ENF-{selectedEnfermera.dni?.slice(-4) || "0000"}
                      </span>
                    </div>
                    <h2 title={`${selectedEnfermera.firstName} ${selectedEnfermera.lastName}`} className="max-w-full truncate font-headline-md text-headline-md text-on-surface font-bold">
                      {selectedEnfermera.firstName} {selectedEnfermera.lastName}
                    </h2>
                    <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                      Enfermera profesional / Cuidados generales
                    </p>
                  </div>
                </div>
              </div>

              {/* Key-Value Fields Grid */}
              <div className="px-space-lg py-space-md grid grid-cols-1 sm:grid-cols-2 gap-space-md bg-surface-container-low/50">
                <div className="min-w-0 p-space-sm rounded-lg bg-surface-container-lowest">
                  <span className="font-label-sm text-label-sm font-mono text-on-surface-variant uppercase tracking-wider block mb-0.5">
                    Nombre
                  </span>
                  <span title={selectedEnfermera.firstName || "—"} className="block truncate font-body-md text-body-md text-on-surface font-semibold">
                    {selectedEnfermera.firstName || "—"}
                  </span>
                </div>
                <div className="min-w-0 p-space-sm rounded-lg bg-surface-container-lowest">
                  <span className="font-label-sm text-label-sm font-mono text-on-surface-variant uppercase tracking-wider block mb-0.5">
                    Apellido
                  </span>
                  <span title={selectedEnfermera.lastName || "—"} className="block truncate font-body-md text-body-md text-on-surface font-semibold">
                    {selectedEnfermera.lastName || "—"}
                  </span>
                </div>
                <div className="p-space-sm rounded-lg bg-surface-container-lowest">
                  <span className="font-label-sm text-label-sm font-mono text-on-surface-variant uppercase tracking-wider block mb-0.5">
                    DNI
                  </span>
                  <span className="font-mono font-body-md text-body-md text-on-surface font-semibold">
                    {formatDni(selectedEnfermera.dni)}
                  </span>
                </div>
                <div className="p-space-sm rounded-lg bg-surface-container-lowest">
                  <span className="font-label-sm text-label-sm font-mono text-on-surface-variant uppercase tracking-wider block mb-0.5">
                    Estado laboral
                  </span>
                  <span className="font-body-md text-body-md text-on-surface font-semibold flex items-center gap-1">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        selectedEnfermera.isActive ? "bg-primary" : "bg-secondary"
                      }`}
                    ></span>
                    {selectedEnfermera.isActive ? "Activo regular" : "Licencia / Inactivo"}
                  </span>
                </div>
                <div className="sm:col-span-2 min-w-0 p-space-sm rounded-lg bg-surface-container-lowest">
                  <span className="font-label-sm text-label-sm font-mono text-on-surface-variant uppercase tracking-wider block mb-0.5">
                    Correo electrónico corporativo
                  </span>
                  <span title={selectedEnfermera.email} className="block truncate font-mono font-body-md text-body-md text-on-surface font-semibold">
                    {selectedEnfermera.email}
                  </span>
                </div>
                <div className="sm:col-span-2 min-w-0 p-space-sm rounded-lg bg-surface-container-lowest">
                  <span className="font-label-sm text-label-sm font-mono text-on-surface-variant uppercase tracking-wider block mb-0.5">
                    Teléfono directo de contacto
                  </span>
                  <span title={selectedEnfermera.phone || "+54 11 4980-0000"} className="block truncate font-mono font-body-md text-body-md text-on-surface font-semibold">
                    {selectedEnfermera.phone || "+54 11 4980-0000"}
                  </span>
                </div>
              </div>

              {/* Operative Assignment Block */}
              <div className="p-space-lg flex flex-col gap-space-sm bg-surface-container-lowest mt-auto">
                <div className="flex items-center justify-between gap-space-sm">
                  <span className="font-label-sm text-label-sm font-mono text-on-surface-variant uppercase tracking-wider font-semibold">
                    Sector de asignación en servicio
                  </span>
                </div>
                <div className="grid gap-space-sm sm:grid-cols-2">
                  <div className="min-w-0 rounded-xl bg-surface-container-low p-space-md">
                    <span
                      aria-hidden="true"
                      className="material-symbols-outlined text-[24px] text-primary"
                    >
                      domain
                    </span>
                    <span className="block text-xs uppercase text-on-surface-variant">
                      Sector de asignación
                    </span>
                    <span className="break-words font-semibold text-on-surface">
                      Vacunatorio General / Inmunizaciones
                    </span>
                  </div>
                  <div className="min-w-0 rounded-xl bg-surface-container-low p-space-md">
                    <span className="block text-xs uppercase text-on-surface-variant">
                      Turno horario
                    </span>
                    <span className="break-words font-semibold text-on-surface">
                      Matutino (07:00 - 15:00 hs)
                    </span>
                  </div>
                </div>
                {confirmStatusChange ? (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-primary/40 p-4 backdrop-blur-sm"
                    role="alertdialog"
                    aria-modal="true"
                    aria-labelledby="confirm-status-title"
                    aria-describedby="confirm-status-description"
                    onClick={(event) => {
                      if (event.target === event.currentTarget) {
                        setConfirmStatusChange(false);
                      }
                    }}
                  >
                    <div className="w-full max-w-sm overflow-hidden rounded-lg bg-surface-container-lowest shadow-xl">
                      <div className="flex items-center justify-between gap-3 bg-primary-fixed px-4 py-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            aria-hidden="true"
                            className={`material-symbols-outlined text-[18px] ${
                              selectedEnfermera.isActive
                                ? "text-error"
                                : "text-primary"
                            }`}
                          >
                            {selectedEnfermera.isActive ? "warning" : "autorenew"}
                          </span>
                          <h3
                            id="confirm-status-title"
                            className="truncate text-sm font-semibold text-on-surface"
                          >
                            {selectedEnfermera.isActive
                              ? "Confirmar baja de enfermera"
                              : "Confirmar reactivación de enfermera"}
                          </h3>
                        </div>
                        <button
                          type="button"
                          aria-label="Cerrar"
                          onClick={() => setConfirmStatusChange(false)}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-on-surface-variant transition-colors hover:bg-surface-container-high"
                        >
                          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                            close
                          </span>
                        </button>
                      </div>
                      <div className="flex flex-col gap-3 p-4">
                        <div className="flex flex-col gap-1">
                          <h4 className="text-base font-semibold text-on-surface">
                            {selectedEnfermera.isActive
                              ? `¿Dar de baja a ${selectedEnfermera.firstName} ${selectedEnfermera.lastName}?`
                              : `¿Reactivar a ${selectedEnfermera.firstName} ${selectedEnfermera.lastName}?`}
                          </h4>
                          <p
                            id="confirm-status-description"
                            className="break-words text-sm text-on-surface-variant"
                          >
                            {selectedEnfermera.isActive
                              ? "No va a poder iniciar sesión. Sus datos se conservarán y los turnos de vacunación ya reservados no se verán afectados."
                              : "La enfermera volverá a tener acceso al sistema con su cuenta."}
                          </p>
                        </div>
                        <div className="rounded-md bg-primary-fixed px-3 py-2 text-xs text-on-surface">
                          <div className="flex items-center justify-between gap-3 border-b border-on-surface/10 py-1">
                            <span className="text-on-surface-variant">Enfermera:</span>
                            <span className="truncate font-semibold">
                              {selectedEnfermera.firstName} {selectedEnfermera.lastName}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3 border-b border-on-surface/10 py-1 font-mono">
                            <span className="font-sans text-on-surface-variant">DNI:</span>
                            <span>{formatDni(selectedEnfermera.dni)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3 py-1">
                            <span className="text-on-surface-variant">Estado actual:</span>
                            <span
                              className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold ${
                                selectedEnfermera.isActive
                                  ? "bg-on-surface text-surface-container-lowest"
                                  : "bg-surface-container-highest text-on-surface-variant line-through"
                              }`}
                            >
                              {selectedEnfermera.isActive ? "ACTIVO" : "INACTIVO"}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-start gap-2 rounded-md bg-primary-fixed px-3 py-2 text-xs text-on-surface-variant">
                          <span aria-hidden="true" className="material-symbols-outlined mt-0.5 text-[16px]">
                            info
                          </span>
                          <p>
                            {selectedEnfermera.isActive
                              ? "Esta acción inhabilitará el acceso de la profesional al portal de enfermería y registrará su baja en el padrón activo."
                              : "Esta acción restablecerá el acceso de la profesional al portal de enfermería y registrará su reactivación en el padrón activo institucional."}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col-reverse items-stretch justify-end gap-2 bg-primary-fixed px-4 py-3 sm:flex-row sm:items-center">
                        <button
                          type="button"
                          onClick={() => setConfirmStatusChange(false)}
                          className="inline-flex h-9 items-center justify-center rounded border border-outline bg-surface-container-high px-4 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container-highest"
                        >
                          Cancelar
                        </button>
                        <form
                          action={
                            selectedEnfermera.isActive
                              ? darDeBajaEnfermera
                              : reactivarEnfermera
                          }
                        >
                          <input
                            type="hidden"
                            name="id"
                            value={selectedEnfermera.id}
                          />
                          <button
                            type="submit"
                            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded bg-black px-4 text-xs font-semibold text-white transition-colors hover:bg-on-surface"
                          >
                            <span
                              aria-hidden="true"
                              className="material-symbols-outlined text-[16px]"
                            >
                              {selectedEnfermera.isActive
                                ? "person_remove"
                                : "autorenew"}
                            </span>
                            {selectedEnfermera.isActive
                              ? "Dar de baja"
                              : "Reactivar"}
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                ) : (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded bg-surface-container-high px-4 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container"
                  >
                    <span aria-hidden="true" className="material-symbols-outlined">edit</span>
                    Modificar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmStatusChange(true)}
                    className={`inline-flex h-10 flex-1 items-center justify-center gap-2 rounded px-4 text-sm font-semibold text-on-primary transition-opacity hover:opacity-90 ${
                      selectedEnfermera.isActive ? "bg-error" : "bg-primary"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="material-symbols-outlined text-[18px]"
                    >
                      {selectedEnfermera.isActive ? "person_off" : "person_check"}
                    </span>
                    {selectedEnfermera.isActive ? "Dar de baja" : "Reactivar"}
                  </button>
                </div>
                )}
                </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
