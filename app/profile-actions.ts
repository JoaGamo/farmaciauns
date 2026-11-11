"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApiError } from "@/lib/api";
import {
  actualizarDatosPaciente as guardarDatosPaciente,
} from "@/lib/cobertura-service";
import {
  MSG_AFILIADO_OBLIGATORIO,
  MSG_COBERTURA_NO_DISPONIBLE,
  MSG_COBERTURA_NO_ENCONTRADA,
} from "@/lib/domain/cobertura";
import {
  MSG_CAMPO_OBLIGATORIO,
  MSG_EMAIL_DUPLICADO,
  MSG_EMAIL_FORMATO,
  MSG_TELEFONO_FORMATO,
  MSG_TELEFONO_MIN,
  validarEmailFormato,
  validarTelefonoFormato,
  validarTelefonoLongitud,
} from "@/lib/domain/usuario";
import type { FormState } from "@/lib/form-state";
import { getCurrentDbUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authorization";

function readString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function clerkErrorCode(error: unknown): string | undefined {
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

export async function actualizarDatosPaciente(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole(["paciente"]);
  const paciente = await getCurrentDbUser();
  if (!paciente || paciente.role !== "PACIENTE") {
    return { errors: { _form: "No se encontró la cuenta del paciente." } };
  }

  const email = readString(formData, "email").toLowerCase();
  const phone = readString(formData, "phone");
  const coberturaId = readString(formData, "coberturaId");
  const numeroAfiliado = readString(formData, "numeroAfiliado");
  const values = { email, phone, coberturaId, numeroAfiliado };
  const errors: Record<string, string> = {};

  if (!email) {
    errors.email = MSG_CAMPO_OBLIGATORIO;
  } else if (!validarEmailFormato(email)) {
    errors.email = MSG_EMAIL_FORMATO;
  }
  if (!phone) {
    errors.phone = MSG_CAMPO_OBLIGATORIO;
  } else if (!validarTelefonoFormato(phone)) {
    errors.phone = MSG_TELEFONO_FORMATO;
  } else if (!validarTelefonoLongitud(phone)) {
    errors.phone = MSG_TELEFONO_MIN;
  }
  if (Object.keys(errors).length > 0) {
    return { errors, values };
  }

  const prisma = getPrisma();
  const emailDuplicado = await prisma.user.findFirst({
    where: {
      id: { not: paciente.id },
      email: { equals: email, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (emailDuplicado) {
    return { errors: { email: MSG_EMAIL_DUPLICADO }, values };
  }

  const emailChanged = email !== paciente.email.toLowerCase();
  let clerk:
    | Awaited<ReturnType<typeof clerkClient>>
    | undefined;
  if (emailChanged) {
    try {
      clerk = await clerkClient();
      const users = await clerk.users.getUserList({
        emailAddress: [email],
        limit: 10,
      });
      if (users.data.some((user) => user.id !== paciente.clerkId)) {
        return { errors: { email: MSG_EMAIL_DUPLICADO }, values };
      }
      if (!paciente.clerkId) {
        return {
          errors: {
            _form:
              "No se pudo vincular la cuenta de acceso para cambiar el email.",
          },
          values,
        };
      }
      await clerk.users.replaceUserEmailAddress(paciente.clerkId, {
        emailAddress: email,
      });
    } catch (error) {
      console.error("Failed to update the patient's email in Clerk.", error);
      const code = clerkErrorCode(error);
      return {
        errors: {
          [code === "form_identifier_exists" ||
          code === "form_email_address_taken"
            ? "email"
            : "_form"]:
            code === "form_identifier_exists" ||
            code === "form_email_address_taken"
              ? MSG_EMAIL_DUPLICADO
              : "No se pudo actualizar el email de acceso. Intentá nuevamente.",
        },
        values,
      };
    }
  }

  try {
    await guardarDatosPaciente(paciente.id, {
      email,
      phone,
      coberturaId: coberturaId || null,
      numeroAfiliado: numeroAfiliado || null,
    });
  } catch (error) {
    if (emailChanged && clerk && paciente.clerkId) {
      try {
        await clerk.users.replaceUserEmailAddress(paciente.clerkId, {
          emailAddress: paciente.email,
        });
      } catch (rollbackError) {
        console.error(
          "Failed to restore the patient's Clerk email after the database update failed.",
          { error, rollbackError },
        );
        return {
          errors: {
            _form:
              "No se pudieron guardar los cambios ni restaurar el email de acceso. Revisá Clerk y la base de datos.",
          },
          values,
        };
      }
    }

    if (error instanceof ApiError) {
      const field =
        error.message === MSG_AFILIADO_OBLIGATORIO
          ? "numeroAfiliado"
          : error.message === MSG_COBERTURA_NO_DISPONIBLE ||
              error.message === MSG_COBERTURA_NO_ENCONTRADA
            ? "coberturaId"
            : "_form";
      return { errors: { [field]: error.message }, values };
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return { errors: { email: MSG_EMAIL_DUPLICADO }, values };
    }

    console.error("Failed to save the patient's contact and coverage data.", error);
    return {
      errors: { _form: "No se pudieron guardar los cambios. Intentá nuevamente." },
      values,
    };
  }

  revalidatePath("/cobertura");
  revalidatePath("/inicio");
  redirect("/cobertura");
}
