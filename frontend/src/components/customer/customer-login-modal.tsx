"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, KeyRound, Loader2, X } from "lucide-react";
import { formatCpf, formatPhone, setCustomerToken } from "@/lib/customer-auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

type CustomerLoginModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess?: (token: string, count: number) => void;
};

export function CustomerLoginModal({ open, onClose, onSuccess }: CustomerLoginModalProps) {
  const router = useRouter();
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API}/me/auth/lookup/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf, phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Não foi possível localizar sua reserva.");
      }

      setCustomerToken(data.token);
      if (onSuccess) {
        onSuccess(data.token, data.reservations_count);
      } else {
        onClose();
        router.push("/minha-reserva");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao buscar reserva.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-ink-100"
      >
        <button
          onClick={onClose}
          type="button"
          aria-label="Fechar"
          className="absolute right-4 top-4 rounded-full p-2 text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition-colors"
        >
          <X className="size-5" />
        </button>

        <div className="flex items-center gap-3 mb-2">
          <div className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <KeyRound className="size-6" />
          </div>
          <div>
            <h2 id="login-modal-title" className="text-xl font-black text-ink-900">
              Acessar Minha Reserva
            </h2>
            <p className="text-xs text-ink-500 font-medium">
              Expedição Piraíba — Área do Pescador
            </p>
          </div>
        </div>

        <p className="text-sm text-ink-600 mt-3 mb-5 leading-relaxed">
          Informe seu CPF e WhatsApp cadastrados para acessar suas expedições, preencher sua ficha de embarque e escolher bebidas.
        </p>

        {error && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800">
            <AlertCircle className="size-4 shrink-0 mt-0.5 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1">
              CPF do Titular da Reserva
            </label>
            <input
              type="text"
              required
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => setCpf(formatCpf(e.target.value))}
              className="w-full rounded-xl border border-ink-200 px-4 py-3 text-sm font-semibold text-ink-900 placeholder:text-ink-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1">
              WhatsApp / Telefone Cadastrado
            </label>
            <input
              type="text"
              required
              placeholder="(00) 00000-0000"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              className="w-full rounded-xl border border-ink-200 px-4 py-3 text-sm font-semibold text-ink-900 placeholder:text-ink-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading || cpf.length < 14 || phone.length < 14}
            className="w-full mt-2 inline-flex min-h-12 items-center justify-center rounded-xl bg-brand-600 px-5 py-3 text-sm font-black text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Localizando reserva...
              </span>
            ) : (
              "Acessar Expedição"
            )}
          </button>
        </form>

        <div className="mt-5 border-t border-ink-100 pt-4 text-center">
          <p className="text-xs text-ink-400">
            Dúvidas ou dificuldades de acesso?{" "}
            <a
              href="https://wa.me/5562981612128?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20para%20acessar%20minha%20reserva"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-brand-700 hover:underline"
            >
              Falar no WhatsApp
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
