import Link from "next/link";
import {
  DIAS_SEMANA,
  diaSemanaDe,
  diasDelMes,
  type FechaISO,
  type MesAgenda,
} from "@/lib/domain/agenda";

/**
 * Paso 2 de US-29: calendario del mes en el que solo se pueden elegir los días
 * con horarios libres. Cada día habilitado es un link al paso 3.
 */
export function CalendarioDias({
  mes,
  hoy,
  dias,
  seleccionado,
  hrefDia,
}: {
  mes: MesAgenda;
  hoy: FechaISO;
  dias: Map<FechaISO, number>;
  seleccionado: FechaISO | null;
  hrefDia: (fecha: FechaISO) => string;
}) {
  const fechas = diasDelMes(mes);
  // Celdas vacías antes del día 1 para que la semana arranque en lunes.
  const huecos = diaSemanaDe(fechas[0]) - 1;

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
        {DIAS_SEMANA.map((d) => (
          <span key={d.valor} className="py-1" aria-hidden="true">
            {d.etiqueta.slice(0, 3)}
          </span>
        ))}
      </div>
      <ol className="grid grid-cols-7 gap-1" aria-label="Días del mes">
        {Array.from({ length: huecos }, (_, i) => (
          <li key={`hueco-${i}`} aria-hidden="true" />
        ))}
        {fechas.map((fecha) => {
          const numero = Number(fecha.slice(8));
          const cupos = dias.get(fecha);
          const esHoy = fecha === hoy;
          const elegido = fecha === seleccionado;
          return (
            <li key={fecha}>
              {cupos ? (
                <Link
                  href={hrefDia(fecha)}
                  scroll={false}
                  aria-current={elegido ? "date" : undefined}
                  aria-label={`${numero}, ${cupos} horario${cupos === 1 ? "" : "s"} libre${cupos === 1 ? "" : "s"}${esHoy ? ", hoy" : ""}`}
                  className={`flex h-14 flex-col items-center justify-center rounded text-sm font-semibold tabular-nums transition-colors ${
                    elegido
                      ? "bg-primary text-on-primary ring-2 ring-primary ring-offset-2"
                      : "bg-primary-fixed text-on-primary-fixed hover:bg-surface-container-high"
                  }`}
                >
                  {numero}
                  <span className="text-[10px] font-medium">
                    {cupos} {cupos === 1 ? "cupo" : "cupos"}
                  </span>
                </Link>
              ) : (
                <span
                  aria-label={`${numero}, sin turnos`}
                  className={`flex h-14 items-center justify-center rounded text-sm tabular-nums ${
                    fecha < hoy ? "text-outline-variant" : "text-on-surface-variant"
                  }`}
                >
                  {numero}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
