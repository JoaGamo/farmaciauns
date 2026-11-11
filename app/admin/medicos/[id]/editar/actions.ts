"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/authorization";
import {
  ESPECIALIDADES,
  MSG_APELLIDO_FORMATO,
  MSG_CAMPO_OBLIGATORIO,
  MSG_EMAIL_DUPLICADO,
  MSG_MATRICULA_FORMATO,
  MSG_NOMBRE_FORMATO,
  MSG_TELEFONO_FORMATO,
  MSG_TELEFONO_MIN,
  validarEmailFormato,
  validarMatriculaFormato,
  validarNombreFormato,
  validarTelefonoFormato,
  validarTelefonoLongitud,
} from "@/lib/domain/usuario";
import { getSignUpRedirectUrl } from "@/lib/clerk-urls";
import type { FormState } from "@/lib/form-state";
import { getPrisma } from "@/lib/prisma";

function readString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function getClerkErrorCode(error: unknown): string | undefined {
  if (
    typeof error !== "object" ||
    error === null ||
    !("errors" in error) ||
    !Array.isArray(error.errors)
  ) {
    return undefined;
  }

  const firstError = error.errors[0];
  return typeof firstError === "object" &&
    firstError !== null &&
    "code" in firstError &&
    typeof firstError.code === "string"
    ? firstError.code
    : undefined;
}

export async function actualizarMedico(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole(["admin"]);

  const id = readString(formData, "id");
  const datos = {
    firstName: readString(formData, "firstName"),
    lastName: readString(formData, "lastName"),
    matricula: readString(formData, "matricula"),
    especialidad: readString(formData, "especialidad"),
    email: readString(formData, "email").toLowerCase(),
    phone: readString(formData, "phone"),
  };
  const errors: Record<string, string> = {};

  if (!id) {
    return {
      errors: { _form: "No se identificó el médico que querés modificar." },
    };
  }
  for (const field of [
    "firstName",
    "lastName",
    "matricula",
    "especialidad",
    "email",
    "phone",
  ] as const) {
    if (!datos[field]) errors[field] = MSG_CAMPO_OBLIGATORIO;
  }
  if (datos.email && !validarEmailFormato(datos.email)) {
    errors.email = "El email no tiene un formato válido";
  }
  if (datos.matricula && !validarMatriculaFormato(datos.matricula)) {
    errors.matricula = MSG_MATRICULA_FORMATO;
  }
  if (datos.phone && !validarTelefonoFormato(datos.phone)) {
    errors.phone = MSG_TELEFONO_FORMATO;
  } else if (datos.phone && !validarTelefonoLongitud(datos.phone)) {
    errors.phone = MSG_TELEFONO_MIN;
  }
  if (datos.firstName && !validarNombreFormato(datos.firstName)) {
    errors.firstName = MSG_NOMBRE_FORMATO;
  }
  if (datos.lastName && !validarNombreFormato(datos.lastName)) {
    errors.lastName = MSG_APELLIDO_FORMATO;
  }
  if (
    datos.especialidad &&
    !(ESPECIALIDADES as readonly string[]).includes(datos.especialidad)
  ) {
    errors.especialidad = "Seleccioná una especialidad válida";
  }
  if (Object.keys(errors).length) {
    return { errors, values: datos };
  }

  const prisma = getPrisma();
  const medico = await prisma.user.findUnique({ where: { id } });
  if (!medico || medico.role !== "MEDICO") {
    return {
      errors: { _form: "No se encontró el médico que querés modificar." },
      values: datos,
    };
  }

  const [emailDuplicado, matriculaDuplicada] = await Promise.all([
    prisma.user.findFirst({
      where: {
        id: { not: id },
        email: { equals: datos.email, mode: "insensitive" },
      },
      select: { id: true },
    }),
    prisma.user.findFirst({
      where: { id: { not: id }, matricula: datos.matricula },
      select: { id: true },
    }),
  ]);
  if (emailDuplicado) {
    return { errors: { email: MSG_EMAIL_DUPLICADO }, values: datos };
  }
  if (matriculaDuplicada) {
    return {
      errors: { matricula: "La matrícula ya está registrada" },
      values: datos,
    };
  }

  let clerk;
  try {
    clerk = await clerkClient();
  } catch (error) {
    console.error("Could not initialize Clerk while updating a doctor.", error);
    return {
      errors: { _form: "No se pudo conectar con Clerk. Intentá nuevamente." },
      values: datos,
    };
  }

  let clerkUserId = medico.clerkId;
  if (!clerkUserId) {
    try {
      const users = await clerk.users.getUserList({
        emailAddress: [medico.email],
        limit: 10,
      });
      clerkUserId =
        users.data.find((user) =>
          user.emailAddresses.some(
            (address) =>
              address.emailAddress.toLowerCase() === medico.email.toLowerCase(),
          ),
        )?.id ?? null;
    } catch (error) {
      console.error("Failed to locate a doctor's Clerk account.", error);
      return {
        errors: {
          _form: "No se pudo verificar la cuenta del médico en Clerk.",
        },
        values: datos,
      };
    }
  }

  let replacementInvitation:
    | Awaited<ReturnType<typeof clerk.invitations.createInvitation>>
    | undefined;
  let previousInvitation:
    | Awaited<ReturnType<typeof clerk.invitations.getInvitationList>>["data"][number]
    | undefined;
  const emailChanged = datos.email !== medico.email.toLowerCase();

  if (emailChanged) {
    try {
      const existingUsers = await clerk.users.getUserList({
        emailAddress: [datos.email],
        limit: 10,
      });
      if (existingUsers.data.some((user) => user.id !== clerkUserId)) {
        return { errors: { email: MSG_EMAIL_DUPLICADO }, values: datos };
      }

      const existingInvitations = await clerk.invitations.getInvitationList({
        query: datos.email,
        status: "pending",
        limit: 100,
      });
      if (
        existingInvitations.data.some(
          (invitation) =>
            invitation.emailAddress.toLowerCase() === datos.email &&
            invitation.publicMetadata?.role === "medico",
        )
      ) {
        return { errors: { email: MSG_EMAIL_DUPLICADO }, values: datos };
      }
    } catch (error) {
      console.error("Failed to check the new doctor email in Clerk.", error);
      return {
        errors: {
          _form: "No se pudo verificar el nuevo email en Clerk.",
        },
        values: datos,
      };
    }

    if (clerkUserId) {
      try {
        await clerk.users.replaceUserEmailAddress(clerkUserId, {
          emailAddress: datos.email,
        });
      } catch (error) {
        console.error("Failed to update a doctor's email in Clerk.", error);
        const code = getClerkErrorCode(error);
        return {
          errors: {
            email:
              code === "form_identifier_exists" ||
              code === "form_email_address_taken"
                ? MSG_EMAIL_DUPLICADO
                : "No se pudo actualizar el email en Clerk. Verificá el dato e intentá nuevamente.",
          },
          values: datos,
        };
      }
    } else {
      try {
        const invitations = await clerk.invitations.getInvitationList({
          query: medico.email,
          status: "pending",
          limit: 100,
        });
        previousInvitation = invitations.data.find(
          (invitation) =>
            invitation.emailAddress.toLowerCase() ===
              medico.email.toLowerCase() &&
            invitation.publicMetadata?.role === "medico",
        );
        replacementInvitation = await clerk.invitations.createInvitation({
          emailAddress: datos.email,
          redirectUrl: await getSignUpRedirectUrl(),
          publicMetadata: {
            role: "medico",
            farmaciaunsStaffInvite: true,
            dni: medico.dni ?? "",
            especialidad: datos.especialidad,
          },
        });
      } catch (error) {
        console.error(
          "Failed to update the pending doctor invitation.",
          error,
        );
        const code = getClerkErrorCode(error);
        return {
          errors: {
            email:
              code === "form_identifier_exists" ||
              code === "form_email_address_taken"
                ? MSG_EMAIL_DUPLICADO
                : "No se pudo actualizar la invitación en Clerk. Intentá nuevamente.",
          },
          values: datos,
        };
      }
    }
  }

  const doctorData = {
    firstName: datos.firstName,
    lastName: datos.lastName,
    matricula: datos.matricula,
    especialidad: toEspecialidadEnum(datos.especialidad),
    email: datos.email,
    phone: datos.phone,
  };

  try {
    if (clerkUserId) {
      await clerk.users.updateUser(clerkUserId, {
        firstName: datos.firstName,
        lastName: datos.lastName,
      });
    }
    await prisma.user.update({ where: { id }, data: doctorData });
  } catch (error) {
    console.error("Failed to persist updated doctor details.", error);
    if (replacementInvitation) {
      try {
        await clerk.invitations.revokeInvitation(replacementInvitation.id);
      } catch (rollbackError) {
        console.error(
          "Failed to revoke a replacement doctor invitation.",
          rollbackError,
        );
      }
    }
    if (clerkUserId) {
      try {
        await clerk.users.updateUser(clerkUserId, {
          firstName: medico.firstName ?? undefined,
          lastName: medico.lastName ?? undefined,
        });
        if (emailChanged) {
          await clerk.users.replaceUserEmailAddress(clerkUserId, {
            emailAddress: medico.email,
          });
        }
      } catch (rollbackError) {
        console.error(
          "Failed to restore a doctor's Clerk account after an update error.",
          rollbackError,
        );
        return {
          errors: {
            _form:
              "Falló la actualización y no se pudieron restaurar los datos de Clerk. Revisá ambos sistemas antes de continuar.",
          },
          values: datos,
        };
      }
    }
    return {
      errors: { _form: "No se pudieron guardar los cambios. Intentá nuevamente." },
      values: datos,
    };
  }

  if (previousInvitation) {
    try {
      await clerk.invitations.revokeInvitation(previousInvitation.id);
    } catch (error) {
      console.error("Failed to revoke the old doctor invitation.", error);
      try {
        await prisma.user.update({
          where: { id },
          data: {
            firstName: medico.firstName,
            lastName: medico.lastName,
            matricula: medico.matricula,
            especialidad: medico.especialidad,
            email: medico.email,
            phone: medico.phone,
          },
        });
        if (replacementInvitation) {
          await clerk.invitations.revokeInvitation(replacementInvitation.id);
        }
      } catch (rollbackError) {
        console.error(
          "Failed to restore doctor data after invitation update error.",
          rollbackError,
        );
        return {
          errors: {
            _form:
              "No se pudo anular la invitación anterior ni revertir por completo los cambios. Revisá Clerk y Neon.",
          },
          values: datos,
        };
      }
      return {
        errors: {
          _form:
            "No se pudo actualizar la invitación anterior. No se guardaron los cambios.",
        },
        values: datos,
      };
    }
  }

  revalidatePath("/admin/medicos");
  redirect(`/admin/medicos?seleccionado=${encodeURIComponent(id)}`);
}

function toEspecialidadEnum(value: string) {
  switch (value) {
    case "Clínica médica":
      return "CLINICA_MEDICA" as const;
    case "Pediatría":
      return "PEDIATRIA" as const;
    case "Traumatología":
      return "TRAUMATOLOGIA" as const;
    default:
      throw new Error("Unexpected doctor specialty after validation.");
  }
}
