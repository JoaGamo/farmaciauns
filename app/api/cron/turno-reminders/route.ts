import { aFechaDb, aFechaISO } from "@/lib/fecha-db";
import { estaEnVentanaRecordatorio } from "@/lib/domain/recordatorio";
import { instanteDeTurno, momentoEnArgentina } from "@/lib/domain/turno";
import { sendAppointmentReminderEmail } from "@/lib/email";
import { getPrisma } from "@/lib/prisma";

const MINUTOS_PARA_REINTENTAR = 10;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    console.error("CRON_SECRET is not configured; appointment reminders cannot run.");
    return Response.json({ error: "Cron is not configured." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const prisma = getPrisma();
  const ahora = new Date();
  const limite = new Date(ahora.getTime() + 24 * 60 * 60 * 1000);
  const fechaDesde = momentoEnArgentina(ahora).fecha;
  const fechaHasta = momentoEnArgentina(limite).fecha;
  const reintentarDesde = new Date(ahora.getTime() - MINUTOS_PARA_REINTENTAR * 60_000);
  const turnos = await prisma.turno.findMany({
    where: {
      estado: "RESERVADO",
      recordatorioEnviadoAt: null,
      OR: [
        { recordatorioProcesandoAt: null },
        { recordatorioProcesandoAt: { lt: reintentarDesde } },
      ],
      fecha: { gte: aFechaDb(fechaDesde), lte: aFechaDb(fechaHasta) },
    },
    orderBy: [{ fecha: "asc" }, { inicioMin: "asc" }],
    select: {
      id: true,
      tipo: true,
      fecha: true,
      inicioMin: true,
      estado: true,
      paciente: { select: { email: true, firstName: true, lastName: true } },
    },
  });

  let enviados = 0;
  let fallidos = 0;
  for (const turno of turnos) {
    const fecha = aFechaISO(turno.fecha);
    if (
      !turno.paciente.email ||
      !estaEnVentanaRecordatorio(
        { fecha, inicioMin: turno.inicioMin, estado: turno.estado },
        ahora,
      )
    ) {
      continue;
    }

    const reclamo = await prisma.turno.updateMany({
      where: {
        id: turno.id,
        estado: "RESERVADO",
        recordatorioEnviadoAt: null,
        OR: [
          { recordatorioProcesandoAt: null },
          { recordatorioProcesandoAt: { lt: reintentarDesde } },
        ],
      },
      data: { recordatorioProcesandoAt: ahora },
    });
    if (reclamo.count === 0) {
      continue;
    }

    try {
      await sendAppointmentReminderEmail({
        email: turno.paciente.email,
        nombre: `${turno.paciente.firstName ?? ""} ${turno.paciente.lastName ?? ""}`.trim(),
        fechaHora: instanteDeTurno(fecha, turno.inicioMin),
        tipo: turno.tipo,
      });
    } catch (error) {
      await prisma.turno.updateMany({
        where: { id: turno.id, recordatorioEnviadoAt: null },
        data: { recordatorioProcesandoAt: null },
      });
      console.error(`Failed to send appointment reminder for turn ${turno.id}.`, error);
      fallidos += 1;
      continue;
    }

    await prisma.turno.update({
      where: { id: turno.id },
      data: { recordatorioEnviadoAt: new Date(), recordatorioProcesandoAt: null },
    });
    enviados += 1;
  }

  return Response.json(
    { enviados, fallidos },
    { status: fallidos > 0 ? 500 : 200 },
  );
}
