"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  MSG_MES_FUERA_DE_RANGO,
  MSG_SIN_DURACION,
  diaSemanaDe,
  esMesHabilitado,
  etiquetaDia,
  expandirMes,
  formatearHora,
  franjasSinTurnos,
  hoyEnArgentina,
  parsearMes,
  primerDiaDelMes,
  ultimoDiaDelMes,
  validarDuracion,
  validarFranjas,
  type FranjaEntrada,
} from "@/lib/domain/agenda";
import {
  guardarDuracionTurno as guardarDuracionTurnoEnDb,
  listarFranjasDesde,
  obtenerDuracionTurno,
  reemplazarFranjas,
} from "@/lib/agenda-repository";
import { requireMedico } from "@/lib/authorization";
import {
  esFuturo,
  mensajeDuracionConTurnos,
  mensajeFranjasConTurnos,
  turnosSinCubrir,
} from "@/lib/domain/turno";
import type { FormState } from "@/lib/form-state";
import { turnosReservadosDesde } from "@/lib/turno-service";

const RUTA_DISPONIBILIDAD = "/medico/agenda/disponibilidad";

function leerString(formData: FormData, campo: string): string {
  const valor = formData.get(campo);
  return typeof valor === "string" ? valor.trim() : "";
}

/** Conserva el mes elegido en la URL al volver a la pantalla. */
function urlDisponibilidad(mes: string, guardado: string): string {
  const params = new URLSearchParams({ guardado });
  if (/^\d{4}-\d{2}$/.test(mes)) {
    params.set("mes", mes);
  }
  return `${RUTA_DISPONIBILIDAD}?${params.toString()}`;
}

/** Estado del formulario de duración: `guardadaMin` indica un guardado exitoso. */
export type EstadoDuracion = FormState & { guardadaMin?: number };

/**
 * US-25 (RF-01) — Definir la duración de los turnos.
 *
 * Guarda la duración y la aplica a las franjas de hoy en adelante; las fechas
 * pasadas conservan la que tenían. Si alguna franja futura deja de admitir un
 * turno completo con la nueva duración, rechaza el cambio y las lista.
 *
 * No redirige: la página se refresca en el lugar para que el editor de franjas
 * conserve lo que el médico cargó y todavía no guardó (defecto 10).
 */
export async function guardarDuracionTurno(
  _prevState: EstadoDuracion,
  formData: FormData,
): Promise<EstadoDuracion> {
  // Autorización real (las server actions son alcanzables por POST directo).
  const medico = await requireMedico();

  const valorIngresado = leerString(formData, "duracionTurnoMin");
  const duracionTurnoMin = Number(valorIngresado);

  const errorDuracion = validarDuracion(duracionTurnoMin);
  if (errorDuracion) {
    return {
      errors: { duracionTurnoMin: errorDuracion },
      values: { duracionTurnoMin: valorIngresado },
    };
  }

  const ahora = new Date();
  const hoy = hoyEnArgentina(ahora);

  try {
    // Sprint 3: con turnos futuros reservados la duración no se puede cambiar.
    const reservados = (await turnosReservadosDesde(medico.id, hoy)).filter((t) =>
      esFuturo(t, ahora),
    );
    if (reservados.length > 0) {
      return {
        errors: { duracionTurnoMin: mensajeDuracionConTurnos(reservados.length) },
        values: { duracionTurnoMin: valorIngresado },
      };
    }

    const conflictos = franjasSinTurnos(
      await listarFranjasDesde(medico.id, hoy),
      duracionTurnoMin,
    );
    if (conflictos.length > 0) {
      // Una misma franja del patrón se repite cada semana: se lista una vez.
      const bloques = [
        ...new Set(
          conflictos.map(
            (f) =>
              `${etiquetaDia(diaSemanaDe(f.fecha))} ${formatearHora(f.inicioMin)} - ${formatearHora(f.finMin)}`,
          ),
        ),
      ];
      return {
        errors: {
          duracionTurnoMin: `Con turnos de ${duracionTurnoMin} min, estas franjas no alcanzan para un turno: ${bloques.join(", ")}. Modificalas antes de cambiar la duración.`,
        },
        values: { duracionTurnoMin: valorIngresado },
      };
    }

    await guardarDuracionTurnoEnDb(medico.id, duracionTurnoMin, hoy);
  } catch (error) {
    console.error("Failed to save the appointment duration.", error);
    return {
      errors: {
        _form: "No se pudo guardar la duración. Intentá nuevamente.",
      },
      values: { duracionTurnoMin: valorIngresado },
    };
  }

  revalidatePath("/medico/agenda", "layout");
  return { errors: {}, guardadaMin: duracionTurnoMin };
}

/** Lee el JSON de franjas del editor. `null` si no tiene la forma esperada. */
function leerFranjas(valor: string): FranjaEntrada[] | null {
  let datos: unknown;
  try {
    datos = JSON.parse(valor);
  } catch {
    return null;
  }
  if (!Array.isArray(datos)) {
    return null;
  }
  const franjas: FranjaEntrada[] = [];
  for (const item of datos) {
    if (
      typeof item !== "object" ||
      item === null ||
      typeof item.diaSemana !== "number" ||
      typeof item.inicio !== "string" ||
      typeof item.fin !== "string"
    ) {
      return null;
    }
    franjas.push({ diaSemana: item.diaSemana, inicio: item.inicio, fin: item.fin });
  }
  return franjas;
}

/**
 * US-26 y US-28 (RF-01) — Guardar la disponibilidad de un mes.
 *
 * Recibe el patrón semanal del editor, lo valida con las mismas reglas que el
 * cliente y lo expande a las fechas del mes de hoy en adelante. En una
 * transacción reemplaza solo ese rango: las fechas pasadas no se tocan.
 */
export async function guardarDisponibilidad(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  // Autorización real (las server actions son alcanzables por POST directo).
  const medico = await requireMedico();

  const mesIngresado = leerString(formData, "mes");
  const hoy = hoyEnArgentina(new Date());
  const mes = parsearMes(mesIngresado);
  if (!mes || !esMesHabilitado(mes, hoy)) {
    return { errors: { _form: MSG_MES_FUERA_DE_RANGO } };
  }

  const entradas = leerFranjas(leerString(formData, "franjas"));
  if (!entradas) {
    return {
      errors: { _form: "No se pudieron leer las franjas enviadas. Recargá la página e intentá nuevamente." },
    };
  }

  // Desde hoy si el mes ya empezó; si no, desde el día 1.
  const primerDia = primerDiaDelMes(mes);
  const rango = { desde: hoy > primerDia ? hoy : primerDia, hasta: ultimoDiaDelMes(mes) };
  let agendaCerrada: boolean;

  try {
    const duracionTurnoMin = await obtenerDuracionTurno(medico.id);
    if (duracionTurnoMin === null) {
      return { errors: { _form: MSG_SIN_DURACION } };
    }

    const resultado = validarFranjas(entradas, duracionTurnoMin);
    if (!resultado.ok) {
      const [indice, mensaje] = Object.entries(resultado.errores)[0];
      return {
        errors: { _form: `Revisá la franja ${Number(indice) + 1}: ${mensaje}` },
      };
    }

    const nuevas = expandirMes(mes, resultado.franjas, rango.desde);

    // Sprint 3: no se pueden quitar ni acortar franjas con turnos reservados.
    const reservados = (await turnosReservadosDesde(medico.id, rango.desde)).filter(
      (t) => t.fecha <= rango.hasta,
    );
    const sinCubrir = turnosSinCubrir(
      reservados,
      nuevas.map((f) => ({ ...f, duracionTurnoMin })),
    );
    if (sinCubrir.length > 0) {
      return {
        errors: {
          _form: mensajeFranjasConTurnos(
            sinCubrir.map(
              (t) =>
                `${etiquetaDia(diaSemanaDe(t.fecha))} ${t.fecha.slice(8, 10)}/${t.fecha.slice(5, 7)} ${formatearHora(t.inicioMin)} (${t.paciente.nombreCompleto})`,
            ),
          ),
        },
      };
    }

    // Sin franjas, el reemplazo cierra la agenda por lo que queda del mes (US-28).
    agendaCerrada = resultado.franjas.length === 0;
    await reemplazarFranjas(medico.id, rango, nuevas, duracionTurnoMin);
  } catch (error) {
    console.error("Failed to save the monthly availability.", error);
    return {
      errors: { _form: "No se pudo guardar la disponibilidad. Intentá nuevamente." },
    };
  }

  revalidatePath("/medico/agenda", "layout");
  redirect(urlDisponibilidad(mesIngresado, agendaCerrada ? "cerrada" : "franjas"));
}
