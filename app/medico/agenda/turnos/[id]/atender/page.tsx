import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, ClipboardList, Lock, User } from "lucide-react";
import { requireMedico } from "@/lib/authorization";
import { formatearHora, hoyEnArgentina } from "@/lib/domain/agenda";
import { MSG_TURNO_NO_CERRABLE, etiquetaEstado, formatearFecha, puedeCerrarse } from "@/lib/domain/turno";
import {
  historiaClinicaDePaciente,
  obtenerTurnoParaAtender,
} from "@/lib/historia-clinica-service";
import { AtencionForm } from "./atencion-form";

export const dynamic = "force-dynamic";

/**
 * US-40 (RF-06a) — "Atención de paciente": datos del paciente y del turno, la
 * historia clínica previa de solo lectura (registros de cualquier médico, del
 * más reciente al más antiguo, CA3) y el formulario de diagnóstico y
 * tratamiento. Solo para turnos reservados del médico, de hoy o de días
 * anteriores (CA4).
 */
export default async function AtenderTurnoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const medico = await requireMedico();
  const { id } = await params;

  const turno = await obtenerTurnoParaAtender(medico.id, id);
  if (!turno) {
    notFound();
  }

  const hoy = hoyEnArgentina(new Date());
  const historia = await historiaClinicaDePaciente(turno.paciente.id);
  const sePuedeAtender = puedeCerrarse(turno, hoy);
  const hrefAgenda = `/medico/agenda?mes=${turno.fecha.slice(0, 7)}&dia=${turno.fecha}`;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <nav
            aria-label="Ruta de navegación"
            className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-on-surface-variant"
          >
            <span>Portal médico</span>
            <span className="text-outline">/</span>
            <Link href={hrefAgenda} className="hover:text-on-surface">
              Mi agenda
            </Link>
            <span className="text-outline">/</span>
            <span className="text-on-surface">Atención de paciente</span>
          </nav>
          <h1 className="text-2xl font-bold tracking-tight">Atención de paciente</h1>
          <p className="mt-1 max-w-2xl text-on-surface-variant">
            Registrá el diagnóstico y el tratamiento de la consulta. Podés consultar
            los antecedentes clínicos previos del paciente.
          </p>
        </div>
        <Link
          href={hrefAgenda}
          className="inline-flex h-10 items-center gap-2 rounded border border-outline-variant bg-surface-container-lowest px-4 text-sm font-semibold text-on-surface hover:bg-surface-container"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver a Mi agenda
        </Link>
      </div>

      <div className="grid grid-cols-1 overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm md:grid-cols-2">
        <section aria-labelledby="titulo-paciente" className="flex flex-col gap-4 p-5 md:border-r md:border-surface-container-high">
          <h2 id="titulo-paciente" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            <User className="h-4 w-4" aria-hidden="true" />
            Datos del paciente
          </h2>
          <dl className="grid grid-cols-2 gap-4">
            <Dato etiqueta="Paciente" valor={turno.paciente.nombreCompleto} />
            <Dato etiqueta="DNI" valor={turno.paciente.dni ?? "—"} mono />
            <Dato etiqueta="Cobertura" valor={turno.paciente.cobertura ?? "Sin registrar"} />
            <Dato etiqueta="N° de afiliado" valor={turno.paciente.numeroAfiliado ?? "—"} mono />
          </dl>
        </section>
        <section aria-labelledby="titulo-turno" className="flex flex-col gap-4 border-t border-surface-container-high p-5 md:border-t-0">
          <div className="flex items-center justify-between gap-2">
            <h2 id="titulo-turno" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              <CalendarClock className="h-4 w-4" aria-hidden="true" />
              Datos del turno actual
            </h2>
            <span className="rounded bg-surface-container px-2 py-0.5 text-xs font-semibold">
              {etiquetaEstado(turno.estado)}
            </span>
          </div>
          <dl className="grid grid-cols-2 gap-4">
            <Dato
              etiqueta="Fecha y horario"
              valor={`${formatearFecha(turno.fecha)} · ${formatearHora(turno.inicioMin)} – ${formatearHora(turno.finMin)}`}
            />
            <Dato etiqueta="Médico tratante" valor={turno.medico} />
            <Dato etiqueta="Especialidad" valor={turno.especialidad ?? "—"} />
          </dl>
        </section>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <section aria-labelledby="titulo-historia" className="flex flex-col gap-4 rounded-xl bg-surface-container-lowest p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="titulo-historia" className="flex items-center gap-2 text-lg font-semibold">
              <ClipboardList className="h-5 w-5" aria-hidden="true" />
              Historia clínica previa
            </h2>
            <span className="rounded bg-surface-container px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
              Solo lectura
            </span>
          </div>
          {historia.length === 0 ? (
            <p className="rounded-lg bg-surface-container-low px-4 py-6 text-center text-sm text-on-surface-variant">
              El paciente todavía no tiene registros en su historia clínica.
            </p>
          ) : (
            <ol className="flex flex-col gap-3">
              {historia.map((r) => (
                <li key={r.id} className="flex flex-col gap-3 rounded-lg border border-surface-container-high p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold tabular-nums">
                        {formatearFecha(r.fecha)} · {formatearHora(r.inicioMin)} hs
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        {r.medico}
                        {r.especialidad ? ` · ${r.especialidad}` : ""}
                      </p>
                    </div>
                    <span className="rounded bg-surface-container px-2 py-0.5 text-[10px] font-semibold">Atendido</span>
                  </div>
                  <Texto titulo="Diagnóstico" texto={r.diagnostico} />
                  <Texto titulo="Tratamiento" texto={r.tratamiento} />
                </li>
              ))}
            </ol>
          )}
          <p className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-outline-variant px-4 py-3 text-center text-xs text-on-surface-variant">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            Los registros de la historia clínica no se pueden modificar ni borrar.
          </p>
        </section>

        <section aria-labelledby="titulo-atencion" className="flex flex-col gap-4 rounded-xl bg-surface-container-lowest p-5 shadow-sm">
          <div>
            <h2 id="titulo-atencion" className="text-lg font-semibold">
              Registrar atención
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Completá los campos obligatorios para registrar la consulta y finalizar el turno.
            </p>
          </div>
          {sePuedeAtender ? (
            <AtencionForm turnoId={turno.id} fecha={turno.fecha} hrefAgenda={hrefAgenda} />
          ) : (
            <p role="status" className="rounded-lg bg-surface-container-low px-4 py-6 text-center text-sm font-medium text-on-surface-variant">
              {turno.estado === "ATENDIDO"
                ? "Este turno ya fue atendido. Su registro está en la historia clínica."
                : turno.estado === "AUSENTE"
                  ? "Este turno se registró como ausente."
                  : MSG_TURNO_NO_CERRABLE}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function Dato({ etiqueta, valor, mono }: { etiqueta: string; valor: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">{etiqueta}</dt>
      <dd className={`font-semibold ${mono ? "font-mono text-sm" : ""}`}>{valor}</dd>
    </div>
  );
}

function Texto({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">{titulo}</h3>
      <p className="whitespace-pre-line rounded bg-surface-container-low px-3 py-2 text-sm">{texto}</p>
    </div>
  );
}
