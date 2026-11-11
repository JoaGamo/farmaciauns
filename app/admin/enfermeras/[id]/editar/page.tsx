import Link from "next/link";
import { notFound } from "next/navigation";
import { EditarStaffForm } from "@/components/editar-staff-form";
import { FormBaseLayout } from "@/components/form-base-layout";
import { requireRole } from "@/lib/authorization";
import { getPrisma } from "@/lib/prisma";
import { actualizarEnfermera } from "@/app/admin/staff-actions";

export const dynamic = "force-dynamic";

export default async function EditarEnfermeraPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["admin"]);
  const { id } = await params;
  const staff = await getPrisma().user.findUnique({ where: { id } });
  if (!staff || staff.role !== "ENFERMERA") notFound();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <nav
        aria-label="Ruta de navegación"
        className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-on-surface-variant"
      >
        <Link href="/admin/enfermeras" className="hover:text-on-surface">
          Equipo de enfermería
        </Link>
        <span aria-hidden="true">›</span>
        <span className="text-on-surface">Modificar enfermera</span>
      </nav>
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Modificar enfermera</h1>
        <p className="mt-1 text-on-surface-variant">
          Actualizá los datos de contacto de la profesional registrada.
        </p>
      </header>
      <FormBaseLayout>
        <EditarStaffForm
          staff={{
            id: staff.id,
            firstName: staff.firstName ?? "",
            lastName: staff.lastName ?? "",
            dni: staff.dni ?? "",
            email: staff.email,
            phone: staff.phone ?? "",
          }}
          action={actualizarEnfermera}
          cancelarHref="/admin/enfermeras"
          mostrarAsignacionOperativa
        />
      </FormBaseLayout>
    </div>
  );
}
