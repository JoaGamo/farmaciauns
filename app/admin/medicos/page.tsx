import { getPrisma } from "../../../lib/prisma";
import { MedicosClient, type MedicoItem } from "./medicos-client";

export const dynamic = "force-dynamic";

export default async function MedicosPage({
  searchParams,
}: {
  searchParams: Promise<{ seleccionado?: string }>;
}) {
  const { seleccionado } = await searchParams;
  const prisma = getPrisma();

  const medicosDb = await prisma.user.findMany({
    where: { role: "MEDICO" },
    orderBy: { lastName: "asc" },
  });

  const medicos: MedicoItem[] = medicosDb.map((m) => ({
    id: m.id,
    firstName: m.firstName,
    lastName: m.lastName,
    dni: m.dni,
    email: m.email,
    phone: m.phone,
    matricula: m.matricula,
    especialidad: m.especialidad,
    isActive: m.isActive,
  }));

  // El orden de la base depende de su collation (los acentos pueden quedar al final)
  medicos.sort((a, b) =>
    (a.lastName ?? "").localeCompare(b.lastName ?? "", "es", { sensitivity: "base" }) ||
    (a.firstName ?? "").localeCompare(b.firstName ?? "", "es", { sensitivity: "base" }),
  );

  return (
    <MedicosClient
      initialMedicos={medicos}
      selectedDoctorId={seleccionado}
    />
  );
}
