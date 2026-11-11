"use client";

import { useRouter } from "next/navigation";

/** Paso 1 de US-29: cambiar la especialidad recarga la lista de médicos. */
export function SelectorEspecialidad({
  especialidad,
  opciones,
}: {
  especialidad: string;
  opciones: { valor: string; etiqueta: string }[];
}) {
  const router = useRouter();

  return (
    <select
      id="especialidad"
      value={especialidad}
      onChange={(e) => router.push(`/turnos/reservar?especialidad=${e.target.value}`)}
      className="h-11 w-full rounded border-0 bg-surface-container-low px-3 text-sm font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
    >
      {opciones.map((o) => (
        <option key={o.valor} value={o.valor}>
          {o.etiqueta}
        </option>
      ))}
    </select>
  );
}
