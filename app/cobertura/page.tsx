import { getCurrentDbUser } from "@/lib/auth";
import { requireRole } from "@/lib/authorization";
import {
  listarCoberturasDisponibles,
  obtenerCoberturaDePaciente,
} from "@/lib/cobertura-service";
import { MisDatosForm } from "./mis-datos-form";

export const dynamic = "force-dynamic";

function formatearDni(value: string | null): string {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length === 8) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  }
  if (digits.length === 7) {
    return `${digits.slice(0, 1)}.${digits.slice(1, 4)}.${digits.slice(4)}`;
  }
  return value ?? "—";
}

export default async function MisDatosPage() {
  await requireRole(["paciente"]);
  const paciente = await getCurrentDbUser();
  if (!paciente || paciente.role !== "PACIENTE") {
    throw new Error("No se encontró la cuenta del paciente.");
  }

  const [cobertura, coberturasDisponibles] = await Promise.all([
    obtenerCoberturaDePaciente(paciente.id),
    listarCoberturasDisponibles(),
  ]);
  const coberturas = [...coberturasDisponibles];
  if (
    cobertura.coberturaId &&
    cobertura.nombre &&
    !coberturas.some((item) => item.id === cobertura.coberturaId)
  ) {
    coberturas.push({
      id: cobertura.coberturaId,
      nombre: cobertura.nombre,
    });
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col">
      <nav
        aria-label="Ruta de navegación"
        className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant"
      >
        <span>Portal paciente</span>
        <span aria-hidden="true" className="text-outline">›</span>
        <span className="text-on-surface">Mi perfil</span>
      </nav>

      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mis datos</h1>
          <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">
            Consultá tu información personal registrada y administrá tus datos
            de contacto y cobertura médica.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded bg-primary-fixed px-3 py-2 font-mono text-[10px] font-semibold uppercase text-on-surface-variant">
          <span>DNI {formatearDni(paciente.dni)}</span>
          <span aria-hidden="true">•</span>
          <span>Cobertura {cobertura.nombre ?? "Particular"}</span>
        </div>
      </header>

      <MisDatosForm
        paciente={{
          firstName: paciente.firstName ?? "",
          lastName: paciente.lastName ?? "",
          dni: paciente.dni ?? "",
          birthDate: paciente.birthDate?.toISOString() ?? null,
          email: paciente.email,
          phone: paciente.phone ?? "",
          coberturaId: cobertura.coberturaId ?? "",
          numeroAfiliado: cobertura.numeroAfiliado ?? "",
        }}
        coberturas={coberturas}
      />
    </div>
  );
}
