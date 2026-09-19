"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  Check,
  ClipboardCheck,
  Clock3,
  ExternalLink,
  Fish,
  GlassWater,
  MapPin,
  MessageCircle,
  Plus,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";

import {
  GEAR_CATALOG,
  GEAR_CATEGORIES,
  GearCategory,
  GearItem,
} from "./gear-catalog";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

type Offer = {
  id: string;
  product_id?: number;
  name?: string;
  product_name?: string;
  category?: string;
  unit?: string;
  note?: string;
  active?: boolean;
};

type Item = {
  id: string;
  title: string;
  description?: string;
  required?: boolean;
  active?: boolean;
};

type Person = {
  id: string;
  full_name: string;
  cpf?: string;
  phone?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  operational_notes?: string;
  onboarding_status?: string;
  selected_offer_ids?: string[];
  no_beverages?: boolean;
  preferences_confirmed?: boolean;
  dietary_restriction_codes?: string[];
  dietary_details?: string;
  dietary_confirmed?: boolean;
  completed_item_ids?: string[];
  checklist_complete?: boolean;
};

type EventItem = {
  type: string;
  created_at: string;
};

type Data = {
  id: string;
  reference: string;
  status: string;
  total_price_cents: number;
  paid_amount_cents: number;
  remaining_balance_cents: number;
  balance_due_at: string | null;
  participants: Person[];
  offers?: Offer[];
  checklist_items?: Item[];
  notices?: string[];
  whatsapp_url?: string;
  events?: EventItem[];
  onboarding: {
    completed: number;
    total: number;
    steps: Record<string, boolean>;
  };
  expedition: {
    name: string;
    slug: string;
    destination: string;
    departure_location?: string;
    meeting_instructions?: string;
    starts_at: string;
    ends_at: string;
    duration_days?: number;
    offers?: Offer[];
    checklist_items?: Item[];
  };
};

const restrictions = [
  ["none", "Sem restrições alimentares"],
  ["vegetarian", "Vegetariano"],
  ["vegan", "Vegano"],
  ["lactose", "Intolerância à lactose"],
  ["gluten", "Restrição a glúten"],
  ["allergy", "Alergia alimentar específica"],
  ["other", "Outros cuidados"],
];

const money = (v: number) =>
  (v / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const date = (v: string) =>
  new Date(`${v}T12:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const headers = () => ({
  Authorization: `Bearer ${sessionStorage.getItem("customer-session-token") ?? ""}`,
});

async function result(r: Response) {
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw body;
  return body;
}

function errorMsg(v: unknown) {
  if (v && typeof v === "object") {
    return (
      Object.values(v as Record<string, unknown>)
        .flat()
        .join(" ") || "Não foi possível concluir."
    );
  }
  return "Não foi possível concluir.";
}

export function CustomerJourney({
  reservationId,
  confirmation = false,
}: {
  reservationId: string;
  confirmation?: boolean;
}) {
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(true);
  const [failure, setFailure] = useState("");
  const [personId, setPersonId] = useState("");
  const [activeTab, setActiveTab] = useState<"BEVERAGES" | "GEAR" | "CHECKLIST" | "LOGISTICS">("BEVERAGES");

  const load = useCallback(async () => {
    setBusy(true);
    setFailure("");
    try {
      if (!sessionStorage.getItem("customer-session-token")) {
        throw { detail: "Sua sessão de acesso não foi encontrada. Por favor, identifique-se novamente." };
      }
      const d = (await result(
        await fetch(`${API}/me/reservations/${reservationId}/`, {
          headers: headers(),
        })
      )) as Data;
      setData(d);
      setPersonId((x) => x || d.participants[0]?.id || "");
    } catch (e) {
      setFailure(errorMsg(e));
    } finally {
      setBusy(false);
    }
  }, [reservationId]);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  if (busy) return <State text="Carregando dados da sua expedição..." />;
  if (!data) return <State text={failure || "Reserva não encontrada."} />;

  const person = data.participants.find((p) => p.id === personId) ?? data.participants[0];
  const offers = (data.offers ?? data.expedition.offers ?? []).filter((x) => x.active !== false);
  const items = (data.checklist_items ?? data.expedition.checklist_items ?? []).filter((x) => x.active !== false);
  const temporal = temporalState(data.expedition.starts_at, data.expedition.ends_at);
  const notices = data.notices?.length ? data.notices : derivedNotices(data);
  const progress = data.onboarding.total
    ? Math.round((data.onboarding.completed / data.onboarding.total) * 100)
    : 0;

  return (
    <section className="container-page pb-20 pt-4">
      {/* HEADER HERO */}
      <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 p-8 text-white shadow-xl">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-sand-300/30 bg-black/30 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-sand-300 backdrop-blur-md">
              <Sparkles className="size-3.5" />
              {confirmation ? "Reserva 100% Confirmada" : "Painel da Minha Expedição"}
            </div>
            <h1 className="mt-3 text-3xl font-black sm:text-4xl lg:text-5xl">{data.expedition.name}</h1>
            <p className="mt-2 flex items-center gap-2 text-sm text-white/80">
              <MapPin className="size-4 text-sand-300" />
              <span>{data.expedition.destination}</span>
              <span className="text-white/40">•</span>
              <span>Embarque: {data.expedition.departure_location ?? "A confirmar"}</span>
            </p>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/10 p-5 text-center backdrop-blur-md">
            <strong className="block text-3xl font-black text-sand-200">{temporal.title}</strong>
            <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">{temporal.copy}</span>
          </div>
        </div>

        {/* STEPPER PROGRESS */}
        <div className="mt-8 border-t border-white/15 pt-6">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-sand-200">
            <span>Progresso Geral do Onboarding</span>
            <span>{progress}% Concluído ({data.onboarding.completed} de {data.onboarding.total} etapas)</span>
          </div>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full bg-gradient-to-r from-sand-300 to-emerald-400 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5 text-[11px]">
            {[
              ["payment", "Pagamento do Sinal", data.onboarding.steps.payment],
              ["preferences", "Bebidas All Inclusive", data.onboarding.steps.preferences],
              ["gear", "Tralha & Equipamentos", Boolean(person?.operational_notes)],
              ["dietary_restrictions", "Alimentação & Cuidados", data.onboarding.steps.dietary_restrictions],
              ["checklist", "Checklist do Pescador", data.onboarding.steps.checklist],
            ].map(([key, label, done]) => (
              <div
                key={key as string}
                className={`flex items-center gap-1.5 rounded-lg p-2 font-bold ${
                  done ? "bg-emerald-500/20 text-emerald-200 border border-emerald-400/30" : "bg-white/5 text-white/60"
                }`}
              >
                <Check className={`size-3.5 shrink-0 ${done ? "opacity-100 text-emerald-400" : "opacity-20"}`} />
                <span className="truncate">{label as string}</span>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* NOTICES */}
      {notices.map((n) => (
        <div key={n} className="mt-4 flex items-center gap-3 rounded-xl border border-amber-300/40 bg-amber-50 p-4 text-xs font-semibold text-amber-900 shadow-sm">
          <AlertCircle className="size-5 shrink-0 text-amber-700" />
          <span>{n}</span>
        </div>
      ))}

      {/* TOP CARDS: RESERVA, FINANCEIRO, SUPORTE */}
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Card title="Dados da Reserva" icon={CalendarDays}>
          <Rows
            values={[
              ["Referência", `#${data.reference}`],
              ["Status", data.status === "CONFIRMED" ? "Confirmada ✓" : data.status],
              ["Período", `${date(data.expedition.starts_at)} a ${date(data.expedition.ends_at)}`],
              ["Vagas Reservadas", `${data.participants.length} pescador(es)`],
              ["Local de Encontro", data.expedition.departure_location ?? "Pousada Parceira"],
            ]}
          />
        </Card>

        <Card title="Painel Financeiro" icon={WalletCards}>
          <Rows
            values={[
              ["Valor Total", money(data.total_price_cents)],
              ["Sinal Pago (PIX)", money(data.paid_amount_cents)],
              ["Saldo Restante", money(data.remaining_balance_cents)],
              ["Vencimento do Saldo", data.balance_due_at ? date(data.balance_due_at) : "Quitado"],
            ]}
          />
          {data.remaining_balance_cents > 0 && (
            <Payment id={data.id} amount={data.remaining_balance_cents} saved={setData} />
          )}
        </Card>

        <Card title="Suporte Operacional" icon={MessageCircle}>
          <p className="text-xs text-ink-600 leading-relaxed">
            Dúvidas sobre o ponto de encontro, transfer ou clima no Rio Araguaia? Fale com a coordenação de pesca.
          </p>
          <a
            href={data.whatsapp_url ?? "https://wa.me/5562981612128"}
            target="_blank"
            rel="noreferrer"
            className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-brand-600 bg-brand-50/70 p-3 font-bold text-brand-700 hover:bg-brand-100 transition shadow-sm text-sm"
          >
            <MessageCircle className="size-4 text-[#25D366]" /> Falar no WhatsApp Oficial
          </a>
        </Card>
      </div>

      {/* PARTICIPANTS TABS */}
      <div className="mt-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black text-brand-900">Personalização por Pescador</h2>
            <p className="text-xs text-ink-600">
              Cada integrante da turma tem suas próprias escolhas de bebidas, tralha e checklist.
            </p>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {data.participants.map((p, idx) => (
              <button
                key={p.id}
                onClick={() => setPersonId(p.id)}
                className={`shrink-0 rounded-xl px-4 py-2 text-xs font-bold transition shadow-sm ${
                  p.id === person?.id
                    ? "bg-brand-800 text-white shadow-brand-900/20"
                    : "border border-ink-900/10 bg-white text-ink-700 hover:bg-sand-50"
                }`}
              >
                Pescador {idx + 1}: {p.full_name || "Sem nome"}
              </button>
            ))}
          </div>
        </div>

        {/* SECTION NAVIGATION PILLS */}
        <div className="mt-6 flex gap-2 border-b border-ink-900/10 pb-3 overflow-x-auto">
          {[
            { id: "BEVERAGES", label: "Bebidas All Inclusive & Alimentação", icon: GlassWater },
            { id: "GEAR", label: "Tralha de Pesca (Aluguel / Compra)", icon: Fish },
            { id: "CHECKLIST", label: "Checklist & Licença de Pesca", icon: ClipboardCheck },
            { id: "LOGISTICS", label: "Encontro & Embarque", icon: MapPin },
          ].map((tab) => {
            const TabIcon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                  active
                    ? "bg-brand-600 text-white shadow"
                    : "border border-ink-900/10 bg-white text-ink-700 hover:bg-sand-50"
                }`}
              >
                <TabIcon className="size-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB CONTENTS */}
        <div className="mt-6">
          {activeTab === "BEVERAGES" && person && (
            <Preferences
              id={data.id}
              person={person}
              offers={offers}
              saved={setData}
            />
          )}

          {activeTab === "GEAR" && person && (
            <GearSection
              id={data.id}
              person={person}
              durationDays={data.expedition.duration_days ?? 4}
              saved={setData}
            />
          )}

          {activeTab === "CHECKLIST" && person && (
            <ChecklistSection
              id={data.id}
              person={person}
              items={items}
              saved={setData}
            />
          )}

          {activeTab === "LOGISTICS" && (
            <LogisticsSection expedition={data.expedition} />
          )}
        </div>
      </div>

      {/* EVENT HISTORY */}
      {!!data.events?.length && (
        <div className="mt-12">
          <Card title="Histórico da Reserva" icon={Clock3}>
            <div className="divide-y divide-ink-900/5">
              {data.events.map((event, index) => (
                <div key={`${event.type}-${index}`} className="flex justify-between gap-3 py-3 text-xs">
                  <span className="font-semibold text-ink-800">{eventLabel(event.type)}</span>
                  <time className="text-ink-500 font-mono">
                    {new Date(event.created_at).toLocaleString("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </time>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {confirmation && (
        <div className="mt-10 text-center">
          <Link
            href={`/expedicoes/${data.expedition.slug}/minha-expedicao/${data.id}` as never}
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-brand-700 px-8 font-bold text-white shadow-md hover:bg-brand-800 transition"
          >
            Abrir Minha Expedição
          </Link>
        </div>
      )}
    </section>
  );
}

// -----------------------------------------------------------------------------
// PREFERENCES (BEBIDAS ALL INCLUSIVE & RESTRIÇÕES)
// -----------------------------------------------------------------------------
function Preferences({
  id,
  person,
  offers,
  saved,
}: {
  id: string;
  person: Person;
  offers: Offer[];
  saved: (d: Data) => void;
}) {
  const [chosen, setChosen] = useState(person.selected_offer_ids ?? []);
  const [none, setNone] = useState(!!person.no_beverages);
  const [codes, setCodes] = useState(person.dietary_restriction_codes ?? []);
  const [details, setDetails] = useState(person.dietary_details ?? "");
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  // Categorize offers
  const categorized = useMemo(() => {
    const beers: Offer[] = [];
    const softDrinks: Offer[] = [];
    const watersJuices: Offer[] = [];
    const otherOffers: Offer[] = [];

    offers.forEach((o) => {
      const name = (o.product_name ?? o.name ?? "").toLowerCase();
      if (name.includes("cerveja") || name.includes("heineken") || name.includes("original") || name.includes("stella")) {
        beers.push(o);
      } else if (name.includes("coca") || name.includes("guaraná") || name.includes("refrigerante") || name.includes("tônica")) {
        softDrinks.push(o);
      } else if (name.includes("água") || name.includes("suco") || name.includes("gelo") || name.includes("destilado")) {
        watersJuices.push(o);
      } else {
        otherOffers.push(o);
      }
    });

    return { beers, softDrinks, watersJuices, otherOffers };
  }, [offers]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSuccess(false);
    if (!none && !chosen.length)
      return setFailure("Escolha pelo menos uma bebida ou marque 'Não quero nenhuma bebida'.");
    if (!codes.length)
      return setFailure("Informe as restrições ou confirme 'Sem restrições alimentares'.");
    if (codes.includes("other") && !details.trim())
      return setFailure("Descreva a opção Outros para que possamos nos preparar.");
    setBusy(true);
    try {
      const res = await result(
        await fetch(`${API}/me/reservations/${id}/participants/${person.id}/preferences/`, {
          method: "PUT",
          headers: { ...headers(), "Content-Type": "application/json" },
          body: JSON.stringify({
            selected_offer_ids: none ? [] : chosen,
            no_beverages: none,
            dietary_restriction_codes: codes,
            dietary_details: details,
          }),
        })
      );
      saved(res);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (x) {
      setFailure(errorMsg(x));
    } finally {
      setBusy(false);
    }
  }

  function toggleOffer(offerId: string) {
    if (none) setNone(false);
    setChosen((current) =>
      current.includes(offerId) ? current.filter((x) => x !== offerId) : [...current, offerId]
    );
  }

  return (
    <Card title={`Bebidas All Inclusive & Alimentação (${person.full_name})`} icon={GlassWater}>
      <div className="rounded-xl border border-brand-500/20 bg-brand-50/60 p-4 text-xs text-brand-950">
        <p className="font-bold flex items-center gap-2 text-brand-900">
          <Sparkles className="size-4 text-brand-700" />
          Open Bar All Inclusive 100% Gratuito
        </p>
        <p className="mt-1 leading-relaxed text-ink-700">
          Todas as cervejas premium, refrigerantes, água mineral e sucos estão incluídos na sua expedição. Marque as marcas e
          variedades que você mais aprecia para que a equipe abasteça a lancha e o rancho na proporção perfeita.
        </p>
      </div>

      <form onSubmit={submit} className="mt-6 space-y-6">
        {/* CERVEJAS */}
        {categorized.beers.length > 0 && (
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-brand-900">
              🍺 Cervejas Premium Inclusas
            </h3>
            <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
              {categorized.beers.map((o) => {
                const selected = chosen.includes(o.id) && !none;
                return (
                  <button
                    type="button"
                    key={o.id}
                    onClick={() => toggleOffer(o.id)}
                    className={`flex items-center justify-between rounded-xl border p-3.5 text-left transition ${
                      selected
                        ? "border-brand-600 bg-brand-50/80 shadow-sm"
                        : "border-ink-900/10 bg-white hover:bg-sand-50"
                    }`}
                  >
                    <div>
                      <strong className="block text-sm text-ink-900">{o.product_name ?? o.name}</strong>
                      {o.note && <span className="text-[11px] text-ink-500">{o.note}</span>}
                    </div>
                    <span
                      className={`grid size-6 place-items-center rounded-md border ${
                        selected ? "border-brand-600 bg-brand-600 text-white" : "border-ink-900/20 bg-white"
                      }`}
                    >
                      {selected && <Check className="size-4" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* REFRIGERANTES */}
        {categorized.softDrinks.length > 0 && (
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-brand-900">
              🥤 Refrigerantes
            </h3>
            <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
              {categorized.softDrinks.map((o) => {
                const selected = chosen.includes(o.id) && !none;
                return (
                  <button
                    type="button"
                    key={o.id}
                    onClick={() => toggleOffer(o.id)}
                    className={`flex items-center justify-between rounded-xl border p-3.5 text-left transition ${
                      selected
                        ? "border-brand-600 bg-brand-50/80 shadow-sm"
                        : "border-ink-900/10 bg-white hover:bg-sand-50"
                    }`}
                  >
                    <div>
                      <strong className="block text-sm text-ink-900">{o.product_name ?? o.name}</strong>
                      {o.note && <span className="text-[11px] text-ink-500">{o.note}</span>}
                    </div>
                    <span
                      className={`grid size-6 place-items-center rounded-md border ${
                        selected ? "border-brand-600 bg-brand-600 text-white" : "border-ink-900/20 bg-white"
                      }`}
                    >
                      {selected && <Check className="size-4" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ÁGUAS & SUCOS */}
        {categorized.watersJuices.length > 0 && (
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-brand-900">
              💧 Águas, Sucos & Bar de Bordo
            </h3>
            <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
              {categorized.watersJuices.map((o) => {
                const selected = chosen.includes(o.id) && !none;
                return (
                  <button
                    type="button"
                    key={o.id}
                    onClick={() => toggleOffer(o.id)}
                    className={`flex items-center justify-between rounded-xl border p-3.5 text-left transition ${
                      selected
                        ? "border-brand-600 bg-brand-50/80 shadow-sm"
                        : "border-ink-900/10 bg-white hover:bg-sand-50"
                    }`}
                  >
                    <div>
                      <strong className="block text-sm text-ink-900">{o.product_name ?? o.name}</strong>
                      {o.note && <span className="text-[11px] text-ink-500">{o.note}</span>}
                    </div>
                    <span
                      className={`grid size-6 place-items-center rounded-md border ${
                        selected ? "border-brand-600 bg-brand-600 text-white" : "border-ink-900/20 bg-white"
                      }`}
                    >
                      {selected && <Check className="size-4" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* NÃO QUERO BEBIDAS */}
        <label className="flex items-center gap-3 rounded-xl border border-ink-900/10 bg-gray-50/70 p-3.5 text-xs font-bold text-ink-800 cursor-pointer">
          <input
            type="checkbox"
            checked={none}
            onChange={(e) => {
              setNone(e.target.checked);
              if (e.target.checked) setChosen([]);
            }}
            className="size-4 accent-brand-600"
          />
          <span>Não consumo bebidas alcoólicas ou não desejo nenhuma opção pré-selecionada.</span>
        </label>

        {/* RESTRIÇÕES ALIMENTARES */}
        <div className="border-t border-ink-900/10 pt-6">
          <h3 className="text-sm font-black text-brand-900">Restrições e Cuidados Alimentares</h3>
          <p className="mt-1 text-xs text-ink-500">
            Nossos almoços no rio (sashimi, churrasco de praia e ceviche) e jantares são preparados com cuidado.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {restrictions.map(([code, label]) => {
              const active = codes.includes(code);
              return (
                <button
                  type="button"
                  key={code}
                  onClick={() =>
                    setCodes((current) =>
                      code === "none"
                        ? ["none"]
                        : current.includes(code)
                        ? current.filter((x) => x !== code)
                        : [...current.filter((x) => x !== "none"), code]
                    )
                  }
                  className={`rounded-full border px-4 py-2 text-xs font-bold transition ${
                    active
                      ? "border-brand-600 bg-brand-100 text-brand-900 shadow-sm"
                      : "border-ink-900/15 bg-white text-ink-700 hover:bg-sand-50"
                  }`}
                >
                  {active ? "✓ " : ""}{label}
                </button>
              );
            })}
          </div>

          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Detalhes sobre alergias ou preferências adicionais (opcional se marcado 'Sem restrições')..."
            className="mt-3 min-h-20 w-full rounded-xl border border-ink-900/15 p-3 text-xs outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          />
        </div>

        {failure && <p className="text-xs font-bold text-red-700">{failure}</p>}
        {success && (
          <p className="rounded-lg bg-emerald-50 p-3 text-xs font-bold text-emerald-800 border border-emerald-300">
            ✓ Preferências salvas com sucesso!
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="min-h-11 w-full rounded-xl bg-brand-600 font-bold text-white shadow hover:bg-brand-700 transition disabled:opacity-50 text-sm"
        >
          {busy ? "Salvando preferências..." : "Salvar Escolha de Bebidas & Alimentação"}
        </button>
      </form>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// GEAR SECTION (ALUGUEL / COMPRA DE TRALHA DE PESCA)
// -----------------------------------------------------------------------------
function GearSection({
  id,
  person,
  durationDays,
  saved,
}: {
  id: string;
  person: Person;
  durationDays: number;
  saved: (d: Data) => void;
}) {
  const [hasCustomGear, setHasCustomGear] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const storageKey = `piraiba-gear-${id}-${person.id}`;
      const savedLocal = localStorage.getItem(storageKey);
      if (savedLocal) {
        const parsed = JSON.parse(savedLocal);
        return parsed.hasCustomGear !== false;
      }
    } catch {
      // ignore
    }
    return true;
  });
  const [activeCategory, setActiveCategory] = useState<GearCategory>("RODS_REELS");
  const [selectedGear, setSelectedGear] = useState<Record<string, { mode: "RENTAL" | "PURCHASE"; qty: number }>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const storageKey = `piraiba-gear-${id}-${person.id}`;
      const savedLocal = localStorage.getItem(storageKey);
      if (savedLocal) {
        const parsed = JSON.parse(savedLocal);
        return parsed.items || {};
      }
    } catch {
      // ignore
    }
    return {};
  });
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [notes, setNotes] = useState<string>(() => {
    if (typeof window === "undefined") return person.operational_notes || "";
    try {
      const storageKey = `piraiba-gear-${id}-${person.id}`;
      const savedLocal = localStorage.getItem(storageKey);
      if (savedLocal) {
        const parsed = JSON.parse(savedLocal);
        if (parsed.notes) return parsed.notes;
      }
    } catch {
      // ignore
    }
    return person.operational_notes || "";
  });

  function toggleGear(item: GearItem, defaultMode: "RENTAL" | "PURCHASE") {
    setSelectedGear((current) => {
      const existing = current[item.id];
      if (existing) {
        const updated = { ...current };
        delete updated[item.id];
        return updated;
      } else {
        return {
          ...current,
          [item.id]: {
            mode: item.supportsRental ? defaultMode : "PURCHASE",
            qty: 1,
          },
        };
      }
    });
  }

  function setItemMode(itemId: string, mode: "RENTAL" | "PURCHASE") {
    setSelectedGear((current) => {
      if (!current[itemId]) return current;
      return {
        ...current,
        [itemId]: { ...current[itemId], mode },
      };
    });
  }

  // Calculate order total
  const orderTotalCents = useMemo(() => {
    return Object.entries(selectedGear).reduce((total, [itemId, config]) => {
      const item = GEAR_CATALOG.find((g) => g.id === itemId);
      if (!item) return total;
      if (config.mode === "RENTAL") {
        return total + item.rentalPriceDailyCents * durationDays * config.qty;
      }
      return total + item.purchasePriceCents * config.qty;
    }, 0);
  }, [selectedGear, durationDays]);

  const selectedCount = Object.keys(selectedGear).length;

  async function saveGearSelection() {
    setBusy(true);
    setSuccess(false);
    try {
      const storageKey = `piraiba-gear-${id}-${person.id}`;
      localStorage.setItem(
        storageKey,
        JSON.stringify({ items: selectedGear, hasCustomGear, notes })
      );

      // Save summary in operational_notes via participant patch
      const gearSummaryText = hasCustomGear && selectedCount > 0
        ? `[Tralha Selecionada: ${selectedCount} itens - Total ${money(orderTotalCents)}] ${notes}`
        : `[Tralha própria do pescador] ${notes}`;

      const res = await result(
        await fetch(`${API}/me/reservations/${id}/participants/${person.id}/`, {
          method: "PATCH",
          headers: { ...headers(), "Content-Type": "application/json" },
          body: JSON.stringify({ operational_notes: gearSummaryText }),
        })
      );
      saved(res);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (e) {
      alert("Não foi possível salvar os dados da tralha: " + errorMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const filteredItems = GEAR_CATALOG.filter((item) => item.category === activeCategory);

  return (
    <Card title={`Tralha & Equipamentos de Pesca (${person.full_name})`} icon={Fish}>
      <div className="rounded-xl border border-brand-500/20 bg-brand-50/60 p-4 text-xs text-brand-950">
        <p className="font-bold flex items-center gap-2 text-brand-900">
          <Fish className="size-4 text-brand-700" />
          Equipamentos Especiais para Gigantes do Araguaia
        </p>
        <p className="mt-1 leading-relaxed text-ink-700">
          Pescar piraíbas de 2 metros e pirararas pesadas exige linhas 0.70mm+, anzóis encastoados e freios de alta performance.
          Você pode trazer seu próprio equipamento ou alugar / comprar conjuntos prontos revisados e montados pelos nossos guias nativos.
        </p>
      </div>

      {/* RADIO TOGGLE: PRÓPRIA VS ALUGAR/COMPRAR */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label
          className={`flex items-center gap-3 rounded-xl border p-4 cursor-pointer transition ${
            !hasCustomGear
              ? "border-brand-600 bg-brand-50/80 shadow-sm"
              : "border-ink-900/10 bg-white hover:bg-sand-50"
          }`}
        >
          <input
            type="radio"
            name="gear-choice"
            checked={!hasCustomGear}
            onChange={() => setHasCustomGear(false)}
            className="size-4 accent-brand-600"
          />
          <div>
            <strong className="block text-sm text-brand-900">Vou levar minha própria tralha</strong>
            <small className="text-xs text-ink-500">Tenho varas, carretilhas, linhas e terminais pesados.</small>
          </div>
        </label>

        <label
          className={`flex items-center gap-3 rounded-xl border p-4 cursor-pointer transition ${
            hasCustomGear
              ? "border-brand-600 bg-brand-50/80 shadow-sm"
              : "border-ink-900/10 bg-white hover:bg-sand-50"
          }`}
        >
          <input
            type="radio"
            name="gear-choice"
            checked={hasCustomGear}
            onChange={() => setHasCustomGear(true)}
            className="size-4 accent-brand-600"
          />
          <div>
            <strong className="block text-sm text-brand-900">Desejo Alugar ou Comprar Equipamentos</strong>
            <small className="text-xs text-ink-500">Receba conjuntos montados e revisados a bordo.</small>
          </div>
        </label>
      </div>

      {hasCustomGear && (
        <div className="mt-8 border-t border-ink-900/10 pt-6">
          {/* CATEGORY SELECTOR */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {GEAR_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                  activeCategory === cat.id
                    ? "bg-brand-800 text-white shadow-sm"
                    : "border border-ink-900/10 bg-white text-ink-700 hover:bg-sand-50"
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          {/* GEAR ITEMS GRID */}
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {filteredItems.map((item) => {
              const selected = selectedGear[item.id];
              const mode = selected?.mode ?? (item.supportsRental ? "RENTAL" : "PURCHASE");

              return (
                <article
                  key={item.id}
                  className={`flex flex-col justify-between rounded-2xl border p-4 transition ${
                    selected
                      ? "border-brand-600 bg-brand-50/40 shadow-md"
                      : "border-ink-900/10 bg-white hover:border-brand-300"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        {item.badge && (
                          <span className="inline-block rounded-md bg-sand-200 px-2 py-0.5 text-[10px] font-black uppercase text-sand-900 mb-1">
                            {item.badge}
                          </span>
                        )}
                        <h4 className="text-sm font-black text-brand-900 leading-tight">{item.name}</h4>
                        <span className="text-[11px] font-semibold text-brand-700 block mt-0.5">
                          🎯 Foco: {item.targetSpecies}
                        </span>
                      </div>

                      {/* CHECK / REMOVE BUTTON */}
                      <button
                        type="button"
                        onClick={() => toggleGear(item, mode)}
                        className={`shrink-0 rounded-lg p-1.5 transition ${
                          selected
                            ? "bg-brand-600 text-white hover:bg-red-600"
                            : "border border-ink-900/20 bg-white text-ink-400 hover:bg-brand-50 hover:text-brand-700"
                        }`}
                        title={selected ? "Remover do pedido" : "Adicionar ao pedido"}
                      >
                        {selected ? <Check className="size-4" /> : <Plus className="size-4" />}
                      </button>
                    </div>

                    <p className="mt-2 text-xs text-ink-600 leading-relaxed">{item.description}</p>

                    {/* SPECS LIST */}
                    <ul className="mt-3 space-y-1 rounded-xl bg-gray-50/80 p-2.5 text-[11px] text-ink-700 border border-gray-100">
                      {item.specs.map((spec, sIdx) => (
                        <li key={sIdx} className="flex items-start gap-1.5">
                          <span className="text-brand-600 font-bold">•</span>
                          <span>{spec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* PRICE & ACTION SECTION */}
                  <div className="mt-4 border-t border-ink-900/10 pt-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      {/* RENTAL / PURCHASE SWITCH */}
                      <div className="flex items-center gap-1.5 text-xs font-bold">
                        {item.supportsRental && (
                          <button
                            type="button"
                            onClick={() => {
                              if (!selected) toggleGear(item, "RENTAL");
                              else setItemMode(item.id, "RENTAL");
                            }}
                            className={`rounded-lg px-2.5 py-1.5 transition ${
                              selected && mode === "RENTAL"
                                ? "bg-brand-700 text-white"
                                : "bg-gray-100 text-ink-700 hover:bg-gray-200"
                            }`}
                          >
                            Aluguel: {money(item.rentalPriceDailyCents)}/dia
                          </button>
                        )}

                        {item.supportsPurchase && (
                          <button
                            type="button"
                            onClick={() => {
                              if (!selected) toggleGear(item, "PURCHASE");
                              else setItemMode(item.id, "PURCHASE");
                            }}
                            className={`rounded-lg px-2.5 py-1.5 transition ${
                              selected && mode === "PURCHASE"
                                ? "bg-brand-700 text-white"
                                : "bg-gray-100 text-ink-700 hover:bg-gray-200"
                            }`}
                          >
                            Compra: {money(item.purchasePriceCents)}
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleGear(item, mode)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition shadow-sm ${
                          selected
                            ? "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                            : "bg-brand-600 text-white hover:bg-brand-700"
                        }`}
                      >
                        {selected ? "Remover" : "Adicionar"}
                      </button>
                    </div>

                    {selected && (
                      <p className="mt-2 text-[11px] font-semibold text-brand-800">
                        {mode === "RENTAL"
                          ? `✓ Aluguel reservado para os ${durationDays} dias: ${money(item.rentalPriceDailyCents * durationDays)}`
                          : `✓ Item adicionado para compra: ${money(item.purchasePriceCents)}`}
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {/* LIVE SUMMARY BOX */}
          <div className="mt-8 rounded-2xl border-2 border-brand-600 bg-sand-50 p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-brand-700">
                  Resumo da Tralha ({person.full_name})
                </span>
                <p className="mt-1 text-sm font-semibold text-ink-900">
                  {selectedCount === 0
                    ? "Nenhum item adicional selecionado até o momento."
                    : `${selectedCount} item(ns) selecionado(s) para a pescaria.`}
                </p>
                <small className="text-[11px] text-ink-500">
                  O valor pode ser pago no check-in da pousada (PIX ou cartão) ou antecipado com o saldo.
                </small>
              </div>

              <div className="text-right">
                <span className="text-xs text-ink-500 block">Total Previsto da Tralha</span>
                <strong className="text-2xl font-black text-brand-800">{money(orderTotalCents)}</strong>
              </div>
            </div>

            {selectedCount > 0 && (
              <div className="mt-4 border-t border-sand-300 pt-3 space-y-1.5 text-xs">
                {Object.entries(selectedGear).map(([itemId, cfg]) => {
                  const it = GEAR_CATALOG.find((g) => g.id === itemId);
                  if (!it) return null;
                  const itemCost =
                    cfg.mode === "RENTAL"
                      ? it.rentalPriceDailyCents * durationDays
                      : it.purchasePriceCents;
                  return (
                    <div key={itemId} className="flex justify-between text-ink-700">
                      <span>
                        • {it.name} ({cfg.mode === "RENTAL" ? `Aluguel ${durationDays}d` : "Compra"})
                      </span>
                      <strong>{money(itemCost)}</strong>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* OBSERVAÇÕES E NOTAS */}
      <div className="mt-6">
        <label className="block text-xs font-semibold text-ink-800">
          Observações sobre seu equipamento ou dúvidas específicas:
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex: Vou levar carretilha própria para tucunaré, mas preciso do conjunto de piraíba montado..."
            className="mt-2 min-h-16 w-full rounded-xl border border-ink-900/15 p-3 text-xs outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          />
        </label>
      </div>

      {success && (
        <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-xs font-bold text-emerald-800 border border-emerald-300">
          ✓ Seleção de tralha salva com sucesso para {person.full_name}!
        </p>
      )}

      <button
        type="button"
        onClick={saveGearSelection}
        disabled={busy}
        className="mt-5 min-h-11 w-full rounded-xl bg-brand-700 font-bold text-white shadow hover:bg-brand-800 transition disabled:opacity-50 text-sm"
      >
        {busy ? "Salvando..." : "Confirmar & Salvar Escolhas de Tralha"}
      </button>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// CHECKLIST SECTION
// -----------------------------------------------------------------------------
function ChecklistSection({
  id,
  person,
  items,
  saved,
}: {
  id: string;
  person: Person;
  items: Item[];
  saved: (d: Data) => void;
}) {
  const [done, setDone] = useState(person.completed_item_ids ?? []);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const [success, setSuccess] = useState(false);

  async function save() {
    setBusy(true);
    setFailure("");
    setSuccess(false);
    try {
      const d = (await result(
        await fetch(`${API}/me/reservations/${id}/participants/${person.id}/checklist/`, {
          method: "PUT",
          headers: { ...headers(), "Content-Type": "application/json"},
          body: JSON.stringify({ completed_item_ids: done }),
        })
      )) as Data;
      saved(d);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (x) {
      setFailure(errorMsg(x));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={`Checklist do Pescador (${person.full_name})`} icon={ClipboardCheck}>
      <div className="rounded-xl border border-brand-500/20 bg-brand-50/60 p-4 text-xs text-brand-950">
        <p className="font-bold flex items-center gap-2 text-brand-900">
          <ShieldCheck className="size-4 text-brand-700" />
          Documentação e Preparação Obrigatória
        </p>
        <p className="mt-1 leading-relaxed text-ink-700">
          Para que a pescaria ocorra com tranquilidade e respeito às leis ambientais, confirme os itens essenciais antes da viagem.
        </p>
      </div>

      {/* LICENÇA DE PESCA HIGHLIGHT */}
      <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50/80 p-4 text-xs text-amber-950">
        <div className="flex items-start justify-between gap-3">
          <div>
            <strong className="block text-sm font-black text-amber-900">
              ⚠️ Emissão da Licença de Pesca Amadora
            </strong>
            <p className="mt-1 text-ink-700">
              A licença federal do Ministério da Pesca ou estadual é <strong>obrigatória</strong> e deve estar válida no celular.
            </p>
          </div>
          <a
            href="https://www.gov.br/pt-br/servicos/obter-licenca-de-pescador-amador"
            target="_blank"
            rel="noreferrer"
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-amber-700 transition"
          >
            Emitir no Gov.br <ExternalLink className="size-3" />
          </a>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {items.map((i) => {
          const checked = done.includes(i.id);
          return (
            <label
              key={i.id}
              className={`flex items-start gap-3.5 rounded-xl border p-4 cursor-pointer transition ${
                checked
                  ? "border-brand-600 bg-brand-50/50 shadow-sm"
                  : "border-ink-900/10 bg-white hover:bg-sand-50"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() =>
                  setDone((c) => (c.includes(i.id) ? c.filter((x) => x !== i.id) : [...c, i.id]))
                }
                className="mt-0.5 size-4 accent-brand-600"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <strong className="text-sm font-bold text-ink-900">{i.title}</strong>
                  {i.required && (
                    <span className="rounded bg-red-100 px-2 py-0.5 text-[10px] font-black uppercase text-red-800">
                      Obrigatório
                    </span>
                  )}
                </div>
                {i.description && (
                  <p className="mt-1 text-xs text-ink-600 leading-relaxed">{i.description}</p>
                )}
              </div>
            </label>
          );
        })}

        {!items.length && <p className="text-xs text-ink-500">Nenhum item pendente no checklist.</p>}
      </div>

      {failure && <p className="mt-3 text-xs font-bold text-red-700">{failure}</p>}
      {success && (
        <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-xs font-bold text-emerald-800 border border-emerald-300">
          ✓ Checklist atualizado com sucesso!
        </p>
      )}

      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="mt-6 min-h-11 w-full rounded-xl bg-brand-600 font-bold text-white shadow hover:bg-brand-700 transition disabled:opacity-50 text-sm"
      >
        {busy ? "Salvando..." : "Salvar Checklist do Viajante"}
      </button>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// LOGISTICS SECTION
// -----------------------------------------------------------------------------
function LogisticsSection({
  expedition,
}: {
  expedition: Data["expedition"];
}) {
  const isCanoa = expedition.destination.toLowerCase().includes("canoa") || expedition.slug.includes("bandeirantes");

  return (
    <Card title="Orientações de Embarque, Logística e Pousada" icon={MapPin}>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-sm">
          <span className="text-xs font-black uppercase tracking-wider text-brand-700">
            Hospedagem & Estrutura
          </span>
          <h3 className="mt-1 text-lg font-black text-brand-900">
            {isCanoa ? "Pousada Canoa (Bandeirantes — GO)" : "Pousada Solar das Águas (São Félix — MT)"}
          </h3>
          <p className="mt-2 text-xs text-ink-600 leading-relaxed">
            {isCanoa
              ? "A Pousada Canoa conta com suítes climatizadas, piscina, pier privativo com saída rápida para os poços mais piscosos do Araguaia e culinária regional de alto padrão."
              : "A Pousada Solar das Águas oferece infraestrutura completa à beira do Araguaia, quartos confortáveis com ar-condicionado, Wi-Fi e equipe nativa de piloteiros com mais de 20 anos de rio."}
          </p>

          <div className="mt-4 space-y-2 text-xs font-semibold text-ink-800">
            <div className="flex items-center gap-2">
              <Check className="size-4 text-brand-600" />
              <span>Check-in a partir das 14h na véspera do 1º dia de pesca</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="size-4 text-brand-600" />
              <span>Café da manhã reforçado às 05:30h com saída das lanchas às 06:00h</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="size-4 text-brand-600" />
              <span>Almoço de praia com sashimi, ceviche fresco e churrasco de chão</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-sm">
          <span className="text-xs font-black uppercase tracking-wider text-brand-700">
            Como Chegar & Transfer
          </span>
          <h3 className="mt-1 text-lg font-black text-brand-900">
            Logística Rodoviária e Aérea
          </h3>
          <p className="mt-2 text-xs text-ink-600 leading-relaxed">
            {isCanoa
              ? "Para Bandeirantes/GO: Acesso via Goiânia ou Brasília com rodovias 100% asfaltadas até a cidade. Oferecemos suporte para vans e transfers executivos em grupo."
              : "Para São Félix do Araguaia/MT: Voos comerciais até Barra do Garças ou Confresa, ou chegada terrestre via Cuiabá/Goiânia. Pista de pouso homologada para táxi aéreo na cidade."}
          </p>

          <div className="mt-4 rounded-xl bg-sand-100 p-3.5 text-xs text-brand-950 border border-sand-300">
            <strong>Precisa de transfer ou carona combinada?</strong>
            <p className="mt-1 text-ink-700">
              Conectamos os participantes da mesma turma para organizar vans e carros compartilhados.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// HELPER COMPONENTS
// -----------------------------------------------------------------------------
function Payment({
  id,
  amount,
  saved,
}: {
  id: string;
  amount: number;
  saved: (d: Data) => void;
}) {
  const [charge, setCharge] = useState<{ id: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");

  async function call(confirm = false) {
    setBusy(true);
    setFailure("");
    try {
      const d = (await result(
        await fetch(`${API}/me/reservations/${id}/balance-payment/${confirm ? "confirm/" : ""}`, {
          method: "POST",
          headers: { ...headers(), "Content-Type": "application/json" },
          body: JSON.stringify(confirm ? { payment_id: charge?.id } : {}),
        })
      )) as Data;
      if (confirm) saved(d);
      else setCharge(d as never);
    } catch (x) {
      setFailure(errorMsg(x));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        onClick={() => void call(!!charge)}
        disabled={busy}
        className="w-full rounded-xl bg-brand-600 p-3 font-bold text-white hover:bg-brand-700 transition shadow text-xs"
      >
        {busy ? "Processando..." : charge ? "Simular Confirmação do Pagamento (PIX)" : `Pagar Saldo Restante (${money(amount)})`}
      </button>
      {failure && <p className="mt-2 text-xs font-bold text-red-700">{failure}</p>}
    </div>
  );
}

function Card({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof CalendarDays;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-ink-900/10 bg-white p-6 shadow-sm">
      <h2 className="flex items-center gap-2.5 text-base font-black text-brand-900">
        <span className="grid size-8 place-items-center rounded-lg bg-brand-50 text-brand-700">
          <Icon className="size-4" />
        </span>
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </article>
  );
}

function Rows({ values }: { values: string[][] }) {
  return (
    <div className="space-y-2.5 text-xs">
      {values.map(([label, val]) => (
        <div key={label} className="flex justify-between gap-3 border-b border-ink-900/5 pb-2">
          <span className="text-ink-500 font-semibold">{label}</span>
          <strong className="text-right text-ink-900">{val}</strong>
        </div>
      ))}
    </div>
  );
}

function State({ text }: { text: string }) {
  return (
    <section className="container-page min-h-[50vh] py-20 text-center text-sm font-semibold text-ink-600">
      <div className="mx-auto size-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent mb-3" />
      {text}
    </section>
  );
}

function temporalState(starts: string, ends: string) {
  const now = Date.now();
  const start = new Date(`${starts}T00:00:00`).getTime();
  const end = new Date(`${ends}T23:59:59`).getTime();
  if (now > end) return { title: "Concluída", copy: "Esta expedição já aconteceu" };
  if (now >= start) return { title: "Em Andamento", copy: "A aventura começou no Araguaia!" };
  const days = Math.ceil((start - now) / 86400000);
  return {
    title: `${days} ${days === 1 ? "Dia" : "Dias"}`,
    copy: days === 1 ? "para o embarque oficial" : "para a viagem dos gigantes",
  };
}

function derivedNotices(data: Data) {
  const values: string[] = [];
  if (data.remaining_balance_cents > 0) {
    const overdue =
      data.balance_due_at &&
      new Date(`${data.balance_due_at}T23:59:59`).getTime() < Date.now();
    values.push(
      overdue
        ? "O saldo da reserva está vencido. A simulação de quitação está disponível no painel."
        : "Há saldo pendente nesta reserva com vencimento programado."
    );
  }
  if (data.onboarding.completed < data.onboarding.total) {
    values.push("Ainda há etapas de preparação pendentes. Complete suas escolhas para agilizar o embarque.");
  }
  return values;
}

function eventLabel(value: string) {
  return (
    ({
      RESERVATION_HELD: "Vagas protegidas na expedição",
      PAYMENT_CONFIRMED: "Pagamento identificado e confirmado",
      PREFERENCES_UPDATED: "Preferências de bebidas e alimentação atualizadas",
      CHECKLIST_UPDATED: "Checklist do participante atualizado",
      RESERVATION_CANCELLED: "Reserva cancelada",
    } as Record<string, string>)[value] ?? "Atualização da reserva"
  );
}
