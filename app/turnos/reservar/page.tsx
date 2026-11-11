import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  Check,
  CircleCheck,
  Info,
  ShieldCheck,
  Stethoscope,
  TriangleAlert,
} from "lucide-react";
import { $Enums } from "@/generated/prisma/client";
import { requirePaciente } from "@/lib/authorization";
import { obtenerCoberturaDePaciente } from "@/lib/cobertura-service";
import {
  etiquetaFechaLarga,
  etiquetaMes,
  formatearHora,
  formatearMes,
  mesDeFecha,
  parsearMes,
  type FechaISO,
} from "@/lib/domain/agenda";
import { MSG_SIN_TURNOS_MEDICO, MSG_TURNO_NO_DISPONIBLE, momentoEnArgentina } from "@/lib/domain/turno";
import { especialidadFromEnum } from "@/lib/prisma-user-repository";
import {
  horariosLibresDeMedico,
  listarMedicosReservables,
  listarTurnosDePaciente,
  obtenerMedicoReservable,
  type MedicoReservable,
} from "@/lib/turno-service";
import { CalendarioDias } from "./calendario-dias";
import { ConfirmarReservaForm } from "./confirmar-reserva-form";
import { SelectorEspecialidad } from "./selector-especialidad";

export const dynamic = "force-dynamic";

type Parametros = {
  especialidad?: string;
  medico?: string;
  mes?: string;
  fecha?: string;
  hora?: string;
  reservado?: string;
};

const ESPECIALIDADES = Object.values($Enums.Especialidad);

/** Arma la URL de un paso conservando solo los parámetros que siguen valiendo. */
function urlReserva(p: Record<string, string | number | null | undefined>): string {
  const query = new URLSearchParams();
  for (const [clave, valor] of Object.entries(p)) {
    if (valor !== undefined && valor !== null && valor !== "") {
      query.set(clave, String(valor));
    }
  }
  return `/turnos/reservar?${query.toString()}`;
}

/**
 * US-29 (RF-02) — Reservar turno, en tres pasos según los wireframes:
 * 1) especialidad y médico, 2) día, 3) horario y confirmación.
 * El estado de cada paso viaja en la URL. Solo se ofrecen médicos activos
 * (CA4) y horarios futuros libres.
 */
export default async function ReservarTurnoPage({
  searchParams,
}: {
  searchParams: Promise<Parametros>;
}) {
  const paciente = await requirePaciente();
  const params = await searchParams;
  const ahora = new Date();
  const hoy = momentoEnArgentina(ahora).fecha;

  const cobertura = await obtenerCoberturaDePaciente(paciente.id);
  const coberturaPaciente =
    cobertura.nombre ?? (cobertura.esParticular ? "Particular" : null);

  if (params.reservado) {
    const turno = (await listarTurnosDePaciente(paciente.id)).find(
      (t) => t.id === params.reservado,
    );
    if (turno) {
      return (
        <ReservaExitosa
          medico={turno.medico ?? ""}
          especialidad={turno.especialidad}
          fecha={turno.fecha}
          inicioMin={turno.inicioMin}
        />
      );
    }
  }

  const especialidad = ESPECIALIDADES.find((e) => e === params.especialidad) ?? ESPECIALIDADES[0];
  const medico = params.medico ? await obtenerMedicoReservable(params.medico) : null;
  const libres = medico ? await horariosLibresDeMedico(medico.id, ahora) : [];

  const cuposPorDia = new Map<FechaISO, number>();
  for (const h of libres) {
    cuposPorDia.set(h.fecha, (cuposPorDia.get(h.fecha) ?? 0) + 1);
  }
  const fecha = params.fecha && cuposPorDia.has(params.fecha) ? params.fecha : null;
  const horariosDelDia = fecha ? libres.filter((h) => h.fecha === fecha) : [];
  const horaPedida = params.hora ? Number(params.hora) : null;
  const horario = horariosDelDia.find((h) => h.inicioMin === horaPedida) ?? null;
  // La hora pedida existía pero ya no está libre: otro paciente la tomó (CA2).
  const horarioTomado = horaPedida !== null && fecha !== null && horario === null;

  const paso = !medico ? 1 : !fecha ? 2 : 3;
  const especialidadMedico = medico?.especialidad ?? especialidadFromEnum(especialidad);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            <Link href="/turnos" className="hover:text-on-surface">
              Gestión de turnos
            </Link>
            <span className="text-outline">›</span>
            <span className="text-on-surface">Nueva reserva</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Reservar turno</h1>
          <p className="mt-1 text-on-surface-variant">
            Completá los pasos para agendar tu consulta médica.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-primary-fixed px-4 py-2 text-sm text-on-primary-fixed">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          <span>
            Tu cobertura: <b>{coberturaPaciente ?? "sin registrar"}</b>
            {cobertura.numeroAfiliado ? ` · Afiliado ${cobertura.numeroAfiliado}` : ""}
          </span>
        </div>
      </header>

      <Pasos
        actual={paso}
        medico={medico?.nombreCompleto}
        fecha={fecha ? etiquetaFechaLarga(fecha) : undefined}
        hrefPaso1={urlReserva({ especialidad })}
        hrefPaso2={medico ? urlReserva({ especialidad, medico: medico.id }) : undefined}
      />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          {params.medico && !medico && (
            <Aviso>Ese médico no está disponible para reservar turnos. Elegí otro profesional.</Aviso>
          )}

          {paso === 1 && (
            <PasoMedico
              especialidad={especialidad}
              medicos={await listarMedicosReservables(especialidad)}
              coberturaPaciente={cobertura.nombre}
            />
          )}

          {paso === 2 && medico && (
            <Tarjeta titulo="Elegí el día de atención" icono={<CalendarCheck className="h-4 w-4" />}>
              <MedicoElegido medico={medico} hrefCambiar={urlReserva({ especialidad })} />
              {cuposPorDia.size === 0 ? (
                <p
                  role="status"
                  className="rounded-lg bg-surface-container-low px-4 py-6 text-center text-sm font-medium text-on-surface-variant"
                >
                  {MSG_SIN_TURNOS_MEDICO}
                </p>
              ) : (
                <SelectorDia
                  hoy={hoy}
                  cuposPorDia={cuposPorDia}
                  mesPedido={params.mes}
                  hrefMes={(mes) => urlReserva({ especialidad, medico: medico.id, mes })}
                  hrefDia={(dia) => urlReserva({ especialidad, medico: medico.id, fecha: dia })}
                />
              )}
              <Link
                href={urlReserva({ especialidad })}
                className="inline-flex items-center gap-2 self-start text-sm font-semibold text-on-surface hover:underline"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Volver al paso 1
              </Link>
            </Tarjeta>
          )}

          {paso === 3 && medico && fecha && (
            <Tarjeta titulo="Elegí el horario" icono={<CalendarCheck className="h-4 w-4" />}>
              <p className="text-sm text-on-surface-variant">
                Fecha seleccionada: <b className="text-on-surface">{etiquetaFechaLarga(fecha)}</b> ·{" "}
                {horariosDelDia.length} horario{horariosDelDia.length === 1 ? "" : "s"} libre
                {horariosDelDia.length === 1 ? "" : "s"}
              </p>
              {horarioTomado && <Aviso>{MSG_TURNO_NO_DISPONIBLE}. Elegí otro horario.</Aviso>}
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {horariosDelDia.map((h) => {
                  const elegido = h.inicioMin === horario?.inicioMin;
                  return (
                    <li key={h.inicioMin}>
                      <Link
                        href={urlReserva({ especialidad, medico: medico.id, fecha, hora: h.inicioMin })}
                        scroll={false}
                        aria-current={elegido ? "true" : undefined}
                        className={`flex h-11 items-center justify-between rounded px-3 font-mono text-sm tabular-nums transition-colors ${
                          elegido
                            ? "bg-primary text-on-primary"
                            : "bg-surface-container-low text-on-surface hover:bg-surface-container-high"
                        }`}
                      >
                        {formatearHora(h.inicioMin)} hs
                        {elegido && <Check className="h-4 w-4" aria-hidden="true" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <p className="flex items-start gap-2 rounded-lg bg-surface-container-low px-4 py-3 text-xs text-on-surface-variant">
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                Duración de la consulta: {horariosDelDia[0] ? horariosDelDia[0].finMin - horariosDelDia[0].inicioMin : 0}{" "}
                minutos. Podés cancelar el turno hasta 24 horas antes desde &quot;Mis turnos&quot;.
              </p>
              <Link
                href={urlReserva({ especialidad, medico: medico.id, mes: formatearMes(mesDeFecha(fecha)) })}
                className="inline-flex items-center gap-2 self-start text-sm font-semibold text-on-surface hover:underline"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Volver al paso 2
              </Link>
            </Tarjeta>
          )}
        </div>

        <aside className="flex flex-col gap-4 rounded-xl bg-surface-container-lowest p-5 shadow-sm lg:sticky lg:top-16">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Resumen del turno</h2>
            <span className="rounded bg-surface-container px-2 py-0.5 font-mono text-[11px] font-semibold">
              {paso} de 3
            </span>
          </div>
          <dl className="flex flex-col gap-3 text-sm">
            <FilaResumen
              etiqueta="Paciente"
              valor={`${paciente.firstName ?? ""} ${paciente.lastName ?? ""}`.trim()}
              detalle={paciente.dni ? `DNI ${paciente.dni}` : undefined}
            />
            <FilaResumen etiqueta="Especialidad" valor={especialidadMedico ?? "—"} />
            <FilaResumen etiqueta="Profesional" valor={medico?.nombreCompleto ?? "—"} />
            <FilaResumen etiqueta="Fecha" valor={fecha ? etiquetaFechaLarga(fecha) : "—"} />
            <FilaResumen
              etiqueta="Hora"
              valor={horario ? `${formatearHora(horario.inicioMin)} hs` : "—"}
            />
          </dl>
          {medico && fecha && horario ? (
            <ConfirmarReservaForm medicoId={medico.id} fecha={fecha} inicioMin={horario.inicioMin} />
          ) : (
            <p className="text-xs text-on-surface-variant">
              Completá los pasos para ver el botón &quot;Confirmar turno&quot;.
            </p>
          )}
          <Link
            href="/turnos"
            className="text-center text-xs font-semibold text-on-surface-variant hover:text-on-surface"
          >
            Volver a Mis turnos
          </Link>
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Paso 1 — especialidad y médico
// ---------------------------------------------------------------------------

function PasoMedico({
  especialidad,
  medicos,
  coberturaPaciente,
}: {
  especialidad: $Enums.Especialidad;
  medicos: MedicoReservable[];
  coberturaPaciente: string | null;
}) {
  return (
    <>
      <Tarjeta titulo="Seleccioná una especialidad" icono={<Stethoscope className="h-4 w-4" />}>
        <label htmlFor="especialidad" className="sr-only">
          Especialidad
        </label>
        <SelectorEspecialidad
          especialidad={especialidad}
          opciones={ESPECIALIDADES.map((e) => ({ valor: e, etiqueta: especialidadFromEnum(e) ?? e }))}
        />
      </Tarjeta>

      <h2 className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
        Profesionales disponibles ({medicos.length})
      </h2>
      {medicos.length === 0 ? (
        <p className="rounded-xl bg-surface-container-lowest p-6 text-center text-sm text-on-surface-variant shadow-sm">
          No hay médicos disponibles para esta especialidad.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {medicos.map((m) => {
            const acepta =
              coberturaPaciente !== null &&
              m.coberturas.some((c) => c.nombre.toLowerCase() === coberturaPaciente.toLowerCase());
            return (
              <li key={m.id}>
                <Link
                  href={urlReserva({ especialidad, medico: m.id })}
                  className="flex flex-col gap-3 rounded-xl bg-surface-container-lowest p-5 shadow-sm transition-colors hover:bg-surface-container-low"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold">{m.nombreCompleto}</p>
                      <p className="text-sm text-on-surface-variant">
                        {m.especialidad ?? "—"}
                        {m.matricula ? ` · Mat. ${m.matricula}` : ""}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-on-surface">
                      Elegir
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-on-surface-variant">Acepta:</span>
                    {m.coberturas.length === 0 ? (
                      <span className="text-on-surface-variant">solo particulares</span>
                    ) : (
                      m.coberturas.map((c) => (
                        <span
                          key={c.id}
                          className={`rounded px-2 py-0.5 font-semibold ${
                            c.nombre.toLowerCase() === coberturaPaciente?.toLowerCase()
                              ? "bg-primary text-on-primary"
                              : "bg-surface-container text-on-surface"
                          }`}
                        >
                          {c.nombre}
                        </span>
                      ))
                    )}
                  </div>
                  {coberturaPaciente && (
                    <p className="flex items-start gap-2 rounded bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant">
                      {acepta ? (
                        <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      ) : (
                        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      )}
                      {acepta
                        ? `Tu cobertura ${coberturaPaciente} es aceptada por este profesional.`
                        : `Este profesional no acepta tu cobertura (${coberturaPaciente}).`}
                    </p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Paso 2 — día
// ---------------------------------------------------------------------------

function SelectorDia({
  hoy,
  cuposPorDia,
  mesPedido,
  hrefMes,
  hrefDia,
}: {
  hoy: FechaISO;
  cuposPorDia: Map<FechaISO, number>;
  mesPedido: string | undefined;
  hrefMes: (mes: string) => string;
  hrefDia: (dia: FechaISO) => string;
}) {
  const dias = [...cuposPorDia.keys()].sort();
  const meses = [...new Set(dias.map((d) => d.slice(0, 7)))];
  const pedido = mesPedido ? parsearMes(mesPedido) : null;
  const mes =
    pedido && meses.includes(formatearMes(pedido)) ? pedido : mesDeFecha(dias[0]);

  return (
    <div className="flex flex-col gap-4">
      {meses.length > 1 && (
        <nav aria-label="Meses con turnos" className="flex flex-wrap gap-2">
          {meses.map((m) => {
            const actual = m === formatearMes(mes);
            const parsed = parsearMes(m);
            return (
              <Link
                key={m}
                href={hrefMes(m)}
                scroll={false}
                aria-current={actual ? "page" : undefined}
                className={`rounded px-3 py-1.5 text-xs font-semibold ${
                  actual ? "bg-primary text-on-primary" : "bg-surface-container-low text-on-surface hover:bg-surface-container"
                }`}
              >
                {parsed ? etiquetaMes(parsed) : m}
              </Link>
            );
          })}
        </nav>
      )}
      <p className="text-sm font-semibold">{etiquetaMes(mes)}</p>
      <CalendarioDias mes={mes} hoy={hoy} dias={cuposPorDia} seleccionado={null} hrefDia={hrefDia} />
      <p className="text-xs text-on-surface-variant">
        Los días resaltados tienen horarios libres. Tocá uno para ver los horarios.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Piezas comunes
// ---------------------------------------------------------------------------

function Pasos({
  actual,
  medico,
  fecha,
  hrefPaso1,
  hrefPaso2,
}: {
  actual: number;
  medico?: string;
  fecha?: string;
  hrefPaso1: string;
  hrefPaso2?: string;
}) {
  const pasos = [
    { n: 1, titulo: "Elegir médico", detalle: medico, href: hrefPaso1 },
    { n: 2, titulo: "Elegir día", detalle: fecha, href: hrefPaso2 },
    { n: 3, titulo: "Elegir horario", detalle: undefined, href: undefined },
  ];
  return (
    <ol className="grid grid-cols-1 gap-2 rounded-xl bg-surface-container-lowest p-3 shadow-sm sm:grid-cols-3">
      {pasos.map((p) => {
        const completo = p.n < actual;
        const enCurso = p.n === actual;
        const contenido = (
          <>
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded text-sm font-bold ${
                enCurso || completo ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant"
              }`}
            >
              {completo ? <Check className="h-4 w-4" aria-hidden="true" /> : p.n}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                Paso {p.n} · {completo ? "Completado" : enCurso ? "En curso" : "Pendiente"}
              </span>
              <span className={`truncate text-sm font-semibold ${enCurso || completo ? "text-on-surface" : "text-on-surface-variant"}`}>
                {p.detalle ?? p.titulo}
              </span>
            </span>
          </>
        );
        return (
          <li
            key={p.n}
            aria-current={enCurso ? "step" : undefined}
            className={`rounded-lg ${enCurso ? "bg-surface-container-low" : ""}`}
          >
            {completo && p.href ? (
              <Link href={p.href} className="flex items-center gap-3 p-2 hover:opacity-80">
                {contenido}
              </Link>
            ) : (
              <div className="flex items-center gap-3 p-2">{contenido}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function MedicoElegido({ medico, hrefCambiar }: { medico: MedicoReservable; hrefCambiar: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-container-low px-4 py-3">
      <div>
        <p className="font-semibold">{medico.nombreCompleto}</p>
        <p className="text-xs text-on-surface-variant">
          {medico.especialidad ?? "—"}
          {medico.matricula ? ` · Mat. ${medico.matricula}` : ""}
        </p>
      </div>
      <Link href={hrefCambiar} className="text-xs font-semibold text-on-surface underline">
        Cambiar médico
      </Link>
    </div>
  );
}

function Tarjeta({ titulo, icono, children }: { titulo: string; icono: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl bg-surface-container-lowest p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <span className="flex h-8 w-8 items-center justify-center rounded bg-primary text-on-primary" aria-hidden="true">
          {icono}
        </span>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Aviso({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-lg bg-surface-container-high px-4 py-3 text-sm font-semibold">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}

function FilaResumen({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle?: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">{etiqueta}</dt>
      <dd className="font-semibold">{valor}</dd>
      {detalle && <dd className="text-xs text-on-surface-variant">{detalle}</dd>}
    </div>
  );
}

function ReservaExitosa({
  medico,
  especialidad,
  fecha,
  inicioMin,
}: {
  medico: string;
  especialidad: string | null;
  fecha: FechaISO;
  inicioMin: number;
}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-5 rounded-xl bg-surface-container-lowest p-8 text-center shadow-sm">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary">
        <Check className="h-7 w-7" aria-hidden="true" />
      </span>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Turno reservado</h1>
        <p role="status" className="mt-1 text-on-surface-variant">
          Tu turno quedó reservado. Lo vas a ver en &quot;Mis turnos&quot;.
        </p>
      </div>
      <dl className="grid w-full grid-cols-2 gap-3 rounded-lg bg-surface-container-low p-4 text-left text-sm">
        <FilaResumen etiqueta="Profesional" valor={medico} />
        <FilaResumen etiqueta="Especialidad" valor={especialidad ?? "—"} />
        <FilaResumen etiqueta="Fecha" valor={etiquetaFechaLarga(fecha)} />
        <FilaResumen etiqueta="Hora" valor={`${formatearHora(inicioMin)} hs`} />
      </dl>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/turnos"
          className="inline-flex h-10 items-center rounded bg-primary px-5 text-sm font-semibold text-on-primary hover:bg-secondary"
        >
          Ver mis turnos
        </Link>
        <Link
          href="/turnos/reservar"
          className="inline-flex h-10 items-center rounded bg-surface-container-low px-5 text-sm font-semibold text-on-surface hover:bg-surface-container"
        >
          Reservar otro turno
        </Link>
      </div>
    </div>
  );
}
