"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BriefcaseMedical,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  ClipboardList,
  FileHeart,
  IdCard,
  LayoutDashboard,
  Pill,
  ShieldCheck,
  Stethoscope,
  Syringe,
  UserPlus,
  UserSearch,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type NavItem = { href: string; label: string; icon: LucideIcon };

type SidebarRole = "ADMINISTRADOR" | "MEDICO" | "ENFERMERA" | "PACIENTE";

/**
 * Navegación del panel izquierdo, una lista por rol. Es la ÚNICA fuente de
 * verdad de los accesos: cada página sector (admin, pacientes, coberturas,
 * cobertura y stock) usa este mismo componente, así el panel nunca cambia de
 * forma al navegar.
 */
const NAV_BY_ROLE: Record<SidebarRole, NavItem[]> = {
  ADMINISTRADOR: [
    { href: "/inicio", label: "Inicio", icon: LayoutDashboard },
    { href: "/admin/medicos", label: "Listado de médicos", icon: Stethoscope },
    { href: "/admin/medicos/nuevo", label: "Alta de médico", icon: UserPlus },
    { href: "/admin/personal", label: "Listado de personal adm.", icon: IdCard },
    { href: "/admin/personal/nuevo", label: "Alta de personal adm.", icon: UserPlus },
    { href: "/admin/enfermeras", label: "Listado de enfermeras", icon: BriefcaseMedical },
    { href: "/admin/enfermeras/nuevo", label: "Alta de enfermeras", icon: UserPlus },
    { href: "/pacientes", label: "Búsqueda de pacientes", icon: UserSearch },
  ],
  MEDICO: [
    { href: "/inicio", label: "Inicio", icon: LayoutDashboard },
    { href: "/pacientes", label: "Búsqueda de pacientes", icon: UserSearch },
    { href: "/medico/agenda", label: "Mi agenda", icon: CalendarDays },
    { href: "/coberturas", label: "Mis coberturas", icon: ShieldCheck },
  ],
  ENFERMERA: [
    { href: "/inicio", label: "Inicio", icon: LayoutDashboard },
    { href: "/stock", label: "Stock de vacunas", icon: Syringe },
    { href: "/dosis", label: "Administración de dosis", icon: Pill },
    { href: "/triage", label: "Registro de triage", icon: ClipboardList },
  ],
  PACIENTE: [
    { href: "/inicio", label: "Inicio", icon: LayoutDashboard },
    { href: "/turnos/reservar", label: "Reservar turno", icon: CalendarPlus },
    { href: "/turnos", label: "Mis turnos", icon: CalendarCheck },
    { href: "/historia-clinica", label: "Mi historia clínica", icon: FileHeart },
    { href: "/cobertura", label: "Mis datos", icon: ShieldCheck },
  ],
};

function resolveRole(role: string | null | undefined): SidebarRole {
  if (role === "MEDICO") return "MEDICO";
  if (role === "ENFERMERA") return "ENFERMERA";
  if (role === "PACIENTE") return "PACIENTE";
  // ADMINISTRADOR y ADMINISTRATIVO comparten el panel de gestión.
  return "ADMINISTRADOR";
}

/**
 * Sidebar del módulo, con el MISMO estilo visual en toda la app: ítem activo
 * en píldora navy `#141b2b`, links inactivos en `on-surface` con hover suave.
 * Recibe el rol del usuario autenticado y muestra SOLO sus accesos.
 */
export function SidebarNav({ role }: { role?: string | null }) {
  const pathname = usePathname();
  const resolved = resolveRole(role);
  const items = NAV_BY_ROLE[resolved];

  // El "Inicio" del administrador es su panel (/admin); el resto vuelve a /inicio.
  const homeHref = resolved === "ADMINISTRADOR" ? "/admin" : "/inicio";

  const activeItem = items
    .filter(
      (item) =>
        pathname === (item.href === "/inicio" ? homeHref : item.href) ||
        (item.href !== "/inicio" &&
          item.href !== "/admin/medicos" &&
          pathname.startsWith(`${item.href}/`)),
    )
    .sort((a, b) => b.href.length - a.href.length)[0];

  return (
    <nav aria-label="Navegación principal" className="flex flex-col gap-1">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeItem?.href === item.href;
        return (
          <Link
            key={item.href}
            href={item.href === "/inicio" ? homeHref : item.href}
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors max-[760px]:w-11 max-[760px]:justify-center max-[760px]:overflow-hidden ${
              isActive
                ? "bg-[#141b2b] text-white"
                : "text-on-surface hover:bg-surface-container-low"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="max-[760px]:hidden">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
