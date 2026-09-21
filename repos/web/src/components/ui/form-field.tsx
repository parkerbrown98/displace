import type { InputHTMLAttributes } from "react";

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  hint?: string;
  label: string;
}

export function FormField({ error, hint, id, label, ...inputProps }: FormFieldProps) {
  const fieldId = id ?? inputProps.name;
  const descriptionId = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;

  return (
    <div className="form-field">
      <label htmlFor={fieldId}>{label}</label>
      <input
        {...inputProps}
        aria-describedby={descriptionId}
        aria-invalid={error ? true : undefined}
        id={fieldId}
      />
      {error ? (
        <small className="field-error" id={descriptionId}>{error}</small>
      ) : hint ? (
        <small id={descriptionId}>{hint}</small>
      ) : null}
    </div>
  );
}