import { CalendarDays, ClipboardList, Clock, IdCard, Lock, Pill, ShieldCheck, Stethoscope } from "lucide-react";
import { requirePaciente } from "@/lib/authorization";
import { obtenerCoberturaDePaciente } from "@/lib/cobertura-service";
import { formatearHora } from "@/lib/domain/agenda";
import { MSG_HISTORIA_VACIA, formatearFecha } from "@/lib/domain/turno";
import { historiaClinicaDePaciente } from "@/lib/historia-clinica-service";

export const dynamic = "force-dynamic";

/**
 * US-42 (RF-06b) — "Mi historia clínica": registros del paciente de la sesión,
 * del más reciente al más antiguo, de solo lectura. El paciente sale siempre
 * de la sesión: no hay forma de pedir la historia de otro (CA4).
 */
export default async function MiHistoriaClinicaPage() {
  const paciente = await requirePaciente();
  const [registros, cobertura] = await Promise.all([
    historiaClinicaDePaciente(paciente.id),
    obtenerCoberturaDePaciente(paciente.id),
  ]);
  const nombreCobertura = cobertura.nombre ?? (cobertura.esParticular ? "Particular" : "Sin registrar");

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            <span>Portal paciente</span>
            <span className="text-outline">/</span>
            <span className="text-on-surface">Salud</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Mi historia clínica</h1>
          <p className="mt-1 text-on-surface-variant">
            Consultá los diagnósticos y tratamientos indicados por tus médicos.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded bg-primary-fixed px-3 py-2 font-mono text-xs font-semibold text-on-primary-fixed">
          {paciente.dni && (
            <span className="flex items-center gap-1.5">
              <IdCard className="h-3.5 w-3.5" aria-hidden="true" />
              DNI {paciente.dni}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {nombreCobertura}
          </span>
        </div>
      </header>

      {registros.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl bg-surface-container-lowest p-12 text-center shadow-sm">
          <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-surface-container-low text-on-surface-variant">
            <ClipboardList className="h-8 w-8" aria-hidden="true" />
          </span>
          {/* Texto exacto del CA2 de US-42. */}
          <h2 className="max-w-sm text-xl font-semibold">{MSG_HISTORIA_VACIA}</h2>
          <p className="max-w-md text-sm text-on-surface-variant">
            Los diagnósticos y tratamientos se van a registrar acá después de cada
            atención en la sala.
          </p>
          <span className="flex items-center gap-1.5 rounded bg-surface-container px-3 py-1 text-xs font-semibold text-on-surface-variant">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            Registro de solo lectura · Confidencial
          </span>
        </div>
      ) : (
        <section aria-labelledby="titulo-registros" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="titulo-registros" className="text-lg font-semibold">
              Registros de atención <span className="text-on-surface-variant">({registros.length})</span>
            </h2>
            <span className="flex items-center gap-1.5 text-xs text-on-surface-variant">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              Ordenados del más reciente al más antiguo
            </span>
          </div>

          <ol className="flex flex-col gap-4">
            {registros.map((r) => (
              <li key={r.id}>
                <article className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm">
                  <header className="flex flex-wrap items-center justify-between gap-3 bg-surface-container-low px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded bg-surface-container text-on-surface">
                        <Stethoscope className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="font-semibold">{r.medico}</p>
                        <p className="text-xs text-on-surface-variant">{r.especialidad ?? "—"}</p>
                      </div>
                    </div>
                    <span className="flex items-center gap-1.5 font-mono text-xs tabular-nums text-on-surface-variant">
                      <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                      {formatearFecha(r.fecha)} · {formatearHora(r.inicioMin)} hs
                    </span>
                  </header>
                  <div className="flex flex-col gap-4 p-5">
                    <Bloque titulo="Diagnóstico" icono={<Stethoscope className="h-3.5 w-3.5" />} texto={r.diagnostico} />
                    <Bloque titulo="Tratamiento indicado" icono={<Pill className="h-3.5 w-3.5" />} texto={r.tratamiento} />
                  </div>
                </article>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function Bloque({ titulo, icono, texto }: { titulo: string; icono: React.ReactNode; texto: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
        <span aria-hidden="true">{icono}</span>
        {titulo}
      </h3>
      <p className="whitespace-pre-line rounded-lg bg-surface-container-low px-4 py-3 text-sm">{texto}</p>
    </div>
  );
}
