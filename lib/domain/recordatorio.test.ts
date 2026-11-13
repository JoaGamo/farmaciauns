import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { estaEnVentanaRecordatorio } from "./recordatorio";

describe("estaEnVentanaRecordatorio", () => {
  const turno = {
    fecha: "2026-11-17",
    inicioMin: 600,
    estado: "RESERVADO" as const,
  };

  test("incluye turnos reservados dentro de las 24 horas previas", () => {
    assert.equal(
      estaEnVentanaRecordatorio(turno, new Date("2026-11-16T13:00:00Z")),
      true,
    );
    assert.equal(
      estaEnVentanaRecordatorio(turno, new Date("2026-11-16T13:01:00Z")),
      true,
    );
  });

  test("excluye turnos fuera de la ventana y turnos que ya comenzaron", () => {
    assert.equal(
      estaEnVentanaRecordatorio(turno, new Date("2026-11-16T12:59:59Z")),
      false,
    );
    assert.equal(
      estaEnVentanaRecordatorio(turno, new Date("2026-11-17T13:00:00Z")),
      false,
    );
    assert.equal(
      estaEnVentanaRecordatorio(
        { ...turno, estado: "CANCELADO" },
        new Date("2026-11-16T13:00:00Z"),
      ),
      false,
    );
  });
});
