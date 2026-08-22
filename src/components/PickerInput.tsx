"use client";

import { useRef, type InputHTMLAttributes } from "react";
import { Icon } from "@/components/Icon";
import { input } from "@/components/ui";

type PickerInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  type: "date" | "time";
};

/** Native, accessible date/time control with an explicit picker button. */
export function PickerInput({ type, className = "", onClick, ...props }: PickerInputProps) {
  const ref = useRef<HTMLInputElement>(null);

  function openPicker() {
    const field = ref.current;
    if (!field) return;
    field.focus();
    try {
      field.showPicker?.();
    } catch {
      // Some browsers open the picker only from their native indicator.
    }
  }

  return (
    <div className="relative">
      <Icon
        name={type === "date" ? "calendar" : "clock"}
        size={18}
        className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-[#7bd0ff]"
      />
      <input
        ref={ref}
        type={type}
        className={`${input} picker-input cursor-pointer pl-11 pr-11 ${className}`}
        onClick={(event) => {
          onClick?.(event);
          openPicker();
        }}
        {...props}
      />
      <button
        type="button"
        onClick={openPicker}
        className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-[#a5aabc] transition hover:bg-white/8 hover:text-white"
        aria-label={`Open ${type} picker`}
        tabIndex={-1}
      >
        <Icon name={type === "date" ? "calendar" : "clock"} size={17} />
      </button>
    </div>
  );
}
