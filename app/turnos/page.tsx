import Link from "next/link";
import { CalendarPlus, Check, Info, Stethoscope, Syringe, UserX } from "lucide-react";
import { requirePaciente } from "@/lib/authorization";
import { obtenerCoberturaDePaciente } from "@/lib/cobertura-service";
import { diaSemanaDe, etiquetaDia, formatearHora } from "@/lib/domain/agenda";
import {
  MSG_SIN_TURNOS_RESERVADOS,
  clasificarTurnos,
  etiquetaEstado,
  etiquetaTipo,
  formatearFecha,
  motivoNoCancelable,
  type EstadoTurno,
} from "@/lib/domain/turno";
import { listarTurnosDePaciente, type TurnoDePaciente } from "@/lib/turno-service";
import { CancelarTurno } from "./cancelar-turno";

export const dynamic = "force-dynamic";

/**
 * US-30 (RF-02) — "Mis turnos": próximos turnos reservados y anteriores con su
 * estado final, de consulta y de vacunación. Desde cada consulta futura se
 * puede cancelar (US-31).
 */
export default async function MisTurnosPage({
  searchParams,
}: {
  searchParams: Promise<{ cancelado?: string }>;
}) {
  const paciente = await requirePaciente();
  const { cancelado } = await searchParams;
  const ahora = new Date();

  const [turnos, cobertura] = await Promise.all([
    listarTurnosDePaciente(paciente.id),
    obtenerCoberturaDePaciente(paciente.id),
  ]);
  const { proximos, anteriores } = clasificarTurnos(turnos, ahora);
  const nombre = `${paciente.firstName ?? ""} ${paciente.lastName ?? ""}`.trim();
  const nombreCobertura = cobertura.nombre ?? (cobertura.esParticular ? "Particular" : "sin registrar");

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            <span>Gestión ambulatoria</span>
            <span className="text-outline">/</span>
            <span className="text-on-surface">Agenda</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Mis turnos</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Paciente: <b className="text-on-surface">{nombre}</b>
            {paciente.dni ? ` · DNI ${paciente.dni}` : ""} · Cobertura: {nombreCobertura}
          </p>
        </div>
        <Link
          href="/turnos/reservar"
          className="inline-flex h-10 items-center gap-2 rounded bg-primary px-4 text-sm font-semibold text-on-primary transition-colors hover:bg-secondary"
        >
          <CalendarPlus className="h-4 w-4" aria-hidden="true" />
          Reservar turno
        </Link>
      </header>

      {cancelado === "1" && (
        <div
          role="status"
          className="rounded-lg bg-primary-fixed px-4 py-3 text-sm font-medium text-on-primary-fixed"
        >
          Tu turno fue cancelado. El horario quedó disponible para otros pacientes.
        </div>
      )}

      <section aria-labelledby="titulo-proximos" className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <h2 id="titulo-proximos" className="text-lg font-semibold">
            Próximos
          </h2>
          <span className="rounded bg-surface-container px-2 py-0.5 text-xs font-semibold">
            {proximos.length} programado{proximos.length === 1 ? "" : "s"}
          </span>
        </div>

        {proximos.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest p-10 text-center">
            {/* Texto y botón exactos del CA2 de US-30. */}
            <p className="text-lg font-semibold">{MSG_SIN_TURNOS_RESERVADOS}</p>
            <Link
              href="/turnos/reservar"
              className="inline-flex h-10 items-center gap-2 rounded bg-primary px-5 text-sm font-semibold text-on-primary hover:bg-secondary"
            >
              <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              Reservar turno
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl bg-surface-container-lowest shadow-sm">
            <table className="w-full min-w-184 border-collapse text-left text-sm">
              <thead>
                <tr className="bg-surface-container-low text-xs uppercase tracking-wider text-on-surface-variant">
                  <th scope="col" className="px-4 py-3">Fecha</th>
                  <th scope="col" className="px-4 py-3">Hora</th>
                  <th scope="col" className="px-4 py-3">Tipo</th>
                  <th scope="col" className="px-4 py-3">Médico o vacuna</th>
                  <th scope="col" className="px-4 py-3">Estado</th>
                  <th scope="col" className="px-4 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {proximos.map((t) => (
                  <tr key={t.id} className="border-t border-surface-container-high">
                    <td className="px-4 py-3">
                      <p className="font-semibold tabular-nums">{formatearFecha(t.fecha)}</p>
                      <p className="text-xs text-on-surface-variant">{etiquetaDia(diaSemanaDe(t.fecha))}</p>
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold tabular-nums">{formatearHora(t.inicioMin)}</td>
                    <td className="px-4 py-3"><Tipo turno={t} /></td>
                    <td className="px-4 py-3"><Profesional turno={t} /></td>
                    <td className="px-4 py-3"><Estado estado={t.estado} /></td>
                    <td className="px-4 py-3 text-right"><AccionCancelar turno={t} ahora={ahora} paciente={nombre} dni={paciente.dni} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="titulo-anteriores" className="flex flex-col gap-3">
        <h2 id="titulo-anteriores" className="text-lg font-semibold">
          Anteriores
        </h2>
        {anteriores.length === 0 ? (
          <p className="rounded-xl bg-surface-container-lowest p-6 text-sm text-on-surface-variant shadow-sm">
            Todavía no tenés turnos anteriores.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl bg-surface-container-lowest shadow-sm">
            <table className="w-full min-w-160 border-collapse text-left text-sm">
              <thead>
                <tr className="bg-surface-container-low text-xs uppercase tracking-wider text-on-surface-variant">
                  <th scope="col" className="px-4 py-3">Fecha</th>
                  <th scope="col" className="px-4 py-3">Tipo</th>
                  <th scope="col" className="px-4 py-3">Médico o vacuna</th>
                  <th scope="col" className="px-4 py-3 text-right">Estado</th>
                </tr>
              </thead>
              <tbody>
                {anteriores.map((t) => {
                  const cancelado = t.estado === "CANCELADO";
                  return (
                    <tr key={t.id} className={`border-t border-surface-container-high ${cancelado ? "text-on-surface-variant" : ""}`}>
                      <td className="px-4 py-3">
                        <p className={`font-semibold tabular-nums ${cancelado ? "line-through" : ""}`}>
                          {formatearFecha(t.fecha)}
                        </p>
                        <p className="text-xs text-on-surface-variant">{formatearHora(t.inicioMin)} hs</p>
                      </td>
                      <td className="px-4 py-3"><Tipo turno={t} /></td>
                      <td className="px-4 py-3"><Profesional turno={t} /></td>
                      <td className="px-4 py-3 text-right"><Estado estado={t.estado} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Tipo({ turno }: { turno: TurnoDePaciente }) {
  const Icono = turno.tipo === "VACUNACION" ? Syringe : Stethoscope;
  return (
    <span className="inline-flex items-center gap-2">
      <Icono className="h-4 w-4 text-on-surface-variant" aria-hidden="true" />
      {etiquetaTipo(turno.tipo)}
    </span>
  );
}

function Profesional({ turno }: { turno: TurnoDePaciente }) {
  if (turno.tipo === "VACUNACION") {
    return <p className="font-medium">{turno.vacuna ?? "Vacuna"}</p>;
  }
  return (
    <>
      <p className="font-medium">{turno.medico ?? "—"}</p>
      <p className="text-xs text-on-surface-variant">{turno.especialidad ?? ""}</p>
    </>
  );
}

const ICONO_ESTADO: Record<EstadoTurno, typeof Check | null> = {
  RESERVADO: null,
  ATENDIDO: Check,
  AUSENTE: UserX,
  CANCELADO: null,
};

function Estado({ estado }: { estado: EstadoTurno }) {
  const Icono = ICONO_ESTADO[estado];
  const estilo =
    estado === "RESERVADO"
      ? "bg-primary text-on-primary"
      : estado === "CANCELADO"
        ? "bg-surface-container text-on-surface-variant line-through"
        : "bg-surface-container-high text-on-surface";
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold ${estilo}`}>
      {Icono && <Icono className="h-3.5 w-3.5" aria-hidden="true" />}
      {etiquetaEstado(estado)}
    </span>
  );
}

/** US-31: "Cancelar" solo en consultas, y deshabilitado a menos de 24 horas (CA3). */
function AccionCancelar({
  turno,
  ahora,
  paciente,
  dni,
}: {
  turno: TurnoDePaciente;
  ahora: Date;
  paciente: string;
  dni: string | null;
}) {
  if (turno.tipo !== "CONSULTA") {
    return <span className="text-on-surface-variant">—</span>;
  }
  const motivo = motivoNoCancelable(turno, ahora);
  if (motivo) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          disabled
          className="rounded border border-outline-variant px-3 py-1.5 text-xs font-semibold text-on-surface-variant opacity-60"
        >
          Cancelar
        </button>
        <span className="flex items-center gap-1 text-[11px] text-on-surface-variant">
          <Info className="h-3 w-3" aria-hidden="true" />
          {motivo}
        </span>
      </div>
    );
  }
  const dia = etiquetaDia(diaSemanaDe(turno.fecha)).toLowerCase();
  const hora = formatearHora(turno.inicioMin);
  return (
    <CancelarTurno
      turnoId={turno.id}
      pregunta={`¿Cancelar tu turno del ${dia} ${formatearFecha(turno.fecha).slice(0, 5)} a las ${hora} con ${turno.medico ?? "el médico"}?`}
      detalle={[
        { etiqueta: "Especialidad", valor: turno.especialidad ?? "—" },
        { etiqueta: "Profesional", valor: turno.medico ?? "—" },
        { etiqueta: "Fecha y hora", valor: `${formatearFecha(turno.fecha)} · ${hora} hs` },
        { etiqueta: "Paciente", valor: dni ? `${paciente} (DNI ${dni})` : paciente },
      ]}
    />
  );
}
