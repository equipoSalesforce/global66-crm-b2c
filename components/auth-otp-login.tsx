"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type AuthResponse = {
  ok?: boolean;
  error?: string;
  expiresInMinutes?: number;
};

async function readAuthResponse(response: Response) {
  return await response.json().catch(() => ({})) as AuthResponse;
}

export function AuthOtpLogin({ nextPath = "/dashboard" }: { nextPath?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"EMAIL" | "CODE">("EMAIL");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function requestCode(event?: FormEvent) {
    event?.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/auth/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = await readAuthResponse(response);
      if (!response.ok) {
        setError(payload.error ?? "No pudimos enviar el código. Intenta nuevamente.");
        return;
      }
      setStep("CODE");
      setMessage(
        `Enviamos un código a ${email.trim().toLowerCase()}. Expira en ${
          payload.expiresInMinutes ?? 10
        } minutos.`,
      );
    } catch {
      setError("No pudimos enviar el código. Intenta nuevamente.");
    } finally {
      setIsLoading(false);
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const payload = await readAuthResponse(response);
      if (!response.ok) {
        setError(payload.error ?? "Código inválido o expirado.");
        return;
      }
      router.replace(nextPath);
      router.refresh();
    } catch {
      setError("No pudimos validar el código. Intenta nuevamente.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-md rounded-xl border border-gray-200 bg-white p-7 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--g66-brand-blue)] text-sm font-bold text-white">
          G66
        </div>
        <div>
          <p className="text-lg font-bold text-gray-950">Global66 CRM</p>
          <p className="text-xs text-gray-500">Acceso interno por código</p>
        </div>
      </div>

      <h1 className="mt-7 text-2xl font-semibold text-gray-950">
        {step === "EMAIL" ? "Ingresa tu correo" : "Ingresa el código"}
      </h1>
      <p className="mt-2 text-sm leading-6 text-gray-600">
        {step === "EMAIL"
          ? "Usa tu correo corporativo @global66.com."
          : "Revisa tu correo e ingresa el código de 6 dígitos."}
      </p>

      <form
        className="mt-6 grid gap-4"
        onSubmit={step === "EMAIL" ? requestCode : verifyCode}
      >
        <label className="grid gap-1.5 text-sm font-medium text-gray-700">
          Correo corporativo
          <input
            type="email"
            autoComplete="email"
            value={email}
            disabled={step === "CODE" || isLoading}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="nombre@global66.com"
            required
            className="h-11 rounded-lg border border-gray-300 px-3 text-sm outline-none transition focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)] disabled:bg-gray-50"
          />
        </label>

        {step === "CODE" ? (
          <label className="grid gap-1.5 text-sm font-medium text-gray-700">
            Código
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="000000"
              minLength={6}
              maxLength={6}
              required
              autoFocus
              className="h-12 rounded-lg border border-gray-300 px-3 text-center font-mono text-xl tracking-[0.35em] outline-none transition focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)]"
            />
          </label>
        ) : null}

        {message ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isLoading || (step === "CODE" && code.length !== 6)}
          className="h-11 rounded-lg bg-[var(--g66-brand-blue)] px-4 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading
            ? "Procesando..."
            : step === "EMAIL"
              ? "Enviar código"
              : "Ingresar al CRM"}
        </button>
      </form>

      {step === "CODE" ? (
        <div className="mt-4 flex items-center justify-between gap-3 text-sm">
          <button
            type="button"
            disabled={isLoading}
            onClick={() => {
              setStep("EMAIL");
              setCode("");
              setMessage(null);
              setError(null);
            }}
            className="font-medium text-gray-600 hover:text-gray-950"
          >
            Cambiar correo
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => void requestCode()}
            className="font-semibold text-[var(--g66-brand-blue)] hover:underline disabled:opacity-60"
          >
            Reenviar código
          </button>
        </div>
      ) : null}
    </section>
  );
}
