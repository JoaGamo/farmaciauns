import Link from "next/link";
import { ListadoPersonalAdministrativo } from "@/components/listado-personal-administrativo";
import { toUsuarioPublico } from "@/lib/domain/usuario";
import { getUserRepository } from "@/lib/repository";
import { requireRole } from "@/lib/authorization";

export const dynamic = "force-dynamic";

/**
 * US-13 (RF-25) — Listado de personal administrativo (exclusivo ADMINISTRADOR).
 * Ordenado alfabéticamente por apellido (lo garantiza `listByRole`).
 */
export default async function ListadoPersonalAdministrativoPage() {
  await requireRole(["admin"]);

  const personal = (await getUserRepository().listByRole("ADMINISTRATIVO")).map(
    (usuario) => ({
      ...toUsuarioPublico(usuario),
      createdAt: usuario.createdAt.toLocaleDateString("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
      }),
      updatedAt: usuario.updatedAt.toLocaleString("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
      }),
    }),
  );

  return (
    <div className="mx-auto flex max-w-6xl flex-col">
        {personal.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl bg-surface-container-low p-12 text-center">
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
                <circle cx="9" cy="8" r="4" />
                <path d="M3 21v-2a6 6 0 0 1 12 0v2" />
                <path d="M16 4h6M19 1v6" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-on-surface">
              No hay personal administrativo registrado
            </h2>
            <p className="mt-2 max-w-md text-sm text-on-surface-variant">
              Utilizá el botón “Nuevo administrativo” para registrar al primer
              integrante del equipo.
            </p>
            <Link
              href="/admin/personal/nuevo"
              className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded bg-surface-container-lowest px-5 text-sm font-semibold text-on-surface shadow-sm transition-colors hover:bg-surface-container-high"
            >
              + Registrar personal administrativo
            </Link>
          </div>
        ) : (
          <ListadoPersonalAdministrativo usuarios={personal} />
        )}
    </div>
  );
}
