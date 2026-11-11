import Link from "next/link";
import { ListadoUsuarios } from "@/components/listado-usuarios";
import { toUsuarioPublico } from "@/lib/domain/usuario";
import { getUserRepository } from "@/lib/repository";
import { requireRole } from "@/lib/authorization";
import { coberturasDePacientes } from "@/lib/cobertura-service";
import { NuevaBusqueda } from "./nueva-busqueda";
import { reactivarPaciente } from "@/app/actions";

/**
 * US-12 (RF-24) — Búsqueda de pacientes (ADMINISTRADOR y MÉDICO).
 *
 * La búsqueda se hace con un `<form method="GET">` (progressive enhancement):
 * navega a `/pacientes?q=...` y el server component filtra. No requiere JS.
 * Pacientes y personal administrativo quedan bloqueados (acceso denegado).
 */
export default async function PacientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; reactivado?: string }>;
}) {
  const role = await requireRole(["admin", "medico"]);

  const { q, reactivado } = await searchParams;
  const query = (q ?? "").trim();

  const repo = getUserRepository();
  const pacientes = (
    await (query
      ? repo.searchByNameOrDni(query)
      : repo.listByRole("PACIENTE"))
  ).map(toUsuarioPublico);

  // Adjunta la cobertura (US-21) para mostrarla en el detalle. Requiere DB.
  let pacientesConCobertura = pacientes;
  if (process.env.DATABASE_URL?.trim()) {
    const coberturas = await coberturasDePacientes(pacientes.map((p) => p.id));
    pacientesConCobertura = pacientes.map((p) => ({
      ...p,
      ...(coberturas[p.id] ?? {}),
    }));
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col">
        <div className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
          <Link
            href="/inicio"
            className="text-on-surface-variant transition-colors hover:text-on-surface"
          >
            Inicio
          </Link>
          <span className="text-outline">/</span>
          <span>Módulo de pacientes</span>
          <span className="text-outline">/</span>
          <span className="text-on-surface">Búsqueda de pacientes</span>
        </div>

        <div className="mb-6 flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">
            Búsqueda de pacientes
          </h1>
          <p className="mt-1 text-on-surface-variant">
            Consulta y verificación de fichas de pacientes en el padrón
            centralizado.
          </p>
        </div>

        {/* Filtro de búsqueda (GET form, sin JS) */}
        <form
          method="GET"
          action="/pacientes"
          className="mb-6 flex flex-col gap-3 rounded-xl bg-surface-container-lowest p-4 shadow-sm lg:flex-row lg:items-end"
        >
          <div className="flex flex-1 flex-col gap-1.5">
            <label
              htmlFor="paciente-search"
              className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant"
            >
              Buscar por nombre o DNI
            </label>
            <input
              id="paciente-search"
              name="q"
              type="text"
              defaultValue={query}
              placeholder="Ej. María Gómez o 32.456.789"
              className="h-10 w-full rounded bg-surface px-3 text-sm text-on-surface placeholder:text-outline focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center gap-2 rounded bg-primary px-5 text-sm font-semibold text-on-primary transition-colors hover:bg-secondary"
            >
              Buscar
            </button>
            <Link
              href="/pacientes"
              className="inline-flex h-10 items-center justify-center gap-2 rounded bg-surface-container-low px-4 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
            >
              Limpiar
            </Link>
          </div>
        </form>

        {pacientes.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl bg-surface-container-lowest p-12 text-center shadow-sm">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded bg-surface-container-high text-on-surface-variant">
              <svg
                className="h-7 w-7"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-on-surface">
              No se encontraron pacientes
            </h2>
            <p className="mt-2 max-w-md text-sm text-on-surface-variant">
              Probá con otro nombre o DNI, o limpiá la búsqueda para ver todos
              los pacientes.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/pacientes"
                className="inline-flex h-10 items-center justify-center gap-2 rounded bg-primary px-5 text-sm font-semibold text-on-primary transition-colors hover:bg-secondary"
              >
                Limpiar búsqueda
              </Link>
              <NuevaBusqueda />
            </div>
          </div>
        ) : (
          <ListadoUsuarios
            key={reactivado ?? query}
            usuarios={pacientesConCobertura}
            puedeEliminar={role === "admin"}
            accionReactivar={reactivarPaciente}
            selectedUserId={role === "admin" ? reactivado : undefined}
          />
        )}
    </div>
  );
}
