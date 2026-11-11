import { UserButton } from "@clerk/nextjs";
import { SignOutButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import type { ReactNode } from "react";
import { SidebarNav } from "./sidebar-nav";
import { getCurrentDbUser } from "@/lib/auth";
import { etiquetaRol } from "@/lib/domain/usuario";

/** Etiqueta del panel lateral según el rol (misma fuente que las wireframes). */
function sidebarLabel(role: string | null | undefined): string {
  switch (role) {
    case "MEDICO":
      return "Rol Médico";
    case "ENFERMERA":
      return "Enfermería";
    case "PACIENTE":
      return "Portal Paciente";
    default:
      return "Gestión Clínica";
  }
}

/**
 * Shell ÚNICO de la aplicación para todas las páginas autenticadas (inicio,
 * admin, pacientes, coberturas, cobertura y stock). Garantiza que el logo, el
 * encabezado y el panel izquierdo se vean SIEMPRE iguales al navegar entre
 * sectores, sin importar el rol.
 *
 *  - Encabezado superior fijo: logo + "Sala Médica" a la izquierda; nombre,
 *    rol, `UserButton` y "Cerrar sesión" a la derecha.
 *  - Panel izquierdo: etiqueta del rol + navegación por rol + footer.
 *  - Contenido: `children`.
 */
export async function AppShell({ children }: { children: ReactNode }) {
  const user = await currentUser();
  const dbUser = await getCurrentDbUser();
  const role = dbUser?.role ?? null;
  const roleLabel = role ? etiquetaRol(role) : null;
  const displayName =
    user?.firstName ?? user?.username ?? user?.emailAddresses[0]?.emailAddress;

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <header className="fixed inset-x-0 top-0 z-40 flex h-12 items-center justify-between border-b border-surface-container-high bg-surface-container-lowest px-5">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-black text-white">
            <span className="material-symbols-outlined text-[17px]">
              local_hospital
            </span>
          </span>
          <span className="text-xs font-bold uppercase tracking-tight">
            Sala Médica
          </span>
        </div>
        <div className="flex items-center gap-3">
          {displayName && (
            <div className="hidden text-right sm:block">
              <p className="text-xs font-semibold text-on-surface">
                {displayName}
              </p>
              {roleLabel && (
                <span className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
                  {roleLabel}
                </span>
              )}
            </div>
          )}
          <UserButton />
          <span className="h-6 w-px bg-outline-variant" aria-hidden="true" />
          <SignOutButton redirectUrl="/sign-in">
            <button
              type="button"
              className="whitespace-nowrap rounded border border-outline-variant px-3 py-1 text-[11px] font-semibold text-on-surface transition-colors hover:bg-surface-container"
            >
              Cerrar sesión
            </button>
          </SignOutButton>
        </div>
      </header>

      <div className="flex min-h-screen pt-12">
        <aside className="sticky top-12 flex h-[calc(100vh-3rem)] w-52 shrink-0 self-start flex-col justify-between overflow-y-auto border-r border-surface-container-high bg-surface-container-lowest px-2 py-3">
          <div>
            <h2 className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-secondary">
              {sidebarLabel(role)}
            </h2>
            <SidebarNav role={role} />
          </div>
          <p className="border-t border-surface-container-high px-2 pt-3 text-[10px] text-secondary">
            Sistema Sala Médica v1.0
          </p>
        </aside>

        <main className="min-w-0 flex-1 p-5 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
