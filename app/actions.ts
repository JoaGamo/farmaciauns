"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  MSG_DNI_DUPLICADO,
  MSG_EMAIL_DUPLICADO,
  normalizarDni,
  validarDatosEnfermera,
  validarDatosMedico,
  validarDatosPaciente,
  validarDatosPersonalAdministrativo,
} from "@/lib/domain/usuario";
import { sendWelcomeEmail } from "@/lib/email";
import { getSignUpRedirectUrl } from "@/lib/clerk-urls";
import type { FormState } from "@/lib/form-state";
import { hashPassword } from "@/lib/password";
import { getPrisma } from "@/lib/prisma";
import { getUserRepository } from "@/lib/repository";
import { normalizeRole, requireRole, type Role } from "@/lib/authorization";
import { getCurrentDbUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import {
  agregarCoberturaAMedico,
  asignarCoberturaAPaciente,
  listarCoberturasDisponibles,
  quitarCoberturaDeMedico,
} from "@/lib/cobertura-service";
import {
  MSG_AFILIADO_OBLIGATORIO,
  MSG_COBERTURA_NO_DISPONIBLE,
  MSG_COBERTURA_NO_ENCONTRADA,
} from "@/lib/domain/cobertura";
import { registrarIngreso, registrarEgreso } from "@/lib/stock-service";
import {
  MSG_CANTIDAD_INVALIDA,
  MSG_DETALLE_OBLIGATORIO,
  MSG_MOTIVO_INVALIDO,
  MSG_MOTIVO_OBLIGATORIO,
  MSG_STOCK_MAXIMO,
  MSG_STOCK_INSUFICIENTE,
} from "@/lib/domain/vacuna";

function leerString(formData: FormData, campo: string): string {
  const valor = formData.get(campo);
  return typeof valor === "string" ? valor : "";
}

/** Parsea "YYYY-MM-DD" a `Date`. Devuelve `undefined` si no es válida. */
function parsearFechaNacimiento(valor: string): Date | undefined {
  if (!valor) {
    return undefined;
  }
  const d = new Date(`${valor}T00:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * US-06 (RF-13) — Registro de paciente (autorregistro sin sesión).
 * Valida, crea un usuario PACIENTE activo y redirige a `/registro/exitoso`.
 */
export async function registrarPaciente(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const datos = {
    firstName: leerString(formData, "firstName"),
    lastName: leerString(formData, "lastName"),
    dni: leerString(formData, "dni"),
    birthDate: leerString(formData, "birthDate"),
    email: leerString(formData, "email"),
    phone: leerString(formData, "phone"),
    password: leerString(formData, "password"),
    confirmPassword: leerString(formData, "confirmPassword"),
  };
  const coberturaId = leerString(formData, "coberturaId");
  const numeroAfiliado = leerString(formData, "numeroAfiliado");

  const valores = {
    firstName: datos.firstName,
    lastName: datos.lastName,
    dni: datos.dni,
    birthDate: datos.birthDate,
    email: datos.email,
    phone: datos.phone,
    coberturaId,
    numeroAfiliado,
  };

  const errores = validarDatosPaciente(datos);
  if (Object.keys(errores).length > 0) {
    return { errors: errores, values: valores };
  }

  const repo = getUserRepository();
  if (await repo.findByDni(normalizarDni(datos.dni))) {
    return { errors: { dni: MSG_DNI_DUPLICADO }, values: valores };
  }
  if (await repo.findByEmail(datos.email)) {
    return { errors: { email: MSG_EMAIL_DUPLICADO }, values: valores };
  }

  // Validación de cobertura (US-21): si elige una cobertura, debe estar
  // disponible y el nº de afiliado es obligatorio. Requiere la DB (Neon).
  const usaCoberturas = Boolean(process.env.DATABASE_URL?.trim());
  if (usaCoberturas && coberturaId) {
    const disponibles = await listarCoberturasDisponibles();
    if (!disponibles.some((c) => c.id === coberturaId)) {
      return {
        errors: { coberturaId: MSG_COBERTURA_NO_DISPONIBLE },
        values: valores,
      };
    }
    if (!numeroAfiliado.trim()) {
      return {
        errors: { numeroAfiliado: MSG_AFILIADO_OBLIGATORIO },
        values: valores,
      };
    }
  }

  const passwordHash = await hashPassword(datos.password);
  const usuario = await repo.create({
    firstName: datos.firstName,
    lastName: datos.lastName,
    dni: datos.dni,
    email: datos.email,
    phone: datos.phone,
    birthDate: parsearFechaNacimiento(datos.birthDate),
    passwordHash,
    role: "PACIENTE",
    active: true,
  });

  if (usaCoberturas) {
    if (coberturaId) {
      await asignarCoberturaAPaciente(usuario.id, coberturaId, numeroAfiliado);
    } else {
      // "Particular": marca esParticular para que "Mi cobertura" lo muestre
      // como registrado y no vuelva a pedir el formulario (defecto 09).
      await asignarCoberturaAPaciente(usuario.id, null);
    }
  }

  revalidatePath("/pacientes");
  redirect("/registro/exitoso");
}

/**
 * US-07 (RF-16) — Registrar personal administrativo (solo ADMINISTRADOR).
 * Valida, crea un usuario ADMINISTRATIVO activo en Neon, envía una invitación
 * de Clerk y redirige a la confirmación (US-08).
 */
export async function registrarPersonalAdministrativo(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  // Autorización real (las server actions son alcanzables por POST directo).
  await requireRole(["admin"]);

  const datos = {
    firstName: leerString(formData, "firstName"),
    lastName: leerString(formData, "lastName"),
    dni: leerString(formData, "dni"),
    email: leerString(formData, "email"),
    phone: leerString(formData, "phone"),
  };

  const errores = validarDatosPersonalAdministrativo(datos);
  if (Object.keys(errores).length > 0) {
    return {
      errors: errores,
      values: {
        firstName: datos.firstName,
        lastName: datos.lastName,
        dni: datos.dni,
        email: datos.email,
        phone: datos.phone,
      },
    };
  }

  const prisma = getPrisma();
  const dni = normalizarDni(datos.dni);
  const email = datos.email.trim().toLowerCase();

  if (await prisma.user.findUnique({ where: { dni } })) {
    return { errors: { dni: MSG_DNI_DUPLICADO } };
  }
  if (
    await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    })
  ) {
    return { errors: { email: MSG_EMAIL_DUPLICADO } };
  }

  let invitationId: string;
  try {
    const clerk = await clerkClient();
    const invitation = await clerk.invitations.createInvitation({
      emailAddress: email,
      publicMetadata: { role: "administrativo", farmaciaunsStaffInvite: true },
      redirectUrl: await getSignUpRedirectUrl(),
    });
    invitationId = invitation.id;
  } catch (error) {
    console.error("Failed to send administrative staff invitation.", error);
    return {
      errors: {
        _form: "No se pudo enviar la invitación. Verificá el email e intentá más tarde.",
      },
    };
  }

  let usuarioId: string;
  try {
    const usuario = await prisma.user.create({
      data: {
        email,
        firstName: datos.firstName.trim(),
        lastName: datos.lastName.trim(),
        dni,
        phone: datos.phone.trim(),
        role: "ADMINISTRATIVO",
        isActive: true,
      },
      select: { id: true },
    });
    usuarioId = usuario.id;
  } catch (databaseError) {
    try {
      const clerk = await clerkClient();
      await clerk.invitations.revokeInvitation(invitationId);
    } catch (revokeError) {
      console.error(
        "Failed to revoke administrative staff invitation after Neon persistence failed.",
        { databaseError, revokeError },
      );
      return {
        errors: {
          _form:
            "No se pudo guardar el registro en Neon ni anular la invitación. Revisá Clerk antes de volver a intentarlo.",
        },
      };
    }

    console.error("Failed to persist administrative staff in Neon.", databaseError);
    return {
      errors: {
        _form:
          "No se pudo guardar el registro en Neon. La invitación fue anulada; intentá nuevamente.",
      },
    };
  }

  revalidatePath("/admin/personal");
  redirect(`/admin/personal/confirmacion?id=${encodeURIComponent(usuarioId)}`);
}

/**
 * US-04 (RF-10) — Registrar médico (solo ADMINISTRADOR).
 * Valida, crea un usuario MEDICO activo con su especialidad, dispara el STUB
 * de email de bienvenida y redirige a la confirmación (US-05) con el id.
 */
export async function registrarMedico(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  // Autorización real (las server actions son alcanzables por POST directo).
  await requireRole(["admin"]);

  const datos = {
    firstName: leerString(formData, "firstName"),
    lastName: leerString(formData, "lastName"),
    dni: leerString(formData, "dni"),
    email: leerString(formData, "email"),
    phone: leerString(formData, "phone"),
    especialidad: leerString(formData, "especialidad"),
    matricula: leerString(formData, "matricula"),
    password: leerString(formData, "password"),
  };

  const errores = validarDatosMedico(datos);
  if (Object.keys(errores).length > 0) {
    return {
      errors: errores,
      values: {
        firstName: datos.firstName,
        lastName: datos.lastName,
        dni: datos.dni,
        email: datos.email,
        phone: datos.phone,
        especialidad: datos.especialidad,
        matricula: datos.matricula,
      },
    };
  }

  const repo = getUserRepository();
  if (await repo.findByDni(normalizarDni(datos.dni))) {
    return { errors: { dni: MSG_DNI_DUPLICADO } };
  }
  if (await repo.findByEmail(datos.email)) {
    return { errors: { email: MSG_EMAIL_DUPLICADO } };
  }

  const passwordHash = await hashPassword(datos.password);
  const usuario = await repo.create({
    firstName: datos.firstName,
    lastName: datos.lastName,
    dni: datos.dni,
    email: datos.email,
    phone: datos.phone,
    especialidad: datos.especialidad,
    matricula: datos.matricula,
    passwordHash,
    role: "MEDICO",
    active: true,
  });

  await sendWelcomeEmail(
    usuario.email ?? "",
    `${usuario.firstName ?? ""} ${usuario.lastName ?? ""}`.trim(),
  );

  revalidatePath("/admin/medicos");
  redirect(`/admin/medicos/confirmacion?id=${encodeURIComponent(usuario.id)}`);
}

/**
 * US-15 (RF-19) — Registrar enfermera (solo ADMINISTRADOR).
 * Registra la enfermera en Neon y envía una invitación nativa de Clerk para
 * que defina su contraseña y active su cuenta.
 */
export async function registrarEnfermera(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  // Autorización real (las server actions son alcanzables por POST directo).
  await requireRole(["admin"]);

  const datos = {
    firstName: leerString(formData, "firstName"),
    lastName: leerString(formData, "lastName"),
    dni: leerString(formData, "dni"),
    email: leerString(formData, "email"),
    phone: leerString(formData, "phone"),
  };

  const errores = validarDatosEnfermera(datos);
  if (Object.keys(errores).length > 0) {
    return {
      errors: errores,
      values: {
        firstName: datos.firstName,
        lastName: datos.lastName,
        dni: datos.dni,
        email: datos.email,
        phone: datos.phone,
      },
    };
  }

  const prisma = getPrisma();
  const dni = normalizarDni(datos.dni);
  const email = datos.email.trim().toLowerCase();

  if (await prisma.user.findUnique({ where: { dni } })) {
    return { errors: { dni: MSG_DNI_DUPLICADO } };
  }
  if (
    await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    })
  ) {
    return { errors: { email: MSG_EMAIL_DUPLICADO } };
  }

  let clerk;
  try {
    clerk = await clerkClient();
  } catch (clerkConfigurationError) {
    console.error(
      "Could not initialize the Clerk client for nurse registration.",
      clerkConfigurationError,
    );
    return {
      errors: {
        _form:
          "No se pudo conectar con Clerk. Verificá su configuración e intentá nuevamente.",
      },
    };
  }
  let pendingInvitations;
  try {
    const invitations = await clerk.invitations.getInvitationList({
      query: email,
      status: "pending",
      limit: 100,
    });
    pendingInvitations = invitations.data.filter(
      (pendingInvitation) =>
        pendingInvitation.emailAddress.toLowerCase() === email &&
        pendingInvitation.publicMetadata?.role === "enfermera" &&
        pendingInvitation.publicMetadata?.farmaciaunsStaffInvite === true,
    );
  } catch (invitationLookupError) {
    console.error("Failed to check for a previous nurse invitation.", invitationLookupError);
    return {
      errors: {
        _form:
          "No se pudo verificar si ya existe una invitación pendiente. Intentá nuevamente.",
      },
    };
  }

  let invitation;
  try {
    invitation = await clerk.invitations.createInvitation({
      emailAddress: email,
      ignoreExisting: pendingInvitations.length > 0,
      publicMetadata: {
        role: "enfermera",
        farmaciaunsStaffInvite: true,
      },
      redirectUrl: await getSignUpRedirectUrl(),
    });
  } catch (clerkError) {
    console.error("Failed to create nurse invitation in Clerk.", clerkError);
    const clerkErrorCode =
      typeof clerkError === "object" && clerkError !== null &&
      "errors" in clerkError && Array.isArray(clerkError.errors)
        ? clerkError.errors.find(
            (item): item is { code: string } =>
              typeof item === "object" &&
              item !== null &&
              "code" in item &&
              typeof item.code === "string",
          )?.code
        : undefined;

    if (
      clerkErrorCode === "form_identifier_exists" ||
      clerkErrorCode === "form_email_address_taken"
    ) {
      return { errors: { email: MSG_EMAIL_DUPLICADO } };
    }
    return {
      errors: {
        _form:
          "No se pudo enviar la invitación desde Clerk. Verificá los datos e intentá nuevamente.",
      },
    };
  }

  try {
    for (const pendingInvitation of pendingInvitations) {
      await clerk.invitations.revokeInvitation(pendingInvitation.id);
    }
  } catch (revokePreviousError) {
    try {
      await clerk.invitations.revokeInvitation(invitation.id);
    } catch (revokeNewError) {
      console.error("Failed to revoke the replacement nurse invitation.", {
        revokePreviousError,
        revokeNewError,
      });
    }
    console.error("Failed to revoke an earlier nurse invitation.", revokePreviousError);
    return {
      errors: {
        _form:
          "No se pudo reemplazar la invitación anterior. Revisá las invitaciones pendientes en Clerk e intentá nuevamente.",
      },
    };
  }

  let usuarioId: string;
  try {
    const usuario = await prisma.user.create({
      data: {
        email,
        firstName: datos.firstName.trim(),
        lastName: datos.lastName.trim(),
        dni,
        phone: datos.phone.trim(),
        role: "ENFERMERA",
        isActive: true,
      },
      select: { id: true },
    });
    usuarioId = usuario.id;
  } catch (databaseError) {
    try {
      await clerk.invitations.revokeInvitation(invitation.id);
    } catch (revokeError) {
      console.error(
        "Failed to revoke the nurse invitation after Neon persistence failed.",
        { databaseError, revokeError },
      );
      return {
        errors: {
          _form:
            "No se pudo guardar la enfermera en Neon ni anular su invitación. Revisá ambos sistemas antes de volver a intentarlo.",
        },
      };
    }

    console.error(
      "Failed to persist nurse in Neon after creating a Clerk invitation.",
      databaseError,
    );
    return {
      errors: {
        _form:
          "No se pudo guardar la enfermera en Neon. La invitación fue anulada; intentá nuevamente.",
      },
    };
  }

  revalidatePath("/admin/enfermeras");
  redirect(
    `/admin/enfermeras/confirmacion?id=${encodeURIComponent(usuarioId)}`,
  );
}

/**
 * Soft delete de usuario (solo ADMINISTRADOR).
 *
 * Marca al usuario como inactivo (`active=false` en dominio, `isActive=false`
 * en DB) en lugar de borrar la fila. Recibe el `id` por `FormData` desde el
 * panel de detalle del listado; si el id no viene (o no es string), es no-op.
 *
 * Revalida las 3 páginas de listado que muestran usuarios (médicos,
 * enfermeras y pacientes) para que el cambio se refleje en todas.
 */
export async function eliminarUsuario(formData: FormData): Promise<void> {
  // Autorización real (las server actions son alcanzables por POST directo).
  await requireRole(["admin"]);

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return;
  }

  await getUserRepository().deactivate(id);

  revalidatePath("/admin/medicos");
  revalidatePath("/admin/enfermeras");
  revalidatePath("/pacientes");
}

type DarDeBajaMedicoState = {
  error?: string;
  ok?: boolean;
};

export async function darDeBajaMedico(
  _previousState: DarDeBajaMedicoState,
  formData: FormData,
): Promise<DarDeBajaMedicoState> {
  await requireRole(["admin"]);

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "No se identificó el médico." };
  }

  const prisma = getPrisma();
  const medico = await prisma.user.findUnique({
    where: { id },
    select: { role: true, isActive: true },
  });
  if (!medico || medico.role !== "MEDICO") {
    return { error: "No se encontró el médico." };
  }
  if (!medico.isActive) {
    return { error: "El médico ya está inactivo." };
  }

  await prisma.user.update({
    where: { id },
    data: { isActive: false },
  });

  revalidatePath("/admin/medicos");
  revalidatePath("/inicio");
  revalidatePath("/medico");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Coberturas Médicas (RF-05b) y Stock de Vacunas (RF-04a)
// ---------------------------------------------------------------------------

/**
 * Devuelve el id de la fila `User` autenticada si su rol está permitido; si
 * no, redirige (mismo criterio que `requireRole`, pero retorna el id para
 * usarlo como FK).
 */
async function idUsuarioActual(
  rolesPermitidos: readonly Role[],
): Promise<string> {
  const dbUser = await getCurrentDbUser();
  if (!dbUser || !dbUser.isActive) {
    redirect("/sign-in");
  }
  const role = normalizeRole(String(dbUser.role));
  if (!role || !rolesPermitidos.includes(role)) {
    redirect("/prototipos/pantalla_6_acceso_denegado");
  }
  return dbUser.id;
}

/**
 * US-20 — Agregar una cobertura a "Mis coberturas" (solo MEDICO).
 * Reutiliza el catálogo existente (case-insensitive) para no duplicar.
 */
export async function agregarCobertura(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const medicoId = await idUsuarioActual(["medico"]);
  const nombre = leerString(formData, "nombre");

  try {
    await agregarCoberturaAMedico(medicoId, nombre);
  } catch (err) {
    return err instanceof ApiError
      ? { errors: { _form: err.message }, values: { nombre } }
      : { errors: { _form: "Error inesperado" }, values: { nombre } };
  }

  revalidatePath("/coberturas");
  redirect("/coberturas");
}

/**
 * US-20 — Quitar una cobertura de "Mis coberturas" (solo MEDICO).
 * Borra solo el vínculo; los pacientes que ya la tienen la conservan.
 */
export async function quitarCobertura(formData: FormData): Promise<void> {
  const medicoId = await idUsuarioActual(["medico"]);
  const coberturaId = formData.get("coberturaId");
  if (typeof coberturaId !== "string" || !coberturaId) {
    return;
  }
  try {
    await quitarCoberturaDeMedico(medicoId, coberturaId);
  } catch {
    // no-op: se revalida y se muestra el estado actual.
  }
  revalidatePath("/coberturas");
}

/**
 * US-21 — Registrar la cobertura del paciente autenticado ("Mi cobertura").
 *
 * `coberturaId` vacío → "Particular" (sin nº de afiliado). Si elige una
 * cobertura, el nº de afiliado es obligatorio (lo valida el servicio). Cada
 * paciente tiene una sola cobertura; modificarla corresponde a RF-15.
 */
export async function registrarCoberturaPaciente(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const pacienteId = await idUsuarioActual(["paciente"]);
  const coberturaId = leerString(formData, "coberturaId");
  const numeroAfiliado = leerString(formData, "numeroAfiliado");
  const valores = { coberturaId, numeroAfiliado };

  try {
    await asignarCoberturaAPaciente(
      pacienteId,
      coberturaId || null,
      numeroAfiliado || undefined,
    );
  } catch (err) {
    if (err instanceof ApiError) {
      const campo =
        err.message === MSG_AFILIADO_OBLIGATORIO
          ? "numeroAfiliado"
          : err.message === MSG_COBERTURA_NO_DISPONIBLE ||
              err.message === MSG_COBERTURA_NO_ENCONTRADA
            ? "coberturaId"
            : "_form";
      return { errors: { [campo]: err.message }, values: valores };
    }
    return { errors: { _form: "Error inesperado" }, values: valores };
  }

  revalidatePath("/cobertura");
  redirect("/cobertura");
}

/** Mapea un `ApiError` de stock al campo del formulario que corresponde. */
function errorStock(err: unknown, valores: Record<string, string>): FormState {
  if (err instanceof ApiError) {
    const campo =
      err.message === MSG_CANTIDAD_INVALIDA ||
      err.message.startsWith(MSG_STOCK_INSUFICIENTE) ||
      err.message.startsWith(MSG_STOCK_MAXIMO)
        ? "cantidad"
        : err.message === MSG_MOTIVO_OBLIGATORIO ||
            err.message === MSG_MOTIVO_INVALIDO
          ? "motivo"
          : err.message === MSG_DETALLE_OBLIGATORIO
            ? "motivoDetalle"
            : "_form";
    return { errors: { [campo]: err.message }, values: valores };
  }
  return { errors: { _form: "Error inesperado" }, values: valores };
}

/** US-22 — Registrar ingreso de stock (solo ENFERMERA). */
export async function registrarIngresoStock(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const enfermeraId = await idUsuarioActual(["enfermera"]);
  const vacunaId = leerString(formData, "vacunaId");
  const cantidadTexto = leerString(formData, "cantidad");
  const cantidad = Number.parseInt(cantidadTexto, 10);
  const valores = { vacunaId, cantidad: cantidadTexto };

  try {
    await registrarIngreso(
      vacunaId,
      Number.isNaN(cantidad) ? NaN : cantidad,
      enfermeraId,
    );
  } catch (err) {
    return errorStock(err, valores);
  }

  revalidatePath("/stock");
  redirect("/stock?ok=ingreso");
}

/** US-23 — Registrar egreso/ajuste de stock (solo ENFERMERA). */
export async function registrarEgresoStock(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const enfermeraId = await idUsuarioActual(["enfermera"]);
  const vacunaId = leerString(formData, "vacunaId");
  const cantidadTexto = leerString(formData, "cantidad");
  const cantidad = Number.parseInt(cantidadTexto, 10);
  const motivo = leerString(formData, "motivo");
  const motivoDetalle = leerString(formData, "motivoDetalle");
  const valores = {
    vacunaId,
    cantidad: cantidadTexto,
    motivo,
    motivoDetalle,
  };

  try {
    await registrarEgreso(
      vacunaId,
      Number.isNaN(cantidad) ? NaN : cantidad,
      motivo,
      motivoDetalle,
      enfermeraId,
    );
  } catch (err) {
    return errorStock(err, valores);
  }

  revalidatePath("/stock");
  redirect("/stock?ok=egreso");
}

/**
 * US-18 (RF-17) — Dar de baja personal administrativo sin borrar sus datos.
 */
export async function darDeBajaPersonalAdministrativo(
  formData: FormData,
): Promise<void> {
  await requireRole(["admin"]);

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    throw new Error("No se recibió un administrativo válido para dar de baja.");
  }

  const repo = getUserRepository();
  const usuario = await repo.findById(id);
  if (!usuario || usuario.role !== "ADMINISTRATIVO") {
    throw new Error("El usuario seleccionado no es un administrativo válido.");
  }

  await repo.deactivate(id);

  revalidatePath("/admin/personal");
  redirect("/admin/personal");
}

/**
 * US-19 (RF-17) — Reactivar personal administrativo sin modificar sus datos.
 */
export async function reactivarPersonalAdministrativo(
  formData: FormData,
): Promise<void> {
  await requireRole(["admin"]);

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    throw new Error("No se recibió un administrativo válido para reactivar.");
  }

  const repo = getUserRepository();
  const usuario = await repo.findById(id);
  if (!usuario || usuario.role !== "ADMINISTRATIVO") {
    throw new Error("El usuario seleccionado no es un administrativo válido.");
  }

  await repo.activate(id);

  revalidatePath("/admin/personal");
  redirect("/admin/personal");
}

/** US-47 — Dar de baja un médico sin borrar sus datos ni su agenda. */
export async function darDeBajaMedico(formData: FormData): Promise<void> {
  await requireRole(["admin"]);

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    throw new Error("No se recibió un médico válido para dar de baja.");
  }

  const repo = getUserRepository();
  const usuario = await repo.findById(id);
  if (!usuario || usuario.role !== "MEDICO" || !usuario.active) {
    throw new Error("El médico seleccionado no está activo.");
  }

  await repo.deactivate(id);
  revalidatePath("/admin/medicos");
  redirect(`/admin/medicos?seleccionado=${encodeURIComponent(id)}`);
}

/** US-48 — Reactivar un médico sin modificar sus datos ni su agenda. */
export async function reactivarMedico(formData: FormData): Promise<void> {
  await requireRole(["admin"]);

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    throw new Error("No se recibió un médico válido para reactivar.");
  }

  const repo = getUserRepository();
  const usuario = await repo.findById(id);
  if (!usuario || usuario.role !== "MEDICO" || usuario.active) {
    throw new Error("El médico seleccionado no está dado de baja.");
  }

  await repo.activate(id);
  revalidatePath("/admin/medicos");
  redirect(`/admin/medicos?seleccionado=${encodeURIComponent(id)}`);
}

/** US-51 — Reactivar un paciente conservando su información. */
export async function reactivarPaciente(formData: FormData): Promise<void> {
  await requireRole(["admin"]);

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    throw new Error("No se recibió un paciente válido para reactivar.");
  }

  const repo = getUserRepository();
  const usuario = await repo.findById(id);
  if (!usuario || usuario.role !== "PACIENTE" || usuario.active) {
    throw new Error("El paciente seleccionado no está dado de baja.");
  }

  await repo.activate(id);
  revalidatePath("/pacientes");
  redirect(`/pacientes?reactivado=${encodeURIComponent(id)}`);
}

/** US-54 — Dar de baja una enfermera sin alterar los turnos ya reservados. */
export async function darDeBajaEnfermera(formData: FormData): Promise<void> {
  await requireRole(["admin"]);

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    throw new Error("No se recibió una enfermera válida para dar de baja.");
  }

  const repo = getUserRepository();
  const usuario = await repo.findById(id);
  if (!usuario || usuario.role !== "ENFERMERA" || !usuario.active) {
    throw new Error("La enfermera seleccionada no está activa.");
  }

  await repo.deactivate(id);
  revalidatePath("/admin/enfermeras");
  redirect("/admin/enfermeras");
}

/** US-55 — Reactivar una enfermera conservando sus datos. */
export async function reactivarEnfermera(formData: FormData): Promise<void> {
  await requireRole(["admin"]);

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    throw new Error("No se recibió una enfermera válida para reactivar.");
  }

  const repo = getUserRepository();
  const usuario = await repo.findById(id);
  if (!usuario || usuario.role !== "ENFERMERA" || usuario.active) {
    throw new Error("La enfermera seleccionada no está dada de baja.");
  }

  await repo.activate(id);
  revalidatePath("/admin/enfermeras");
  redirect("/admin/enfermeras");
}
