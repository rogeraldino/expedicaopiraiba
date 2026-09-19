"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  ExternalLink,
  Fish,
  LogOut,
  MapPin,
  Users,
  WalletCards,
  AlertCircle,
} from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { getCustomerToken, clearCustomerToken, formatCpf, formatPhone, setCustomerToken } from "@/lib/customer-auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

type ReservationItem = {
  id: string;
  reference: string;
  status: string;
  participant_count: number;
  completed_participants_count: number;
  total_price_cents: number;
  paid_amount_cents: number;
  remaining_balance_cents: number;
  balance_due_at: string | null;
  expedition: {
    name: string;
    slug: string;
    destination: string;
    starts_at: string;
    ends_at: string;
    duration_days: number;
    departure_location?: string;
    cover_image_url?: string;
  };
  journey_url: string;
};

const money = (v: number) =>
  (v / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const date = (v: string) =>
  new Date(`${v}T12:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export default function MinhaReservaPage() {
  const [token, setToken] = useState<string>("");
  const [reservations, setReservations] = useState<ReservationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Login form state (if not authenticated)
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const loadReservations = useCallback(async (authToken: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/me/reservations/`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) {
        if (res.status === 401) {
          clearCustomerToken();
          setToken("");
          return;
        }
        throw new Error("Erro ao carregar expedições.");
      }
      const data = await res.json();
      setReservations(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha na comunicação com o servidor.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const current = getCustomerToken();
    setToken(current);
    if (current) {
      loadReservations(current);
    } else {
      setLoading(false);
    }
  }, [loadReservations]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      const res = await fetch(`${API}/me/auth/lookup/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf, phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Reserva não encontrada.");
      }
      setCustomerToken(data.token);
      setToken(data.token);
      loadReservations(data.token);
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : "Erro ao buscar reserva.");
    } finally {
      setLoginLoading(false);
    }
  }

  function handleLogout() {
    clearCustomerToken();
    setToken("");
    setReservations([]);
  }

  return (
    <main className="min-h-screen bg-sand-50 flex flex-col justify-between">
      <SiteHeader />

      <div className="container-page py-10 flex-1">
        {!token ? (
          <div className="max-w-lg mx-auto bg-white rounded-3xl p-8 shadow-xl border border-ink-100">
            <div className="text-center mb-6">
              <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 mb-3">
                <Fish className="size-8" />
              </span>
              <h1 className="text-2xl font-black text-ink-900">Área do Pescador</h1>
              <p className="text-sm text-ink-500 mt-1">
                Acesse suas reservas, preencha sua ficha de embarque e acompanhe sua pescaria.
              </p>
            </div>

            {loginError && (
              <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800">
                <AlertCircle className="size-4 shrink-0 mt-0.5 text-red-600" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1">
                  CPF do Titular
                </label>
                <input
                  type="text"
                  required
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  className="w-full rounded-xl border border-ink-200 px-4 py-3 text-sm font-semibold text-ink-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
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
                  className="w-full rounded-xl border border-ink-200 px-4 py-3 text-sm font-semibold text-ink-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
                />
              </div>

              <button
                type="submit"
                disabled={loginLoading || cpf.length < 14 || phone.length < 14}
                className="w-full mt-2 inline-flex min-h-12 items-center justify-center rounded-xl bg-brand-600 px-5 py-3 text-sm font-black text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {loginLoading ? "Consultando reservas..." : "Acessar Minhas Reservas"}
              </button>
            </form>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
              <div>
                <h1 className="text-3xl font-black text-ink-900">Minhas Expedições</h1>
                <p className="text-sm text-ink-500 mt-1">
                  Selecione sua pescaria para gerenciar participantes, bebidas e checklist de viagem.
                </p>
              </div>
              <button
                onClick={handleLogout}
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-xs font-bold text-ink-700 hover:bg-ink-50 transition-colors shadow-sm"
              >
                <LogOut className="size-4 text-ink-500" />
                <span>Trocar de Conta</span>
              </button>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-ink-100 bg-white p-12 text-center text-ink-500 font-medium">
                Carregando suas viagens...
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-800">
                <p className="font-bold">{error}</p>
                <button
                  onClick={() => loadReservations(token)}
                  className="mt-3 text-xs font-bold underline text-red-900"
                >
                  Tentar novamente
                </button>
              </div>
            ) : reservations.length === 0 ? (
              <div className="rounded-3xl border border-ink-100 bg-white p-12 text-center">
                <Fish className="size-12 mx-auto text-ink-300 mb-3" />
                <h2 className="text-lg font-bold text-ink-900">Nenhuma reserva ativa encontrada</h2>
                <p className="text-sm text-ink-500 mt-1 max-w-md mx-auto">
                  Você ainda não possui viagens associadas a este cadastro ou o status de sua reserva expirou.
                </p>
                <Link
                  href="/#expedicoes"
                  className="mt-6 inline-flex rounded-xl bg-brand-600 px-6 py-3 text-sm font-bold text-white hover:bg-brand-700 transition-colors"
                >
                  Conhecer Expedições 2026
                </Link>
              </div>
            ) : (
              <div className="grid gap-6">
                {reservations.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-3xl border border-ink-100 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row"
                  >
                    {r.expedition.cover_image_url && (
                      <div className="relative md:w-72 h-48 md:h-auto shrink-0 bg-ink-100">
                        <Image
                          src={r.expedition.cover_image_url}
                          alt={r.expedition.name}
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      </div>
                    )}
                    <div className="p-6 md:p-8 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <span className="text-xs font-black tracking-wider uppercase text-brand-700 bg-brand-50 px-2.5 py-1 rounded-md">
                            {r.reference}
                          </span>
                          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {r.status === "CONFIRMED"
                              ? "Confirmada"
                              : r.status === "HELD"
                              ? "Vagas protegidas"
                              : r.status}
                          </span>
                        </div>

                        <h2 className="text-xl md:text-2xl font-black text-ink-900">
                          {r.expedition.name}
                        </h2>

                        <div className="mt-3 flex flex-wrap gap-4 text-xs font-semibold text-ink-600">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="size-4 text-brand-600" />
                            <span>{r.expedition.destination}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <CalendarDays className="size-4 text-brand-600" />
                            <span>
                              {date(r.expedition.starts_at)} até {date(r.expedition.ends_at)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Users className="size-4 text-brand-600" />
                            <span>{r.participant_count} pescadores</span>
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-ink-100 flex flex-wrap items-center gap-4 text-xs">
                          <div>
                            <span className="text-ink-400 block">Total da Reserva</span>
                            <strong className="text-ink-900 font-bold text-sm">
                              {money(r.total_price_cents)}
                            </strong>
                          </div>
                          <div>
                            <span className="text-ink-400 block">Saldo Restante</span>
                            <strong
                              className={`text-sm font-bold ${
                                r.remaining_balance_cents > 0 ? "text-amber-700" : "text-emerald-700"
                              }`}
                            >
                              {r.remaining_balance_cents > 0
                                ? money(r.remaining_balance_cents)
                                : "Quitado (100%)"}
                            </strong>
                          </div>
                          <div>
                            <span className="text-ink-400 block">Ficha de Embarque</span>
                            <span className="font-bold text-ink-700">
                              {r.completed_participants_count} de {r.participant_count} preenchidos
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 pt-4 border-t border-ink-100 flex items-center justify-end">
                        <Link
                          href={r.journey_url as never}
                          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-black text-white hover:bg-brand-700 transition-colors shadow-sm"
                        >
                          <span>Acessar Minha Expedição</span>
                          <ExternalLink className="size-4" />
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <SiteFooter />
    </main>
  );
}
