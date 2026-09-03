"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Beer,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  GlassWater,
  MapPinned,
  Minus,
  Plus,
  Salad,
  ShieldCheck,
  Users,
} from "lucide-react";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
const inputClass = "mt-1.5 h-11 w-full rounded-lg border border-ink-900/15 bg-white px-3 text-sm outline-none focus:border-brand-600";

type Participant = {
  id: string;
  full_name: string;
  cpf: string;
  birth_date: string | null;
  phone: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  operational_notes: string;
  onboarding_status: string;
};

type BeveragePreferences = {
  beverages?: Record<string, number>;
  dietary_restrictions?: string;
  notes?: string;
  completed?: boolean;
  checklist_reviewed?: boolean;
};

type Reservation = {
  id: string;
  reference: string;
  status: string;
  participant_count: number;
  payment_plan: string;
  total_price_cents: number;
  paid_amount_cents: number;
  remaining_balance_cents: number;
  balance_due_at: string | null;
  preferences?: BeveragePreferences;
  onboarding: {
    completed: number;
    total: number;
    steps: Record<string, boolean>;
  };
  participants: Participant[];
  expedition: {
    name: string;
    slug: string;
    destination: string;
    starts_at: string;
    ends_at: string;
    duration_days: number;
    price_per_person_cents: number;
  };
};

const money = (value: number) => (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const shortDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

function errorMessage(value: unknown) {
  if (!value || typeof value !== "object") return "Não foi possível continuar.";
  return Object.values(value as Record<string, unknown>).flat().join(" ");
}

export function ConfirmationOnboarding({ reservationId }: { reservationId: string }) {
  const [data, setData] = useState<Reservation | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [editingPreferences, setEditingPreferences] = useState(false);
  const [viewingChecklist, setViewingChecklist] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const token = sessionStorage.getItem("customer-session-token");
    if (!token) {
      setError("Sua sessão não foi encontrada. Refaça a confirmação do contato para acessar esta reserva.");
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`${api}/me/reservations/${reservationId}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (!response.ok) throw result;
      setData(result);
    } catch (value) {
      setError(errorMessage(value));
    } finally {
      setLoading(false);
    }
  }, [reservationId]);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  if (loading) {
    return <section className="container-page min-h-[55vh] py-16 text-center text-ink-500">Carregando sua reserva...</section>;
  }

  if (!data) {
    return (
      <section className="container-page min-h-[55vh] py-16">
        <div className="mx-auto max-w-xl rounded-xl border border-red-200 bg-red-50 p-7 text-center">
          <h1 className="text-2xl font-black text-red-800">Não foi possível abrir a reserva</h1>
          <p className="mt-3 text-red-700">{error}</p>
        </div>
      </section>
    );
  }

  const steps = [
    ["payment", "Pagamento inicial realizado", "Seu pagamento foi confirmado com sucesso.", CheckCircle2],
    ["participants", "Cadastrar participantes", "Informe os dados essenciais de cada pescador.", Users],
    ["preferences", "Escolher bebidas e preferências", "Selecione as bebidas, marcas e quantidades da pescaria.", GlassWater],
    ["dietary_restrictions", "Informar restrições alimentares", "Registre alergias e preferências do cardápio.", Salad],
    ["checklist", "Conferir checklist da viagem", "Veja documentos, equipamentos e dicas essenciais.", ClipboardCheck],
  ] as const;

  const incompleteParticipant = data.participants.find((item) => item.onboarding_status !== "COMPLETED");

  const handleContinueOnboarding = () => {
    if (incompleteParticipant) {
      setEditingParticipant(incompleteParticipant);
    } else if (!data.onboarding.steps.preferences) {
      setEditingPreferences(true);
    } else if (!data.onboarding.steps.checklist) {
      setViewingChecklist(true);
    }
  };

  return (
    <>
      <section className="container-page pb-14">
        <div className="flex items-center gap-3">
          <h1 className="text-4xl font-black text-brand-900 sm:text-5xl">Reserva confirmada!</h1>
          <CheckCircle2 className="size-12 text-brand-700" />
        </div>
        <p className="mt-2 text-lg">Sua vaga na {data.expedition.name} foi garantida com sucesso.</p>

        <div className="mt-7 grid gap-5 xl:grid-cols-[.8fr_1.15fr_.9fr]">
          {/* Card Resumo */}
          <article className="rounded-xl border border-ink-900/10 bg-white p-5">
            <h2 className="flex items-center gap-2 text-lg font-black">
              <CalendarDays className="text-brand-700" /> Resumo da reserva
            </h2>
            <div className="mt-5 space-y-4 text-sm">
              <Row label="Reserva" value={`#${data.reference}`} />
              <Row label="Participantes" value={`${data.participant_count} participante(s)`} />
              <Row label="Período" value={`${shortDate(data.expedition.starts_at)} a ${shortDate(data.expedition.ends_at)}`} />
              <hr className="border-dashed border-ink-900/15" />
              <Row label="Valor pago" value={money(data.paid_amount_cents)} green />
              <Row label="Saldo restante" value={money(data.remaining_balance_cents)} />
              {data.balance_due_at && <Row label="Vencimento do saldo" value={shortDate(data.balance_due_at)} />}
            </div>
          </article>

          {/* Card Próximos Passos */}
          <article className="rounded-xl border border-ink-900/10 bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-black">
                <MapPinned className="text-brand-700" /> Próximos passos
              </h2>
              <strong className="text-sm text-brand-700">
                {data.onboarding.completed} de {data.onboarding.total} concluídas
              </strong>
            </div>

            <div className="mt-4 space-y-3">
              {steps.map(([key, title, copy, Icon], index) => {
                const done = data.onboarding.steps[key];
                const isPart = key === "participants";
                const isPref = key === "preferences" || key === "dietary_restrictions";
                const isCheck = key === "checklist";

                return (
                  <div
                    key={key}
                    className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                      done ? "border-brand-200 bg-brand-50" : "border-ink-900/10"
                    }`}
                  >
                    <span
                      className={`grid size-9 shrink-0 place-items-center rounded-full font-black ${
                        done ? "bg-brand-600 text-white" : "bg-gray-100 text-ink-700"
                      }`}
                    >
                      {done ? <Check className="size-5" /> : index + 1}
                    </span>
                    <Icon className="hidden size-5 text-brand-700 sm:block" />
                    <div className="min-w-0 flex-1">
                      <strong className="block text-sm">{title}</strong>
                      <span className="text-xs text-ink-500">{copy}</span>
                    </div>

                    {isPart && !done && (
                      <button
                        onClick={() => setEditingParticipant(incompleteParticipant ?? data.participants[0])}
                        className="rounded-md border border-brand-600 px-3 py-2 text-xs font-bold text-brand-700 hover:bg-brand-50"
                      >
                        Preencher
                      </button>
                    )}

                    {isPref && !done && (
                      <button
                        onClick={() => setEditingPreferences(true)}
                        className="rounded-md bg-brand-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-brand-700"
                      >
                        Preencher
                      </button>
                    )}

                    {isCheck && !done && (
                      <button
                        onClick={() => setViewingChecklist(true)}
                        className="rounded-md border border-brand-600 px-3 py-2 text-xs font-bold text-brand-700 hover:bg-brand-50"
                      >
                        Ver dicas
                      </button>
                    )}

                    {done && <span className="text-xs font-bold text-brand-700">✓ Concluído</span>}
                  </div>
                );
              })}
            </div>
          </article>

          {/* Card Expedição */}
          <article className="overflow-hidden rounded-xl border border-ink-900/10 bg-white">
            <div className="relative h-40">
              <Image src="/expeditions/rio-araguaia/rio-barco.jpg" alt="Rio durante a expedição" fill className="object-cover" sizes="400px" />
            </div>
            <div className="p-5">
              <h2 className="text-2xl font-black">{data.expedition.name}</h2>
              <p className="mt-1 text-sm text-ink-500">{data.expedition.destination}</p>
              <div className="mt-4 grid grid-cols-3 gap-2 border-y border-ink-900/10 py-4 text-center text-xs">
                <span>
                  <CalendarDays className="mx-auto mb-1 size-5 text-brand-700" />
                  {shortDate(data.expedition.starts_at).split(" de ").slice(0, 2).join(" ")}
                </span>
                <span>
                  <Users className="mx-auto mb-1 size-5 text-brand-700" />
                  {data.participant_count} pessoas
                </span>
                <span>
                  <Clock3 className="mx-auto mb-1 size-5 text-brand-700" />
                  {data.expedition.duration_days} dias
                </span>
              </div>
              <p className="mt-4 text-sm">
                Total da reserva <strong className="float-right">{money(data.total_price_cents)}</strong>
              </p>
              <p className="mt-2 text-sm">
                Saldo restante <strong className="float-right text-brand-700">{money(data.remaining_balance_cents)}</strong>
              </p>
            </div>
          </article>
        </div>

        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            onClick={handleContinueOnboarding}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-brand-600 px-8 font-bold text-white hover:bg-brand-700"
          >
            Continuar onboarding <ArrowRight className="size-5" />
          </button>
          <button
            onClick={() => setViewingChecklist(true)}
            className="min-h-12 rounded-md border border-brand-600 px-8 font-bold text-brand-700 hover:bg-brand-50"
          >
            Ver checklist da viagem
          </button>
        </div>
      </section>

      {/* Seção Garantias */}
      <section className="border-t border-ink-900/10 bg-white">
        <div className="container-page grid gap-5 py-7 md:grid-cols-3">
          {[
            [ShieldCheck, "Pagamento seguro", "Dados e pagamentos protegidos."],
            [Users, "Equipe experiente", "Preparação acompanhada pela equipe."],
            [CheckCircle2, "Confirmação imediata", "Sua reserva já está registrada."],
          ].map(([Icon, title, copy]) => {
            const ItemIcon = Icon as typeof ShieldCheck;
            return (
              <div key={title as string} className="flex items-center gap-3">
                <span className="grid size-12 place-items-center rounded-full bg-brand-900 text-white">
                  <ItemIcon />
                </span>
                <div>
                  <strong>{title as string}</strong>
                  <p className="text-sm text-ink-500">{copy as string}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Modais */}
      {editingParticipant && (
        <ParticipantModal
          participant={editingParticipant}
          reservationId={data.id}
          close={() => setEditingParticipant(null)}
          saved={(result) => {
            setData(result);
            const next = result.participants.find((item) => item.onboarding_status !== "COMPLETED");
            if (next) {
              setEditingParticipant(next);
            } else {
              setEditingParticipant(null);
              setEditingPreferences(true);
            }
          }}
        />
      )}

      {editingPreferences && (
        <PreferencesModal
          reservationId={data.id}
          currentPreferences={data.preferences}
          close={() => setEditingPreferences(false)}
          saved={(result) => {
            setData(result);
            setEditingPreferences(false);
          }}
        />
      )}

      {viewingChecklist && (
        <ChecklistModal
          reservationId={data.id}
          close={() => setViewingChecklist(false)}
          saved={(result) => {
            setData(result);
            setViewingChecklist(false);
          }}
        />
      )}
    </>
  );
}

function Row({ label, value, green = false }: { label: string; value: string; green?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-ink-500">{label}</span>
      <strong className={`text-right ${green ? "text-brand-700" : ""}`}>{value}</strong>
    </div>
  );
}

function formatPhone(val: string) {
  const d = (val || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("55") && d.length >= 12) {
    const raw = d.slice(2);
    if (raw.length === 11) return `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7)}`;
    if (raw.length === 10) return `(${raw.slice(0, 2)}) ${raw.slice(2, 6)}-${raw.slice(6)}`;
  }
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return val;
}

function ParticipantModal({
  participant,
  reservationId,
  close,
  saved,
}: {
  participant: Participant;
  reservationId: string;
  close: () => void;
  saved: (data: Reservation) => void;
}) {
  const [form, setForm] = useState(() => ({
    ...participant,
    phone: formatPhone(participant.phone || ""),
    emergency_contact_phone: formatPhone(participant.emergency_contact_phone || ""),
  }));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const token = sessionStorage.getItem("customer-session-token");
      const cleanForm = {
        ...form,
        cpf: form.cpf ? form.cpf.replace(/\D/g, "") : "",
        phone: form.phone ? form.phone.replace(/\D/g, "") : "",
        emergency_contact_phone: form.emergency_contact_phone ? form.emergency_contact_phone.replace(/\D/g, "") : "",
      };
      const response = await fetch(`${api}/me/reservations/${reservationId}/participants/${participant.id}/`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(cleanForm),
      });
      const result = await response.json();
      if (!response.ok) throw result;
      saved(result);
    } catch (value) {
      setError(errorMessage(value));
    } finally {
      setLoading(false);
    }
  }

  const field = (key: keyof Participant, label: string, required = false, type = "text", placeholder = "") => (
    <label className="text-sm font-bold">
      {label}
      <input
        required={required}
        type={type}
        placeholder={placeholder}
        value={(form[key] as string) ?? ""}
        onChange={(event) => setForm({ ...form, [key]: event.target.value })}
        className={inputClass}
      />
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-4">
      <form onSubmit={submit} className="my-5 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-600">Dados do participante</p>
            <h2 className="text-2xl font-black">{participant.full_name}</h2>
            <p className="mt-1 text-sm text-ink-500">CPF e data de nascimento são opcionais nesta etapa.</p>
          </div>
          <button type="button" onClick={close} className="text-2xl text-ink-400 hover:text-ink-900">
            ×
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {field("full_name", "Nome completo", true)}
          {field("cpf", "CPF")}
          {field("birth_date", "Data de nascimento", false, "date")}
          {field("phone", "Celular/WhatsApp", true)}
          {field("emergency_contact_name", "Contato de emergência", true)}
          {field("emergency_contact_phone", "Telefone de emergência", true)}
          <label className="text-sm font-bold sm:col-span-2">
            Observações operacionais
            <textarea
              value={form.operational_notes}
              onChange={(event) => setForm({ ...form, operational_notes: event.target.value })}
              placeholder="Ex: preferências de tamanho de colete, canhoto/destro, etc."
              className="mt-1.5 min-h-20 w-full rounded-lg border border-ink-900/15 p-3 text-sm outline-none focus:border-brand-600"
            />
          </label>
        </div>

        {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}

        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={close} className="min-h-11 rounded-md border border-ink-900/15 px-5 font-bold hover:bg-gray-50">
            Continuar depois
          </button>
          <button
            disabled={loading}
            className="min-h-11 rounded-md bg-brand-600 px-5 font-bold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? "Salvando..." : "Salvar e avançar"}
          </button>
        </div>
      </form>
    </div>
  );
}

const BEVERAGE_CATALOG = {
  cervejas: [
    { id: "heineken", name: "Heineken (Lata 350ml)", category: "Cerveja All Inclusive" },
    { id: "original", name: "Antarctica Original (Lata 350ml)", category: "Cerveja All Inclusive" },
    { id: "amstel", name: "Amstel Puro Malte (Lata 350ml)", category: "Cerveja All Inclusive" },
    { id: "spaten", name: "Spaten Puro Malte (Lata 350ml)", category: "Cerveja All Inclusive" },
    { id: "corona", name: "Corona Extra (Long Neck)", category: "Cerveja All Inclusive" },
  ],
  nao_alcoolicos: [
    { id: "agua_sem_gas", name: "Água Mineral Sem Gás (500ml)", category: "Não Alcoólico" },
    { id: "agua_com_gas", name: "Água Mineral Com Gás (500ml)", category: "Não Alcoólico" },
    { id: "coca_cola", name: "Coca-Cola Original (Lata)", category: "Refrigerante" },
    { id: "coca_zero", name: "Coca-Cola Zero (Lata)", category: "Refrigerante" },
    { id: "guarana", name: "Guaraná Antarctica (Lata)", category: "Refrigerante" },
    { id: "tonica", name: "Água Tônica Schweppes (Lata)", category: "Refrigerante" },
  ],
  destilados_extras: [
    { id: "gelo_abundante", name: "Gelo em Cubos (abundante no barco)", category: "Essencial" },
    { id: "limao_fatiado", name: "Limão fatiado para bebidas/peixes", category: "Essencial" },
    { id: "kit_sashimi", name: "Kit Ceviche & Sashimi no Barco", category: "Gastronomia Bordo" },
    { id: "carvao_churrasco", name: "Carvão para Churrasco na Praia", category: "Gastronomia Bordo" },
    { id: "gin_tanqueray", name: "Gin Tanqueray (Garrafa)", category: "Destilado" },
    { id: "whisky_red_label", name: "Whisky Red Label (Garrafa)", category: "Destilado" },
    { id: "campari", name: "Campari Bitter (Garrafa)", category: "Destilado" },
  ],
};

function PreferencesModal({
  reservationId,
  currentPreferences,
  close,
  saved,
}: {
  reservationId: string;
  currentPreferences?: BeveragePreferences;
  close: () => void;
  saved: (data: Reservation) => void;
}) {
  const [counts, setCounts] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {
      heineken: 12,
      agua_sem_gas: 24,
      agua_com_gas: 12,
      coca_cola: 12,
      coca_zero: 6,
      gelo_abundante: 1,
      limao_fatiado: 1,
    };
    return { ...initial, ...(currentPreferences?.beverages || {}) };
  });

  const [dietary, setDietary] = useState(currentPreferences?.dietary_restrictions || "");
  const [notes, setNotes] = useState(currentPreferences?.notes || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const updateCount = (id: string, delta: number) => {
    setCounts((prev) => {
      const val = Math.max((prev[id] || 0) + delta, 0);
      return { ...prev, [id]: val };
    });
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const token = sessionStorage.getItem("customer-session-token");
      const response = await fetch(`${api}/me/reservations/${reservationId}/preferences/`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          beverages: counts,
          dietary_restrictions: dietary,
          notes: notes,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw result;
      saved(result);
    } catch (value) {
      setError(errorMessage(value));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-4">
      <form onSubmit={submit} className="my-5 w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-600">Tela 05 — Onboarding Operacional</p>
            <h2 className="text-2xl font-black text-brand-900">Bebidas e Preferências da Pescaria</h2>
            <p className="mt-1 text-sm text-ink-500">
              Personalize o estoque do barco-hotel. A equipe do barco providenciará tudo gelado antes do seu embarque.
            </p>
          </div>
          <button type="button" onClick={close} className="text-2xl text-ink-400 hover:text-ink-900">
            ×
          </button>
        </div>

        <div className="mt-6 max-h-[60vh] space-y-6 overflow-y-auto pr-2">
          {/* Cervejas */}
          <div>
            <h3 className="flex items-center gap-2 text-base font-black text-brand-900">
              <Beer className="size-5 text-brand-700" /> Cervejas Preferidas
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {BEVERAGE_CATALOG.cervejas.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg border border-ink-900/10 p-3 bg-gray-50/50">
                  <div>
                    <strong className="block text-sm">{item.name}</strong>
                    <span className="text-xs text-ink-500">{item.category}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateCount(item.id, -6)}
                      className="grid size-7 place-items-center rounded-md border border-ink-900/15 bg-white text-xs font-bold hover:bg-gray-100"
                    >
                      <Minus className="size-3" />
                    </button>
                    <span className="w-8 text-center text-sm font-black">{counts[item.id] || 0}</span>
                    <button
                      type="button"
                      onClick={() => updateCount(item.id, 6)}
                      className="grid size-7 place-items-center rounded-md bg-brand-600 text-xs font-bold text-white hover:bg-brand-700"
                    >
                      <Plus className="size-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Não Alcoólicos */}
          <div>
            <h3 className="flex items-center gap-2 text-base font-black text-brand-900">
              <GlassWater className="size-5 text-brand-700" /> Águas e Refrigerantes
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {BEVERAGE_CATALOG.nao_alcoolicos.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg border border-ink-900/10 p-3 bg-gray-50/50">
                  <div>
                    <strong className="block text-sm">{item.name}</strong>
                    <span className="text-xs text-ink-500">{item.category}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateCount(item.id, -6)}
                      className="grid size-7 place-items-center rounded-md border border-ink-900/15 bg-white text-xs font-bold hover:bg-gray-100"
                    >
                      <Minus className="size-3" />
                    </button>
                    <span className="w-8 text-center text-sm font-black">{counts[item.id] || 0}</span>
                    <button
                      type="button"
                      onClick={() => updateCount(item.id, 6)}
                      className="grid size-7 place-items-center rounded-md bg-brand-600 text-xs font-bold text-white hover:bg-brand-700"
                    >
                      <Plus className="size-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Destilados e Extras */}
          <div>
            <h3 className="flex items-center gap-2 text-base font-black text-brand-900">
              <ShieldCheck className="size-5 text-brand-700" /> Destilados e Suprimentos de Bordo
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {BEVERAGE_CATALOG.destilados_extras.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg border border-ink-900/10 p-3 bg-gray-50/50">
                  <div>
                    <strong className="block text-sm">{item.name}</strong>
                    <span className="text-xs text-ink-500">{item.category}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateCount(item.id, -1)}
                      className="grid size-7 place-items-center rounded-md border border-ink-900/15 bg-white text-xs font-bold hover:bg-gray-100"
                    >
                      <Minus className="size-3" />
                    </button>
                    <span className="w-8 text-center text-sm font-black">{counts[item.id] || 0}</span>
                    <button
                      type="button"
                      onClick={() => updateCount(item.id, 1)}
                      className="grid size-7 place-items-center rounded-md bg-brand-600 text-xs font-bold text-white hover:bg-brand-700"
                    >
                      <Plus className="size-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Restrições Alimentares */}
          <div>
            <h3 className="flex items-center gap-2 text-base font-black text-brand-900">
              <Salad className="size-5 text-brand-700" /> Restrições Alimentares e Alergias
            </h3>
            <textarea
              value={dietary}
              onChange={(e) => setDietary(e.target.value)}
              placeholder="Ex: Não como frutos do mar, intolerância severa a lactose, preferência por carne bem passada..."
              className="mt-2 min-h-20 w-full rounded-lg border border-ink-900/15 p-3 text-sm outline-none focus:border-brand-600"
            />
          </div>

          {/* Observações Gerais */}
          <div>
            <label className="block text-sm font-bold text-ink-700">
              Observações gerais para o Barco-Hotel
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Algum outro detalhe que nossa equipe precisa saber?"
                className="mt-2 min-h-16 w-full rounded-lg border border-ink-900/15 p-3 text-sm outline-none focus:border-brand-600"
              />
            </label>
          </div>
        </div>

        {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}

        <div className="mt-6 flex justify-end gap-3 border-t border-ink-900/10 pt-4">
          <button type="button" onClick={close} className="min-h-11 rounded-md border border-ink-900/15 px-5 font-bold hover:bg-gray-50">
            Continuar depois
          </button>
          <button
            disabled={loading}
            className="min-h-11 rounded-md bg-brand-600 px-6 font-bold text-white shadow-md hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? "Gravando escolhas..." : "Salvar Bebidas e Preferências"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ChecklistModal({
  reservationId,
  close,
  saved,
}: {
  reservationId: string;
  close: () => void;
  saved: (data: Reservation) => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleConfirmChecklist = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem("customer-session-token");
      const response = await fetch(`${api}/me/reservations/${reservationId}/preferences/`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ checklist_reviewed: true }),
      });
      const result = await response.json();
      if (!response.ok) throw result;
      saved(result);
    } catch {
      close();
    } finally {
      setLoading(false);
    }
  };

  const checklistItems = [
    { title: "Licença de Pesca Amadora (Embarcada)", desc: "Obrigatória pelo MPA/Ibama para pesca esportiva no Rio Araguaia." },
    { title: "Documento com foto (RG / CNH)", desc: "Necessário no check-in do barco-hotel em Luiz Alves." },
    { title: "Roupas com Proteção UV e Chapéu", desc: "Camisas manga longa dry-fit, óculos polarizado e protetor solar." },
    { title: "Medicamentos de uso pessoal", desc: "Antialérgicos, analgésicos e remédios contínuos recomendados." },
    { title: "Equipamentos de Pesca Pesada", desc: "Varas de 50 a 100 lbs e carretilhas com linha multifilamento de 80 lbs para Piraíba." },
  ];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-4">
      <div className="my-5 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-600">Preparação da Viagem</p>
            <h2 className="text-2xl font-black text-brand-900">Checklist da Expedição Piraíba</h2>
            <p className="mt-1 text-sm text-ink-500">Tudo o que você e seus companheiros precisam levar para a melhor pescaria.</p>
          </div>
          <button type="button" onClick={close} className="text-2xl text-ink-400 hover:text-ink-900">
            ×
          </button>
        </div>

        <div className="mt-6 space-y-3">
          {checklistItems.map((item, index) => (
            <div key={index} className="flex items-start gap-3 rounded-lg border border-brand-200 bg-brand-50/60 p-3.5">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brand-700" />
              <div>
                <strong className="text-sm text-brand-900">{item.title}</strong>
                <p className="mt-0.5 text-xs text-ink-600">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-ink-900/10 pt-4">
          <button
            onClick={handleConfirmChecklist}
            disabled={loading}
            className="min-h-11 rounded-md bg-brand-600 px-6 font-bold text-white shadow-md hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? "Confirmando..." : "Entendi e Conferi o Checklist"}
          </button>
        </div>
      </div>
    </div>
  );
}
