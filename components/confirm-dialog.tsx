"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Modal de confirmación (Sprint 3: US-31 "Cancelar turno" y US-41 "Registrar
 * ausencia"), según los wireframes: ícono, título con una etiqueta arriba,
 * contenido y botones. Usa el elemento nativo `<dialog>`, que ya resuelve el
 * foco, la tecla Esc y el fondo.
 */
export function ConfirmDialog({
  abierto,
  onCerrar,
  etiqueta,
  titulo,
  icono,
  children,
}: {
  abierto: boolean;
  onCerrar: () => void;
  /** Texto chico sobre el título, por ejemplo "Confirmación requerida". */
  etiqueta: string;
  titulo: string;
  icono: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (abierto && !dialogo.open) dialogo.showModal();
    if (!abierto && dialogo.open) dialogo.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      onClose={onCerrar}
      aria-labelledby="confirm-dialog-titulo"
      className="m-auto w-[min(36rem,calc(100vw-2rem))] rounded-xl bg-surface-container-lowest p-0 text-on-surface shadow-xl backdrop:bg-black/40 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex flex-col gap-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container"
            >
              {icono}
            </span>
            <div>
              <h2 id="confirm-dialog-titulo" className="text-lg font-semibold">
                {titulo}
              </h2>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                {etiqueta}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded p-1 text-on-surface-variant hover:bg-surface-container"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
