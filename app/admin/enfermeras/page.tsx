import { getPrisma } from "../../../lib/prisma";
import { requireRole } from "@/lib/authorization";
import { EnfermerasClient, type EnfermeraItem } from "./enfermeras-client";

export const dynamic = "force-dynamic";

export default async function EnfermerasPage() {
  await requireRole(["admin"]);
  const prisma = getPrisma();

  const enfermerasDb = await prisma.user.findMany({
    where: { role: "ENFERMERA" },
    orderBy: { lastName: "asc" },
  });

  const enfermeras: EnfermeraItem[] = enfermerasDb.map((e) => ({
    id: e.id,
    firstName: e.firstName,
    lastName: e.lastName,
    dni: e.dni,
    email: e.email,
    phone: e.phone,
    isActive: e.isActive,
    createdAt: e.createdAt.toLocaleDateString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
    }),
    updatedAt: e.updatedAt.toLocaleString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
    }),
  }));

  // El orden de la base depende de su collation (los acentos pueden quedar al final)
  enfermeras.sort((a, b) =>
    (a.lastName ?? "").localeCompare(b.lastName ?? "", "es", { sensitivity: "base" }) ||
    (a.firstName ?? "").localeCompare(b.firstName ?? "", "es", { sensitivity: "base" }),
  );

  return (
    <EnfermerasClient enfermeras={enfermeras} />
  );
}
