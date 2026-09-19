"use client";

import { useEffect, useState, useCallback, use, FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  CalendarDays,
  Check,
  ClipboardCheck,
  Fish,
  GlassWater,
  HeartPulse,
  LifeBuoy,
  MapPin,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { formatCpf, formatPhone } from "@/lib/customer-auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

type Offer = {
  id: string;
  name: string;
  unit?: string;
  note?: string;
};

type ChecklistItem = {
  id: string;
  title: string;
  description?: string;
  required: boolean;
};

type GuestData = {
  participant: {
    id: string;
    full_name: string;
    cpf?: string;
    birth_date?: string;
    phone?: string;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    vest_size?: string;
    health_notes?: string;
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
  expedition: {
    name: string;
    slug: string;
    destination: string;
    starts_at: string;
    ends_at: string;
    duration_days: number;
    departure_location?: string;
    meeting_instructions?: string;
    lodge?: {
      name: string;
      city: string;
      state: string;
      river_section?: string;
      meeting_point?: string;
      amenities?: string[];
    } | null;
    offers: Offer[];
    checklist_items: ChecklistItem[];
  };
};

const restrictionsList = [
  ["none", "Sem restrições alimentares"],
  ["vegetarian", "Vegetariano"],
  ["vegan", "Vegano"],
  ["lactose", "Intolerância à lactose"],
  ["gluten", "Restrição a glúten"],
  ["allergy", "Alergia alimentar específica"],
  ["other", "Outros cuidados"],
];

const dateStr = (v: string) =>
  new Date(`${v}T12:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export default function GuestPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<GuestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"FICHA" | "BEVERAGES" | "CHECKLIST" | "LOGISTICS">("FICHA");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/me/guest/${token}/`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Link de convidado inválido ou expirado.");
      }
      const d = (await res.json()) as GuestData;
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar dados do convidado.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <main className="min-h-screen bg-sand-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Fish className="size-10 animate-bounce text-brand-600 mx-auto mb-3" />
          <p className="text-sm font-bold text-ink-600">Carregando dados da sua pescaria...</p>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-sand-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl bg-white p-8 text-center shadow-lg border border-ink-100">
          <AlertCircle className="size-12 text-red-500 mx-auto mb-3" />
          <h1 className="text-lg font-black text-ink-900">Acesso Não Autorizado</h1>
          <p className="text-sm text-ink-600 mt-2 leading-relaxed">{error || "Link inválido ou expirado."}</p>
          <Link
            href="/"
            className="mt-6 inline-flex rounded-xl bg-brand-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-brand-700 transition-colors"
          >
            Ir para a Página Inicial
          </Link>
        </div>
      </main>
    );
  }

  const { participant, expedition } = data;

  return (
    <main className="min-h-screen bg-sand-50 pb-16">
      {/* Top Header */}
      <header className="border-b border-ink-100 bg-white sticky top-0 z-30 shadow-xs">
        <div className="container-page flex min-h-16 items-center justify-between gap-4 py-2">
          <Link href="/" className="flex items-center gap-3 text-brand-700">
            <Image
              src="/brand/logo-expedicao-piraiba.png"
              alt="Logo"
              width={48}
              height={48}
              className="size-10 rounded-full object-cover sm:size-12"
            />
            <div>
              <strong className="block text-sm font-black tracking-wide sm:text-base">EXPEDIÇÃO PIRAÍBA</strong>
              <span className="block text-[8px] font-bold tracking-[0.35em]">PORTAL DO CONVIDADO</span>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
              <ShieldCheck className="size-3.5" />
              <span>Convidado Confirmado</span>
            </span>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <div className="bg-brand-900 text-white py-8 border-b border-brand-800">
        <div className="container-page">
          <span className="text-xs font-bold uppercase tracking-wider text-brand-300">
            Ficha Oficial de Embarque
          </span>
          <h1 className="text-2xl md:text-3xl font-black mt-1">
            {expedition.name}
          </h1>
          <div className="mt-3 flex flex-wrap gap-4 text-xs font-semibold text-brand-200">
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4 text-brand-400" />
              {expedition.destination}
            </span>
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-4 text-brand-400" />
              {dateStr(expedition.starts_at)} até {dateStr(expedition.ends_at)}
            </span>
            <span className="flex items-center gap-1.5">
              <UserCheck className="size-4 text-brand-400" />
              Passageiro: {participant.full_name || "Convidado"}
            </span>
          </div>
        </div>
      </div>

      <div className="container-page py-6">
        {/* Navigation Tabs */}
        <div className="flex gap-2 border-b border-ink-200 pb-3 overflow-x-auto">
          {[
            { id: "FICHA", label: "Ficha de Embarque", icon: UserCheck },
            { id: "BEVERAGES", label: "Bebidas All Inclusive & Alimentação", icon: GlassWater },
            { id: "CHECKLIST", label: "Checklist de Viagem", icon: ClipboardCheck },
            { id: "LOGISTICS", label: "Encontro & Pousada", icon: MapPin },
          ].map((tab) => {
            const TabIcon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
                  active
                    ? "bg-brand-600 text-white shadow-sm"
                    : "border border-ink-200 bg-white text-ink-700 hover:bg-sand-100"
                }`}
              >
                <TabIcon className="size-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: Ficha de Embarque */}
        {activeTab === "FICHA" && (
          <GuestFichaForm token={token} participant={participant} onUpdated={setData} />
        )}

        {/* Tab 2: Bebidas */}
        {activeTab === "BEVERAGES" && (
          <GuestBeveragesForm
            token={token}
            offers={expedition.offers}
            participant={participant}
            onUpdated={setData}
          />
        )}

        {/* Tab 3: Checklist */}
        {activeTab === "CHECKLIST" && (
          <GuestChecklistForm
            token={token}
            items={expedition.checklist_items}
            participant={participant}
            onUpdated={setData}
          />
        )}

        {/* Tab 4: Logística */}
        {activeTab === "LOGISTICS" && (
          <GuestLogistics expedition={expedition} />
        )}
      </div>
    </main>
  );
}

function GuestFichaForm({
  token,
  participant,
  onUpdated,
}: {
  token: string;
  participant: GuestData["participant"];
  onUpdated: (d: GuestData) => void;
}) {
  const [fullName, setFullName] = useState(participant.full_name || "");
  const [cpf, setCpf] = useState(participant.cpf ? formatCpf(participant.cpf) : "");
  const [birthDate, setBirthDate] = useState(participant.birth_date || "");
  const [phone, setPhone] = useState(participant.phone ? formatPhone(participant.phone) : "");
  const [emergencyName, setEmergencyName] = useState(participant.emergency_contact_name || "");
  const [emergencyPhone, setEmergencyPhone] = useState(
    participant.emergency_contact_phone ? formatPhone(participant.emergency_contact_phone) : ""
  );
  const [vestSize, setVestSize] = useState(participant.vest_size || "G");
  const [healthNotes, setHealthNotes] = useState(participant.health_notes || "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch(`${API}/me/guest/${token}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          cpf: cpf.replace(/\D/g, ""),
          birth_date: birthDate || null,
          phone: phone,
          emergency_contact_name: emergencyName,
          emergency_contact_phone: emergencyPhone,
          vest_size: vestSize,
          health_notes: healthNotes,
        }),
      });
      const updated = await res.json();
      if (!res.ok) throw new Error(updated.detail || "Erro ao salvar dados.");
      onUpdated(updated);
      setMsg("Ficha de embarque atualizada com sucesso!");
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 max-w-3xl rounded-3xl bg-white p-6 md:p-8 shadow-sm border border-ink-100">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-black text-ink-900">Seus Dados de Embarque</h2>
          <p className="text-xs text-ink-500 mt-1">
            Estes dados são exigidos pela Capitania dos Portos e seguro de viagem.
          </p>
        </div>
        <span
          className={`px-3 py-1 text-xs font-bold rounded-full ${
            participant.onboarding_status === "COMPLETED"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-amber-50 text-amber-700 border border-amber-200"
          }`}
        >
          {participant.onboarding_status === "COMPLETED" ? "Cadastro Completo" : "Pendente"}
        </span>
      </div>

      {msg && (
        <div
          className={`mb-6 p-4 rounded-xl text-xs font-bold ${
            msg.includes("sucesso")
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {msg}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1">
              Nome Completo *
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-900 focus:border-brand-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1">
              CPF *
            </label>
            <input
              type="text"
              required
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => setCpf(formatCpf(e.target.value))}
              className="w-full rounded-xl border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-900 focus:border-brand-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1">
              Data de Nascimento
            </label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full rounded-xl border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-900 focus:border-brand-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1">
              WhatsApp / Telefone Próprio *
            </label>
            <input
              type="text"
              required
              placeholder="(00) 00000-0000"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              className="w-full rounded-xl border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-900 focus:border-brand-600 focus:outline-none"
            />
          </div>
        </div>

        <div className="border-t border-ink-100 pt-6">
          <h3 className="text-sm font-bold text-ink-900 mb-4 flex items-center gap-2">
            <LifeBuoy className="size-4 text-brand-600" />
            <span>Equipamentos e Contatos de Emergência</span>
          </h3>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1">
                Tamanho do Colete Salva-Vidas / Camiseta UV
              </label>
              <select
                value={vestSize}
                onChange={(e) => setVestSize(e.target.value)}
                className="w-full rounded-xl border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-900 focus:border-brand-600 focus:outline-none bg-white"
              >
                {["P", "M", "G", "GG", "XG", "EXG"].map((s) => (
                  <option key={s} value={s}>
                    Tamanho {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1">
                Nome do Contato de Emergência *
              </label>
              <input
                type="text"
                required
                placeholder="Nome de parente ou amigo"
                value={emergencyName}
                onChange={(e) => setEmergencyName(e.target.value)}
                className="w-full rounded-xl border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-900 focus:border-brand-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1">
                Telefone de Emergência *
              </label>
              <input
                type="text"
                required
                placeholder="(00) 00000-0000"
                value={emergencyPhone}
                onChange={(e) => setEmergencyPhone(formatPhone(e.target.value))}
                className="w-full rounded-xl border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-900 focus:border-brand-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1">
              Observações Médicas e de Saúde
            </label>
            <textarea
              rows={2}
              placeholder="Alergias a medicamentos (dipirona, etc.), pressão alta, diabetes ou qualquer cuidado especial..."
              value={healthNotes}
              onChange={(e) => setHealthNotes(e.target.value)}
              className="w-full rounded-xl border border-ink-200 px-4 py-2.5 text-sm text-ink-900 focus:border-brand-600 focus:outline-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving || !fullName || !phone || !emergencyName || !emergencyPhone}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors shadow-sm"
        >
          {saving ? "Salvando Ficha..." : "Salvar Ficha de Embarque"}
        </button>
      </form>
    </div>
  );
}

function GuestBeveragesForm({
  token,
  offers,
  participant,
  onUpdated,
}: {
  token: string;
  offers: Offer[];
  participant: GuestData["participant"];
  onUpdated: (d: GuestData) => void;
}) {
  const [selected, setSelected] = useState<string[]>(participant.selected_offer_ids || []);
  const [noBeverages, setNoBeverages] = useState<boolean>(Boolean(participant.no_beverages));
  const [restrictions, setRestrictions] = useState<string[]>(participant.dietary_restriction_codes || ["none"]);
  const [details, setDetails] = useState(participant.dietary_details || "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  function toggleOffer(id: string) {
    setNoBeverages(false);
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleNoneBeverages() {
    setNoBeverages(true);
    setSelected([]);
  }

  function toggleRestriction(code: string) {
    if (code === "none") {
      setRestrictions(["none"]);
      return;
    }
    const filtered = restrictions.filter((c) => c !== "none");
    if (filtered.includes(code)) {
      const res = filtered.filter((c) => c !== code);
      setRestrictions(res.length ? res : ["none"]);
    } else {
      setRestrictions([...filtered, code]);
    }
  }

  async function handleSave() {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch(`${API}/me/guest/${token}/preferences/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selected_offer_ids: selected,
          no_beverages: noBeverages,
          dietary_restriction_codes: restrictions,
          dietary_details: details,
        }),
      });
      const updated = await res.json();
      if (!res.ok) throw new Error(updated.detail || "Erro ao salvar preferências.");
      onUpdated(updated);
      setMsg("Preferências de bebidas e alimentação salvas!");
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 max-w-3xl rounded-3xl bg-white p-6 md:p-8 shadow-sm border border-ink-100 space-y-8">
      <div>
        <h2 className="text-xl font-black text-ink-900">Cardápio de Bebidas All Inclusive</h2>
        <p className="text-xs text-ink-500 mt-1">
          Selecione as cervejas e refrigerantes que você deseja disponíveis geladas no barco e na pousada.
        </p>

        <div className="mt-4 grid sm:grid-cols-2 gap-3">
          {offers.map((o) => {
            const active = selected.includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => toggleOffer(o.id)}
                className={`flex items-center justify-between p-4 rounded-2xl border text-left transition-all ${
                  active
                    ? "border-brand-600 bg-brand-50/70 text-brand-900"
                    : "border-ink-200 bg-white text-ink-700 hover:bg-sand-50"
                }`}
              >
                <div>
                  <strong className="block text-sm font-bold">{o.name}</strong>
                  <span className="text-xs text-ink-500">{o.unit || "Disponível na viagem"}</span>
                </div>
                <div
                  className={`size-6 rounded-full flex items-center justify-center border ${
                    active ? "bg-brand-600 border-brand-600 text-white" : "border-ink-300"
                  }`}
                >
                  {active && <Check className="size-4" />}
                </div>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleNoneBeverages}
          className={`mt-3 text-xs font-bold underline ${
            noBeverages ? "text-brand-700" : "text-ink-500 hover:text-ink-800"
          }`}
        >
          {noBeverages ? "✓ Opção selecionada: Não consumo bebidas alcoólicas nem refrigerantes" : "Não consumo bebidas alcoólicas nem refrigerantes"}
        </button>
      </div>

      <div className="border-t border-ink-100 pt-6">
        <h3 className="text-sm font-bold text-ink-900 mb-3">Restrições Alimentares</h3>
        <div className="flex flex-wrap gap-2">
          {restrictionsList.map(([code, label]) => {
            const active = restrictions.includes(code);
            return (
              <button
                key={code}
                type="button"
                onClick={() => toggleRestriction(code)}
                className={`rounded-xl px-3.5 py-2 text-xs font-bold border transition ${
                  active
                    ? "bg-brand-600 border-brand-600 text-white"
                    : "bg-white border-ink-200 text-ink-700 hover:bg-sand-50"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {restrictions.some((c) => c !== "none") && (
          <div className="mt-4">
            <label className="block text-xs font-bold text-ink-700 mb-1">
              Detalhes da Restrição / Alergia Alimentar
            </label>
            <input
              type="text"
              placeholder="Descreva detalhes ou alimentos que não pode consumir..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="w-full rounded-xl border border-ink-200 px-4 py-2 text-sm text-ink-900 focus:border-brand-600 focus:outline-none"
            />
          </div>
        )}
      </div>

      {msg && (
        <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
          {msg}
        </div>
      )}

      <button
        type="button"
        disabled={saving}
        onClick={handleSave}
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-brand-700 transition-colors shadow-sm"
      >
        {saving ? "Salvando..." : "Salvar Bebidas & Alimentação"}
      </button>
    </div>
  );
}

function GuestChecklistForm({
  token,
  items,
  participant,
  onUpdated,
}: {
  token: string;
  items: ChecklistItem[];
  participant: GuestData["participant"];
  onUpdated: (d: GuestData) => void;
}) {
  const [completed, setCompleted] = useState<string[]>(participant.completed_item_ids || []);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  function toggleItem(id: string) {
    setCompleted((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSave() {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch(`${API}/me/guest/${token}/checklist/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed_item_ids: completed }),
      });
      const updated = await res.json();
      if (!res.ok) throw new Error(updated.detail || "Erro ao salvar checklist.");
      onUpdated(updated);
      setMsg("Checklist atualizado com sucesso!");
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 max-w-3xl rounded-3xl bg-white p-6 md:p-8 shadow-sm border border-ink-100">
      <h2 className="text-xl font-black text-ink-900">Checklist Pessoal da Viagem</h2>
      <p className="text-xs text-ink-500 mt-1 mb-6">
        Marque os itens obrigatórios e recomendados conforme for preparando sua bagagem.
      </p>

      <div className="space-y-3">
        {items.map((item) => {
          const checked = completed.includes(item.id);
          return (
            <div
              key={item.id}
              onClick={() => toggleItem(item.id)}
              className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition ${
                checked ? "bg-emerald-50/60 border-emerald-300" : "bg-white border-ink-200 hover:bg-sand-50"
              }`}
            >
              <div
                className={`size-5 mt-0.5 rounded-md flex items-center justify-center border shrink-0 ${
                  checked ? "bg-emerald-600 border-emerald-600 text-white" : "border-ink-300 bg-white"
                }`}
              >
                {checked && <Check className="size-3.5 stroke-[3]" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-ink-900">{item.title}</span>
                  {item.required && (
                    <span className="text-[10px] uppercase font-extrabold bg-red-50 text-red-700 px-1.5 py-0.5 rounded">
                      Obrigatório
                    </span>
                  )}
                </div>
                {item.description && <p className="text-xs text-ink-500 mt-0.5">{item.description}</p>}
              </div>
            </div>
          );
        })}
      </div>

      {msg && (
        <div className="mt-4 p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
          {msg}
        </div>
      )}

      <button
        type="button"
        disabled={saving}
        onClick={handleSave}
        className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-brand-700 transition-colors shadow-sm"
      >
        {saving ? "Salvando..." : "Salvar Checklist"}
      </button>
    </div>
  );
}

function GuestLogistics({ expedition }: { expedition: GuestData["expedition"] }) {
  return (
    <div className="mt-6 max-w-3xl rounded-3xl bg-white p-6 md:p-8 shadow-sm border border-ink-100 space-y-6">
      <div>
        <h2 className="text-xl font-black text-ink-900">Orientações de Embarque</h2>
        <p className="text-xs text-ink-500 mt-1">
          Confira local de saída, pousada e recomendações de encontro.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-sand-50 border border-ink-100">
          <span className="text-xs font-bold text-brand-700 uppercase">Ponto de Partida</span>
          <p className="text-sm font-extrabold text-ink-900 mt-1">
            {expedition.departure_location || expedition.destination}
          </p>
        </div>

        {expedition.lodge && (
          <div className="p-4 rounded-2xl bg-sand-50 border border-ink-100">
            <span className="text-xs font-bold text-brand-700 uppercase">Pousada Parceira</span>
            <p className="text-sm font-extrabold text-ink-900 mt-1">
              {expedition.lodge.name} ({expedition.lodge.city}/{expedition.lodge.state})
            </p>
          </div>
        )}
      </div>

      {expedition.meeting_instructions && (
        <div className="p-4 rounded-2xl border border-ink-200 bg-white">
          <span className="text-xs font-bold uppercase text-ink-400 block mb-1">
            Instruções Operacionais
          </span>
          <p className="text-sm text-ink-800 leading-relaxed whitespace-pre-line">
            {expedition.meeting_instructions}
          </p>
        </div>
      )}

      {expedition.lodge?.amenities && expedition.lodge.amenities.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-ink-700 uppercase mb-2">Comodidades da Base</h3>
          <div className="flex flex-wrap gap-2">
            {expedition.lodge.amenities.map((a, i) => (
              <span key={i} className="text-xs bg-ink-50 text-ink-700 px-3 py-1 rounded-lg border border-ink-100">
                ✓ {a}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
