/** Emails de la aplicación; los flujos heredados de restablecimiento y bienvenida siguen siendo stubs. */

interface AppointmentReminderEmail {
  email: string;
  nombre: string;
  fechaHora: Date;
  tipo: "CONSULTA" | "VACUNACION";
}

export async function sendAppointmentReminderEmail({
  email,
  nombre,
  fechaHora,
  tipo,
}: AppointmentReminderEmail): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    throw new Error("RESEND_API_KEY and EMAIL_FROM must be set to send appointment reminders.");
  }

  const fechaFormateada = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(fechaHora);
  const descripcion = tipo === "CONSULTA" ? "consulta médica" : "vacunación";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Recordatorio de tu turno - Farmacia UNS",
      text: [
        `Hola ${nombre || "paciente"},`,
        "",
        `Te recordamos que tenés un turno de ${descripcion} el ${fechaFormateada}.`,
        "",
        "Te esperamos. Si necesitás gestionar tu turno, ingresá a Farmacia UNS.",
      ].join("\n"),
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Resend returned HTTP ${response.status} while sending an appointment reminder.`);
  }
}

export async function sendPasswordResetEmail(email: string): Promise<void> {
  // STUB: sin proveedor de email. Solo se registra la intención en consola.
  console.log(
    `[STUB email] Enviar link de cambio de contraseña a: ${email}`,
  );
}

/**
 * Email de bienvenida (US-04). Semántica distinta a `sendPasswordResetEmail`:
 * acá se da la bienvenida al nuevo médico con sus credenciales iniciales.
 */
export async function sendWelcomeEmail(
  email: string,
  nombre: string,
): Promise<void> {
  // STUB: sin proveedor de email. Solo se registra la intención en consola.
  console.log(
    `[STUB email] Enviar email de bienvenida a ${nombre} <${email}>`,
  );
}
