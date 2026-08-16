"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

export type PasswordStrength = "empty" | "weak" | "medium" | "strong";

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return "empty";
  if (password.length < 8) return "weak";
  let score = 0;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  if (score >= 4) return "strong";
  if (score >= 2) return "medium";
  return "weak";
}

const STRENGTH_LABEL: Record<Exclude<PasswordStrength, "empty">, string> = {
  weak: "Weak",
  medium: "Medium",
  strong: "Strong",
};

const STRENGTH_BAR: Record<Exclude<PasswordStrength, "empty">, string> = {
  weak: "w-1/3 bg-red-400",
  medium: "w-2/3 bg-amber-400",
  strong: "w-full bg-emerald-400",
};

export function PasswordInput({
  id,
  label,
  value,
  onChange,
  autoComplete,
  error,
  showStrength,
  placeholder = "••••••••",
}: {
  id: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  error?: string;
  showStrength?: boolean;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);
  const strength = getPasswordStrength(value);

  return (
    <div>
      {label ? (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-white/60 mb-1.5"
        >
          {label}
        </label>
      ) : null}
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" />
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required
          minLength={8}
          className="w-full pl-10 pr-11 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/35 text-sm outline-none focus:border-white/25 focus:bg-white/10 transition"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? (
            <EyeOff className="w-4 h-4" />
          ) : (
            <Eye className="w-4 h-4" />
          )}
        </button>
      </div>
      {error ? (
        <p className="mt-1.5 text-xs text-red-400">{error}</p>
      ) : null}
      {showStrength && strength !== "empty" ? (
        <div className="mt-2">
          <div className="h-1 rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${STRENGTH_BAR[strength]}`}
            />
          </div>
          <p className="mt-1 text-[11px] text-white/40">
            {STRENGTH_LABEL[strength]}
          </p>
        </div>
      ) : null}
    </div>
  );
}
