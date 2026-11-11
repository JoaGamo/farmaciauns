"use client";

import { useState, type InputHTMLAttributes, type KeyboardEvent } from "react";

type FormInputType = "text" | "email" | "tel" | "password" | "date";

type FormInputProps = {
  label: string;
  name: string;
  type?: FormInputType;
  required?: boolean;
  minLength?: number;
  hint?: string;
  error?: string;
  placeholder?: string;
  autoComplete?: InputHTMLAttributes<HTMLInputElement>["autoComplete"];
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
  defaultValue?: string;
  pattern?: string;
  maxLength?: number;
  allowedCharacters?: RegExp;
  leadingIcon?: string;
  /** Si es true, bloquea el ingreso de letras y fuerza `inputMode="numeric"`. */
  numeric?: boolean;
};

/**
 * Input del nuevo sistema de diseño (tokens del tema).
 *
 * Regla de estructura del label:
 *  - Texto oscuro (`text-on-surface`, `text-sm font-medium`).
 *  - Asterisco rojo `*` (solo si `required`).
 *  - Texto de ayuda a la DERECHA del label (gris claro, `text-xs`, `ml-auto`).
 * El hint NO se repite debajo; debajo solo va el `error` (si lo hay).
 */
export function FormInput({
  label,
  name,
  type = "text",
  required,
  minLength,
  hint,
  error,
  placeholder,
  autoComplete,
  inputMode,
  defaultValue,
  pattern,
  maxLength,
  allowedCharacters,
  numeric,
  leadingIcon,
}: FormInputProps) {
  const [filteredValue, setFilteredValue] = useState(defaultValue ?? "");

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!numeric) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.length === 1 && /[a-zA-Z]/.test(event.key)) {
      event.preventDefault();
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={name}
        className="flex items-center gap-1 text-sm font-medium text-on-surface"
      >
        <span className="flex items-center gap-0.5">
          {label}
          {required && (
            <span aria-hidden="true" className="font-semibold text-error">
              *
            </span>
          )}
        </span>
        {hint && (
          <span className="ml-auto text-right text-xs font-normal text-on-surface-variant">
            {hint}
          </span>
        )}
      </label>
      <div className="relative">
        {leadingIcon && (
          <span
            aria-hidden="true"
            className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant"
          >
            {leadingIcon}
          </span>
        )}
        <input
          id={name}
          name={name}
          type={type}
          required={required}
          minLength={minLength}
          inputMode={numeric ? "numeric" : inputMode}
          autoComplete={autoComplete}
          placeholder={placeholder}
          defaultValue={allowedCharacters ? undefined : defaultValue}
          pattern={pattern}
          maxLength={maxLength}
          value={allowedCharacters ? filteredValue : undefined}
          onChange={
            allowedCharacters
              ? (event) => {
                  const characters = Array.from(event.target.value)
                    .filter((character) => allowedCharacters.test(character))
                    .slice(0, maxLength);
                  setFilteredValue(characters.join(""));
                }
              : undefined
          }
          aria-invalid={Boolean(error)}
          onKeyDown={handleKeyDown}
          className={`h-10 w-full rounded border-0 bg-surface-container-low text-sm text-on-surface placeholder:text-outline focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/40 ${
            leadingIcon ? "pl-11 pr-3" : "px-3"
          }`}
        />
      </div>
      {error && (
        <span role="alert" className="text-xs font-medium text-error">
          {error}
        </span>
      )}
    </div>
  );
}
