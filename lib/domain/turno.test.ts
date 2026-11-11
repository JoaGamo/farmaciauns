/**
 * Tests unitarios del dominio de turnos e historia clínica (Sprint 3).
 *
 * Correr desde la raíz del repo: pnpm test
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  MSG_CANCELACION_FUERA_DE_PLAZO,
  MSG_TEXTO_CLINICO_LARGO,
  MSG_TURNO_NO_CANCELABLE,
  claveSlot,
  clasificarTurnos,
  diasConHorarios,
  esFuturo,
  horariosLibres,
  instanteDeTurno,
  momentoEnArgentina,
  motivoNoCancelable,
  puedeCerrarse,
  rangoReservable,
  seSuperponen,
  turnosSinCubrir,
  validarRegistroClinico,
  type TurnoBase,
} from "./turno";
import { MSG_CAMPO_OBLIGATORIO } from "./usuario";

/** Instante a partir de una hora de Argentina ("2026-11-23T10:00"). */
function ar(fechaHora: string): Date {
  return new Date(`${fechaHora}:00-03:00`);
}

function turno(datos: Partial<TurnoBase> & Pick<TurnoBase, "fecha" | "inicioMin">): TurnoBase {
  return { tipo: "CONSULTA", estado: "RESERVADO", finMin: datos.inicioMin + 20, ...datos };
}

describe("tiempo", () => {
  test("el instante de un turno se calcula en hora de Argentina", () => {
    assert.equal(instanteDeTurno("2026-11-23", 600).toISOString(), "2026-11-23T13:00:00.000Z");
    // Un turno de las 22:00 en Argentina ya es el día siguiente en UTC.
    assert.equal(instanteDeTurno("2026-11-23", 1320).toISOString(), "2026-11-24T01:00:00.000Z");
  });

  test("el momento actual se pasa a fecha y minuto de Argentina", () => {
    // 02:30 UTC del 24/11 son las 23:30 del 23/11 en Argentina.
    assert.deepEqual(momentoEnArgentina(new Date("2026-11-24T02:30:00Z")), {
      fecha: "2026-11-23",
      minuto: 1410,
    });
  });

  test("un turno es futuro solo si todavía no empezó", () => {
    const horario = { fecha: "2026-11-23", inicioMin: 600 };
    assert.equal(esFuturo(horario, ar("2026-11-23T09:59")), true);
    assert.equal(esFuturo(horario, ar("2026-11-23T10:00")), false);
    assert.equal(esFuturo(horario, ar("2026-11-23T10:05")), false);
  });
});

describe("horarios", () => {
  test("superposición entre turnos de distinta duración", () => {
    const consulta = { fecha: "2026-11-23", inicioMin: 600, finMin: 620 };
    assert.equal(seSuperponen(consulta, { fecha: "2026-11-23", inicioMin: 610, finMin: 625 }), true);
    // Tocarse no es superponerse.
    assert.equal(seSuperponen(consulta, { fecha: "2026-11-23", inicioMin: 620, finMin: 640 }), false);
    // Mismo horario, otro día.
    assert.equal(seSuperponen(consulta, { fecha: "2026-11-24", inicioMin: 600, finMin: 620 }), false);
  });

  test("se reserva desde hoy hasta el último mes habilitado de la agenda", () => {
    assert.deepEqual(rangoReservable("2026-11-16"), { desde: "2026-11-16", hasta: "2027-04-30" });
  });

  test("la clave de slot identifica dueño, día y hora", () => {
    assert.equal(claveSlot("med1", "2026-11-23", 600), "med1|2026-11-23|600");
  });

  test("horarios libres: franjas menos ocupados menos lo que ya empezó", () => {
    const franjas = [
      { fecha: "2026-11-23", inicioMin: 480, finMin: 560, duracionTurnoMin: 20 }, // 08:00 a 09:20
    ];
    const ocupados = [{ fecha: "2026-11-23", inicioMin: 520, finMin: 540 }]; // 08:40 reservado
    const libres = horariosLibres(franjas, ocupados, ar("2026-11-23T08:10"));
    // 08:00 ya empezó y 08:40 está ocupado: quedan 08:20 y 09:00.
    assert.deepEqual(libres.map((h) => h.inicioMin), [500, 540]);
    assert.deepEqual(diasConHorarios(libres), ["2026-11-23"]);
  });

  test("los días con horarios salen ordenados y sin repetir", () => {
    const franjas = [
      { fecha: "2026-11-30", inicioMin: 480, finMin: 520, duracionTurnoMin: 20 },
      { fecha: "2026-11-23", inicioMin: 480, finMin: 520, duracionTurnoMin: 20 },
    ];
    const libres = horariosLibres(franjas, [], ar("2026-11-20T12:00"));
    assert.equal(libres.length, 4);
    assert.deepEqual(diasConHorarios(libres), ["2026-11-23", "2026-11-30"]);
  });

  test("detecta turnos reservados que las nuevas franjas dejan sin cubrir", () => {
    const reservados = [
      { fecha: "2026-11-23", inicioMin: 480, finMin: 500 }, // 08:00
      { fecha: "2026-11-23", inicioMin: 660, finMin: 680 }, // 11:00
    ];
    // La franja nueva se acorta a 08:00–10:00: el de las 11:00 queda afuera.
    const franjas = [{ fecha: "2026-11-23", inicioMin: 480, finMin: 600, duracionTurnoMin: 20 }];
    assert.deepEqual(turnosSinCubrir(reservados, franjas), [reservados[1]]);
    // Cambiar la duración también descubre el turno, aunque la franja siga igual.
    const conOtraDuracion = [{ fecha: "2026-11-23", inicioMin: 480, finMin: 720, duracionTurnoMin: 30 }];
    assert.deepEqual(turnosSinCubrir([reservados[0]], conOtraDuracion), [reservados[0]]);
  });
});

describe("clasificarTurnos (US-30)", () => {
  test("separa próximos y anteriores con su orden", () => {
    const ahora = ar("2026-11-16T12:00");
    const futuroLejano = turno({ fecha: "2026-11-23", inicioMin: 600 });
    const futuroCercano = turno({ fecha: "2026-11-17", inicioMin: 540 });
    const atendido = turno({ fecha: "2026-11-02", inicioMin: 630, estado: "ATENDIDO" });
    const ausente = turno({ fecha: "2026-11-09", inicioMin: 660, estado: "AUSENTE" });
    const canceladoFuturo = turno({ fecha: "2026-11-25", inicioMin: 525, estado: "CANCELADO" });
    const pasadoSinCerrar = turno({ fecha: "2026-11-16", inicioMin: 600 });

    const { proximos, anteriores } = clasificarTurnos(
      [futuroLejano, atendido, canceladoFuturo, futuroCercano, ausente, pasadoSinCerrar],
      ahora,
    );
    assert.deepEqual(proximos, [futuroCercano, futuroLejano]);
    // Un cancelado futuro va a "Anteriores" (US-31 CA4); el más reciente primero.
    assert.deepEqual(anteriores, [canceladoFuturo, pasadoSinCerrar, ausente, atendido]);
  });
});

describe("motivoNoCancelable (US-31)", () => {
  const consulta = turno({ fecha: "2026-11-23", inicioMin: 600 }); // lunes 10:00

  test("permite cancelar con 24 horas o más de anticipación", () => {
    assert.equal(motivoNoCancelable(consulta, ar("2026-11-21T10:00")), null);
    assert.equal(motivoNoCancelable(consulta, ar("2026-11-22T10:00")), null); // 24 h justas
  });

  test("a menos de 24 horas informa el plazo", () => {
    assert.equal(motivoNoCancelable(consulta, ar("2026-11-22T10:01")), MSG_CANCELACION_FUERA_DE_PLAZO);
    assert.equal(motivoNoCancelable(consulta, ar("2026-11-23T11:00")), MSG_CANCELACION_FUERA_DE_PLAZO);
  });

  test("solo se cancelan consultas reservadas", () => {
    const ahora = ar("2026-11-01T10:00");
    assert.equal(motivoNoCancelable({ ...consulta, tipo: "VACUNACION" }, ahora), MSG_TURNO_NO_CANCELABLE);
    assert.equal(motivoNoCancelable({ ...consulta, estado: "CANCELADO" }, ahora), MSG_TURNO_NO_CANCELABLE);
  });
});

describe("puedeCerrarse (US-40 y US-41)", () => {
  test("solo turnos reservados de hoy o de días anteriores", () => {
    assert.equal(puedeCerrarse({ estado: "RESERVADO", fecha: "2026-11-16" }, "2026-11-16"), true);
    assert.equal(puedeCerrarse({ estado: "RESERVADO", fecha: "2026-11-10" }, "2026-11-16"), true);
    assert.equal(puedeCerrarse({ estado: "RESERVADO", fecha: "2026-11-17" }, "2026-11-16"), false);
    assert.equal(puedeCerrarse({ estado: "ATENDIDO", fecha: "2026-11-16" }, "2026-11-16"), false);
  });
});

describe("validarRegistroClinico (US-40)", () => {
  test("diagnóstico y tratamiento son obligatorios", () => {
    assert.deepEqual(validarRegistroClinico({ diagnostico: "  ", tratamiento: "" }), {
      diagnostico: MSG_CAMPO_OBLIGATORIO,
      tratamiento: MSG_CAMPO_OBLIGATORIO,
    });
    assert.deepEqual(validarRegistroClinico({ diagnostico: "Rinitis", tratamiento: "" }), {
      tratamiento: MSG_CAMPO_OBLIGATORIO,
    });
    assert.deepEqual(validarRegistroClinico({ diagnostico: "Rinitis", tratamiento: "Reposo" }), {});
  });

  test("rechaza textos demasiado largos", () => {
    const largo = "a".repeat(5001);
    assert.deepEqual(validarRegistroClinico({ diagnostico: largo, tratamiento: "Reposo" }), {
      diagnostico: MSG_TEXTO_CLINICO_LARGO,
    });
  });
});
