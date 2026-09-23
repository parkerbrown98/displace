"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

const EMPTY_VALUE = "__displace_empty_select_value__";

export interface SelectOption {
  description?: string;
  disabled?: boolean;
  icon?: ReactNode;
  label: string;
  value: string;
}

interface SelectProps {
  "aria-label"?: string;
  className?: string;
  defaultValue?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  onValueChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  required?: boolean;
  value?: string;
}

export function Select({
  "aria-label": ariaLabel,
  className,
  defaultValue,
  disabled,
  id,
  name,
  onValueChange,
  options,
  placeholder = "Select an option",
  required,
  value,
}: SelectProps) {
  const fallbackValue = defaultValue ?? options.find((option) => !option.disabled)?.value ?? "";
  const [invalid, setInvalid] = useState(false);
  const [uncontrolledValue, setUncontrolledValue] = useState(fallbackValue);
  const selectedValue = value ?? uncontrolledValue;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return;
    const reset = () => {
      setInvalid(false);
      if (value === undefined) setUncontrolledValue(fallbackValue);
    };
    const validate = (event: SubmitEvent) => {
      if (!required || selectedValue) return;
      event.preventDefault();
      setInvalid(true);
      triggerRef.current?.focus();
    };
    form.addEventListener("reset", reset);
    form.addEventListener("submit", validate);
    return () => {
      form.removeEventListener("reset", reset);
      form.removeEventListener("submit", validate);
    };
  }, [fallbackValue, required, selectedValue, value]);

  function changeValue(nextValue: string) {
    const actualValue = fromPrimitiveValue(nextValue);
    setInvalid(false);
    if (value === undefined) setUncontrolledValue(actualValue);
    onValueChange?.(actualValue);
  }

  return (
    <div className={`select-root${className ? ` ${className}` : ""}`} ref={rootRef}>
      <SelectPrimitive.Root
        disabled={disabled}
        onValueChange={changeValue}
        required={required}
        value={toPrimitiveValue(selectedValue)}
      >
        <SelectPrimitive.Trigger aria-invalid={invalid || undefined} aria-label={ariaLabel} className="select-trigger" id={id} ref={triggerRef}>
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon className="select-trigger-icon"><ChevronDown aria-hidden="true" size={16} /></SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content className="select-content" position="popper" sideOffset={6}>
            <SelectPrimitive.ScrollUpButton className="select-scroll-button"><ChevronUp aria-hidden="true" size={16} /></SelectPrimitive.ScrollUpButton>
            <SelectPrimitive.Viewport className="select-viewport">
              {options.map((option) => (
                <SelectPrimitive.Item
                  className="select-item"
                  disabled={option.disabled}
                  key={option.value || EMPTY_VALUE}
                  value={toPrimitiveValue(option.value)}
                >
                  <SelectPrimitive.ItemIndicator className="select-item-indicator"><Check aria-hidden="true" size={15} /></SelectPrimitive.ItemIndicator>
                  {option.icon ? <span className="select-item-icon" aria-hidden="true">{option.icon}</span> : null}
                  <span className="select-item-copy">
                    <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                    {option.description ? <small>{option.description}</small> : null}
                  </span>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
            <SelectPrimitive.ScrollDownButton className="select-scroll-button"><ChevronDown aria-hidden="true" size={16} /></SelectPrimitive.ScrollDownButton>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
      {name ? <input name={name} type="hidden" value={selectedValue} /> : null}
    </div>
  );
}

function toPrimitiveValue(value: string) {
  return value === "" ? EMPTY_VALUE : value;
}

function fromPrimitiveValue(value: string) {
  return value === EMPTY_VALUE ? "" : value;
}