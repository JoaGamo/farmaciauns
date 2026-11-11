import Link from "next/link";
import { ClipboardPen, ShieldCheck } from "lucide-react";
import {
  etiquetaFechaLarga,
  formatearHora,
  generarTurnos,
  type FechaISO,
} from "@/lib/domain/agenda";
import { esFuturo, etiquetaEstado, puedeCerrarse, type EstadoTurno } from "@/lib/domain/turno";
import type { FranjaGuardada } from "@/lib/agenda-repository";
import type { TurnoDeAgenda } from "@/lib/turno-service";
import { AusenteTurno } from "./ausente-turno";

/** Una fila del día: un horario de las franjas, con o sin turno reservado. */
type Fila = {
  inicioMin: number;
  finMin: number;
  turno: TurnoDeAgenda | null;
};

/**
 * Detalle del día seleccionado en "Mi agenda" (US-27 con los cambios del
 * Sprint 3). Cada horario de las franjas se muestra como Disponible o con su
 * turno: Reservado (paciente, "Atender" y "Ausente"), Atendido o Ausente. Un
 * turno cancelado libera el horario, así que vuelve a verse como Disponible.
 * "Atender" y "Ausente" solo aparecen en turnos de hoy o de días anteriores
 * (US-40 CA4).
 */
export function TurnosDelDia({
  fecha,
  hoy,
  ahora,
  franjas,
  turnos,
  especialidad,
}: {
  fecha: FechaISO;
  hoy: FechaISO;
  ahora: Date;
  franjas: FranjaGuardada[];
  turnos: TurnoDeAgenda[];
  especialidad: string | null;
}) {
  const esHoy = fecha === hoy;
  const pasado = fecha < hoy;

  const filas: Fila[] = franjas.flatMap((f) =>
    generarTurnos(f, f.duracionTurnoMin).turnos.map((t) => ({
      ...t,
      turno: turnos.find((r) => r.inicioMin === t.inicioMin) ?? null,
    })),
  );
  // Un turno reservado siempre se muestra, aunque no coincida con una franja.
  for (const turno of turnos) {
    if (!filas.some((f) => f.turno?.id === turno.id)) {
      filas.push({ inicioMin: turno.inicioMin, finMin: turno.finMin, turno });
    }
  }
  filas.sort((a, b) => a.inicioMin - b.inicioMin);

  const reservados = turnos.filter((t) => t.estado === "RESERVADO").length;
  const descripcionFranjas = franjas
    .map(
      (f) =>
        `${formatearHora(f.inicioMin)} a ${formatearHora(f.finMin)} hs · ${f.duracionTurnoMin} min / turno`,
    )
    .join("  |  ");

  return (
    <section
      id={`dia-${fecha}`}
      aria-labelledby={`titulo-${fecha}`}
      className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-container-high bg-surface-container-low px-5 py-3">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded text-sm font-bold tabular-nums ${
              esHoy ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface"
            }`}
          >
            {fecha.slice(8)}
          </span>
          <div>
            <h3 id={`titulo-${fecha}`} className="flex items-center gap-2 font-semibold">
              {etiquetaFechaLarga(fecha)}
              {esHoy && (
                <span className="rounded bg-surface-container-high px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                  Hoy
                </span>
              )}
              {pasado && (
                <span className="rounded bg-surface-container-high px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
                  Pasado
                </span>
              )}
            </h3>
            {descripcionFranjas && (
              <p className="text-xs font-medium text-on-surface-variant">
                Franja horaria: {descripcionFranjas}
              </p>
            )}
          </div>
        </div>
        <span className="rounded bg-surface-container-lowest px-3 py-1 text-xs font-semibold text-on-surface">
          {filas.length} turno{filas.length === 1 ? "" : "s"} · {reservados} reservado
          {reservados === 1 ? "" : "s"}
        </span>
      </header>

      <ul className="flex flex-col gap-2 p-4">
        {filas.map((fila) => (
          <li
            key={fila.turno?.id ?? fila.inicioMin}
            className={`flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-2.5 ${
              fila.turno ? "border border-outline-variant" : "border border-dashed border-outline-variant"
            }`}
          >
            <div className="flex min-w-0 items-center gap-4">
              {/* US-27: horario de inicio y fin de cada turno. */}
              <span
                className={`shrink-0 rounded px-2 py-1 font-mono text-sm font-semibold tabular-nums ${
                  fila.turno?.estado === "RESERVADO" ? "bg-primary text-on-primary" : ""
                }`}
              >
                {formatearHora(fila.inicioMin)} – {formatearHora(fila.finMin)}
              </span>
              {fila.turno ? (
                <Paciente turno={fila.turno} />
              ) : (
                <span className="text-xs italic text-on-surface-variant">
                  {esFuturo({ fecha, inicioMin: fila.inicioMin }, ahora)
                    ? "Turno disponible para reserva"
                    : "Sin reserva"}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {fila.turno ? (
                <>
                  <EstadoChip estado={fila.turno.estado} />
                  {puedeCerrarse({ estado: fila.turno.estado, fecha }, hoy) && (
                    <>
                      <AusenteTurno
                        turnoId={fila.turno.id}
                        paciente={fila.turno.paciente.nombreCompleto}
                        detalle={`Turno: ${formatearHora(fila.inicioMin)} – ${formatearHora(fila.finMin)} hs${especialidad ? ` · ${especialidad}` : ""}`}
                      />
                      <Link
                        href={`/medico/agenda/turnos/${fila.turno.id}/atender`}
                        className="inline-flex h-8 items-center gap-1.5 rounded bg-primary px-3 text-xs font-semibold text-on-primary transition-colors hover:bg-secondary"
                      >
                        <ClipboardPen className="h-3.5 w-3.5" aria-hidden="true" />
                        Atender
                      </Link>
                    </>
                  )}
                </>
              ) : (
                esFuturo({ fecha, inicioMin: fila.inicioMin }, ahora) && <EstadoChip estado={null} />
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Paciente({ turno }: { turno: TurnoDeAgenda }) {
  const ausente = turno.estado === "AUSENTE";
  return (
    <div className="min-w-0">
      <p className={`truncate text-sm font-semibold ${ausente ? "text-on-surface-variant line-through" : ""}`}>
        {turno.paciente.nombreCompleto}
        {turno.paciente.dni && (
          <span className="ml-2 font-mono text-xs font-normal text-on-surface-variant">
            DNI {turno.paciente.dni}
          </span>
        )}
      </p>
      <p className="flex items-center gap-1 text-xs text-on-surface-variant">
        <ShieldCheck className="h-3 w-3" aria-hidden="true" />
        {turno.paciente.cobertura ?? "Sin cobertura registrada"}
        {ausente && <span className="italic"> · Paciente no asistió</span>}
      </p>
    </div>
  );
}

/** `null` = horario libre ("Disponible"). */
function EstadoChip({ estado }: { estado: EstadoTurno | null }) {
  const texto = estado ? etiquetaEstado(estado) : "Disponible";
  const estilo =
    estado === "RESERVADO"
      ? "border-primary text-on-surface"
      : estado === "ATENDIDO"
        ? "border-transparent bg-surface-container-high text-on-surface"
        : estado === "AUSENTE"
          ? "border-transparent bg-surface-container text-on-surface-variant"
          : "border-outline-variant text-on-surface";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${estilo}`}
    >
      <span aria-hidden="true" className="h-2 w-2 rounded-full border border-current" />
      {texto}
    </span>
  );
}
