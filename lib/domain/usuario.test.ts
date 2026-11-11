import assert from "node:assert/strict";
import test from "node:test";
import {
  MSG_APELLIDO_FORMATO,
  MSG_NOMBRE_LONGITUD,
  MSG_TELEFONO_MIN,
  validarDatosPersonalAdministrativo,
  validarDatosMedico,
  validarTelefonoFormato,
  validarTelefonoLongitud,
} from "./usuario";

test("rechaza teléfonos con menos de 12 dígitos", () => {
  assert.equal(validarTelefonoFormato("12"), true);
  assert.equal(validarTelefonoLongitud("12"), false);
  assert.equal(validarDatosMedico({
    firstName: "Juan",
    lastName: "Pérez",
    dni: "30156789",
    email: "juan@example.com",
    phone: "12",
    especialidad: "Clínica médica",
    matricula: "MN 123456",
    password: "password1",
  }).phone, MSG_TELEFONO_MIN);
});

test("valida nombre, apellido y límites del personal administrativo", () => {
  const datos = {
    firstName: "María-José",
    lastName: "O'Connor",
    dni: "30156789",
    email: "maria@example.com",
    phone: "+54 11 1234-5678",
  };

  assert.deepEqual(validarDatosPersonalAdministrativo(datos), {});
  assert.equal(
    validarDatosPersonalAdministrativo({
      ...datos,
      lastName: "O'Connor!",
    }).lastName,
    MSG_APELLIDO_FORMATO,
  );
  assert.equal(
    validarDatosPersonalAdministrativo({
      ...datos,
      firstName: "A".repeat(51),
    }).firstName,
    MSG_NOMBRE_LONGITUD,
  );
});
