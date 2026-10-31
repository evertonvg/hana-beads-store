"use client";

import { Radio, RadioGroup } from "@headlessui/react";
import { cn } from "@/lib/cn";
import { pillClass } from "./pill";

type Props<T extends string> = {
  /** Accessible name. Leave it out when a `<fieldset><legend>` already names the group. */
  label?: string;
  options: { value: T; label: string; note?: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Extra classes for the group (e.g. `flex-col` to stack the options). */
  className?: string;
  /** Extra classes for every option. */
  optionClassName?: string;
};

/** Pill-styled single choice on Headless UI RadioGroup (`role="radio"`, arrow keys). */
export function PillRadioGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
  optionClassName,
}: Props<T>) {
  return (
    <RadioGroup
      value={value}
      onChange={onChange}
      aria-label={label}
      className={cn("flex flex-wrap gap-2", className)}
    >
      {options.map((o) => (
        <Radio
          key={o.value}
          value={o.value}
          className={({ checked }) =>
            pillClass(checked, cn("flex-col items-start gap-1", optionClassName))
          }
        >
          <span>{o.label}</span>
          {o.note ? <span className="font-mono text-xs opacity-80">{o.note}</span> : null}
        </Radio>
      ))}
    </RadioGroup>
  );
}
