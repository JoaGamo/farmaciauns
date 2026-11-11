import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";

/**
 * Rutas de turnos del paciente (Sprint 3: US-29, US-30 y US-31) dentro del
 * mismo `AppShell` que el resto del sistema. El control de acceso lo hace cada
 * página y cada server action con `requirePaciente`.
 */
export default function TurnosLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
