import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";

/** "Mi historia clínica" del paciente (US-42) dentro del `AppShell` común. */
export default function HistoriaClinicaLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
