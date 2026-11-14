"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import { darDeBajaMedico, reactivarMedico } from "@/app/actions";

const MEDICOS_POR_PAGINA = 10;

export interface MedicoItem {
  id: string;
  firstName: string | null;
  lastName: string | null;
  dni: string | null;
  email: string;
  phone: string | null;
  matricula: string | null;
  especialidad: "CLINICA_MEDICA" | "PEDIATRIA" | "TRAUMATOLOGIA" | null;
  isActive: boolean;
}

interface MedicosClientProps {
  initialMedicos: MedicoItem[];
  selectedDoctorId?: string;
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

function especialidadLabel(esp: MedicoItem["especialidad"]): string {
  switch (esp) {
    case "CLINICA_MEDICA":
      return "Clínica médica";
    case "PEDIATRIA":
      return "Pediatría";
    case "TRAUMATOLOGIA":
      return "Traumatología";
    default:
      return "General";
  }
}

export function MedicosClient({
  initialMedicos,
  selectedDoctorId,
}: MedicosClientProps) {
  const [filtroEspecialidad, setFiltroEspecialidad] = useState("todas");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [selectedId, setSelectedId] = useState<string | null>(selectedDoctorId ?? null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortAscending, setSortAscending] = useState(true);
  const [confirmStatusChange, setConfirmStatusChange] = useState(false);

  const filtered = useMemo(() => {
    return initialMedicos.filter((m) => {
      // Filtro especialidad
      if (filtroEspecialidad === "clinica" && m.especialidad !== "CLINICA_MEDICA") {
        return false;
      }
      if (filtroEspecialidad === "pediatria" && m.especialidad !== "PEDIATRIA") {
        return false;
      }
      if (filtroEspecialidad === "traumatologia" && m.especialidad !== "TRAUMATOLOGIA") {
        return false;
      }

      // Filtro estado
      if (filtroEstado === "activo" && !m.isActive) {
        return false;
      }
      if (filtroEstado === "inactivo" && m.isActive) {
        return false;
      }

      return true;
    });
  }, [initialMedicos, filtroEspecialidad, filtroEstado]);

  const orderedMedicos = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        const order =
          (a.lastName ?? "").localeCompare(b.lastName ?? "", "es", {
            sensitivity: "base",
          }) ||
          (a.firstName ?? "").localeCompare(b.firstName ?? "", "es", {
            sensitivity: "base",
          });
        return sortAscending ? order : -order;
      }),
    [filtered, sortAscending],
  );
  const pageCount = Math.max(1, Math.ceil(orderedMedicos.length / MEDICOS_POR_PAGINA));
  const page = Math.min(currentPage, pageCount);
  const firstIndex = (page - 1) * MEDICOS_POR_PAGINA;
  const visibleMedicos = orderedMedicos.slice(firstIndex, firstIndex + MEDICOS_POR_PAGINA);
  const selectedMedico =
    visibleMedicos.find((medico) => medico.id === selectedId) ??
    visibleMedicos[0] ??
    null;

  function resetListInteraction() {
    setCurrentPage(1);
    setSelectedId(null);
    setConfirmStatusChange(false);
  }

  function goToPage(nextPage: number) {
    const nextFirstIndex = (nextPage - 1) * MEDICOS_POR_PAGINA;
    setCurrentPage(nextPage);
    setSelectedId(orderedMedicos[nextFirstIndex]?.id ?? null);
    setConfirmStatusChange(false);
  }

  function toggleSortOrder() {
    setSortAscending((ascending) => !ascending);
    resetListInteraction();
  }

  const resetFilters = () => {
    setFiltroEspecialidad("todas");
    setFiltroEstado("todos");
    resetListInteraction();
  };

  return (
    <div className="flex flex-col gap-space-lg w-full">
      {/* Top Breadcrumb & Metadata */}
      <div className="flex items-center justify-between">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-space-xs text-on-surface-variant font-label-sm text-label-sm tracking-widest uppercase"
        >
          <span className="hover:text-on-surface transition-colors cursor-pointer">
            MÓDULO CLÍNICO
          </span>
          <span className="text-secondary select-none">/</span>
          <span className="hover:text-on-surface transition-colors cursor-pointer">
            CUERPO MÉDICO
          </span>
          <span className="text-secondary select-none">/</span>
          <span className="text-on-surface font-semibold">NÓMINA GENERAL</span>
        </nav>
        <div className="flex items-center gap-space-sm bg-surface-container-high px-space-sm py-1 rounded">
          <span className="w-2 h-2 rounded-full bg-primary inline-block"></span>
          <span className="font-label-sm text-label-sm text-on-surface uppercase tracking-wider font-semibold">
            Base de datos sincronizada
          </span>
        </div>
      </div>

      {/* Page Header Area */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-md">
        <div className="flex flex-col gap-0.5">
          <h1 className="font-display-lg text-display-lg text-on-surface tracking-tight font-bold">
            Listado de médicos
          </h1>
          <p className="font-body-md text-body-md text-secondary">
            Cuerpo facultativo y profesionales matriculados en Sala Médica
          </p>
        </div>
        <Link
          href="/admin/medicos/nuevo"
          className="inline-flex items-center gap-space-xs bg-primary text-on-primary px-space-md py-2 rounded shadow-sm hover:bg-on-surface transition-all active:scale-[0.98]"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span className="font-label-md text-label-md">Nuevo médico</span>
        </Link>
      </div>

      {/* Filter Bar */}
      <section className="bg-surface-container-lowest p-space-md rounded shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md">
        <div className="flex flex-wrap items-center gap-space-lg w-full md:w-auto">
          {/* Especialidad Selector */}
          <div className="flex flex-col gap-1 min-w-[200px]">
            <label
              htmlFor="filtro-especialidad"
              className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-semibold"
            >
              Especialidad
            </label>
            <div className="relative w-full">
              <select
                id="filtro-especialidad"
                value={filtroEspecialidad}
                onChange={(e) => {
                  setFiltroEspecialidad(e.target.value);
                  resetListInteraction();
                }}
                className="w-full appearance-none bg-surface text-on-surface font-body-md text-body-md py-2 pl-3 pr-8 rounded focus:outline-none focus:bg-surface-container transition-colors cursor-pointer border border-outline-variant/40"
              >
                <option value="todas">Todas</option>
                <option value="clinica">Clínica médica</option>
                <option value="pediatria">Pediatría</option>
                <option value="traumatologia">Traumatología</option>
              </select>
              <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-secondary pointer-events-none text-[18px]">
                expand_more
              </span>
            </div>
          </div>

          {/* Estado Selector */}
          <div className="flex flex-col gap-1 min-w-[180px]">
            <label
              htmlFor="filtro-estado"
              className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-semibold"
            >
              Estado
            </label>
            <div className="relative w-full">
              <select
                id="filtro-estado"
                value={filtroEstado}
                onChange={(e) => {
                  setFiltroEstado(e.target.value);
                  resetListInteraction();
                }}
                className="w-full appearance-none bg-surface text-on-surface font-body-md text-body-md py-2 pl-3 pr-8 rounded focus:outline-none focus:bg-surface-container transition-colors cursor-pointer border border-outline-variant/40"
              >
                <option value="todos">Todos</option>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
              <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-secondary pointer-events-none text-[18px]">
                expand_more
              </span>
            </div>
          </div>
        </div>

        {/* Counter Metric Tag */}
        <div className="flex items-center gap-space-xs bg-surface-container py-1.5 px-space-md rounded">
          <span className="material-symbols-outlined text-[16px] text-secondary">group</span>
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface font-semibold">
            Total: <span className="font-bold">{filtered.length}</span> profesionales registrados
          </span>
        </div>
      </section>

      {/* Main Workplace: Table + Detail Panel */}
      {filtered.length === 0 ? (
        /* Empty State exactly matching pantalla_20 */
        <div className="w-full bg-surface-container-lowest rounded shadow-sm overflow-hidden p-space-xl flex flex-col items-center justify-center text-center min-h-[420px]">
          <div className="relative mb-space-md">
            <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-[32px]">filter_list_off</span>
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-surface-container-high border-2 border-surface-container-lowest flex items-center justify-center">
              <span className="material-symbols-outlined text-on-surface-variant text-[14px]">
                search_off
              </span>
            </div>
          </div>

          <h2 className="font-headline-sm text-headline-sm text-on-surface tracking-tight mb-space-xs font-bold">
            No hay médicos que coincidan con el filtro
          </h2>
          <p className="font-body-md text-body-md text-secondary max-w-md mx-auto mb-space-lg">
            Probá modificando los criterios de especialidad o estado para visualizar otros profesionales.
          </p>

          <div className="flex items-center gap-2 mb-space-lg flex-wrap justify-center">
            <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">
              Criterios activos:
            </span>
            {filtroEspecialidad !== "todas" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-surface-container text-on-surface font-label-sm text-label-sm">
                <span className="material-symbols-outlined text-[13px] text-secondary">label</span>
                Especialidad:{" "}
                {filtroEspecialidad === "clinica"
                  ? "Clínica médica"
                  : filtroEspecialidad === "pediatria"
                  ? "Pediatría"
                  : "Traumatología"}
              </span>
            )}
            {filtroEstado !== "todos" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-surface-container text-on-surface font-label-sm text-label-sm">
                <span className="material-symbols-outlined text-[13px] text-secondary">
                  toggle_off
                </span>
                Estado: {filtroEstado === "activo" ? "Activo" : "Inactivo"}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-space-xs bg-surface-container hover:bg-surface-container-high text-on-surface px-space-md py-2 rounded font-label-md text-label-md font-semibold transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">restart_alt</span>
            <span>Limpiar filtros</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
          {/* Columna Izquierda: Tabla */}
          <div className="lg:col-span-8 flex flex-col bg-surface-container-lowest rounded shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-surface-container px-4 py-3">
              <span className="font-label-sm text-label-sm font-semibold uppercase tracking-wider text-on-surface-variant">
                Listado alfabético por apellido
              </span>
              <button
                type="button"
                onClick={toggleSortOrder}
                aria-label={`Cambiar orden por apellido a ${sortAscending ? "descendente" : "ascendente"}`}
                className="rounded px-2 py-1 font-mono text-[10px] font-semibold uppercase text-on-surface-variant hover:bg-surface-container-high"
              >
                Apellido {sortAscending ? "A-Z" : "Z-A"}
              </button>
            </div>
            <div className="overflow-x-auto w-full">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-surface-container text-xs uppercase tracking-wider text-on-surface-variant">
                    <th className="w-12 px-4 py-2.5 text-center">SEL</th>
                    <th className="px-4 py-2.5">Apellido y nombre</th>
                    <th className="px-4 py-2.5">DNI</th>
                    <th className="px-4 py-2.5">Especialidad</th>
                    <th className="px-4 py-2.5">Email</th>
                    <th className="px-4 py-2.5 text-right">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleMedicos.map((m) => {
                    const isSelected = selectedMedico?.id === m.id;
                    return (
                      <tr
                        key={m.id}
                        onClick={() => {
                          setSelectedId(m.id);
                          setConfirmStatusChange(false);
                        }}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-surface-container-high/70"
                            : "hover:bg-surface-container-low"
                        }`}
                      >
                        <td className="px-4 py-3 text-center">
                          <input
                            type="radio"
                            name="medico-seleccionado"
                            readOnly
                            checked={isSelected}
                            className="h-4 w-4 accent-black"
                            aria-label={`Seleccionar a ${m.lastName}, ${m.firstName}`}
                          />
                        </td>
                        <td className="min-w-0 px-4 py-3 font-medium text-on-surface">
                          <span className="block truncate" title={`${m.lastName}, ${m.firstName}`}>
                            {m.lastName}, {m.firstName}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-on-surface-variant">
                          {formatDni(m.dni)}
                        </td>
                        <td className="px-4 py-3 text-on-surface-variant">
                          {especialidadLabel(m.especialidad)}
                        </td>
                        <td className="max-w-[200px] truncate px-4 py-3 font-mono text-xs text-on-surface-variant" title={m.email}>
                          {m.email}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                              m.isActive
                                ? "bg-primary text-on-primary"
                                : "bg-surface-container-high text-on-surface-variant"
                            }`}
                          >
                            {m.isActive ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="border-t border-surface-container-high bg-surface-container-low px-4 py-2 text-xs text-on-surface-variant">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Mostrando {orderedMedicos.length === 0 ? 0 : firstIndex + 1}-
                  {Math.min(firstIndex + MEDICOS_POR_PAGINA, orderedMedicos.length)} de{" "}
                  {orderedMedicos.length} registros • Pág. {page} de {pageCount}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page === 1}
                    onClick={() => goToPage(page - 1)}
                    className="rounded border border-outline bg-surface-container-high px-3 py-1 text-[10px] font-semibold uppercase text-on-surface enabled:hover:bg-surface-container-highest disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    disabled={page === pageCount}
                    onClick={() => goToPage(page + 1)}
                    className="rounded border border-outline bg-surface-container-high px-3 py-1 text-[10px] font-semibold uppercase text-on-surface enabled:hover:bg-surface-container-highest disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Panel de Ficha Técnica */}
          {selectedMedico && (
            <div className="lg:col-span-4 flex flex-col bg-surface-container-lowest rounded shadow-sm overflow-hidden sticky top-20">
              <div className="p-space-lg bg-surface-container-low flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-bold">
                    Ficha de Profesional
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded font-label-sm text-label-sm uppercase tracking-wider font-semibold ${
                      selectedMedico.isActive
                        ? "bg-primary text-on-primary"
                        : "bg-surface-container-high text-secondary"
                    }`}
                  >
                    {selectedMedico.isActive ? "Activo" : "Inactivo"}
                  </span>
                </div>
                <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">
                  Detalle del médico
                </h2>
                <p className="font-body-sm text-body-sm text-secondary leading-relaxed">
                  Información institucional y de contacto del profesional seleccionado.
                </p>
              </div>

              <div className="p-space-lg flex flex-col gap-space-lg">
                {/* Identity Summary Box */}
                <div className="flex items-center gap-space-md p-space-md bg-surface-container-low rounded">
                  <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-on-primary font-headline-md text-headline-md font-bold select-none">
                    {(selectedMedico.firstName?.[0] || "") +
                      (selectedMedico.lastName?.[0] || "")}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-headline-sm text-headline-sm text-on-surface font-semibold truncate">
                      Dr. {selectedMedico.firstName} {selectedMedico.lastName}
                    </span>
                    <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider font-medium">
                      {especialidadLabel(selectedMedico.especialidad)} • Planta permanente
                    </span>
                  </div>
                </div>

                {/* Structured Specifications Grid */}
                <div className="flex flex-col gap-space-md">
                  <div className="grid grid-cols-2 gap-space-sm">
                    <div className="flex flex-col bg-surface-container-low p-space-sm rounded">
                      <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">
                        Nombre
                      </span>
                      <span className="font-body-md text-body-md text-on-surface font-medium mt-0.5">
                        {selectedMedico.firstName || "—"}
                      </span>
                    </div>
                    <div className="flex flex-col bg-surface-container-low p-space-sm rounded">
                      <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">
                        Apellido
                      </span>
                      <span className="font-body-md text-body-md text-on-surface font-medium mt-0.5">
                        {selectedMedico.lastName || "—"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-space-sm bg-surface-container-low rounded">
                    <div className="flex flex-col">
                      <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">
                        Documento Nacional (DNI)
                      </span>
                      <span className="font-body-md text-body-md text-on-surface font-mono font-medium mt-0.5">
                        {formatDni(selectedMedico.dni)}
                      </span>
                    </div>
                    <span className="material-symbols-outlined text-secondary text-[20px]">
                      badge
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-space-sm bg-surface-container-low rounded">
                    <div className="flex flex-col">
                      <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">
                        Matrícula Habilitante
                      </span>
                      <span className="font-body-md text-body-md text-on-surface font-mono font-medium mt-0.5">
                        {selectedMedico.matricula || "MN —"}
                      </span>
                    </div>
                    <span className="material-symbols-outlined text-secondary text-[20px]">
                      verified
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-space-sm bg-surface-container-low rounded">
                    <div className="flex flex-col">
                      <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">
                        Especialidad
                      </span>
                      <span className="font-body-md text-body-md text-on-surface font-medium mt-0.5">
                        {especialidadLabel(selectedMedico.especialidad)}
                      </span>
                    </div>
                    <span className="material-symbols-outlined text-secondary text-[20px]">
                      stethoscope
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-space-sm bg-surface-container-low rounded">
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">
                        Correo Institucional
                      </span>
                      <span className="font-body-md text-body-md text-on-surface font-medium truncate mt-0.5">
                        {selectedMedico.email}
                      </span>
                    </div>
                    <span className="material-symbols-outlined text-secondary text-[20px] shrink-0">
                      mail
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-space-sm bg-surface-container-low rounded">
                    <div className="flex flex-col">
                      <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">
                        Teléfono de Contacto
                      </span>
                      <span className="font-body-md text-body-md text-on-surface font-mono font-medium mt-0.5">
                        {selectedMedico.phone || "—"}
                      </span>
                    </div>
                    <span className="material-symbols-outlined text-secondary text-[20px]">
                      call
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-space-sm bg-surface-container-low rounded">
                    <div className="flex flex-col">
                      <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">
                        Estado de Habilitación
                      </span>
                      <span className="font-body-md text-body-md text-on-surface font-medium mt-0.5">
                        {selectedMedico.isActive
                          ? "Activo en guardia y consultorios"
                          : "Inactivo / Licencia"}
                      </span>
                    </div>
                    <div
                      className={`w-3 h-3 rounded-full ${
                        selectedMedico.isActive
                          ? "bg-primary ring-4 ring-surface-container-high"
                          : "bg-secondary"
                      }`}
                    ></div>
                  </div>
                </div>

                <div className="pt-space-xs text-center">
                  <span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest font-mono">
                    REGISTRO AUDITADO #MED-{selectedMedico.dni?.slice(-5) || "00000"} • SOLO LECTURA
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Link
                    href={`/admin/medicos/${selectedMedico.id}/editar`}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded bg-surface-container-high px-4 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                    Modificar
                  </Link>
                  <button
                    type="button"
                    onClick={() => setConfirmStatusChange(true)}
                    className={`inline-flex h-10 items-center justify-center gap-2 rounded px-4 text-sm font-semibold text-on-primary transition-colors ${
                      selectedMedico.isActive
                        ? "bg-black hover:bg-on-surface"
                        : "bg-primary hover:bg-secondary"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {selectedMedico.isActive ? "person_remove" : "person_check"}
                    </span>
                    {selectedMedico.isActive ? "Dar de baja" : "Reactivar"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {selectedMedico && confirmStatusChange && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-primary/40 p-4 backdrop-blur-sm"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="confirm-medico-status-title"
              aria-describedby="confirm-medico-status-description"
              onClick={(event) => {
                if (event.target === event.currentTarget) {
                  setConfirmStatusChange(false);
                }
              }}
            >
              <div className="w-full max-w-sm overflow-hidden rounded-lg bg-surface-container-lowest shadow-xl">
                <div className="flex items-start gap-3 px-5 pt-5">
                  <span
                    aria-hidden="true"
                    className="material-symbols-outlined flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-fixed text-on-surface"
                  >
                    {selectedMedico.isActive ? "person_remove" : "person_check"}
                  </span>
                  <div className="min-w-0">
                    <h2
                      id="confirm-medico-status-title"
                      className="text-base font-semibold text-on-surface"
                    >
                      {selectedMedico.isActive
                        ? `¿Dar de baja al Dr. ${selectedMedico.firstName} ${selectedMedico.lastName}?`
                        : `¿Reactivar al Dr. ${selectedMedico.firstName} ${selectedMedico.lastName}?`}
                    </h2>
                    <p
                      id="confirm-medico-status-description"
                      className="mt-1 text-sm text-on-surface-variant"
                    >
                      {selectedMedico.isActive
                        ? "No podrá iniciar sesión ni recibir nuevos turnos. Sus turnos pasados y registros clínicos se conservarán."
                        : "Volverá a atender en la sala. Conservará sus datos, contraseña y configuración de agenda."}
                    </p>
                  </div>
                </div>
                <div className="mx-5 mt-4 rounded-md border border-outline-variant/50 bg-primary-fixed/50 px-3 py-2 text-xs text-on-surface">
                  <div className="flex justify-between gap-3 border-b border-on-surface/10 py-1">
                    <span className="text-on-surface-variant">Profesional</span>
                    <span className="truncate font-semibold">
                      Dr. {selectedMedico.firstName} {selectedMedico.lastName}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3 border-b border-on-surface/10 py-1">
                    <span className="text-on-surface-variant">Especialidad</span>
                    <span className="truncate font-semibold">
                      {especialidadLabel(selectedMedico.especialidad)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3 border-b border-on-surface/10 py-1 font-mono">
                    <span className="font-sans text-on-surface-variant">Matrícula</span>
                    <span>{selectedMedico.matricula || "MN —"}</span>
                  </div>
                  <div className="flex justify-between gap-3 py-1">
                    <span className="text-on-surface-variant">Estado actual</span>
                    <span className="rounded bg-black px-2 py-0.5 text-[10px] font-bold text-white">
                      {selectedMedico.isActive ? "ACTIVO" : "INACTIVO"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col-reverse justify-end gap-2 px-5 py-5 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setConfirmStatusChange(false)}
                    className="inline-flex h-9 items-center justify-center rounded border border-outline bg-surface-container-high px-4 text-xs font-medium text-on-surface hover:bg-surface-container-highest"
                  >
                    Cancelar
                  </button>
                  {!selectedMedico.isActive && (
                    <form action={reactivarMedico}>
                      <input type="hidden" name="id" value={selectedMedico.id} />
                      <button
                        type="submit"
                        className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded bg-black px-4 text-xs font-semibold text-white hover:bg-on-surface"
                      >
                        <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
                          person_check
                        </span>
                        Reactivar
                      </button>
                    </form>
                  )}
                </div>
                {selectedMedico.isActive && (
                  <div id="dar-de-baja-medico" className="px-5 pb-5">
                    <DarDeBajaMedico medicoId={selectedMedico.id} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DarDeBajaMedico({ medicoId }: { medicoId: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    { ok: boolean; error?: string },
    FormData
  >((_state, formData) => darDeBajaMedico(formData), { ok: true });

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [router, state.ok]);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (
          !window.confirm(
            "¿Querés dar de baja a este médico? Dejará de recibir turnos y no podrá acceder al sistema.",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={medicoId} />
      {state.error && (
        <p className="mb-2 text-sm font-medium text-error" role="alert">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded border border-error px-4 text-sm font-semibold text-error transition-colors hover:bg-error-container disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Procesando…" : "Dar de baja"}
      </button>
    </form>
  );
}
