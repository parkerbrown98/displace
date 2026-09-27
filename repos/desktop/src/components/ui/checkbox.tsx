import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import type { CheckedState } from '@radix-ui/react-checkbox';
import type { ReactNode } from 'react';

export function Checkbox({
  checked,
  children,
  className,
  defaultChecked,
  disabled,
  name,
  onCheckedChange,
  value = 'true',
}: {
  checked?: boolean;
  children: ReactNode;
  className?: string;
  defaultChecked?: boolean;
  disabled?: boolean;
  name?: string;
  onCheckedChange?: (checked: boolean) => void;
  value?: string;
}) {
  return <label className={`checkbox-field${className ? ` ${className}` : ''}`}>
    <CheckboxPrimitive.Root
      checked={checked}
      className="checkbox-control"
      defaultChecked={defaultChecked}
      disabled={disabled}
      name={name}
      onCheckedChange={(next: CheckedState) => onCheckedChange?.(next === true)}
      value={value}
    >
      <CheckboxPrimitive.Indicator><Check aria-hidden="true" size={13} strokeWidth={3} /></CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
    <span>{children}</span>
  </label>;
}