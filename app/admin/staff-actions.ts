"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/authorization";
import {
  MSG_EMAIL_DUPLICADO,
  validarDatosEnfermera,
  validarDatosPersonalAdministrativo,
} from "@/lib/domain/usuario";
import type { FormState } from "@/lib/form-state";
import { getSignUpRedirectUrl } from "@/lib/clerk-urls";
import { getPrisma } from "@/lib/prisma";

type StaffRole = "ADMINISTRATIVO" | "ENFERMERA";
type ClerkClient = Awaited<ReturnType<typeof clerkClient>>;
type ClerkInvitation = Awaited<
  ReturnType<ClerkClient["invitations"]["createInvitation"]>
>;
type ClerkInvitationListItem = Awaited<
  ReturnType<ClerkClient["invitations"]["getInvitationList"]>
>["data"][number];

function readString(formData: FormData, name: string): string {
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
  const item = error.errors.find(
    (candidate): candidate is { code: string } =>
      typeof candidate === "object" &&
      candidate !== null &&
      "code" in candidate &&
      typeof candidate.code === "string",
  );
  return item?.code;
}

async function updateStaff(
  _previousState: FormState,
  formData: FormData,
  role: StaffRole,
  redirectOnSuccess = true,
): Promise<FormState> {
  await requireRole(["admin"]);
  const id = readString(formData, "id");
  const data = {
    firstName: readString(formData, "firstName"),
    lastName: readString(formData, "lastName"),
    email: readString(formData, "email").toLowerCase(),
    phone: readString(formData, "phone"),
  };
  const values = { ...data };
  if (!id) {
    return {
      errors: { _form: "No se identificó el usuario que querés modificar." },
      values,
    };
  }

  const prisma = getPrisma();
  const staff = await prisma.user.findUnique({ where: { id } });
  if (!staff || staff.role !== role) {
    return {
      errors: { _form: "No se encontró el usuario que querés modificar." },
      values,
    };
  }

  const validationData = {
    ...data,
    dni: staff.dni ?? "",
  };
  const errors =
    role === "ENFERMERA"
      ? validarDatosEnfermera(validationData)
      : validarDatosPersonalAdministrativo(validationData);
  delete errors.dni;
  if (Object.keys(errors).length > 0) {
    return { errors, values };
  }

  const emailDuplicado = await prisma.user.findFirst({
    where: {
      id: { not: id },
      email: { equals: data.email, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (emailDuplicado) {
    return { errors: { email: MSG_EMAIL_DUPLICADO }, values };
  }

  const original = {
    firstName: staff.firstName,
    lastName: staff.lastName,
    email: staff.email,
    phone: staff.phone,
  };
  const emailChanged = data.email !== staff.email.toLowerCase();
  let clerk: ClerkClient | undefined;
  let clerkUserId = staff.clerkId;
  let replacedEmail = false;
  let updatedClerkName = false;
  let replacementInvitation: ClerkInvitation | undefined;
  let previousInvitation: ClerkInvitationListItem | undefined;

  try {
    clerk = await clerkClient();
    if (!clerkUserId) {
      const users = await clerk.users.getUserList({
        emailAddress: [staff.email],
        limit: 10,
      });
      clerkUserId =
        users.data.find((user) =>
          user.emailAddresses.some(
            (address) =>
              address.emailAddress.toLowerCase() === staff.email.toLowerCase(),
          ),
        )?.id ?? null;
    }

    if (emailChanged) {
      const [users, invitations] = await Promise.all([
        clerk.users.getUserList({ emailAddress: [data.email], limit: 10 }),
        clerk.invitations.getInvitationList({
          query: data.email,
          status: "pending",
          limit: 100,
        }),
      ]);
      if (
        users.data.some((user) => user.id !== clerkUserId) ||
        invitations.data.some(
          (invitation) =>
            invitation.emailAddress.toLowerCase() === data.email,
        )
      ) {
        return { errors: { email: MSG_EMAIL_DUPLICADO }, values };
      }

      if (!clerkUserId) {
        const oldInvitations = await clerk.invitations.getInvitationList({
          query: staff.email,
          status: "pending",
          limit: 100,
        });
        previousInvitation = oldInvitations.data.find(
          (invitation) =>
            invitation.emailAddress.toLowerCase() ===
              staff.email.toLowerCase() &&
            invitation.publicMetadata?.role === role.toLowerCase() &&
            invitation.publicMetadata?.farmaciaunsStaffInvite === true,
        );
        if (previousInvitation) {
          replacementInvitation = await clerk.invitations.createInvitation({
            emailAddress: data.email,
            publicMetadata: {
              role: role.toLowerCase(),
              farmaciaunsStaffInvite: true,
            },
            redirectUrl: await getSignUpRedirectUrl(),
          });
        }
      } else {
        await clerk.users.replaceUserEmailAddress(clerkUserId, {
          emailAddress: data.email,
        });
        replacedEmail = true;
      }
    }

    if (clerkUserId) {
      await clerk.users.updateUser(clerkUserId, {
        firstName: data.firstName,
        lastName: data.lastName,
      });
      updatedClerkName = true;
    }
  } catch (error) {
    if (replacedEmail && clerkUserId) {
      try {
        await clerk?.users.replaceUserEmailAddress(clerkUserId, {
          emailAddress: staff.email,
        });
      } catch (rollbackError) {
        console.error("Failed to restore a staff email in Clerk.", {
          error,
          rollbackError,
        });
      }
    }
    if (replacementInvitation) {
      try {
        await clerk?.invitations.revokeInvitation(replacementInvitation.id);
      } catch (rollbackError) {
        console.error("Failed to revoke a replacement staff invitation.", {
          error,
          rollbackError,
        });
      }
    }
    console.error("Failed to synchronize staff details with Clerk.", error);
    const code = getClerkErrorCode(error);
    return {
      errors: {
        [code === "form_identifier_exists" ||
        code === "form_email_address_taken"
          ? "email"
          : "_form"]:
          code === "form_identifier_exists" ||
          code === "form_email_address_taken"
            ? MSG_EMAIL_DUPLICADO
            : "No se pudieron actualizar los datos de acceso. Intentá nuevamente.",
      },
      values,
    };
  }

  let updatedInDatabase = false;
  try {
    await prisma.user.update({
      where: { id },
      data,
    });
    updatedInDatabase = true;

    if (previousInvitation && replacementInvitation) {
      await clerk.invitations.revokeInvitation(previousInvitation.id);
    }
  } catch (error) {
    if (updatedInDatabase) {
      try {
        await prisma.user.update({ where: { id }, data: original });
      } catch (rollbackError) {
        console.error("Failed to restore staff data in the database.", {
          error,
          rollbackError,
        });
        return {
          errors: {
            _form:
              "Falló la actualización y no se pudieron restaurar los datos. Revisá Clerk y la base de datos.",
          },
          values,
        };
      }
    }
    if (updatedClerkName && clerkUserId) {
      try {
        await clerk.users.updateUser(clerkUserId, {
          firstName: original.firstName ?? undefined,
          lastName: original.lastName ?? undefined,
        });
      } catch (rollbackError) {
        console.error("Failed to restore a staff name in Clerk.", {
          error,
          rollbackError,
        });
      }
    }
    if (replacedEmail && clerkUserId) {
      try {
        await clerk.users.replaceUserEmailAddress(clerkUserId, {
          emailAddress: staff.email,
        });
      } catch (rollbackError) {
        console.error("Failed to restore a staff email in Clerk.", {
          error,
          rollbackError,
        });
      }
    }
    if (replacementInvitation) {
      try {
        await clerk.invitations.revokeInvitation(replacementInvitation.id);
      } catch (rollbackError) {
        console.error("Failed to revoke a replacement staff invitation.", {
          error,
          rollbackError,
        });
      }
    }
    if (
      getClerkErrorCode(error) === "form_identifier_exists" ||
      (typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002")
    ) {
      return { errors: { email: MSG_EMAIL_DUPLICADO }, values };
    }
    console.error("Failed to persist updated staff details.", error);
    return {
      errors: {
        _form: "No se pudieron guardar los cambios. Intentá nuevamente.",
      },
      values,
    };
  }

  const listPath =
    role === "ENFERMERA" ? "/admin/enfermeras" : "/admin/personal";
  revalidatePath(listPath);
  if (!redirectOnSuccess) {
    return {
      errors: {},
      values: data,
    };
  }
  redirect(listPath);
}

export async function actualizarPersonalAdministrativo(
  previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  return updateStaff(previousState, formData, "ADMINISTRATIVO");
}

export async function actualizarPersonalAdministrativoEnPanel(
  previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  return updateStaff(previousState, formData, "ADMINISTRATIVO", false);
}

export async function actualizarEnfermera(
  previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  return updateStaff(previousState, formData, "ENFERMERA");
}

export async function actualizarEnfermeraEnPanel(
  previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  return updateStaff(previousState, formData, "ENFERMERA", false);
}
