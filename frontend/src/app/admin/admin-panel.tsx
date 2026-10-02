"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, Beer, CalendarDays, Check, ChevronLeft, ChevronRight, Compass, Copy, Download, ExternalLink, FileText, Fish, House, ImageIcon, Layers, ListChecks, LogOut, Menu, Package, Pencil, Plus, Printer, RefreshCw, Search, Share2, ShieldCheck, ShoppingCart, Sparkles, TicketCheck, Trash2, Users, X } from "lucide-react";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
type Section = "overview" | "reservations" | "expeditions" | "lodges" | "rivers" | "species" | "packages" | "gear" | "customers" | "manifest" | "configuration" | "shopping";
type Amenity = { id: string; name: string; category: string; category_display: string; icon_key?: string; description?: string; display_order: number; active: boolean };
type RiverSpecies = { id: string; species: string; species_name: string; species_slug: string; scientific_name?: string; category?: string; is_native: boolean; is_trophy: boolean; best_season?: string };
type River = { id: string; name: string; slug: string; basin: string; basin_display: string; states: string[]; description?: string; regulations?: string; active: boolean; species_count?: number; lodges_count?: number; created_at?: string; updated_at?: string };
type Lodge = { id: string; name: string; slug: string; city: string; state: string; river_section?: string; river?: River | null; river_id?: string | null; description?: string; boat_fleet_details?: string; amenities?: string[]; amenities_detailed?: { id: string; name: string; category: string; category_display: string; icon_key?: string; description?: string }[]; target_species?: Species[]; meeting_point?: string; directions?: string; cover_image_url?: string; active: boolean };
type Species = { id?: string; common_name: string; slug: string; scientific_name?: string; category: string; active?: boolean };
type AllInclusivePackage = { id: string; name: string; slug: string; description: string; inclusions: string[]; active: boolean; expeditions_count?: number; created_at?: string; updated_at?: string };
type BeveragePackageItem = { id?: string; product?: number | string; product_id?: number | string; product_name?: string; product_category?: string; product_unit?: string; standard_quantity_per_participant: number; display_order: number; note: string };
type BeveragePackage = { id: string; name: string; slug: string; description: string; active: boolean; items: BeveragePackageItem[]; expeditions_count?: number; created_at?: string; updated_at?: string };
type FishingGearProduct = { id: string; name: string; slug: string; category: string; category_display: string; modality: "RENTAL" | "SALE" | "BOTH"; modality_display: string; technical_specs: Record<string, string>; rental_price_cents: number; sale_price_cents: number; inventory_quantity: number; image_url: string; description: string; active: boolean; addons_count?: number; created_at?: string; updated_at?: string };
type ReservationGearAddon = { id: string; reservation?: string; participant?: string | null; participant_name?: string | null; gear_product: string; gear_product_id?: string; gear_product_name: string; gear_product_category: string; gear_product_category_display: string; modality: "RENTAL" | "SALE"; quantity: number; unit_price_cents: number; total_price_cents: number; notes: string; delivered: boolean; created_at: string };
type CustomerProfile = { id?: string; rg?: string; rg_issuer?: string; birth_date?: string | null; city?: string; state?: string; fishing_license_number?: string; fishing_license_expiry?: string | null; has_valid_license?: boolean; default_vest_size?: string; dietary_notes?: string; medical_notes?: string; emergency_contact_name?: string; emergency_contact_phone?: string; internal_admin_notes?: string; created_at?: string; updated_at?: string };
type CustomerCRM = { id: string; cpf: string; full_name: string; email: string; phone: string; city: string; state: string; has_valid_license: boolean; total_reservations: number; lifetime_value_cents: number; last_expedition_name?: string; last_expedition_date?: string; created_at: string; profile?: CustomerProfile; reservations?: { id: string; expedition_name: string; starts_at: string; status: string; participant_count: number; total_price_cents: number; paid_amount_cents: number; remaining_balance_cents: number; gear_addons_count: number; created_at: string }[] };
type Expedition = { id: string; name: string; slug: string; destination: string; departure_location?: string; starts_at: string; ends_at: string; capacity: number; occupied_slots: number; available_slots: number; price_per_person_cents: number; deposit_cents: number; balance_due_days_before: number; status: string; summary: string; lodge?: Lodge | null; lodge_id?: string | null; all_inclusive_package?: { id: string; name: string; slug: string } | null; all_inclusive_package_id?: string | null; beverage_package?: { id: string; name: string; slug: string } | null; beverage_package_id?: string | null; cover_image_url?: string; target_species?: (Species & { is_primary?: boolean })[]; species_slugs?: string[]; inclusions?: string[] };
type Participant = { id: string; name: string; cpf?: string; phone: string; birth_date?: string | null; emergency_contact_name?: string; emergency_contact_phone?: string; operational_notes?: string; onboarding_status: string; preferences_confirmed?: boolean; dietary_confirmed?: boolean; checklist_completed?: boolean; selected_offers?: { id: string; name: string }[]; dietary_restrictions?: string[]; dietary_details?: string };
type OperationalAlert = { id?: string; type?: string; level?: string; title?: string; message: string; reservation_id?: string; expedition_id?: string };
type ExpeditionIndicator = { expedition_id?: string; id?: string; expedition_name?: string; name?: string; capacity: number; held_slots?: number; confirmed_slots?: number; occupied_slots?: number; available_slots: number; sold_cents?: number; received_cents?: number; outstanding_cents?: number; pending_preferences?: number; pending_checklists?: number; restrictions?: number };
type Reservation = { id: string; status: string; participant_count: number; total_price_cents: number; payment_plan: string; paid_amount_cents: number; remaining_balance_cents: number; balance_due_at: string | null; held_until: string | null; created_at: string; alerts?: (string | OperationalAlert)[]; customer: { name: string; cpf: string; email: string; phone: string }; expedition: { id: string; name: string; slug?: string; starts_at: string }; participants: Participant[]; gear_addons?: ReservationGearAddon[]; payments: { id: string; amount_cents: number; status: string; paid_at: string | null }[]; events: { id: string; event_type: string; reason: string; created_at: string }[] };
type Overview = { revenue_cents: number; sold_cents: number; outstanding_cents: number; incomplete_participants: number; reservations: { total: number; confirmed: number; awaiting: number }; alerts?: OperationalAlert[]; expedition_indicators?: ExpeditionIndicator[]; expeditions?: ExpeditionIndicator[]; upcoming_expeditions: Expedition[]; recent_reservations: Reservation[] };
type Product = { id: string; name: string; category?: string; unit: string; package_size?: number | null; aliases?: string[]; active?: boolean };
type Offer = { id?: string; product_id: string; name?: string; standard_quantity_per_participant: number; display_order: number; note: string; active: boolean };
type ChecklistItem = { id?: string; title: string; description: string; required: boolean; active: boolean; display_order: number };
type Meeting = { location: string; date: string; time: string; instructions: string };
type Configuration = { meeting?: Meeting; meeting_instructions?: string; departure_location?: string; products?: Product[]; offers: Offer[]; checklist?: ChecklistItem[]; checklist_items?: ChecklistItem[] };
type ConsolidationDetail = { reservation_id?: string; customer_name?: string; participant_id?: string; participant_name: string };
type ConsolidationRow = { offer_id: string; product: string; unit: string; people: number; standard_quantity_per_participant: number; total: number; package_size: number | null; full_packages: number | null; remainder: number | null; updated_at: string; details?: ConsolidationDetail[] };
type Consolidation = { generated_at: string; items: ConsolidationRow[]; text?: string };
type PassengerManifest = { id: string; name: string; cpf: string; phone: string; birth_date: string; emergency_contact_name: string; emergency_contact_phone: string; operational_notes: string; onboarding_status: string; dietary_restrictions: string[]; dietary_details: string; reservation_id: string; customer_name: string; customer_phone: string; reservation_status: string; gear_addons?: { id: string; gear_name: string; category: string; modality: string; quantity: number; delivered: boolean }[] };
type ManifestData = { expedition: { id: string; name: string; slug: string; destination: string; departure_location: string; lodge_name: string; starts_at: string; ends_at: string; capacity: number; total_passengers: number }; passengers: PassengerManifest[]; gear_summary?: { gear_product_id: string; name: string; category: string; modality: string; total_quantity: number; delivered_quantity: number }[]; generated_at: string };

const money = (value = 0) => (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const shortDate = (value?: string | null) => value ? new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const labels: Record<string, string> = { DRAFT: "Rascunho", PUBLISHED: "Publicada", SOLD_OUT: "Esgotada", CLOSED: "Encerrada", IN_PROGRESS: "Em andamento", COMPLETED: "Concluída", CANCELLED: "Cancelada", HELD: "Vagas protegidas", AWAITING_PAYMENT: "Aguardando pagamento", PARTIALLY_PAID: "Parcialmente paga", CONFIRMED: "Confirmada", PAID: "Paga", EXPIRED: "Expirada", REFUNDED: "Reembolsada" };
const danger = ["EXPIRED", "CANCELLED", "REFUNDED"];
function Status({ value }: { value: string }) { const tone = ["PAID", "CONFIRMED", "PUBLISHED", "COMPLETED"].includes(value) ? "bg-brand-100 text-brand-800" : danger.includes(value) ? "bg-red-100 text-red-700" : ["AWAITING_PAYMENT", "PARTIALLY_PAID"].includes(value) ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-700"; return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}>{labels[value] ?? value}</span>; }
function errorMessage(value: unknown) { if (!value || typeof value !== "object") return typeof value === "string" ? value : "Não foi possível concluir a operação."; const record = value as Record<string, unknown>; return typeof record.detail === "string" ? record.detail : Object.values(record).flat(3).join(" "); }
async function request<T>(path: string, token: string, init?: RequestInit): Promise<T> { const response = await fetch(`${api}/operations/${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers } }); const result = (response.headers.get("content-type") ?? "").includes("json") ? await response.json() : await response.text(); if (!response.ok) throw result; return result as T; }
function useData<T>(path: string | null, token: string, unauthorized: () => void) { const [data, setData] = useState<T | null>(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(Boolean(path)); const load = useCallback(async () => { if (!path) return; setLoading(true); setError(""); try { setData(await request<T>(path, token)); } catch (value) { const message = errorMessage(value); if (message.toLowerCase().includes("sessão administrativa")) unauthorized(); else setError(message); } finally { setLoading(false); } }, [path, token, unauthorized]); useEffect(() => { const task = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(task); }, [load]); return { data, error, loading, load }; }
function State({ loading, error }: { loading: boolean; error: string }) { if (loading) return <div className="rounded-xl bg-white p-10 text-center text-ink-500">Carregando dados...</div>; if (error) return <div className="rounded-xl bg-red-50 p-5 font-bold text-red-700">{error}</div>; return null; }
function Empty({ children }: { children: ReactNode }) { return <p className="p-8 text-center text-sm text-ink-500">{children}</p>; }
function Header({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) { return <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h2 className="text-2xl font-black">{title}</h2><p className="mt-1 text-sm text-ink-500">{subtitle}</p></div>{action}</div>; }

export function AdminPanel() {
  const [token, setToken] = useState<string | null>(null); const [ready, setReady] = useState(false); const [section, setSection] = useState<Section>("overview"); const [menu, setMenu] = useState(false);
  useEffect(() => { const task = window.setTimeout(() => { setToken(sessionStorage.getItem("operations-token")); setReady(true); }, 0); return () => window.clearTimeout(task); }, []);
  const logout = useCallback(() => { sessionStorage.removeItem("operations-token"); setToken(null); }, []);
  if (!ready) return <div className="min-h-screen bg-brand-900" />;
  if (!token) return <Login onLogin={value => { sessionStorage.setItem("operations-token", value); setToken(value); }} />;
  const nav = [["overview", "Visão geral", BarChart3], ["reservations", "Reservas", TicketCheck], ["expeditions", "Expedições", CalendarDays], ["lodges", "Pousadas", House], ["species", "Catálogo de Peixes", Fish], ["packages", "Pacotes & Cardápios", Layers], ["gear", "Tralhas & Loja", Package], ["customers", "CRM Pescadores", Users], ["manifest", "Manifesto", FileText], ["configuration", "Configuração", ListChecks], ["shopping", "Lista de compras", ShoppingCart]] as const;
  return <div className="min-h-screen bg-[#f4f6f2] lg:grid lg:grid-cols-[260px_1fr]">
    <aside className={`fixed inset-y-0 left-0 z-40 w-[260px] bg-brand-900 text-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${menu ? "translate-x-0" : "-translate-x-full"}`}><div className="flex h-full flex-col p-5"><div className="flex items-center gap-3 border-b border-white/10 pb-5"><Image src="/brand/logo-expedicao-piraiba.png" alt="" width={48} height={48} className="size-12 rounded-full" /><div><strong className="block text-sm">EXPEDIÇÃO PIRAÍBA</strong><span className="text-[10px] tracking-[.2em] text-white/60">PAINEL OPERACIONAL</span></div><button aria-label="Fechar menu" onClick={() => setMenu(false)} className="ml-auto lg:hidden"><X /></button></div><nav className="mt-6 space-y-2">{nav.map(([value,label,Icon]) => <button key={value} onClick={() => { setSection(value); setMenu(false); }} className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-bold ${section === value ? "bg-white text-brand-900" : "text-white/75 hover:bg-white/10"}`}><Icon className="size-5" />{label}</button>)}</nav><Link href="/" className="mt-auto flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-bold text-white/70"><Fish className="size-5" />Ver site</Link><button onClick={logout} className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-bold text-white/70"><LogOut className="size-5" />Sair</button></div></aside>
    {menu && <button aria-label="Fechar menu" className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setMenu(false)} />}
    <main className="min-w-0"><header className="flex min-h-16 items-center border-b bg-white px-5 lg:px-8"><button aria-label="Abrir menu" onClick={() => setMenu(true)} className="mr-4 lg:hidden"><Menu /></button><div><p className="text-xs font-bold uppercase tracking-widest text-brand-600">Área administrativa</p><h1 className="text-xl font-black">{nav.find(item => item[0] === section)?.[1]}</h1></div><div className="ml-auto flex items-center gap-2 text-sm text-ink-500"><ShieldCheck className="size-5 text-brand-600" /><span className="hidden sm:inline">Sessão protegida</span></div></header><div className="p-5 lg:p-8">{section === "overview" && <OverviewPanel token={token} unauthorized={logout} go={setSection} />}{section === "reservations" && <ReservationsPanel token={token} unauthorized={logout} />}{section === "expeditions" && <ExpeditionsPanel token={token} unauthorized={logout} />}{section === "lodges" && <LodgesPanel token={token} unauthorized={logout} />}{section === "rivers" && <RiversPanel token={token} unauthorized={logout} />}{section === "species" && <SpeciesPanel token={token} unauthorized={logout} />}{section === "packages" && <PackagesPanel token={token} unauthorized={logout} />}{section === "gear" && <GearPanel token={token} unauthorized={logout} />}{section === "customers" && <CustomersPanel token={token} unauthorized={logout} />}{section === "manifest" && <ManifestPanel token={token} unauthorized={logout} />}{section === "configuration" && <ConfigurationPanel token={token} unauthorized={logout} />}{section === "shopping" && <ShoppingPanel token={token} unauthorized={logout} />}</div></main>
  </div>;
}

function Login({ onLogin }: { onLogin: (token: string) => void }) { const [email,setEmail] = useState("admin@expedicaopiraiba.com.br"); const [password,setPassword] = useState("admin-local-2026"); const [error,setError] = useState(""); const [loading,setLoading] = useState(false); async function submit(event: FormEvent) { event.preventDefault(); setLoading(true); setError(""); try { const response = await fetch(`${api}/operations/login/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email,password }) }); const data = await response.json(); if (!response.ok) throw data; onLogin(data.token); } catch (value) { setError(errorMessage(value)); } finally { setLoading(false); } } return <main className="grid min-h-screen place-items-center bg-brand-900 p-5"><form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-8"><Image src="/brand/logo-expedicao-piraiba.png" alt="Expedição Piraíba" width={72} height={72} className="mx-auto rounded-full" /><h1 className="mt-5 text-center text-2xl font-black">Painel operacional</h1><label className="mt-7 block text-sm font-bold">E-mail<input type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-2 h-12 w-full rounded-lg border px-3" /></label><label className="mt-4 block text-sm font-bold">Senha<input type="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-2 h-12 w-full rounded-lg border px-3" /></label>{error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}<button disabled={loading} className="mt-5 min-h-12 w-full rounded-lg bg-brand-600 font-bold text-white">{loading ? "Entrando..." : "Entrar"}</button></form></main>; }

function OverviewPanel({ token, unauthorized, go }: { token: string; unauthorized: () => void; go: (value: Section) => void }) { const result = useData<Overview>("overview/", token, unauthorized); if (!result.data) return <State loading={result.loading} error={result.error} />; const data = result.data; const cards = [["Valor vendido", money(data.sold_cents)], ["Valor recebido", money(data.revenue_cents)], ["Saldo pendente", money(data.outstanding_cents)], ["Reservas confirmadas", data.reservations.confirmed], ["Cadastros pendentes", data.incomplete_participants], ["Reservas totais", data.reservations.total]]; const indicators=data.expedition_indicators??data.expeditions??[]; return <div><Header title="Resumo do negócio" subtitle="Financeiro, ocupação e pendências operacionais." action={<button onClick={() => void result.load()} className="rounded-lg border bg-white p-2.5"><RefreshCw className="size-5" /></button>} /><section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map(([label,value]) => <article key={label} className="rounded-xl bg-white p-5"><span className="text-sm font-bold text-ink-500">{label}</span><strong className="mt-3 block text-2xl font-black">{value}</strong></article>)}</section>{Boolean(data.alerts?.length || data.incomplete_participants) && <section className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5"><h3 className="font-black text-amber-900"><AlertTriangle className="mr-2 inline size-5" />Alertas operacionais</h3>{data.alerts?.map((alert,index) => <button key={alert.id ?? index} onClick={() => go("reservations")} className="mt-3 block w-full rounded-lg bg-white p-3 text-left text-sm"><strong>{alert.title ?? "Atenção"}</strong><span className="ml-2 text-ink-500">{alert.message}</span></button>)}{!data.alerts?.length && <p className="mt-2 text-sm">Há {data.incomplete_participants} cadastro(s) pendente(s).</p>}</section>}{indicators.length>0&&<ExpeditionIndicators items={indicators}/>}<div className="mt-6 grid gap-6 xl:grid-cols-2"><section className="rounded-xl bg-white p-5"><h3 className="font-black">Próximas expedições</h3>{data.upcoming_expeditions.map(item => <div key={item.id} className="mt-3 flex items-center gap-3 rounded-lg bg-[#f7f8f4] p-3"><CalendarDays className="text-brand-700" /><div className="flex-1"><strong>{item.name}</strong><p className="text-xs text-ink-500">{shortDate(item.starts_at)} · {item.destination}</p></div><strong>{item.occupied_slots}/{item.capacity}</strong></div>)}</section><section className="rounded-xl bg-white p-5"><h3 className="font-black">Reservas recentes</h3>{data.recent_reservations.map(item => <button key={item.id} onClick={() => go("reservations")} className="mt-3 flex w-full items-center gap-3 border-b pb-3 text-left"><div className="flex-1"><strong>{item.customer.name}</strong><p className="text-xs text-ink-500">{item.expedition.name}</p></div><Status value={item.status} /></button>)}</section></div></div>; }

function ExpeditionIndicators({items}:{items:ExpeditionIndicator[]}){return <section className="mt-6"><h3 className="text-lg font-black">Indicadores por expedição</h3><div className="mt-3 grid gap-4 xl:grid-cols-2">{items.map((item,index)=><article key={item.expedition_id??item.id??index} className="rounded-xl bg-white p-5"><div className="flex justify-between gap-3"><strong>{item.expedition_name??item.name??"Expedição"}</strong><span className="text-sm font-bold text-brand-700">{item.available_slots} vagas livres</span></div><div className="mt-4 grid grid-cols-3 gap-2 text-sm"><Indicator label="Confirmadas" value={item.confirmed_slots??item.occupied_slots??0}/><Indicator label="Em hold" value={item.held_slots??0}/><Indicator label="Capacidade" value={item.capacity}/><Indicator label="A receber" value={money(item.outstanding_cents??0)}/><Indicator label="Preferências" value={item.pending_preferences??0}/><Indicator label="Checklists" value={item.pending_checklists??0}/></div>{Boolean(item.restrictions)&&<p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs font-bold text-amber-900">{item.restrictions} participante(s) com restrição alimentar.</p>}</article>)}</div></section>}
function Indicator({label,value}:{label:string;value:string|number}){return <div><span className="block text-xs text-ink-500">{label}</span><strong>{value}</strong></div>}

function ExpeditionSelect({ value, set, items, all = true }: { value: string; set: (value: string) => void; items: Expedition[]; all?: boolean }) { return <select value={value} onChange={e => set(e.target.value)} className="min-h-11 rounded-lg border bg-white px-3 text-sm font-bold">{all ? <option value="">Todas as expedições</option> : <option value="">Selecione uma expedição</option>}{items.map(item => <option key={item.id} value={item.id}>{item.name} · {shortDate(item.starts_at)}</option>)}</select>; }
function ReservationsPanel({ token, unauthorized }: { token: string; unauthorized: () => void }) {
  const expeditions = useData<Expedition[]>("expeditions/", token, unauthorized);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [expedition, setExpedition] = useState("");
  const [selected, setSelected] = useState<Reservation | null>(null);
  const [creating, setCreating] = useState(false);
  const path = `reservations/?q=${encodeURIComponent(query)}&status=${status}&expedition=${expedition}`;
  const list = useData<Reservation[]>(path, token, unauthorized);

  async function open(id: string) {
    try {
      setSelected(await request<Reservation>(`reservations/${id}/`, token));
    } catch (value) {
      window.alert(errorMessage(value));
    }
  }

  return (
    <div>
      <Header
        title="Reservas e clientes"
        subtitle="Filtre, confira pendências e execute ações operacionais."
        action={
          <button
            onClick={() => setCreating(true)}
            className="rounded-lg bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-brand-700"
          >
            <Plus className="mr-2 inline size-4" />
            Nova reserva manual
          </button>
        }
      />
      <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
        <label className="flex min-h-11 items-center gap-2 rounded-lg border bg-white px-3">
          <Search className="size-4" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nome, CPF, telefone ou e-mail"
            className="min-w-0 flex-1 outline-none"
          />
        </label>
        <ExpeditionSelect value={expedition} set={setExpedition} items={expeditions.data ?? []} />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border bg-white px-3 font-bold"
        >
          <option value="">Todos os status</option>
          {Object.entries(labels)
            .slice(7)
            .map(([key, value]) => (
              <option key={key} value={key}>
                {value}
              </option>
            ))}
        </select>
      </div>
      <div className="mt-6">
        <State loading={list.loading} error={list.error} />
        {list.data && (
          <div className="overflow-x-auto rounded-xl bg-white">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-brand-900 text-xs uppercase text-white">
                <tr>
                  <th className="px-5 py-4">Cliente</th>
                  <th>Expedição</th>
                  <th>Progresso</th>
                  <th>Financeiro</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {list.data.map((item) => (
                  <tr key={item.id}>
                    <td className="px-5 py-4">
                      <strong>{item.customer.name}</strong>
                      <span className="block text-xs text-ink-500">{item.customer.phone}</span>
                    </td>
                    <td>
                      {item.expedition.name}
                      <span className="block text-xs">{item.participant_count} participante(s)</span>
                    </td>
                    <td>
                      {item.participants.filter((p) => p.onboarding_status === "COMPLETED").length}/
                      {item.participant_count} cadastros
                    </td>
                    <td>
                      <strong>{money(item.paid_amount_cents)}</strong>
                      <span className="block text-xs">Saldo {money(item.remaining_balance_cents)}</span>
                    </td>
                    <td>
                      <Status value={item.status} />
                    </td>
                    <td>
                      <button
                        onClick={() => void open(item.id)}
                        className="rounded-lg border px-3 py-2 text-xs font-bold"
                      >
                        Abrir detalhe
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!list.data.length && <Empty>Nenhuma reserva encontrada.</Empty>}
          </div>
        )}
      </div>
      {selected && (
        <ReservationDrawer
          item={selected}
          token={token}
          close={() => setSelected(null)}
          changed={async () => {
            await list.load();
            setSelected(null);
          }}
        />
      )}
      {creating && (
        <ManualReservationModal
          token={token}
          expeditions={expeditions.data ?? []}
          close={() => setCreating(false)}
          created={async () => {
            await list.load();
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

function ReservationDrawer({
  item,
  token,
  close,
  changed,
}: {
  item: Reservation;
  token: string;
  close: () => void;
  changed: () => Promise<void>;
}) {
  const [action, setAction] = useState<"payment" | "cancel" | "">("");
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState((item.remaining_balance_cents / 100).toFixed(2));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [addingGear, setAddingGear] = useState(false);

  async function handleToggleDelivered(addon: ReservationGearAddon) {
    try {
      await request(`reservations/${item.id}/gear-addons/${addon.id}/`, token, {
        method: "PATCH",
        body: JSON.stringify({ delivered: !addon.delivered }),
      });
      await changed();
    } catch (err) {
      window.alert(errorMessage(err));
    }
  }

  async function handleRemoveAddon(addon: ReservationGearAddon) {
    if (!window.confirm(`Deseja remover "${addon.gear_product_name}"? O estoque será devolvido e o saldo financeiro recalculado.`)) return;
    try {
      await request(`reservations/${item.id}/gear-addons/${addon.id}/`, token, {
        method: "DELETE",
      });
      await changed();
    } catch (err) {
      window.alert(errorMessage(err));
    }
  }

  async function submit() {
    if (!reason.trim()) return setError("Informe o motivo para a auditoria.");
    setSaving(true);
    try {
      const path =
        action === "payment"
          ? `reservations/${item.id}/manual-payment/`
          : `reservations/${item.id}/cancel/`;
      await request(path, token, {
        method: "POST",
        body: JSON.stringify(
          action === "payment"
            ? { amount_cents: Math.round(Number(amount.replace(",", ".")) * 100), reason }
            : { reason }
        ),
      });
      await changed();
    } catch (value) {
      setError(errorMessage(value));
    } finally {
      setSaving(false);
    }
  }

  const clientUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/expedicoes/${item.expedition.slug ?? ""}/minha-expedicao/${item.id}`;
  const whatsappPhone = item.customer.phone.replace(/\D/g, "");
  const whatsappMsg = `Olá, ${item.customer.name}! Segue o link de acesso da sua reserva na Expedição Piraíba (${item.expedition.name}):\n\n${clientUrl}\n\nSaldo restante: ${money(item.remaining_balance_cents)}.\n\nQualquer dúvida estamos à disposição!`;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/45">
      <aside className="h-full w-full max-w-2xl overflow-y-auto bg-[#f7f8f4] p-6">
        <div className="flex justify-between">
          <div>
            <Status value={item.status} />
            <h2 className="mt-3 text-2xl font-black">{item.customer.name}</h2>
            <p className="text-sm">{item.expedition.name}</p>
          </div>
          <button onClick={close}>
            <X />
          </button>
        </div>

        {/* Quick action buttons for sharing and WhatsApp */}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => {
              navigator.clipboard.writeText(clientUrl);
              setCopiedLink(true);
              setTimeout(() => setCopiedLink(false), 2000);
            }}
            className="rounded-lg border bg-white px-3 py-2 text-xs font-bold text-brand-800 shadow-sm hover:bg-brand-50"
          >
            <Copy className="mr-1.5 inline size-3.5" />
            {copiedLink ? "Link copiado!" : "Copiar Link do Cliente"}
          </button>
          <a
            href={`https://wa.me/55${whatsappPhone}?text=${encodeURIComponent(whatsappMsg)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
          >
            <Share2 className="mr-1.5 inline size-3.5" />
            Cobrança WhatsApp
          </a>
        </div>

        {item.alerts?.map((value, index) => {
          const alert = typeof value === "string" ? { message: value } : value;
          return (
            <p key={alert.id ?? index} className="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-bold">
              <AlertTriangle className="mr-2 inline size-4" />
              {alert.title ? `${alert.title}: ` : ""}
              {alert.message}
            </p>
          );
        })}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Box title="Contato">
            <p>{item.customer.email}</p>
            <p>{item.customer.phone}</p>
            <p>CPF {item.customer.cpf}</p>
          </Box>
          <Box title="Financeiro">
            <p>
              Pago: <strong>{money(item.paid_amount_cents)}</strong>
            </p>
            <p>
              Saldo: <strong>{money(item.remaining_balance_cents)}</strong>
            </p>
            <p>Vencimento: {shortDate(item.balance_due_at)}</p>
          </Box>
        </div>
        <Box title="Participantes e preparação">
          {item.participants.map((person) => (
            <div key={person.id} className="mt-3 rounded-lg border bg-[#fafbfc] p-3 shadow-xs">
              <div className="flex items-center justify-between">
                <strong>{person.name}</strong>
                <button
                  onClick={() => setEditingParticipant(person)}
                  className="rounded border bg-white px-2.5 py-1 text-xs font-bold text-brand-700 shadow-xs hover:bg-brand-50"
                >
                  <Pencil className="mr-1 inline size-3" />
                  Editar / Substituir
                </button>
              </div>
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-ink-600">
                {person.phone && <span>📱 {person.phone}</span>}
                {person.cpf && <span>CPF: {person.cpf}</span>}
                {person.emergency_contact_name && (
                  <span className="text-brand-900 font-bold">
                    🚨 Emergência: {person.emergency_contact_name} ({person.emergency_contact_phone || "s/ tel"})
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <Pill ok={person.onboarding_status === "COMPLETED"}>Cadastro</Pill>
                <Pill ok={person.preferences_confirmed}>Bebidas</Pill>
                <Pill ok={person.dietary_confirmed}>Restrições</Pill>
                <Pill ok={person.checklist_completed}>Checklist</Pill>
              </div>
              {person.selected_offers?.length ? (
                <p className="mt-2 text-xs">
                  Escolhas: {person.selected_offers.map((value) => value.name).join(", ")}
                </p>
              ) : null}
              {person.dietary_restrictions?.length ? (
                <p className="mt-1 text-xs font-bold text-amber-800">
                  Restrições: {person.dietary_restrictions.join(", ")}
                  {person.dietary_details ? ` — ${person.dietary_details}` : ""}
                </p>
              ) : null}
              {person.operational_notes && (
                <p className="mt-1 text-xs text-ink-500 italic">Obs: {person.operational_notes}</p>
              )}
            </div>
          ))}
        </Box>
        <Box title="Tralhas & Equipamentos Alugados / Comprados">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-ink-500">
              {item.gear_addons?.length ?? 0} item(ns) adicionado(s)
            </span>
            {!danger.includes(item.status) && (
              <button
                onClick={() => setAddingGear(true)}
                className="rounded-lg border border-brand-600 bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-900 hover:bg-brand-100"
              >
                <Plus className="mr-1 inline size-3" />
                Alugar / Vender Tralha
              </button>
            )}
          </div>
          {item.gear_addons?.map((addon) => (
            <div key={addon.id} className="mt-2 rounded-lg border bg-gray-50/50 p-3 text-xs">
              <div className="flex items-start justify-between">
                <div>
                  <strong className="text-ink-900">{addon.gear_product_name}</strong>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-900">
                      {addon.modality === "RENTAL" ? "Locação" : "Venda"}
                    </span>
                    <span className="text-ink-500">
                      {addon.quantity}x {money(addon.unit_price_cents)} = <strong>{money(addon.total_price_cents)}</strong>
                    </span>
                  </div>
                  {addon.participant_name && (
                    <span className="block text-[11px] text-ink-500 mt-1">
                      Destinado a: <strong>{addon.participant_name}</strong>
                    </span>
                  )}
                  {addon.notes && <p className="text-[11px] text-ink-400 mt-0.5 italic">{addon.notes}</p>}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => void handleToggleDelivered(addon)}
                    title={addon.delivered ? "Marcar como pendente" : "Marcar como entregue"}
                    className={`rounded px-2 py-1 text-[10px] font-bold ${
                      addon.delivered ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {addon.delivered ? "Entregue" : "Pendente"}
                  </button>
                  {!danger.includes(item.status) && (
                    <button
                      onClick={() => void handleRemoveAddon(addon)}
                      title="Remover tralha (devolve estoque e recalcula saldo)"
                      className="rounded p-1 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {!item.gear_addons?.length && (
            <p className="text-xs text-ink-400 py-1">Nenhum equipamento alugado ou comprado para esta reserva.</p>
          )}
        </Box>
        <Box title="Histórico">
          {item.events.map((event) => (
            <div key={event.id} className="mt-2 border-l-2 border-brand-500 pl-3 text-xs">
              <strong>{event.event_type.replaceAll("_", " ")}</strong> · {shortDate(event.created_at)}
              {event.reason && <p>{event.reason}</p>}
            </div>
          ))}
        </Box>
        <div className="mt-5 flex gap-3">
          {item.remaining_balance_cents > 0 &&
            ["HELD", "AWAITING_PAYMENT", "PARTIALLY_PAID", "CONFIRMED"].includes(item.status) && (
              <button
                onClick={() => setAction("payment")}
                className="rounded-lg bg-brand-600 px-4 py-3 text-sm font-bold text-white"
              >
                Registrar pagamento
              </button>
            )}
          {!danger.includes(item.status) && (
            <button
              onClick={() => setAction("cancel")}
              className="rounded-lg border border-red-200 px-4 text-sm font-bold text-red-700"
            >
              Cancelar reserva
            </button>
          )}
        </div>
        {action && (
          <div className="mt-4 rounded-xl bg-white p-5">
            <h3 className="font-black">
              {action === "payment" ? "Pagamento manual simulado" : "Cancelamento"}
            </h3>
            {action === "payment" && (
              <Field label="Valor (R$)" type="number" value={amount} set={setAmount} />
            )}
            <label className="mt-3 block text-xs font-bold">
              Motivo
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 min-h-20 w-full rounded-lg border p-3"
              />
            </label>
            {error && <p className="mt-2 text-sm font-bold text-red-700">{error}</p>}
            <button
              disabled={saving}
              onClick={() => void submit()}
              className="mt-3 rounded-lg bg-brand-700 px-4 py-2 font-bold text-white"
            >
              Confirmar
            </button>
          </div>
        )}
      </aside>

      {editingParticipant && (
        <ParticipantModal
          reservationId={item.id}
          participant={editingParticipant}
          token={token}
          close={() => setEditingParticipant(null)}
          changed={async () => {
            await changed();
            setEditingParticipant(null);
          }}
        />
      )}

      {addingGear && (
        <AddGearAddonModal
          token={token}
          reservation={item}
          close={() => setAddingGear(false)}
          added={async () => {
            await changed();
            setAddingGear(false);
          }}
        />
      )}
    </div>
  );
}

function ManualReservationModal({
  token,
  expeditions,
  close,
  created,
}: {
  token: string;
  expeditions: Expedition[];
  close: () => void;
  created: () => Promise<void>;
}) {
  const [expeditionId, setExpeditionId] = useState(expeditions[0]?.id ?? "");
  const [spotsCount, setSpotsCount] = useState(1);
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"CONFIRMED" | "HELD">("CONFIRMED");
  const [holdHours, setHoldHours] = useState(24);
  const [paymentType, setPaymentType] = useState<"DEPOSIT" | "FULL">("DEPOSIT");
  const [reason, setReason] = useState("Venda direta balcão / WhatsApp");
  const [participantNames, setParticipantNames] = useState<string[]>([""]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedExp = expeditions.find((e) => e.id === expeditionId);
  const pricePerPerson = selectedExp?.price_per_person_cents ?? 0;
  const totalPrice = pricePerPerson * spotsCount;
  // Sinal de 20% à vista conforme determinação do Rodrigo
  const depositPrice = Math.round(totalPrice * 0.2);

  const handleSpotsChange = (count: number) => {
    const val = Math.max(1, Math.min(12, count));
    setSpotsCount(val);
    setParticipantNames((prev) => {
      const next = [...prev];
      while (next.length < val) next.push("");
      return next.slice(0, val);
    });
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !cpf.trim() || !email.trim() || !phone.trim()) {
      return setError("Preencha todos os dados do comprador.");
    }
    if (!reason.trim()) {
      return setError("Informe o motivo para a trilha de auditoria.");
    }
    setSaving(true);
    setError("");
    try {
      await request("reservations/", token, {
        method: "POST",
        body: JSON.stringify({
          expedition_id: expeditionId,
          customer_name: name.trim(),
          customer_cpf: cpf.trim(),
          customer_email: email.trim(),
          customer_phone: phone.trim(),
          spots_count: spotsCount,
          status,
          hold_hours: status === "HELD" ? holdHours : undefined,
          payment_type: status === "CONFIRMED" ? paymentType : undefined,
          participant_names: participantNames.map((n, i) =>
            n.trim() || (i === 0 ? name.trim() : `Participante ${i + 1}`)
          ),
          reason: reason.trim(),
        }),
      });
      await created();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
      <div className="my-8 w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b pb-4">
          <h3 className="text-xl font-black">Nova Reserva Manual</h3>
          <button onClick={close} className="rounded p-1 hover:bg-gray-100">
            <X />
          </button>
        </div>
        <form onSubmit={submit} className="mt-4 space-y-4">
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
          <label className="block text-xs font-bold">
            Expedição
            <select
              value={expeditionId}
              onChange={(e) => setExpeditionId(e.target.value)}
              className="mt-1 h-10 w-full rounded-lg border px-3"
            >
              {expeditions.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} · {shortDate(e.starts_at)} (R${" "}
                  {(e.price_per_person_cents / 100).toLocaleString("pt-BR")}/pessoa)
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-bold">
              Vagas (1 a 12)
              <input
                type="number"
                min="1"
                max="12"
                value={spotsCount}
                onChange={(e) => handleSpotsChange(Number(e.target.value))}
                className="mt-1 h-10 w-full rounded-lg border px-3"
              />
            </label>
            <label className="text-xs font-bold">
              Status Inicial
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "CONFIRMED" | "HELD")}
                className="mt-1 h-10 w-full rounded-lg border px-3 font-bold"
              >
                <option value="CONFIRMED">Confirmada (Já Paga / Sinal)</option>
                <option value="HELD">Vaga em Hold (Aguardando Pagar)</option>
              </select>
            </label>
          </div>
          {status === "HELD" ? (
            <label className="block text-xs font-bold">
              Prazo do Hold (horas)
              <input
                type="number"
                min="1"
                max="72"
                value={holdHours}
                onChange={(e) => setHoldHours(Number(e.target.value))}
                className="mt-1 h-10 w-full rounded-lg border px-3"
              />
            </label>
          ) : (
            <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
              <span className="block text-xs font-bold text-brand-900">Tipo de Pagamento Inicial:</span>
              <div className="mt-2 flex gap-4 text-xs font-bold">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="paymentType"
                    value="DEPOSIT"
                    checked={paymentType === "DEPOSIT"}
                    onChange={() => setPaymentType("DEPOSIT")}
                  />
                  Sinal de 20% à vista ({money(depositPrice)})
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="paymentType"
                    value="FULL"
                    checked={paymentType === "FULL"}
                    onChange={() => setPaymentType("FULL")}
                  />
                  Integral 100% ({money(totalPrice)})
                </label>
              </div>
              <p className="mt-2 text-[11px] text-ink-600">
                {paymentType === "DEPOSIT"
                  ? `Saldo restante de ${money(totalPrice - depositPrice)} ficará pendente na reserva.`
                  : "Reserva será gravada como integralmente paga."}
              </p>
            </div>
          )}
          <div className="border-t pt-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-ink-500">Dados do Comprador</h4>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Field label="Nome Completo" value={name} set={setName} />
              <Field label="CPF" value={cpf} set={setCpf} />
              <Field label="E-mail" type="email" value={email} set={setEmail} />
              <Field label="WhatsApp / Telefone" value={phone} set={setPhone} />
            </div>
          </div>
          <div className="border-t pt-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-ink-500">
              Nomes dos Pescadores / Participantes
            </h4>
            <div className="mt-2 space-y-2">
              {participantNames.map((pName, idx) => (
                <label key={idx} className="block text-xs">
                  Participante {idx + 1}
                  <input
                    type="text"
                    placeholder={
                      idx === 0 ? name || "Mesmo que o comprador" : `Pescador parceiro ${idx + 1}`
                    }
                    value={pName}
                    onChange={(e) => {
                      const next = [...participantNames];
                      next[idx] = e.target.value;
                      setParticipantNames(next);
                    }}
                    className="mt-1 h-9 w-full rounded-lg border px-3"
                  />
                </label>
              ))}
            </div>
          </div>
          <label className="block text-xs font-bold border-t pt-3">
            Justificativa de Auditoria (Obrigatório)
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Venda balcão WhatsApp - comprovante PIX recebido"
              className="mt-1 h-10 w-full rounded-lg border px-3"
            />
          </label>
          <div className="flex justify-end gap-3 pt-3 border-t">
            <button
              type="button"
              onClick={close}
              className="rounded-lg border px-4 py-2 text-sm font-bold hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              disabled={saving}
              type="submit"
              className="rounded-lg bg-brand-700 px-5 py-2 text-sm font-bold text-white hover:bg-brand-800"
            >
              {saving ? "Salvando..." : "Criar Reserva"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ParticipantModal({
  reservationId,
  participant,
  token,
  close,
  changed,
}: {
  reservationId: string;
  participant: Participant;
  token: string;
  close: () => void;
  changed: () => Promise<void>;
}) {
  const [fullName, setFullName] = useState(participant.name);
  const [cpf, setCpf] = useState(participant.cpf ?? "");
  const [phone, setPhone] = useState(participant.phone ?? "");
  const [birthDate, setBirthDate] = useState(participant.birth_date ?? "");
  const [emergencyName, setEmergencyName] = useState(participant.emergency_contact_name ?? "");
  const [emergencyPhone, setEmergencyPhone] = useState(participant.emergency_contact_phone ?? "");
  const [operationalNotes, setOperationalNotes] = useState(participant.operational_notes ?? "");
  const [isSubstitution, setIsSubstitution] = useState(false);
  const [substitutionReason, setSubstitutionReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (isSubstitution && !substitutionReason.trim()) {
      return setError("Informe o motivo da substituição para o histórico auditado.");
    }
    setSaving(true);
    setError("");
    try {
      await request(`reservations/${reservationId}/participants/${participant.id}/`, token, {
        method: "PATCH",
        body: JSON.stringify({
          full_name: fullName.trim(),
          cpf: cpf.trim(),
          phone: phone.trim(),
          birth_date: birthDate || null,
          emergency_contact_name: emergencyName.trim(),
          emergency_contact_phone: emergencyPhone.trim(),
          operational_notes: operationalNotes.trim(),
          is_substitution: isSubstitution,
          substitution_reason: substitutionReason.trim(),
        }),
      });
      await changed();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
      <div className="my-8 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b pb-4">
          <h3 className="text-xl font-black">Editar Dados do Pescador</h3>
          <button onClick={close} className="rounded p-1 hover:bg-gray-100">
            <X />
          </button>
        </div>
        <form onSubmit={submit} className="mt-4 space-y-3">
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
          <label className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs font-bold text-amber-900 cursor-pointer">
            <input
              type="checkbox"
              checked={isSubstitution}
              onChange={(e) => setIsSubstitution(e.target.checked)}
              className="size-4 rounded text-brand-600"
            />
            <span>Substituir este pescador por outro participante (desistência / troca)</span>
          </label>
          {isSubstitution && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              <strong className="block font-bold">Aviso de Troca de Passageiro:</strong>
              O participante anterior (<em>{participant.name}</em>) será registrado no histórico auditado. As
              preferências de bebidas, restrições e checklist serão resetadas para o novo pescador preencher.
              <label className="mt-2 block font-bold text-ink-900">
                Motivo da Substituição (Obrigatório)
                <input
                  type="text"
                  placeholder="Ex: Desistência por viagem a trabalho / cirurgia"
                  value={substitutionReason}
                  onChange={(e) => setSubstitutionReason(e.target.value)}
                  className="mt-1 h-9 w-full rounded border bg-white px-2"
                />
              </label>
            </div>
          )}
          <Field
            label={isSubstitution ? "Nome do Novo Pescador" : "Nome Completo"}
            value={fullName}
            set={setFullName}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="CPF" value={cpf} set={setCpf} />
            <Field label="Telefone / WhatsApp" value={phone} set={setPhone} />
          </div>
          <Field label="Data de Nascimento" type="date" value={birthDate} set={setBirthDate} />
          <div className="grid grid-cols-2 gap-3 border-t pt-3">
            <Field label="Contato de Emergência" value={emergencyName} set={setEmergencyName} />
            <Field label="Telefone de Emergência" value={emergencyPhone} set={setEmergencyPhone} />
          </div>
          <label className="block text-xs font-bold">
            Observações Operacionais
            <textarea
              value={operationalNotes}
              onChange={(e) => setOperationalNotes(e.target.value)}
              className="mt-1 min-h-16 w-full rounded-lg border p-2 text-xs"
              placeholder="Ex: Pescador canhoto, precisa de auxílio no embarque"
            />
          </label>
          <div className="flex justify-end gap-3 pt-3 border-t">
            <button
              type="button"
              onClick={close}
              className="rounded-lg border px-4 py-2 text-sm font-bold hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              disabled={saving}
              type="submit"
              className="rounded-lg bg-brand-700 px-5 py-2 text-sm font-bold text-white hover:bg-brand-800"
            >
              {saving ? "Salvando..." : isSubstitution ? "Confirmar Substituição" : "Salvar Alterações"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Box({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-4 rounded-xl bg-white p-5 text-sm">
      <h3 className="mb-2 font-black">{title}</h3>
      {children}
    </section>
  );
}
function Pill({ ok,children }: { ok?: boolean; children: ReactNode }) { return <span className={`rounded-full px-2 py-1 font-bold ${ok ? "bg-brand-100 text-brand-800" : "bg-amber-100 text-amber-800"}`}>{ok && <Check className="mr-1 inline size-3" />}{children}</span>; }

function ExpeditionsPanel({ token, unauthorized }: { token: string; unauthorized: () => void }) {
  const list = useData<Expedition[]>("expeditions/", token, unauthorized);
  const [editing, setEditing] = useState<Expedition | "new" | null>(null);

  return (
    <div>
      <Header
        title="Expedições"
        subtitle="Crie e edite datas, capacidade, preço, pousada, espécies-alvo e publicação."
        action={
          <button
            onClick={() => setEditing("new")}
            className="rounded-lg bg-brand-600 px-4 py-3 text-sm font-bold text-white"
          >
            <Plus className="mr-2 inline size-4" />
            Nova expedição
          </button>
        }
      />
      <div className="mt-6">
        <State loading={list.loading} error={list.error} />
        {list.data && (
          <div className="grid gap-4 xl:grid-cols-2">
            {list.data.map((item) => (
              <article key={item.id} className="rounded-xl bg-white p-5">
                <div className="flex justify-between">
                  <div>
                    <Status value={item.status} />
                    <h3 className="mt-3 text-xl font-black">{item.name}</h3>
                    <p className="text-sm text-ink-600">
                      {item.lodge ? (
                        <span className="font-bold text-brand-800">
                          {item.lodge.name} ({item.lodge.city}/{item.lodge.state})
                        </span>
                      ) : (
                        item.destination
                      )}
                    </p>
                  </div>
                  <button onClick={() => setEditing(item)} className="rounded-lg border p-2">
                    <Pencil className="size-4" />
                  </button>
                </div>
                {(item.all_inclusive_package || item.beverage_package) && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {item.all_inclusive_package && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                        <Layers className="size-3" />
                        {item.all_inclusive_package.name}
                      </span>
                    )}
                    {item.beverage_package && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                        <Beer className="size-3" />
                        {item.beverage_package.name}
                      </span>
                    )}
                  </div>
                )}
                {item.target_species && item.target_species.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {item.target_species.map((sp) => (
                      <span
                        key={sp.slug}
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          sp.is_primary ? "bg-brand-600 text-white" : "bg-ink-900/5 text-ink-700"
                        }`}
                      >
                        {sp.common_name}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-5 grid grid-cols-3 border-t pt-4 text-sm">
                  <p>{shortDate(item.starts_at)}</p>
                  <strong>
                    {item.occupied_slots}/{item.capacity}
                  </strong>
                  <strong>{money(item.price_per_person_cents)}</strong>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
      {editing && (
        <ExpeditionWizardModal
          token={token}
          item={editing === "new" ? undefined : editing}
          close={() => setEditing(null)}
          saved={async () => {
            setEditing(null);
            await list.load();
          }}
        />
      )}
    </div>
  );
}

const GALLERY_PHOTOS = [
  { url: "/gallery/piraiba-rio.jpg", label: "Piraíba no Rio Araguaia" },
  { url: "/gallery/estrutura-expedicao.jpg", label: "Estrutura & Acampamento" },
  { url: "/gallery/barco-araguaia.jpg", label: "Barco no Rio Araguaia" },
  { url: "/gallery/tres-pirararas.jpg", label: "Três Pirararas" },
  { url: "/gallery/ponte-sao-felix.jpg", label: "Ponte São Félix do Araguaia" },
  { url: "/gallery/pescaria-barco.jpg", label: "Pescaria no Barco" },
  { url: "/gallery/expedicao-rio.jpg", label: "Expedição no Rio" },
  { url: "/gallery/captura-dupla.jpg", label: "Captura Dupla de Gigantes" },
  { url: "/gallery/piraiba-splash.jpg", label: "Salto da Piraíba" },
  { url: "/expeditions/por-do-sol-araguaia.jpg", label: "Pôr do Sol no Araguaia" },
  { url: "/expeditions/casais-pesca.jpg", label: "Casais na Pesca" },
  { url: "/expeditions/bandeirantes-piraiba.jpg", label: "Piraíba em Bandeirantes" },
  { url: "/gallery/foto-1.jpg", label: "Foto Galeria 1" },
  { url: "/gallery/foto-2.jpg", label: "Foto Galeria 2" },
  { url: "/gallery/foto-3.jpg", label: "Foto Galeria 3" },
  { url: "/gallery/foto-5.jpg", label: "Foto Galeria 5" },
  { url: "/gallery/foto-6.jpg", label: "Foto Galeria 6" },
  { url: "/gallery/foto-7.jpg", label: "Foto Galeria 7" },
  { url: "/gallery/foto-9.jpg", label: "Foto Galeria 9" },
  { url: "/gallery/foto-10.jpg", label: "Foto Galeria 10" },
  { url: "/gallery/foto-11.jpg", label: "Foto Galeria 11" },
  { url: "/gallery/foto-12.jpg", label: "Foto Galeria 12" },
];

function GalleryPickerModal({
  currentUrl,
  onSelect,
  close,
}: {
  currentUrl?: string;
  onSelect: (url: string) => void;
  close: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-4">
      <div className="my-5 flex w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <ImageIcon className="size-5 text-brand-600" />
            <h3 className="text-lg font-black text-ink-900">Escolha uma Imagem da Galeria</h3>
          </div>
          <button type="button" onClick={close} className="rounded-lg p-1 hover:bg-gray-100">
            <X className="size-5" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-6">
          <p className="mb-4 text-xs text-ink-500">
            Clique sobre a foto desejada para selecioná-la como imagem de capa.
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {GALLERY_PHOTOS.map((photo) => {
              const isSelected = currentUrl === photo.url;
              return (
                <button
                  key={photo.url}
                  type="button"
                  onClick={() => {
                    onSelect(photo.url);
                    close();
                  }}
                  className={`group relative flex flex-col overflow-hidden rounded-xl border-2 text-left transition ${
                    isSelected
                      ? "border-brand-600 ring-2 ring-brand-500"
                      : "border-gray-200 hover:border-brand-400"
                  }`}
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-gray-100">
                    <img
                      src={photo.url}
                      alt={photo.label}
                      className="size-full object-cover transition-transform group-hover:scale-105"
                    />
                    {isSelected && (
                      <span className="absolute right-2 top-2 rounded-full bg-brand-600 p-1 text-white shadow">
                        <Check className="size-3" />
                      </span>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="truncate text-xs font-bold text-ink-800">{photo.label}</p>
                    <p className="truncate text-[10px] text-ink-400">{photo.url}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex justify-end border-t px-6 py-3">
          <button
            type="button"
            onClick={close}
            className="rounded-lg border px-4 py-2 text-xs font-bold text-ink-700 hover:bg-gray-50"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function ExpeditionWizardModal({
  token,
  item,
  close,
  saved,
}: {
  token: string;
  item?: Expedition;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const rivers = useData<River[]>("rivers/", token, () => {});
  const lodges = useData<Lodge[]>("lodges/", token, () => {});
  const speciesList = useData<Species[]>("species/", token, () => {});
  const allInclusivePackages = useData<AllInclusivePackage[]>("all-inclusive-packages/", token, () => {});
  const beveragePackages = useData<BeveragePackage[]>("beverage-packages/", token, () => {});

  const [form, setForm] = useState({
    name: item?.name ?? "",
    destination: item?.destination ?? "",
    departure_location: item?.departure_location ?? "",
    starts_at: item?.starts_at ?? "",
    ends_at: item?.ends_at ?? "",
    capacity: String(item?.capacity ?? 12),
    price: String((item?.price_per_person_cents ?? 249000) / 100),
    deposit: String((item?.deposit_cents ?? 120000) / 100),
    balance_due_days_before: String(item?.balance_due_days_before ?? 30),
    status: item?.status ?? "DRAFT",
    summary: item?.summary ?? "",
    river_id: item?.lodge?.river?.id ?? item?.lodge?.river_id ?? "",
    lodge_id: item?.lodge?.id ?? item?.lodge_id ?? "",
    all_inclusive_package_id: item?.all_inclusive_package?.id ?? item?.all_inclusive_package_id ?? "",
    beverage_package_id: item?.beverage_package?.id ?? item?.beverage_package_id ?? "",
    cover_image_url: item?.cover_image_url ?? "",
    inclusions: (item?.inclusions ?? [
      "Hospedagem Completa na Pousada",
      "Combustível e Óleo 100% Inclusos",
      "Kit Sashimi, Ceviche e petiscos no rio",
      "Iscas Vivas Nativas",
      "Guias Nativos Especializados",
      "Torneio com Troféus e Banner da Equipe",
      "Seguro Viagem",
      "Água mineral, Refrigerante e Gelo abundante",
      "Internet Wi-Fi na Pousada",
    ]).join("\n"),
  });

  const [selectedSpecies, setSelectedSpecies] = useState<string[]>(
    item?.target_species?.map((s) => s.slug) ?? item?.species_slugs ?? []
  );

  const [primarySpecies, setPrimarySpecies] = useState<string>(
    item?.target_species?.find((s) => s.is_primary)?.slug ??
    item?.target_species?.[0]?.slug ??
    ""
  );

  const [riverNotice, setRiverNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showGalleryPicker, setShowGalleryPicker] = useState(false);

  function generateExpeditionName(lodgeName?: string, startsAt?: string) {
    if (!lodgeName) return "";
    let suffix = "";
    if (startsAt) {
      const parts = startsAt.split("-");
      if (parts.length >= 2) {
        const year = parts[0];
        const month = parseInt(parts[1], 10);
        const monthNames = [
          "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
          "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
        ];
        if (month >= 1 && month <= 12) {
          suffix = ` — ${monthNames[month - 1]}/${year}`;
        }
      }
    }
    return `Expedição ${lodgeName}${suffix}`;
  }

  // Auto-populate initial river if lodge is pre-set
  useEffect(() => {
    if (form.lodge_id && !form.river_id && lodges.data) {
      const foundLodge = lodges.data.find((l) => l.id === form.lodge_id);
      const rId = foundLodge?.river?.id ?? foundLodge?.river_id;
      if (rId) setForm((prev) => ({ ...prev, river_id: rId }));
    }
  }, [form.lodge_id, form.river_id, lodges.data]);

  // Auto-select package if only 1 package exists
  useEffect(() => {
    if (!form.all_inclusive_package_id && allInclusivePackages.data?.length === 1) {
      const singlePkg = allInclusivePackages.data[0];
      if (singlePkg) {
        setForm((prev) => ({
          ...prev,
          all_inclusive_package_id: singlePkg.id,
          inclusions: singlePkg.inclusions && singlePkg.inclusions.length > 0
            ? singlePkg.inclusions.join("\n")
            : prev.inclusions,
        }));
      }
    }
  }, [allInclusivePackages.data, form.all_inclusive_package_id]);

  // Auto-select beverage package if only 1 beverage package exists
  useEffect(() => {
    if (!form.beverage_package_id && beveragePackages.data?.length === 1) {
      const singleBev = beveragePackages.data[0];
      if (singleBev) {
        setForm((prev) => ({
          ...prev,
          beverage_package_id: singleBev.id,
        }));
      }
    }
  }, [beveragePackages.data, form.beverage_package_id]);

  const onRiverChange = (newRiverId: string) => {
    setRiverNotice("");
    if (form.lodge_id && newRiverId) {
      const currentLodge = lodges.data?.find((l) => l.id === form.lodge_id);
      const currentLodgeRiverId = currentLodge?.river?.id ?? currentLodge?.river_id;
      if (currentLodgeRiverId && currentLodgeRiverId !== newRiverId) {
        setForm((prev) => ({ ...prev, river_id: newRiverId, lodge_id: "" }));
        setRiverNotice(
          `A pousada "${currentLodge?.name}" pertence a outro rio e foi desmarcada para evitar inconsistência geográfica.`
        );
        return;
      }
    }
    setForm((prev) => ({ ...prev, river_id: newRiverId }));
  };

  const onLodgeChange = (lodgeId: string) => {
    const chosen = lodges.data?.find((l) => l.id === lodgeId);
    setForm((prev) => {
      const chosenRiverId = chosen?.river?.id ?? chosen?.river_id ?? prev.river_id;
      const shouldUpdateName = !prev.name.trim() || prev.name.startsWith("Expedição ");
      return {
        ...prev,
        lodge_id: lodgeId,
        river_id: chosenRiverId || prev.river_id,
        name: shouldUpdateName && chosen ? generateExpeditionName(chosen.name, prev.starts_at) : prev.name,
        departure_location: prev.departure_location || (chosen ? `${chosen.city}/${chosen.state}` : ""),
        destination: chosen ? `${chosen.city}/${chosen.state} (${chosen.name})` : prev.destination,
        cover_image_url: prev.cover_image_url || (chosen?.cover_image_url ?? ""),
      };
    });

    if (chosen?.target_species && chosen.target_species.length > 0) {
      setSelectedSpecies(chosen.target_species.map((s) => s.slug));
      setPrimarySpecies(chosen.target_species[0]?.slug ?? "");
    }
  };

  const onStartsAtChange = (newDate: string) => {
    setForm((prev) => {
      const chosenLodge = lodges.data?.find((l) => l.id === prev.lodge_id);
      const shouldUpdateName = !prev.name.trim() || prev.name.startsWith("Expedição ");
      return {
        ...prev,
        starts_at: newDate,
        name: shouldUpdateName && chosenLodge ? generateExpeditionName(chosenLodge.name, newDate) : prev.name,
      };
    });
  };

  const onPriceChange = (val: string) => {
    const pNum = Number(val) || 0;
    const minDeposit = Math.ceil(pNum * 0.20);
    setForm((prev) => ({
      ...prev,
      price: val,
      deposit: pNum > 0 ? String(minDeposit) : prev.deposit,
    }));
  };

  const onAllInclusiveChange = (packageId: string) => {
    const chosen = allInclusivePackages.data?.find((p) => p.id === packageId);
    setForm((prev) => ({
      ...prev,
      all_inclusive_package_id: packageId,
      inclusions: chosen?.inclusions && chosen.inclusions.length > 0
        ? chosen.inclusions.join("\n")
        : prev.inclusions,
    }));
  };

  const reloadPackageInclusions = () => {
    const chosen = allInclusivePackages.data?.find((p) => p.id === form.all_inclusive_package_id);
    if (chosen?.inclusions) {
      setForm((prev) => ({ ...prev, inclusions: chosen.inclusions.join("\n") }));
    }
  };

  const priceNum = Number(form.price) || 0;
  const depositNum = Number(form.deposit) || 0;
  const minDepositNum = Math.ceil(priceNum * 0.20);
  const isDepositValid = priceNum === 0 || (depositNum >= minDepositNum && depositNum <= priceNum);

  const durationDays = useMemo(() => {
    if (!form.starts_at || !form.ends_at) return null;
    const start = new Date(`${form.starts_at}T12:00:00`);
    const end = new Date(`${form.ends_at}T12:00:00`);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays > 0 ? diffDays : null;
  }, [form.starts_at, form.ends_at]);

  const selectedLodge = lodges.data?.find((l) => l.id === form.lodge_id);
  const selectedBeveragePkg = beveragePackages.data?.find((p) => p.id === form.beverage_package_id);
  const selectedAllInclusivePkg = allInclusivePackages.data?.find((p) => p.id === form.all_inclusive_package_id);

  async function submit(event?: FormEvent, targetStatus?: string) {
    if (event) event.preventDefault();
    setError("");

    const finalStatus = targetStatus || form.status;

    if (!form.name.trim()) {
      setError("O nome da expedição é obrigatório.");
      setStep(3);
      return;
    }
    if (!form.destination.trim()) {
      setError("O destino da expedição é obrigatório.");
      setStep(1);
      return;
    }
    if (!form.starts_at || !form.ends_at) {
      setError("As datas de início e término são obrigatórias.");
      setStep(3);
      return;
    }
    if (new Date(form.ends_at) < new Date(form.starts_at)) {
      setError("A data final deve ser posterior ou igual à inicial.");
      setStep(3);
      return;
    }

    const priceCents = Math.round(Number(form.price) * 100);
    const depositCents = Math.round(Number(form.deposit) * 100);
    const minDepositCents = Math.ceil(priceCents * 0.20);

    if (priceCents > 0 && depositCents < minDepositCents) {
      setError(`O sinal mínimo deve ser de pelo menos 20% do valor por pessoa (${money(minDepositCents)}).`);
      setStep(3);
      return;
    }
    if (depositCents > priceCents) {
      setError("O sinal não pode ser superior ao valor por pessoa.");
      setStep(3);
      return;
    }

    setLoading(true);
    try {
      const orderedSpecies = primarySpecies && selectedSpecies.includes(primarySpecies)
        ? [primarySpecies, ...selectedSpecies.filter((s) => s !== primarySpecies)]
        : selectedSpecies;

      const body = {
        name: form.name.trim(),
        destination: form.destination.trim(),
        departure_location: form.departure_location.trim(),
        starts_at: form.starts_at,
        ends_at: form.ends_at,
        capacity: Number(form.capacity) || 12,
        price_per_person_cents: priceCents,
        deposit_cents: depositCents,
        balance_due_days_before: Number(form.balance_due_days_before) || 30,
        status: finalStatus,
        summary: form.summary.trim(),
        cover_image_url: form.cover_image_url.trim(),
        lodge_id: form.lodge_id || null,
        all_inclusive_package_id: form.all_inclusive_package_id || null,
        beverage_package_id: form.beverage_package_id || null,
        species_slugs: orderedSpecies.length > 0 ? orderedSpecies : undefined,
        inclusions: form.inclusions
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      };

      await request(item ? `expeditions/${item.id}/` : "expeditions/", token, {
        method: item ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      await saved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const steps = [
    { num: 1, title: "Destino & Pousada", Icon: House },
    { num: 2, title: "Pacote & Cardápio", Icon: Layers },
    { num: 3, title: "Comercial & Vagas", Icon: CalendarDays },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-4">
      <form onSubmit={submit} className="my-5 flex w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-brand-600" />
              <h2 className="text-xl font-black">
                {item ? `Editar Expedição: ${item.name}` : "Construtor de Nova Expedição"}
              </h2>
            </div>
            <p className="text-xs text-ink-500">
              Fluxo simplificado em 3 etapas · Integração com Pousadas e Pacotes
            </p>
          </div>
          <button type="button" onClick={close} className="rounded-lg p-1 text-ink-400 hover:bg-gray-100">
            <X className="size-5" />
          </button>
        </div>

        {/* Stepper Tabs */}
        <div className="grid grid-cols-3 gap-2 border-b bg-gray-50/75 p-3">
          {steps.map(({ num, title, Icon }) => {
            const isActive = step === num;
            const isDone = step > num;
            return (
              <button
                key={num}
                type="button"
                onClick={() => setStep(num as 1 | 2 | 3)}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition ${
                  isActive
                    ? "bg-white text-brand-900 shadow-sm ring-1 ring-black/5"
                    : isDone
                    ? "text-brand-700 hover:bg-white/50"
                    : "text-ink-400 hover:bg-white/50"
                }`}
              >
                <div
                  className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-black ${
                    isActive
                      ? "bg-brand-600 text-white"
                      : isDone
                      ? "bg-brand-100 text-brand-800"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {isDone ? <Check className="size-3.5" /> : num}
                </div>
                <div className="min-w-0 text-left">
                  <span className="block truncate">{title}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Step Body */}
        <div className="max-h-[calc(85vh-200px)] overflow-y-auto p-6">
          {riverNotice && (
            <div className="mb-4 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800">
              <span>{riverNotice}</span>
              <button type="button" onClick={() => setRiverNotice("")} className="ml-2 text-ink-400 hover:text-ink-700">
                <X className="size-4" />
              </button>
            </div>
          )}

          {/* STEP 1: Destino & Pousada */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-4">
                <h3 className="text-sm font-black text-brand-900">Etapa 1: Definição Geográfica & Hospedagem</h3>
                <p className="mt-1 text-xs text-brand-700">
                  Selecione a pousada parceira. A localização e o catálogo de peixes cadastrados na pousada serão associados automaticamente a esta expedição.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-ink-800">
                  Pousada Parceira
                  <select
                    value={form.lodge_id}
                    onChange={(e) => onLodgeChange(e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border bg-white px-3 font-medium text-ink-900"
                  >
                    <option value="">Selecione a pousada parceira...</option>
                    {lodges.data?.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} — {l.city}/{l.state}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Lodge details preview */}
              {selectedLodge && (
                <div className="rounded-xl border bg-gray-50/80 p-4 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <strong className="text-sm font-black text-ink-900">{selectedLodge.name}</strong>
                      <span className="ml-2 text-ink-500">
                        {selectedLodge.city}/{selectedLodge.state}
                      </span>
                    </div>
                  </div>

                  {selectedLodge.target_species && selectedLodge.target_species.length > 0 && (
                    <div className="mt-3">
                      <span className="font-bold text-ink-700">Peixes Disponíveis nesta Pousada:</span>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {selectedLodge.target_species.map((sp) => (
                          <span
                            key={sp.slug}
                            className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-bold text-brand-900 ring-1 ring-brand-600/20"
                          >
                            🐟 {sp.common_name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedLodge.meeting_point && (
                    <div className="mt-2.5">
                      <span className="font-bold text-ink-700">Ponto de Encontro Padrão:</span>
                      <p className="mt-0.5 text-ink-600">{selectedLodge.meeting_point}</p>
                    </div>
                  )}

                  {selectedLodge.amenities_detailed && selectedLodge.amenities_detailed.length > 0 && (
                    <div className="mt-3">
                      <span className="font-bold text-ink-700">Comodidades da Pousada:</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {selectedLodge.amenities_detailed.map((am) => (
                          <span
                            key={am.id}
                            className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-ink-700 ring-1 ring-ink-900/10"
                          >
                            {am.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Destino Oficial"
                  value={form.destination}
                  set={(v) => setForm({ ...form, destination: v })}
                />
                <Field
                  label="Local de Saída / Encontro"
                  value={form.departure_location}
                  set={(v) => setForm({ ...form, departure_location: v })}
                />
              </div>
            </div>
          )}

          {/* STEP 2: Pacote & Cardápio */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-4">
                <h3 className="text-sm font-black text-brand-900">Etapa 2: Pacote da Expedição & Bebidas</h3>
                <p className="mt-1 text-xs text-brand-700">
                  Associe moldes de Pacote da Expedição e Cardápio de Bebidas. O pacote carrega uma cópia das inclusões para personalização exclusiva desta expedição.
                </p>
              </div>

              {/* Pacote da Expedição Section */}
              <div className="rounded-xl border p-4">
                <div className="flex items-center gap-2">
                  <Layers className="size-4 text-brand-600" />
                  <h4 className="text-sm font-black text-ink-900">Pacote da Expedição</h4>
                </div>

                <div className="mt-3">
                  <select
                    value={form.all_inclusive_package_id}
                    onChange={(e) => onAllInclusiveChange(e.target.value)}
                    className="h-10 w-full rounded-lg border bg-white px-3 text-sm font-bold text-ink-800"
                  >
                    <option value="">Nenhum pacote vinculado (Personalizado)</option>
                    {allInclusivePackages.data?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.inclusions?.length ?? 0} benefícios)
                      </option>
                    ))}
                  </select>
                </div>

                {selectedAllInclusivePkg && (
                  <div className="mt-3 rounded-lg bg-gray-50 p-3 text-xs">
                    <p className="text-ink-600">{selectedAllInclusivePkg.description}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-bold text-ink-500">
                        {selectedAllInclusivePkg.inclusions?.length ?? 0} benefícios no molde
                      </span>
                      <button
                        type="button"
                        onClick={reloadPackageInclusions}
                        className="text-xs font-bold text-brand-600 hover:underline"
                      >
                        Restaurar inclusões do molde
                      </button>
                    </div>
                  </div>
                )}

                <label className="mt-3 block text-xs font-bold text-ink-800">
                  Inclusões Oficiais desta Expedição (uma por linha)
                  <span className="block text-[11px] font-normal text-ink-500">
                    Modificações abaixo aplicam-se apenas a esta expedição (snapshot durável).
                  </span>
                  <textarea
                    value={form.inclusions}
                    onChange={(e) => setForm({ ...form, inclusions: e.target.value })}
                    rows={5}
                    className="mt-1 w-full rounded-lg border p-3 font-mono text-xs"
                  />
                </label>
              </div>

              {/* Beverage Package Section */}
              <div className="rounded-xl border p-4">
                <div className="flex items-center gap-2">
                  <Beer className="size-4 text-amber-600" />
                  <h4 className="text-sm font-black text-ink-900">Cardápio de Bebidas Operacional</h4>
                </div>

                <div className="mt-3">
                  <select
                    value={form.beverage_package_id}
                    onChange={(e) => setForm({ ...form, beverage_package_id: e.target.value })}
                    className="h-10 w-full rounded-lg border bg-white px-3 text-sm font-bold text-ink-800"
                  >
                    <option value="">Nenhum cardápio de bebidas vinculado</option>
                    {beveragePackages.data?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.items?.length ?? 0} bebidas)
                      </option>
                    ))}
                  </select>
                </div>

                {selectedBeveragePkg && (
                  <div className="mt-3 space-y-2 rounded-lg bg-gray-50 p-3 text-xs">
                    <p className="font-bold text-ink-700">Cotas sincronizadas por participante:</p>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {selectedBeveragePkg.items?.map((it, idx) => (
                        <div key={it.id ?? idx} className="flex justify-between rounded bg-white p-2 shadow-xs">
                          <div>
                            <strong className="text-ink-900">{it.product_name}</strong>
                            {it.note && <span className="ml-1 text-[10px] text-ink-500">({it.note})</span>}
                          </div>
                          <span className="font-bold text-brand-800">
                            {it.standard_quantity_per_participant} {it.product_unit}/pes.
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] text-ink-500">
                      ℹ Ao salvar a expedição, estes produtos serão espelhados para a lista de itens da expedição.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: Comercial & Vagas */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-4">
                <h3 className="text-sm font-black text-brand-900">Etapa 3: Parâmetros Comerciais & Publicação</h3>
                <p className="mt-1 text-xs text-brand-700">
                  Defina datas, capacidade e valores. Pela Constituição do projeto, o sinal mínimo obrigatório é de 20% do valor total por pessoa.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-ink-800">Nome da Expedição *</label>
                    {selectedLodge && (
                      <button
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            name: generateExpeditionName(selectedLodge.name, prev.starts_at),
                          }))
                        }
                        className="text-[11px] font-bold text-brand-600 hover:underline"
                      >
                        ⚡ Sugerir Nome
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ex: Expedição Pousada Cristal — Out/2026"
                    className="h-10 w-full rounded-lg border px-3 text-sm font-bold"
                  />
                </div>

                <label className="text-xs font-bold text-ink-800">
                  Status Operacional
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="mt-1 h-10 w-full rounded-lg border bg-white px-3 font-medium"
                  >
                    {Object.entries(labels)
                      .slice(0, 7)
                      .map(([key, val]) => (
                        <option key={key} value={key}>
                          {val}
                        </option>
                      ))}
                  </select>
                </label>

                <div>
                  <Field
                    label="Data de Início"
                    type="date"
                    value={form.starts_at}
                    set={onStartsAtChange}
                  />
                </div>

                <div>
                  <Field
                    label="Data de Término"
                    type="date"
                    value={form.ends_at}
                    set={(v) => setForm({ ...form, ends_at: v })}
                  />
                  {durationDays && (
                    <span className="mt-1 block text-right text-[11px] font-bold text-brand-700">
                      Duração estimada: {durationDays} dias / {durationDays - 1} noites
                    </span>
                  )}
                </div>

                <Field
                  label="Capacidade Total de Pescadores (Vagas)"
                  type="number"
                  value={form.capacity}
                  set={(v) => setForm({ ...form, capacity: v })}
                />

                <Field
                  label="Vencimento do Saldo (Dias antes da viagem)"
                  type="number"
                  value={form.balance_due_days_before}
                  set={(v) => setForm({ ...form, balance_due_days_before: v })}
                />

                <div>
                  <Field
                    label="Valor por Pessoa (R$)"
                    type="number"
                    value={form.price}
                    set={onPriceChange}
                  />
                  {priceNum > 0 && (
                    <span className="mt-1 block text-right text-[11px] text-ink-500">
                      Sinal de 20% autocalculado: <strong>{money(minDepositNum * 100)}</strong>
                    </span>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-ink-800">Valor do Sinal (R$)</label>
                    {priceNum > 0 && depositNum !== minDepositNum && (
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, deposit: String(minDepositNum) }))}
                        className="text-[11px] font-bold text-brand-600 hover:underline"
                      >
                        Redefinir 20%
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    value={form.deposit}
                    onChange={(e) => setForm({ ...form, deposit: e.target.value })}
                    className="h-10 w-full rounded-lg border px-3 text-sm font-bold"
                  />
                  {depositNum > 0 && priceNum > 0 && (
                    <span className="mt-1 block text-right text-[11px] font-bold text-ink-600">
                      Equivale a {((depositNum / priceNum) * 100).toFixed(1)}% do valor total
                    </span>
                  )}
                </div>
              </div>

              {/* 20% Deposit Validation Alert */}
              {!isDepositValid && priceNum > 0 && (
                <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="size-5 shrink-0" />
                    <span>
                      Sinal abaixo do mínimo constitucional (20%). O valor mínimo exigido é de {money(minDepositNum * 100)}.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, deposit: String(minDepositNum) })}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-red-700"
                  >
                    Definir 20% ({money(minDepositNum * 100)})
                  </button>
                </div>
              )}

              {/* Cover Image with Gallery Picker */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-ink-800">Imagem de Capa da Expedição</label>
                  <button
                    type="button"
                    onClick={() => setShowGalleryPicker(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-brand-600 bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700 hover:bg-brand-100"
                  >
                    <ImageIcon className="size-3.5" />
                    Escolher da Galeria
                  </button>
                </div>

                {form.cover_image_url ? (
                  <div className="mt-2 flex items-center gap-3 rounded-xl border bg-gray-50 p-2">
                    <img
                      src={form.cover_image_url}
                      alt="Capa da expedição"
                      className="size-16 rounded-lg object-cover shadow-sm"
                    />
                    <div className="min-w-0 flex-1">
                      <input
                        value={form.cover_image_url}
                        onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })}
                        placeholder="URL ou caminho da imagem"
                        className="h-8 w-full rounded border bg-white px-2 text-xs"
                      />
                      <p className="mt-0.5 text-[10px] text-ink-500">Foto selecionada para a expedição</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, cover_image_url: "" })}
                      className="rounded p-1 text-ink-400 hover:bg-gray-200 hover:text-ink-700"
                      title="Remover imagem"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => setShowGalleryPicker(true)}
                    className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50/50 py-4 text-xs font-bold text-ink-600 transition hover:border-brand-500 hover:bg-brand-50/30"
                  >
                    <ImageIcon className="size-4 text-brand-600" />
                    <span>Nenhuma imagem selecionada. Clique para escolher da galeria de fotos.</span>
                  </div>
                )}
              </div>

              <label className="block text-xs font-bold text-ink-800">
                Resumo Executivo da Expedição
                <textarea
                  value={form.summary}
                  onChange={(e) => setForm({ ...form, summary: e.target.value })}
                  rows={3}
                  className="mt-1 w-full rounded-lg border p-3 text-xs"
                />
              </label>

              {/* Wizard Executive Summary */}
              <div className="rounded-xl border bg-gray-50 p-4 text-xs">
                <h4 className="font-black uppercase tracking-wider text-ink-600">Resumo da Configuração</h4>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div>
                    <span className="text-ink-500">Destino:</span>{" "}
                    <strong>{form.destination || "Não definido"}</strong>
                  </div>
                  <div>
                    <span className="text-ink-500">Pousada:</span>{" "}
                    <strong>{selectedLodge?.name || "Não selecionada"}</strong>
                  </div>
                  <div>
                    <span className="text-ink-500">Peixes da Pousada:</span>{" "}
                    <strong>
                      {selectedSpecies.length} espécie(s) vinculada(s)
                    </strong>
                  </div>
                  <div>
                    <span className="text-ink-500">Pacote da Expedição:</span>{" "}
                    <strong>{selectedAllInclusivePkg?.name || "Personalizado"}</strong>
                  </div>
                  <div>
                    <span className="text-ink-500">Cardápio Bebidas:</span>{" "}
                    <strong>{selectedBeveragePkg?.name || "Não definido"}</strong>
                  </div>
                  <div>
                    <span className="text-ink-500">Comercial:</span>{" "}
                    <strong>
                      {form.capacity} vagas a {money(priceNum * 100)} (Sinal: {money(depositNum * 100)})
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {error && <p className="px-6 py-2 text-xs font-bold text-red-700">{error}</p>}

        {/* Stepper Footer Controls */}
        <div className="flex items-center justify-between border-t px-6 py-4">
          <button
            type="button"
            onClick={close}
            className="rounded-lg border px-4 py-2 text-sm font-bold text-ink-700 hover:bg-gray-50"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
                className="flex items-center gap-1 rounded-lg border px-4 py-2 text-sm font-bold text-ink-700 hover:bg-gray-50"
              >
                <ChevronLeft className="size-4" />
                Voltar
              </button>
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
                className="flex items-center gap-1 rounded-lg bg-brand-900 px-5 py-2 text-sm font-bold text-white hover:bg-brand-800"
              >
                Avançar
                <ChevronRight className="size-4" />
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => submit(undefined, "DRAFT")}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-ink-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {loading ? "Salvando..." : "Salvar como Rascunho"}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => submit(undefined, "PUBLISHED")}
                  className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
                >
                  <Sparkles className="size-4" />
                  {loading ? "Salvando..." : item ? "Salvar e Publicar" : "Publicar Imediatamente"}
                </button>
              </div>
            )}
          </div>
        </div>
      </form>

      {showGalleryPicker && (
        <GalleryPickerModal
          currentUrl={form.cover_image_url}
          onSelect={(url) => setForm((prev) => ({ ...prev, cover_image_url: url }))}
          close={() => setShowGalleryPicker(false)}
        />
      )}
    </div>
  );
}


function LodgesPanel({ token, unauthorized }: { token: string; unauthorized: () => void }) {
  const list = useData<Lodge[]>("lodges/", token, unauthorized);
  const [editing, setEditing] = useState<Lodge | "new" | null>(null);

  return (
    <div>
      <Header
        title="Pousadas e Estruturas"
        subtitle="Gerencie pousadas parceiras, frota náutica, comodidades e ponto de encontro."
        action={
          <button
            onClick={() => setEditing("new")}
            className="rounded-lg bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow hover:bg-brand-700"
          >
            <Plus className="mr-2 inline size-4" />
            Nova pousada
          </button>
        }
      />
      <div className="mt-6">
        <State loading={list.loading} error={list.error} />
        {list.data && (
          <div className="grid gap-4 xl:grid-cols-2">
            {list.data.map((item) => (
              <article key={item.id} className="rounded-xl bg-white p-5 shadow-sm border border-ink-900/5">
                <div className="flex justify-between items-start">
                  <div>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                        item.active ? "bg-brand-100 text-brand-800" : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {item.active ? "Ativa" : "Inativa"}
                    </span>
                    <h3 className="mt-2 text-xl font-black">{item.name}</h3>
                    <p className="text-sm font-bold text-brand-700">
                      {item.city} — {item.state}
                      {item.river?.name ? ` · ${item.river.name}` : ""}
                      {item.river_section ? ` (${item.river_section})` : ""}
                    </p>
                  </div>
                  <button onClick={() => setEditing(item)} className="rounded-lg border p-2 hover:bg-gray-50">
                    <Pencil className="size-4" />
                  </button>
                </div>
                {item.description && (
                  <p className="mt-3 text-xs text-ink-600 line-clamp-2">{item.description}</p>
                )}
                {item.boat_fleet_details && (
                  <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50/70 p-2.5 text-xs text-brand-900">
                    <strong className="font-bold">Estrutura Náutica: </strong>
                    {item.boat_fleet_details}
                  </div>
                )}
                {item.amenities && item.amenities.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {item.amenities.map((a) => (
                      <span key={a} className="rounded bg-ink-900/5 px-2 py-0.5 text-[11px] font-semibold text-ink-700">
                        {a}
                      </span>
                    ))}
                  </div>
                )}
                {item.meeting_point && (
                  <p className="mt-3 border-t pt-2 text-xs text-ink-500">
                    <strong>Encontro:</strong> {item.meeting_point}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
      {editing && (
        <LodgeModal
          token={token}
          item={editing === "new" ? undefined : editing}
          close={() => setEditing(null)}
          saved={async () => {
            setEditing(null);
            await list.load();
          }}
        />
      )}
    </div>
  );
}

function AmenityModal({
  token,
  item,
  close,
  saved,
}: {
  token: string;
  item: Amenity | "new";
  close: () => void;
  saved: (createdAmenity?: Amenity) => Promise<void>;
}) {
  const isNew = item === "new";
  const [name, setName] = useState(isNew ? "" : item.name);
  const [category, setCategory] = useState(isNew ? "ROOM_COMFORT" : item.category);
  const [description, setDescription] = useState(isNew ? "" : item.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const categories = [
    { value: "ROOM_COMFORT", label: "Acomodação e Conforto" },
    { value: "FISHING_STRUCTURE", label: "Estrutura Náutica e Pesca" },
    { value: "GASTRONOMY", label: "Culinária e Bar" },
    { value: "LEISURE", label: "Lazer e Bem-estar" },
    { value: "CONNECTIVITY", label: "Conectividade e Apoio" },
  ];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("O nome da comodidade é obrigatório.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const isEditing = !isNew;
      const res = await request<Amenity>(
        isEditing ? `amenities/${item.id}/` : "amenities/",
        token,
        {
          method: isEditing ? "PATCH" : "POST",
          body: JSON.stringify({
            name: name.trim(),
            category,
            description: description.trim(),
            active: true,
          }),
        }
      );
      await saved(isEditing ? undefined : res);
      close();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-black/60 p-4">
      <form onSubmit={handleSubmit} className="my-5 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b pb-4">
          <h3 className="text-lg font-black text-ink-900">
            {isNew ? "Cadastrar Nova Comodidade" : "Editar Comodidade"}
          </h3>
          <button type="button" onClick={close} className="rounded p-1 hover:bg-gray-100">
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block text-xs font-bold text-ink-800">
            Nome da Comodidade
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Piscina com borda infinita"
              className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
            />
          </label>

          <label className="block text-xs font-bold text-ink-800">
            Categoria
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 h-10 w-full rounded-lg border bg-white px-3 text-sm font-medium"
            >
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-bold text-ink-800">
            Descrição (opcional)
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Área de lazer com vista para o pôr do sol"
              className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
            />
          </label>
        </div>

        {error && <p className="mt-3 text-xs font-bold text-red-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2 border-t pt-4">
          <button
            type="button"
            onClick={close}
            className="rounded-lg border px-4 py-2 text-xs font-bold text-ink-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? "Salvando..." : isNew ? "Cadastrar" : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}

const ARAGUAIA_POLO_CITIES = [
  { city: "São Félix do Araguaia", state: "MT" },
  { city: "Luiz Alves", state: "GO" },
  { city: "Bandeirantes", state: "GO" },
  { city: "Cocalinho", state: "MT" },
  { city: "Aruanã", state: "GO" },
] as const;

function LodgeModal({
  token,
  item,
  close,
  saved,
}: {
  token: string;
  item?: Lodge;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const amenities = useData<Amenity[]>("amenities/", token, () => {});
  const speciesData = useData<Species[]>("species/", token, () => {});

  const [form, setForm] = useState({
    name: item?.name ?? "",
    city: item?.city ?? "",
    state: item?.state ?? "MT",
    description: item?.description ?? "",
    meeting_point: item?.meeting_point ?? "",
    directions: item?.directions ?? "",
    cover_image_url: item?.cover_image_url ?? "",
    active: item?.active ?? true,
  });

  const [selectedAmenityIds, setSelectedAmenityIds] = useState<string[]>(() => {
    if (item?.amenities_detailed && item.amenities_detailed.length > 0) {
      return item.amenities_detailed.map((a) => a.id);
    }
    return [];
  });

  const [selectedSpeciesSlugs, setSelectedSpeciesSlugs] = useState<string[]>(
    () => item?.target_species?.map((s) => s.slug) ?? []
  );

  const [editingAmenity, setEditingAmenity] = useState<Amenity | "new" | null>(null);
  const [showGalleryPicker, setShowGalleryPicker] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function selectStandardAmenities() {
    if (!amenities.data) return;
    const standardKeywords = [
      "ar split", "ar-condicionado", "climatizada", "wi-fi", "starlink",
      "barcos", "guias", "restaurante", "limpeza", "gelo", "refeições", "pensão"
    ];
    const defaultIds = amenities.data
      .filter((a) => standardKeywords.some((k) => a.name.toLowerCase().includes(k)))
      .map((a) => a.id);
    setSelectedAmenityIds(defaultIds);
  }

  useEffect(() => {
    if (amenities.data && selectedAmenityIds.length === 0) {
      if (item?.amenities && item.amenities.length > 0) {
        const legacyNames = new Set(item.amenities.map((n) => n.trim().toLowerCase()));
        const matched = amenities.data
          .filter((a) => legacyNames.has(a.name.trim().toLowerCase()))
          .map((a) => a.id);
        if (matched.length > 0) {
          setSelectedAmenityIds(matched);
        }
      } else if (!item) {
        // Pre-select standard amenities for a new lodge
        selectStandardAmenities();
      }
    }
  }, [amenities.data, item, selectedAmenityIds.length]);

  function toggleAmenity(id: string) {
    setSelectedAmenityIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleSpecies(slug: string) {
    setSelectedSpeciesSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  }

  const groupedAmenities = useMemo(() => {
    if (!amenities.data) return {};
    const groups: Record<string, Amenity[]> = {};
    for (const a of amenities.data) {
      const cat = a.category_display || a.category;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(a);
    }
    return groups;
  }, [amenities.data]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) {
      setError("O nome da pousada é obrigatório.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const selectedNames = selectedAmenityIds
        .map((id) => amenities.data?.find((a) => a.id === id)?.name)
        .filter(Boolean) as string[];

      const body = {
        ...form,
        amenity_ids: selectedAmenityIds,
        amenities: selectedNames.length > 0 ? selectedNames : item?.amenities ?? [],
        species_slugs: selectedSpeciesSlugs,
      };

      await request(item ? `lodges/${item.id}/` : "lodges/", token, {
        method: item ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      await saved();
    } catch (value) {
      setError(errorMessage(value));
    } finally {
      setSaving(false);
    }
  }

  const input = (name: keyof typeof form, label: string) => (
    <Field
      label={label}
      value={form[name] as string}
      set={(value) => setForm({ ...form, [name]: value })}
    />
  );

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/55 p-4">
      <form onSubmit={submit} className="my-5 w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex justify-between border-b pb-4">
          <div>
            <h2 className="text-2xl font-black">{item ? "Editar pousada" : "Nova pousada"}</h2>
            <p className="text-xs text-ink-500">Defina localização, catálogo de peixes, imagem e comodidades.</p>
          </div>
          <button type="button" onClick={close} className="rounded p-1 hover:bg-gray-100">
            <X />
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 max-h-[70vh] overflow-y-auto pr-2">
          <div className="sm:col-span-2">
            {input("name", "Nome da pousada")}
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-bold text-ink-800">
              Preenchimento Rápido (Cidades-polo Araguaia)
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              {ARAGUAIA_POLO_CITIES.map((polo) => {
                const isSelected = form.city === polo.city && form.state === polo.state;
                return (
                  <button
                    key={`${polo.city}-${polo.state}`}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, city: polo.city, state: polo.state }))}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-bold transition ${
                      isSelected
                        ? "border-brand-600 bg-brand-50 text-brand-900 ring-2 ring-brand-500/20"
                        : "border-gray-200 bg-gray-50 text-ink-700 hover:border-brand-400 hover:bg-white"
                    }`}
                  >
                    📍 {polo.city} ({polo.state})
                  </button>
                );
              })}
            </div>
          </div>

          {input("city", "Cidade")}
          {input("state", "Estado (UF)")}

          {/* Cover image with Gallery Picker */}
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-ink-800">Imagem de Capa da Pousada</label>
              <button
                type="button"
                onClick={() => setShowGalleryPicker(true)}
                className="flex items-center gap-1.5 rounded-lg border border-brand-600 bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700 hover:bg-brand-100"
              >
                <ImageIcon className="size-3.5" />
                Escolher da Galeria
              </button>
            </div>

            {form.cover_image_url ? (
              <div className="mt-2 flex items-center gap-3 rounded-xl border bg-gray-50 p-2">
                <img
                  src={form.cover_image_url}
                  alt="Capa da pousada"
                  className="size-16 rounded-lg object-cover shadow-sm"
                />
                <div className="min-w-0 flex-1">
                  <input
                    value={form.cover_image_url}
                    onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })}
                    placeholder="URL ou caminho da imagem"
                    className="h-8 w-full rounded border bg-white px-2 text-xs"
                  />
                  <p className="mt-0.5 text-[10px] text-ink-500">Imagem selecionada para a pousada</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, cover_image_url: "" })}
                  className="rounded p-1 text-ink-400 hover:bg-gray-200 hover:text-ink-700"
                  title="Remover imagem"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => setShowGalleryPicker(true)}
                className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50/50 py-4 text-xs font-bold text-ink-600 transition hover:border-brand-500 hover:bg-brand-50/30"
              >
                <ImageIcon className="size-4 text-brand-600" />
                <span>Nenhuma imagem selecionada. Clique para escolher da galeria de fotos.</span>
              </div>
            )}
          </div>

          {/* PEIXES DISPONÍVEIS NA POUSADA (CATÁLOGO RIO ARAGUAIA) */}
          <div className="sm:col-span-2 border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-ink-900 uppercase tracking-wider">
                Peixes Disponíveis nesta Pousada ({selectedSpeciesSlugs.length} selecionados)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedSpeciesSlugs(speciesData.data?.map((s) => s.slug) ?? [])}
                  className="text-[11px] font-bold text-brand-600 hover:underline"
                >
                  Selecionar Todos os Peixes (Rio Araguaia)
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedSpeciesSlugs([])}
                  className="text-[11px] font-bold text-ink-500 hover:underline"
                >
                  Limpar
                </button>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 max-h-48 overflow-y-auto p-2 border rounded-xl bg-gray-50/50">
              {speciesData.data?.map((sp) => {
                const checked = selectedSpeciesSlugs.includes(sp.slug);
                return (
                  <label
                    key={sp.slug}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-xs transition ${
                      checked
                        ? "border-brand-600 bg-brand-50 text-brand-950 font-bold"
                        : "border-gray-200 bg-white text-ink-700 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSpecies(sp.slug)}
                      className="size-3.5 rounded text-brand-600"
                    />
                    <span className="truncate">{sp.common_name}</span>
                    <span className="ml-auto text-[9px] uppercase font-bold text-ink-400">
                      {sp.category === "COURO" ? "Couro" : "Escama"}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* COMODIDADES CATEGORIZADAS COM ADICIONAR / EDITAR */}
          <div className="sm:col-span-2 border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-ink-900 uppercase tracking-wider">
                Comodidades Estruturadas ({selectedAmenityIds.length} selecionadas)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingAmenity("new")}
                  className="rounded bg-brand-50 border border-brand-600 px-2 py-0.5 text-[11px] font-bold text-brand-700 hover:bg-brand-100"
                >
                  <Plus className="mr-1 inline size-3" />
                  Nova Comodidade
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={selectStandardAmenities}
                  className="text-[11px] font-bold text-brand-600 hover:underline"
                >
                  Padrão Pousada Completa
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedAmenityIds(amenities.data?.map((a) => a.id) ?? [])}
                  className="text-[11px] font-bold text-brand-600 hover:underline"
                >
                  Selecionar todas
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedAmenityIds([])}
                  className="text-[11px] font-bold text-ink-500 hover:underline"
                >
                  Limpar
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {Object.entries(groupedAmenities).map(([categoryName, items]) => (
                <div key={categoryName} className="rounded-xl border border-ink-900/10 bg-[#fafbfa] p-3">
                  <h4 className="text-xs font-black text-brand-900 uppercase tracking-wide mb-2.5">
                    {categoryName}
                  </h4>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {items.map((a) => {
                      const checked = selectedAmenityIds.includes(a.id);
                      return (
                        <div
                          key={a.id}
                          className={`flex items-start justify-between rounded-lg border p-2.5 text-xs transition ${
                            checked
                              ? "border-brand-600 bg-brand-50/70 text-brand-950 font-bold"
                              : "border-ink-900/10 bg-white text-ink-700 hover:bg-gray-50"
                          }`}
                        >
                          <label className="flex flex-1 cursor-pointer items-start gap-2.5">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleAmenity(a.id)}
                              className="mt-0.5 rounded text-brand-600"
                            />
                            <div className="min-w-0 flex-1">
                              <span className="block leading-tight">{a.name}</span>
                              {a.description && (
                                <p className="mt-0.5 text-[11px] font-normal text-ink-500 line-clamp-1">
                                  {a.description}
                                </p>
                              )}
                            </div>
                          </label>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setEditingAmenity(a);
                            }}
                            title="Editar esta comodidade"
                            className="ml-2 rounded p-1 text-ink-400 hover:bg-gray-200 hover:text-brand-700"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <label className="text-xs font-bold sm:col-span-2 border-t pt-4">
            Ponto de encontro oficial
            <input
              value={form.meeting_point}
              onChange={(e) => setForm({ ...form, meeting_point: e.target.value })}
              placeholder="Ex: São Félix do Araguaia / MT — Recepção da pousada às 16h"
              className="mt-1 h-10 w-full rounded-lg border px-3"
            />
          </label>

          <label className="text-xs font-bold sm:col-span-2">
            Descrição geral da pousada
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="mt-1 min-h-20 w-full rounded-lg border p-3 text-xs"
            />
          </label>

          <label className="text-xs font-bold sm:col-span-2">
            Como chegar (instruções de acesso e rotas)
            <textarea
              value={form.directions}
              onChange={(e) => setForm({ ...form, directions: e.target.value })}
              className="mt-1 min-h-16 w-full rounded-lg border p-3 text-xs"
            />
          </label>

          <label className="flex items-center gap-2 text-xs font-bold sm:col-span-2">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Pousada ativa no sistema
          </label>
        </div>

        {error && <p className="mt-3 text-sm font-bold text-red-700">{error}</p>}
        <div className="mt-5 flex justify-end gap-3 border-t pt-4">
          <button
            type="button"
            onClick={close}
            className="rounded-lg border px-4 py-2.5 text-sm font-bold hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            disabled={saving}
            type="submit"
            className="rounded-lg bg-brand-600 px-5 py-2.5 font-bold text-white hover:bg-brand-700 shadow"
          >
            {saving ? "Salvando..." : "Salvar Pousada"}
          </button>
        </div>
      </form>

      {editingAmenity && (
        <AmenityModal
          token={token}
          item={editingAmenity}
          close={() => setEditingAmenity(null)}
          saved={async (newA) => {
            await amenities.load();
            if (newA?.id) {
              setSelectedAmenityIds((prev) => [...prev, newA.id]);
            }
          }}
        />
      )}

      {showGalleryPicker && (
        <GalleryPickerModal
          currentUrl={form.cover_image_url}
          onSelect={(url) => setForm((prev) => ({ ...prev, cover_image_url: url }))}
          close={() => setShowGalleryPicker(false)}
        />
      )}
    </div>
  );
}

const BASIN_OPTIONS = [
  ["TOCANTINS_ARAGUAIA", "Bacia Tocantins-Araguaia"],
  ["AMAZONICA", "Bacia Amazônica"],
  ["PRATA", "Bacia do Prata / Pantanal"],
  ["SAO_FRANCISCO", "Bacia do São Francisco"],
] as const;

function RiversPanel({ token, unauthorized }: { token: string; unauthorized: () => void }) {
  const list = useData<River[]>("rivers/", token, unauthorized);
  const [editing, setEditing] = useState<River | "new" | null>(null);
  const [managingSpecies, setManagingSpecies] = useState<River | null>(null);

  return (
    <div>
      <Header
        title="Rios e Bacias Hidrográficas"
        subtitle="Gerencie os rios onde ocorrem as expedições, regulamentações ambientais e peixes esportivos de cada ecossistema."
        action={
          <button
            onClick={() => setEditing("new")}
            className="rounded-lg bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow hover:bg-brand-700"
          >
            <Plus className="mr-2 inline size-4" />
            Novo rio
          </button>
        }
      />
      <div className="mt-6">
        <State loading={list.loading} error={list.error} />
        {list.data && (
          <div className="grid gap-4 xl:grid-cols-2">
            {list.data.map((river) => (
              <article key={river.id} className="rounded-xl bg-white p-5 shadow-sm border border-ink-900/5">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                          river.active ? "bg-brand-100 text-brand-800" : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {river.active ? "Ativo" : "Inativo"}
                      </span>
                      <span className="rounded-full bg-sand-200/70 px-2.5 py-1 text-xs font-bold text-sand-900">
                        {river.basin_display}
                      </span>
                    </div>
                    <h3 className="mt-2 text-xl font-black">{river.name}</h3>
                    <p className="text-xs font-bold text-ink-500">
                      Estados: {river.states?.join(", ") || "—"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setManagingSpecies(river)}
                      className="rounded-lg border px-3 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-50 flex items-center gap-1.5"
                    >
                      <Fish className="size-4" />
                      Peixes ({river.species_count ?? 0})
                    </button>
                    <button
                      onClick={() => setEditing(river)}
                      className="rounded-lg border p-2 hover:bg-gray-50"
                    >
                      <Pencil className="size-4" />
                    </button>
                  </div>
                </div>
                {river.description && (
                  <p className="mt-3 text-xs text-ink-600 line-clamp-2">{river.description}</p>
                )}
                {river.regulations && (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 p-2.5 text-xs text-amber-900">
                    <strong className="font-bold">Regulamentação: </strong>
                    {river.regulations}
                  </div>
                )}
                <div className="mt-3 flex items-center gap-4 border-t pt-2.5 text-xs text-ink-500">
                  <span>
                    <strong>{river.lodges_count ?? 0}</strong> pousada(s) operando
                  </span>
                  <span>·</span>
                  <span>
                    <strong>{river.species_count ?? 0}</strong> espécie(s) catalogada(s)
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <RiverModal
          token={token}
          item={editing === "new" ? undefined : editing}
          close={() => setEditing(null)}
          saved={async () => {
            setEditing(null);
            await list.load();
          }}
        />
      )}

      {managingSpecies && (
        <RiverSpeciesModal
          token={token}
          river={managingSpecies}
          close={() => setManagingSpecies(null)}
          changed={async () => {
            await list.load();
          }}
        />
      )}
    </div>
  );
}

function RiverModal({
  token,
  item,
  close,
  saved,
}: {
  token: string;
  item?: River;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: item?.name ?? "",
    slug: item?.slug ?? "",
    basin: item?.basin ?? "TOCANTINS_ARAGUAIA",
    states: (item?.states ?? []).join(", "),
    description: item?.description ?? "",
    regulations: item?.regulations ?? "",
    active: item?.active ?? true,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const statesArray = form.states
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);

      const body = {
        ...form,
        states: statesArray,
      };

      await request(item ? `rivers/${item.id}/` : "rivers/", token, {
        method: item ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      await saved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const input = (name: keyof typeof form, label: string) => (
    <Field
      label={label}
      value={form[name] as string}
      set={(value) => setForm({ ...form, [name]: value })}
    />
  );

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/55 p-4">
      <form onSubmit={submit} className="my-5 w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex justify-between border-b pb-4">
          <div>
            <h2 className="text-2xl font-black">{item ? "Editar Rio" : "Novo Rio"}</h2>
            <p className="text-xs text-ink-500">Defina o nome, bacia hidrográfica, estados e regras de pesca.</p>
          </div>
          <button type="button" onClick={close} className="rounded p-1 hover:bg-gray-100">
            <X />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {input("name", "Nome do Rio (Ex: Rio Araguaia)")}
          {input("slug", "Identificador / Slug (opcional)")}

          <label className="block text-xs font-bold">
            Bacia Hidrográfica
            <select
              value={form.basin}
              onChange={(e) => setForm({ ...form, basin: e.target.value })}
              className="mt-1 h-10 w-full rounded-lg border bg-white px-3 font-medium"
            >
              {BASIN_OPTIONS.map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-bold">
            Estados por onde passa (separados por vírgula)
            <input
              type="text"
              value={form.states}
              onChange={(e) => setForm({ ...form, states: e.target.value })}
              placeholder="Ex: MT, GO, TO"
              className="mt-1 h-10 w-full rounded-lg border px-3 text-xs"
            />
          </label>

          <label className="block text-xs font-bold">
            Descrição do Ecossistema e Características
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Ex: Berço das grandes piraíbas, águas limpas na seca com praias de areia branca..."
              className="mt-1 min-h-20 w-full rounded-lg border p-3 text-xs"
            />
          </label>

          <label className="block text-xs font-bold">
            Regulamentações e Leis Ambientais
            <textarea
              value={form.regulations}
              onChange={(e) => setForm({ ...form, regulations: e.target.value })}
              placeholder="Ex: Cota zero para transporte de peixes. Licença MPA obrigatória."
              className="mt-1 min-h-16 w-full rounded-lg border p-3 text-xs"
            />
          </label>

          <label className="flex items-center gap-2 text-xs font-bold">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Rio ativo para expedições
          </label>
        </div>

        {error && <p className="mt-3 text-sm font-bold text-red-700">{error}</p>}
        <div className="mt-5 flex justify-end gap-3 border-t pt-4">
          <button
            type="button"
            onClick={close}
            className="rounded-lg border px-4 py-2 text-sm font-bold hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            disabled={saving}
            type="submit"
            className="rounded-lg bg-brand-600 px-5 py-2 font-bold text-white shadow hover:bg-brand-700"
          >
            {saving ? "Salvando..." : "Salvar Rio"}
          </button>
        </div>
      </form>
    </div>
  );
}

function RiverSpeciesModal({
  token,
  river,
  close,
  changed,
}: {
  token: string;
  river: River;
  close: () => void;
  changed: () => Promise<void>;
}) {
  const currentList = useData<RiverSpecies[]>(`rivers/${river.id}/species/`, token, () => {});
  const catalog = useData<Species[]>("species/", token, () => {});

  const [selectedSlug, setSelectedSlug] = useState("");
  const [isTrophy, setIsTrophy] = useState(false);
  const [bestSeason, setBestSeason] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function addSpecies(e: FormEvent) {
    e.preventDefault();
    if (!selectedSlug) return setError("Selecione uma espécie para associar.");
    setSubmitting(true);
    setError("");
    try {
      await request(`rivers/${river.id}/species/`, token, {
        method: "POST",
        body: JSON.stringify({
          species_slug: selectedSlug,
          is_trophy: isTrophy,
          is_native: true,
          best_season: bestSeason.trim(),
        }),
      });
      setSelectedSlug("");
      setIsTrophy(false);
      setBestSeason("");
      await currentList.load();
      await changed();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function removeSpecies(slug: string) {
    if (!window.confirm("Remover esta espécie deste rio?")) return;
    try {
      await request(`rivers/${river.id}/species/?species_slug=${slug}`, token, {
        method: "DELETE",
      });
      await currentList.load();
      await changed();
    } catch (err) {
      window.alert(errorMessage(err));
    }
  }

  const existingSlugs = new Set(currentList.data?.map((s) => s.species_slug) ?? []);
  const availableToSelect = (catalog.data ?? []).filter((s) => !existingSlugs.has(s.slug));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/55 p-4">
      <div className="my-5 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex justify-between border-b pb-4">
          <div>
            <h2 className="text-2xl font-black">Peixes do {river.name}</h2>
            <p className="text-xs text-ink-500">
              Catálogo de espécies esportivas, troféus e melhor temporada no rio.
            </p>
          </div>
          <button type="button" onClick={close} className="rounded p-1 hover:bg-gray-100">
            <X />
          </button>
        </div>

        {/* FORMULÁRIO DE ASSOCIAÇÃO */}
        <form onSubmit={addSpecies} className="mt-4 rounded-xl border border-brand-200 bg-brand-50/50 p-4">
          <h3 className="text-xs font-black uppercase text-brand-900 mb-2">Vincular nova espécie ao rio</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-bold">
              Espécie do catálogo
              <select
                value={selectedSlug}
                onChange={(e) => setSelectedSlug(e.target.value)}
                className="mt-1 h-9 w-full rounded border bg-white px-2 text-xs"
              >
                <option value="">Selecione um peixe...</option>
                {availableToSelect.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.common_name} ({s.category})
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-bold">
              Melhor época / temporada
              <input
                type="text"
                value={bestSeason}
                onChange={(e) => setBestSeason(e.target.value)}
                placeholder="Ex: Junho a Outubro (seca)"
                className="mt-1 h-9 w-full rounded border px-2 text-xs"
              />
            </label>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={isTrophy}
                onChange={(e) => setIsTrophy(e.target.checked)}
                className="rounded text-brand-600"
              />
              Espécie Troféu (Destaque da Bacia)
            </label>

            <button
              disabled={submitting}
              type="submit"
              className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-bold text-white hover:bg-brand-700"
            >
              {submitting ? "Adicionando..." : "+ Vincular ao Rio"}
            </button>
          </div>
          {error && <p className="mt-2 text-xs font-bold text-red-700">{error}</p>}
        </form>

        {/* LISTA DE ESPÉCIES ATUALMENTE VINCULADAS */}
        <div className="mt-5">
          <h3 className="text-xs font-black uppercase text-ink-900 mb-3">
            Espécies vinculadas ({currentList.data?.length ?? 0})
          </h3>
          <State loading={currentList.loading} error={currentList.error} />
          {currentList.data && currentList.data.length === 0 && (
            <p className="text-center text-xs text-ink-500 py-6">Nenhuma espécie vinculada a este rio ainda.</p>
          )}
          {currentList.data && currentList.data.length > 0 && (
            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {currentList.data.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border border-ink-900/10 bg-white p-3 shadow-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-sm font-bold text-ink-900">{item.species_name}</strong>
                      {item.is_trophy && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800">
                          ★ TROFÉU
                        </span>
                      )}
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700">
                        {item.category}
                      </span>
                    </div>
                    {item.scientific_name && (
                      <p className="text-[11px] italic text-ink-500">{item.scientific_name}</p>
                    )}
                    {item.best_season && (
                      <p className="text-[11px] text-brand-700 font-medium mt-0.5">
                        Temporada: {item.best_season}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => removeSpecies(item.species_slug)}
                    className="rounded p-1.5 text-red-600 hover:bg-red-50 text-xs font-bold"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end border-t pt-4">
          <button
            type="button"
            onClick={close}
            className="rounded-lg bg-ink-900 px-5 py-2 text-sm font-bold text-white hover:bg-ink-800"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
}

function SpeciesPanel({ token, unauthorized }: { token: string; unauthorized: () => void }) {
  const list = useData<Species[]>("species/", token, unauthorized);
  const [editing, setEditing] = useState<Species | "new" | null>(null);

  return (
    <div>
      <Header
        title="Catálogo de Peixes do Bioma"
        subtitle="Gerencie as espécies nativas, categorias (Couro/Escama) e status para seleção nas expedições."
        action={
          <button
            onClick={() => setEditing("new")}
            className="rounded-lg bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow hover:bg-brand-700"
          >
            <Plus className="mr-2 inline size-4" />
            Novo peixe
          </button>
        }
      />
      <div className="mt-6">
        <State loading={list.loading} error={list.error} />
        {list.data && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {list.data.map((item) => (
              <article key={item.slug} className="rounded-xl border border-ink-900/10 bg-white p-5 shadow-sm transition hover:shadow">
                <div className="flex items-start justify-between">
                  <div className="flex flex-wrap gap-1.5">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        item.active !== false ? "bg-brand-100 text-brand-800" : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {item.active !== false ? "Ativo" : "Inativo"}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        item.category === "COURO" ? "bg-amber-100 text-amber-900" : "bg-blue-100 text-blue-900"
                      }`}
                    >
                      {item.category === "COURO" ? "Peixe de Couro" : "Peixe de Escama"}
                    </span>
                  </div>
                  <button
                    onClick={() => setEditing(item)}
                    className="rounded-lg border p-1.5 text-ink-600 hover:bg-gray-50"
                    title="Editar peixe"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                    <Fish className="size-4" />
                  </span>
                  <div>
                    <h3 className="text-base font-black text-ink-900 leading-snug">{item.common_name}</h3>
                    {item.scientific_name && (
                      <p className="text-xs italic text-ink-500">{item.scientific_name}</p>
                    )}
                  </div>
                </div>
                <p className="mt-3 border-t pt-2 text-[10px] font-mono text-ink-400">slug: {item.slug}</p>
              </article>
            ))}
          </div>
        )}
      </div>
      {editing && (
        <SpeciesModal
          token={token}
          item={editing === "new" ? undefined : editing}
          close={() => setEditing(null)}
          saved={async () => {
            setEditing(null);
            await list.load();
          }}
        />
      )}
    </div>
  );
}

function SpeciesModal({
  token,
  item,
  close,
  saved,
}: {
  token: string;
  item?: Species;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    common_name: item?.common_name ?? "",
    slug: item?.slug ?? "",
    scientific_name: item?.scientific_name ?? "",
    category: item?.category ?? "COURO",
    active: item?.active ?? true,
  });
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await request(item ? `species/${item.slug}/` : "species/", token, {
        method: item ? "PATCH" : "POST",
        body: JSON.stringify(form),
      });
      await saved();
    } catch (value) {
      setError(errorMessage(value));
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/55 p-4">
      <form onSubmit={submit} className="my-5 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-black">{item ? "Editar peixe" : "Novo peixe no catálogo"}</h2>
          <button type="button" onClick={close} className="rounded-lg p-1 text-ink-500 hover:bg-gray-100">
            <X className="size-5" />
          </button>
        </div>
        <div className="mt-5 grid gap-4">
          <Field
            label="Nome popular (ex: Piraíba (+2m), Pirarara Lendária, Bargada)"
            value={form.common_name}
            set={(value) => setForm({ ...form, common_name: value })}
          />
          <Field
            label="Identificador (slug) — Deixe vazio para gerar automaticamente"
            value={form.slug}
            set={(value) => setForm({ ...form, slug: value })}
          />
          <Field
            label="Nome científico (opcional, ex: Brachyplatystoma filamentosum)"
            value={form.scientific_name}
            set={(value) => setForm({ ...form, scientific_name: value })}
          />
          <label className="text-xs font-bold">
            Categoria da espécie
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="mt-1 h-10 w-full rounded-lg border px-3 text-sm font-semibold"
            >
              <option value="COURO">Peixe de Couro</option>
              <option value="ESCAMA">Peixe de Escama</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs font-bold text-ink-800">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="size-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            Peixe ativo no catálogo para expedições
          </label>
        </div>
        {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={close} className="rounded-lg border px-4 py-2 text-sm font-bold">
            Cancelar
          </button>
          <button type="submit" className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-bold text-white shadow hover:bg-brand-700">
            {item ? "Salvar alterações" : "Cadastrar peixe"}
          </button>
        </div>
      </form>
    </div>
  );
}

function PackagesPanel({ token, unauthorized }: { token: string; unauthorized: () => void }) {
  const [tab, setTab] = useState<"all_inclusive" | "beverage">("all_inclusive");
  const allInclusiveList = useData<AllInclusivePackage[]>("all-inclusive-packages/", token, unauthorized);
  const beverageList = useData<BeveragePackage[]>("beverage-packages/", token, unauthorized);
  const productsList = useData<Product[]>("products/", token, unauthorized);

  const [editingAllInclusive, setEditingAllInclusive] = useState<AllInclusivePackage | "new" | null>(null);
  const [editingBeverage, setEditingBeverage] = useState<BeveragePackage | "new" | null>(null);
  const [deleteError, setDeleteError] = useState("");

  async function handleDeleteAllInclusive(pkg: AllInclusivePackage) {
    if (!window.confirm(`Tem certeza que deseja excluir o pacote "${pkg.name}"?`)) return;
    setDeleteError("");
    try {
      await request(`all-inclusive-packages/${pkg.id}/`, token, { method: "DELETE" });
      await allInclusiveList.load();
    } catch (err) {
      setDeleteError(errorMessage(err));
    }
  }

  async function handleDeleteBeverage(pkg: BeveragePackage) {
    if (!window.confirm(`Tem certeza que deseja excluir o cardápio "${pkg.name}"?`)) return;
    setDeleteError("");
    try {
      await request(`beverage-packages/${pkg.id}/`, token, { method: "DELETE" });
      await beverageList.load();
    } catch (err) {
      setDeleteError(errorMessage(err));
    }
  }

  return (
    <div>
      <Header
        title="Pacotes & Cardápios"
        subtitle="Gerencie moldes reutilizáveis de pacotes e cardápios de bebidas para as expedições."
        action={
          tab === "all_inclusive" ? (
            <button
              onClick={() => {
                setDeleteError("");
                setEditingAllInclusive("new");
              }}
              className="rounded-lg bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-brand-700"
            >
              <Plus className="mr-2 inline size-4" />
              Novo pacote da expedição
            </button>
          ) : (
            <button
              onClick={() => {
                setDeleteError("");
                setEditingBeverage("new");
              }}
              className="rounded-lg bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-brand-700"
            >
              <Plus className="mr-2 inline size-4" />
              Novo cardápio de bebidas
            </button>
          )
        }
      />

      {/* Tabs */}
      <div className="mt-5 flex gap-2 border-b pb-3">
        <button
          onClick={() => {
            setTab("all_inclusive");
            setDeleteError("");
          }}
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition ${
            tab === "all_inclusive"
              ? "bg-brand-900 text-white shadow-sm"
              : "bg-white text-ink-600 hover:bg-gray-100"
          }`}
        >
          <Layers className="size-4" />
          Pacotes da Expedição ({allInclusiveList.data?.length ?? 0})
        </button>
        <button
          onClick={() => {
            setTab("beverage");
            setDeleteError("");
          }}
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition ${
            tab === "beverage"
              ? "bg-brand-900 text-white shadow-sm"
              : "bg-white text-ink-600 hover:bg-gray-100"
          }`}
        >
          <Beer className="size-4" />
          Cardápios de Bebidas ({beverageList.data?.length ?? 0})
        </button>
      </div>

      {deleteError && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-5 shrink-0" />
            <span>{deleteError}</span>
          </div>
          <button onClick={() => setDeleteError("")} className="text-xs text-red-500 hover:underline">
            Fechar
          </button>
        </div>
      )}

      {/* All Inclusive Tab Content */}
      {tab === "all_inclusive" && (
        <div className="mt-6">
          <State loading={allInclusiveList.loading} error={allInclusiveList.error} />
          {allInclusiveList.data && (
            <div className="grid gap-4 xl:grid-cols-2">
              {allInclusiveList.data.map((pkg) => (
                <article key={pkg.id} className="flex flex-col justify-between rounded-xl bg-white p-5 shadow-sm">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              pkg.active ? "bg-brand-100 text-brand-800" : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {pkg.active ? "Ativo" : "Inativo"}
                          </span>
                          {pkg.expeditions_count !== undefined && (
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                              {pkg.expeditions_count} expedição(ões) vinculada(s)
                            </span>
                          )}
                        </div>
                        <h3 className="mt-2 text-lg font-black text-ink-900">{pkg.name}</h3>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditingAllInclusive(pkg)}
                          title="Editar pacote"
                          className="rounded-lg border p-2 hover:bg-gray-50"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          onClick={() => void handleDeleteAllInclusive(pkg)}
                          title="Excluir pacote"
                          className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>

                    {pkg.description && (
                      <p className="mt-2 text-sm text-ink-600">{pkg.description}</p>
                    )}

                    <div className="mt-4 border-t pt-3">
                      <p className="text-xs font-bold text-ink-500">
                        Benefícios e Inclusões ({pkg.inclusions?.length ?? 0}):
                      </p>
                      <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs text-ink-700">
                        {pkg.inclusions?.map((inc, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <Check className="mt-0.5 size-3 shrink-0 text-brand-600" />
                            <span>{inc}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </article>
              ))}
              {!allInclusiveList.data.length && <Empty>Nenhum pacote da expedição cadastrado.</Empty>}
            </div>
          )}
        </div>
      )}

      {/* Beverage Tab Content */}
      {tab === "beverage" && (
        <div className="mt-6">
          <State loading={beverageList.loading} error={beverageList.error} />
          {beverageList.data && (
            <div className="grid gap-4 xl:grid-cols-2">
              {beverageList.data.map((pkg) => (
                <article key={pkg.id} className="flex flex-col justify-between rounded-xl bg-white p-5 shadow-sm">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              pkg.active ? "bg-brand-100 text-brand-800" : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {pkg.active ? "Ativo" : "Inativo"}
                          </span>
                          {pkg.expeditions_count !== undefined && (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                              {pkg.expeditions_count} expedição(ões) vinculada(s)
                            </span>
                          )}
                        </div>
                        <h3 className="mt-2 text-lg font-black text-ink-900">{pkg.name}</h3>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditingBeverage(pkg)}
                          title="Editar cardápio"
                          className="rounded-lg border p-2 hover:bg-gray-50"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          onClick={() => void handleDeleteBeverage(pkg)}
                          title="Excluir cardápio"
                          className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>

                    {pkg.description && (
                      <p className="mt-2 text-sm text-ink-600">{pkg.description}</p>
                    )}

                    <div className="mt-4 border-t pt-3">
                      <p className="text-xs font-bold text-ink-500">
                        Itens & Cotas por Participante ({pkg.items?.length ?? 0}):
                      </p>
                      <div className="mt-2 max-h-48 space-y-1.5 overflow-y-auto">
                        {pkg.items?.map((it, i) => (
                          <div
                            key={it.id ?? i}
                            className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-1.5 text-xs"
                          >
                            <div>
                              <strong className="text-ink-900">
                                {it.product_name || `Produto #${it.product || it.product_id}`}
                              </strong>
                              {it.note && <span className="ml-2 text-ink-500">({it.note})</span>}
                            </div>
                            <span className="font-bold text-brand-800">
                              {it.standard_quantity_per_participant} {it.product_unit || "un"}/pessoa
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
              {!beverageList.data.length && <Empty>Nenhum cardápio de bebidas cadastrado.</Empty>}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {editingAllInclusive && (
        <AllInclusivePackageModal
          token={token}
          item={editingAllInclusive === "new" ? undefined : editingAllInclusive}
          close={() => setEditingAllInclusive(null)}
          saved={async () => {
            setEditingAllInclusive(null);
            await allInclusiveList.load();
          }}
        />
      )}

      {editingBeverage && (
        <BeveragePackageModal
          token={token}
          item={editingBeverage === "new" ? undefined : editingBeverage}
          products={productsList.data ?? []}
          close={() => setEditingBeverage(null)}
          saved={async () => {
            setEditingBeverage(null);
            await beverageList.load();
          }}
        />
      )}
    </div>
  );
}

const STANDARD_INCLUSIONS_CATALOG = [
  "Combustível e Óleo 100% Inclusos",
  "Iscas Vivas Nativas (Tuviras/Caranguejos)",
  "Hospedagem Completa na Pousada",
  "Pensão Completa (Café, Almoço e Jantar)",
  "Kit Sashimi, Ceviche e petiscos no rio",
  "Bebidas e Gelo Abundante no Barco",
  "Guias Nativos Especializados",
  "Torneio com Troféus e Banner da Equipe",
  "Seguro Viagem e Resgate",
  "Internet Wi-Fi Starlink na Pousada",
  "Lavanderia Diária Inclusa",
  "Translado Aeroporto / Pousada",
] as const;

function AllInclusivePackageModal({
  token,
  item,
  close,
  saved,
}: {
  token: string;
  item?: AllInclusivePackage;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [active, setActive] = useState(item?.active ?? true);
  const [inclusions, setInclusions] = useState<string[]>(() => {
    if (item?.inclusions && item.inclusions.length > 0) {
      return item.inclusions;
    }
    return Array.from(STANDARD_INCLUSIONS_CATALOG.slice(0, 9));
  });
  const [customInclusion, setCustomInclusion] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function toggleInclusion(tag: string) {
    setInclusions((prev) =>
      prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]
    );
  }

  function addCustomInclusion() {
    const trimmed = customInclusion.trim();
    if (!trimmed) return;
    if (!inclusions.includes(trimmed)) {
      setInclusions((prev) => [...prev, trimmed]);
    }
    setCustomInclusion("");
  }

  function removeInclusion(tag: string) {
    setInclusions((prev) => prev.filter((x) => x !== tag));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("O nome do pacote é obrigatório.");
      return;
    }
    const cleanInclusions = inclusions.map((s) => s.trim()).filter(Boolean);
    if (cleanInclusions.length === 0) {
      setError("Insira ao menos um item de benefício/inclusão.");
      return;
    }

    setLoading(true);
    try {
      const body = {
        name: name.trim(),
        description: description.trim(),
        active,
        inclusions: cleanInclusions,
      };
      await request(item ? `all-inclusive-packages/${item.id}/` : "all-inclusive-packages/", token, {
        method: item ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      await saved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/55 p-4">
      <form onSubmit={submit} className="my-5 w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2">
            <Layers className="size-5 text-brand-600" />
            <h2 className="text-xl font-black">
              {item ? "Editar pacote da expedição" : "Novo pacote da expedição"}
            </h2>
          </div>
          <button type="button" onClick={close} className="rounded-lg p-1 text-ink-400 hover:bg-gray-100">
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-5 space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <label className="block text-xs font-bold text-ink-800">
            Nome do Pacote
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Pacote Casais VIP (Tudo Incluso)"
              className="mt-1 h-10 w-full rounded-lg border px-3 text-sm font-bold"
            />
          </label>

          <label className="block text-xs font-bold text-ink-800">
            Descrição do Molde
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Explicação da proposta do pacote e perfil de público..."
              className="mt-1 w-full rounded-lg border p-3 text-sm"
            />
          </label>

          {/* Quick-toggle tags for standard inclusions */}
          <div className="border-t pt-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-ink-800">
                Itens Padrão do Pacote (Clique para Ativar / Desativar)
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setInclusions(Array.from(STANDARD_INCLUSIONS_CATALOG.slice(0, 9)))}
                  className="text-[11px] font-bold text-brand-600 hover:underline"
                >
                  Padrão All-Inclusive
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={() => setInclusions([])}
                  className="text-[11px] font-bold text-ink-500 hover:underline"
                >
                  Limpar
                </button>
              </div>
            </div>
            <p className="mt-0.5 text-[11px] text-ink-500">
              Clique nos itens rápidos abaixo para adicionar ou remover do pacote:
            </p>

            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {STANDARD_INCLUSIONS_CATALOG.map((tag) => {
                const isIncluded = inclusions.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleInclusion(tag)}
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition ${
                      isIncluded
                        ? "border-brand-600 bg-brand-50 text-brand-900 shadow-xs ring-1 ring-brand-500/20"
                        : "border-gray-200 bg-gray-50 text-ink-600 hover:border-gray-300 hover:bg-white"
                    }`}
                  >
                    {isIncluded ? (
                      <Check className="size-3 text-brand-600 stroke-[3]" />
                    ) : (
                      <Plus className="size-3 text-ink-400" />
                    )}
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active inclusions list & custom addition */}
          <div className="rounded-xl border bg-gray-50/80 p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase tracking-wider text-ink-700">
                Benefícios Inclusos no Pacote ({inclusions.length})
              </span>
              {inclusions.length === 0 && (
                <span className="text-xs font-bold text-amber-600">Nenhum benefício selecionado</span>
              )}
            </div>

            {inclusions.length > 0 && (
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {inclusions.map((inc, idx) => (
                  <div
                    key={`${inc}-${idx}`}
                    className="flex items-center justify-between rounded-lg border bg-white px-3 py-1.5 text-xs text-ink-800 shadow-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="grid size-4 shrink-0 place-items-center rounded-full bg-brand-100 text-[10px] font-black text-brand-800">
                        {idx + 1}
                      </span>
                      <span className="font-medium truncate">{inc}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeInclusion(inc)}
                      className="ml-2 rounded p-1 text-ink-400 hover:bg-red-50 hover:text-red-600"
                      title="Remover benefício"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Custom item addition input */}
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={customInclusion}
                onChange={(e) => setCustomInclusion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomInclusion();
                  }
                }}
                placeholder="Adicionar item customizado (ex: Translado em van privativa)..."
                className="h-9 flex-1 rounded-lg border bg-white px-3 text-xs"
              />
              <button
                type="button"
                onClick={addCustomInclusion}
                className="flex items-center gap-1 rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-800"
              >
                <Plus className="size-3.5" />
                Adicionar
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs font-bold text-ink-800 pt-2">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="size-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            Pacote ativo para seleção no Construtor de Expedições
          </label>
        </div>

        {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}

        <div className="mt-6 flex justify-end gap-3 border-t pt-4">
          <button type="button" onClick={close} className="rounded-lg border px-4 py-2 text-sm font-bold">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-bold text-white shadow hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? "Salvando..." : item ? "Salvar alterações" : "Criar pacote"}
          </button>
        </div>
      </form>
    </div>
  );
}

function BeveragePackageModal({
  token,
  item,
  products,
  close,
  saved,
}: {
  token: string;
  item?: BeveragePackage;
  products: Product[];
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: item?.name ?? "",
    active: item?.active ?? true,
  });

  type ProductRow = {
    productId: string | number;
    name: string;
    category?: string;
    unit: string;
    enabled: boolean;
    quantity: number;
    note: string;
  };

  const [rows, setRows] = useState<ProductRow[]>(() => {
    const existingMap = new Map<string, { quantity: number; note: string }>();
    if (item?.items) {
      for (const it of item.items) {
        const pId = String(it.product_id ?? it.product ?? "");
        if (pId) {
          existingMap.set(pId, {
            quantity: it.standard_quantity_per_participant ?? 1,
            note: it.note ?? "",
          });
        }
      }
    }

    return products.map((prod) => {
      const pId = String(prod.id);
      const existing = existingMap.get(pId);
      const isEnabled = existing !== undefined;
      return {
        productId: prod.id,
        name: prod.name,
        category: prod.category,
        unit: prod.unit,
        enabled: isEnabled,
        quantity: existing?.quantity ?? 6,
        note: existing?.note ?? "",
      };
    });
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const activeCount = rows.filter((r) => r.enabled).length;

  function toggleProduct(productId: string | number) {
    setRows((prev) =>
      prev.map((r) => (r.productId === productId ? { ...r, enabled: !r.enabled } : r))
    );
  }

  function updateQuantity(productId: string | number, quantity: number) {
    setRows((prev) =>
      prev.map((r) => (r.productId === productId ? { ...r, quantity } : r))
    );
  }

  function updateNote(productId: string | number, note: string) {
    setRows((prev) =>
      prev.map((r) => (r.productId === productId ? { ...r, note } : r))
    );
  }

  function setAll(enabled: boolean) {
    setRows((prev) => prev.map((r) => ({ ...r, enabled })));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError("O nome do cardápio é obrigatório.");
      return;
    }
    const enabledRows = rows.filter((r) => r.enabled);
    if (enabledRows.length === 0) {
      setError("Ative pelo menos uma bebida no cardápio.");
      return;
    }

    setLoading(true);
    try {
      const body = {
        name: form.name.trim(),
        description: "",
        active: form.active,
        items_payload: enabledRows.map((it, idx) => ({
          product_id: it.productId,
          standard_quantity_per_participant: Number(it.quantity) || 1,
          note: it.note.trim(),
          display_order: idx,
        })),
      };

      await request(item ? `beverage-packages/${item.id}/` : "beverage-packages/", token, {
        method: item ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      await saved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/55 p-4">
      <form onSubmit={submit} className="my-5 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2">
            <Beer className="size-5 text-amber-600" />
            <h2 className="text-xl font-black">
              {item ? "Editar cardápio de bebidas" : "Novo cardápio de bebidas"}
            </h2>
          </div>
          <button type="button" onClick={close} className="rounded-lg p-1 text-ink-400 hover:bg-gray-100">
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <label className="block text-xs font-bold text-ink-800">
            Nome do Cardápio
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Open Bar Premium (Cervejas Especiais + Refrigerantes e Água)"
              className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
            />
          </label>

          <label className="flex items-center gap-2 text-xs font-bold text-ink-800">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="size-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            Cardápio ativo para seleção no Construtor
          </label>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-black text-ink-900">
                  Bebidas do Cardápio ({activeCount} ativada{activeCount === 1 ? "" : "s"})
                </h4>
                <p className="text-xs text-ink-500">
                  Ative ou desative cada bebida e defina a cota padrão por participante.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAll(true)}
                  className="text-xs font-bold text-brand-600 hover:underline"
                >
                  Ativar todas
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={() => setAll(false)}
                  className="text-xs font-bold text-ink-500 hover:underline"
                >
                  Desativar todas
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {rows.map((row) => (
                <div
                  key={row.productId}
                  className={`flex flex-col gap-2 rounded-xl border p-3 transition sm:flex-row sm:items-center sm:justify-between ${
                    row.enabled
                      ? "border-brand-500 bg-brand-50/40"
                      : "border-gray-200 bg-gray-50/60 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleProduct(row.productId)}
                      className={`flex h-7 w-24 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                        row.enabled
                          ? "bg-brand-600 text-white shadow-xs"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                    >
                      {row.enabled ? "✓ Ativo" : "Desativado"}
                    </button>
                    <div>
                      <span className="text-xs font-bold text-ink-900">{row.name}</span>
                      <span className="ml-2 rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-ink-500 border">
                        {row.unit}
                      </span>
                    </div>
                  </div>

                  {row.enabled && (
                    <div className="flex items-center gap-2 pl-2 sm:pl-0">
                      <label className="flex items-center gap-1 text-xs font-bold text-ink-700">
                        <span className="text-[11px] text-ink-500">Cota:</span>
                        <input
                          type="number"
                          min={1}
                          value={row.quantity}
                          onChange={(e) => updateQuantity(row.productId, Math.max(1, Number(e.target.value) || 1))}
                          className="h-8 w-16 rounded border bg-white px-2 text-center text-xs font-bold text-brand-900"
                        />
                      </label>
                      <input
                        type="text"
                        value={row.note}
                        onChange={(e) => updateNote(row.productId, e.target.value)}
                        placeholder="Obs (ex: Lata 350ml)"
                        className="h-8 w-36 rounded border bg-white px-2 text-xs text-ink-700 sm:w-44"
                      />
                    </div>
                  )}
                </div>
              ))}
              {!rows.length && <Empty>Nenhum produto cadastrado no catálogo.</Empty>}
            </div>
          </div>
        </div>

        {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}

        <div className="mt-6 flex justify-end gap-3 border-t pt-4">
          <button type="button" onClick={close} className="rounded-lg border px-4 py-2 text-sm font-bold">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-bold text-white shadow hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? "Salvando..." : item ? "Salvar alterações" : "Criar cardápio"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ConfigurationPanel({ token, unauthorized }: { token:string; unauthorized:()=>void }) { const expeditions=useData<Expedition[]>("expeditions/",token,unauthorized); const [selected,setSelected]=useState(""); const selectedId=selected||expeditions.data?.[0]?.id||""; const config=useData<Configuration>(selectedId?`expeditions/${selectedId}/configuration/`:null,token,unauthorized); return <div><Header title="Configuração operacional" subtitle="Defina encontro, bebidas oferecidas e checklist." /><div className="mt-5"><ExpeditionSelect value={selectedId} set={setSelected} items={expeditions.data??[]} all={false}/></div><div className="mt-6"><State loading={config.loading} error={config.error}/>{config.data&&<ConfigEditor key={selectedId} expedition={expeditions.data?.find(value=>value.id===selectedId)} config={config.data} token={token} reload={config.load}/>}</div></div>; }
function ConfigEditor({ expedition,config,token,reload }: { expedition?:Expedition; config:Configuration; token:string; reload:()=>Promise<void> }) { const [departure,setDeparture]=useState(config.departure_location??""); const [instructions,setInstructions]=useState(config.meeting_instructions??""); const [products,setProducts]=useState(config.products??[]); const [offers,setOffers]=useState(config.offers??[]); const [checklist,setChecklist]=useState(config.checklist_items??config.checklist??[]); const [message,setMessage]=useState(""); const locked=["IN_PROGRESS","COMPLETED"].includes(expedition?.status??""); async function save(){if(!expedition)return;try{await request(`expeditions/${expedition.id}/configuration/`,token,{method:"PUT",body:JSON.stringify({departure_location:departure,meeting_instructions:instructions,products,offers,checklist_items:checklist})});setMessage("Configuração salva.");await reload();}catch(value){setMessage(errorMessage(value));}} function updatePackage(productId:string,size:number){setProducts(products.map(product=>product.id===productId?{...product,package_size:size||null}:product))} return <div className="space-y-6">{locked&&<p className="rounded-lg bg-amber-50 p-4 font-bold">Configuração bloqueada após o início da expedição.</p>}<Box title="Encontro"><div className="grid gap-3 sm:grid-cols-2"><Field label="Local de saída" value={departure} set={setDeparture}/><Field label="Orientações de encontro" value={instructions} set={setInstructions}/></div></Box><section className="rounded-xl bg-white p-5"><div className="flex justify-between"><div><h3 className="font-black">Oferta de bebidas</h3><p className="text-sm text-ink-500">O viajante escolhe opções, sem informar unidades.</p></div><button disabled={locked} onClick={()=>setOffers([...offers,{product_id:"",standard_quantity_per_participant:1,display_order:offers.length+1,note:"",active:true}])} className="rounded-lg border px-3 text-sm font-bold"><Plus className="mr-1 inline size-4"/>Oferta</button></div>{offers.map((offer,index)=><div key={offer.id??index} className="mt-3 grid gap-3 rounded-lg border p-3 lg:grid-cols-[2fr_1fr_1fr_2fr_auto]"><label className="text-xs font-bold">Bebida<select value={offer.product_id} onChange={e=>setOffers(offers.map((value,i)=>i===index?{...value,product_id:e.target.value}:value))} className="mt-1 h-10 w-full rounded-lg border"><option value="">Selecione</option>{products.map(product=><option key={product.id} value={product.id}>{product.name} ({product.unit})</option>)}</select></label><NumberField label="Padrão/pessoa" value={offer.standard_quantity_per_participant} set={number=>setOffers(offers.map((value,i)=>i===index?{...value,standard_quantity_per_participant:number}:value))}/><NumberField label="Por embalagem" value={products.find(product=>product.id===offer.product_id)?.package_size??0} set={number=>updatePackage(offer.product_id,number)}/><Field label="Observação" value={offer.note} set={note=>setOffers(offers.map((value,i)=>i===index?{...value,note}:value))}/><label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={offer.active} onChange={e=>setOffers(offers.map((value,i)=>i===index?{...value,active:e.target.checked}:value))}/>Ativa</label></div>)}{!offers.length&&<Empty>Nenhuma bebida oferecida.</Empty>}</section><section className="rounded-xl bg-white p-5"><div className="flex justify-between"><h3 className="font-black">Checklist</h3><button disabled={locked} onClick={()=>setChecklist([...checklist,{title:"",description:"",required:true,active:true,display_order:checklist.length+1}])} className="rounded-lg border px-3 text-sm font-bold"><Plus className="mr-1 inline size-4"/>Item</button></div>{checklist.map((item,index)=><div key={item.id??index} className="mt-3 grid gap-3 rounded-lg border p-3 lg:grid-cols-[2fr_3fr_auto_auto]"><Field label="Título" value={item.title} set={title=>setChecklist(checklist.map((value,i)=>i===index?{...value,title}:value))}/><Field label="Orientação" value={item.description} set={description=>setChecklist(checklist.map((value,i)=>i===index?{...value,description}:value))}/><label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={item.required} onChange={e=>setChecklist(checklist.map((value,i)=>i===index?{...value,required:e.target.checked}:value))}/>Obrigatório</label><label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={item.active} onChange={e=>setChecklist(checklist.map((value,i)=>i===index?{...value,active:e.target.checked}:value))}/>Ativo</label></div>)}{!checklist.length&&<Empty>Nenhum item configurado.</Empty>}</section>{message&&<p className="rounded-lg bg-brand-50 p-3 font-bold">{message}</p>}<button disabled={locked} onClick={()=>void save()} className="rounded-lg bg-brand-600 px-5 py-3 font-bold text-white disabled:opacity-50">Salvar configuração</button></div>; }
function Field({label,value,set,type="text"}:{label:string;value:string;set:(value:string)=>void;type?:string}){return <label className="text-xs font-bold">{label}<input type={type} value={value??""} onChange={e=>set(e.target.value)} className="mt-1 h-10 w-full rounded-lg border px-3"/></label>}
function NumberField({label,value,set}:{label:string;value:number;set:(value:number)=>void}){return <label className="text-xs font-bold">{label}<input type="number" min="0" step="1" value={value} onChange={e=>set(Number(e.target.value))} className="mt-1 h-10 w-full rounded-lg border px-3"/></label>}
function ManifestPanel({ token, unauthorized }: { token: string; unauthorized: () => void }) {
  const expeditions = useData<Expedition[]>("expeditions/", token, unauthorized);
  const [selected, setSelected] = useState("");
  const selectedId = selected || expeditions.data?.[0]?.id || "";
  const manifest = useData<ManifestData>(selectedId ? `expeditions/${selectedId}/manifest/` : null, token, unauthorized);

  async function downloadCsv() {
    try {
      const content = await request<string>(`expeditions/${selectedId}/manifest.csv`, token);
      const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `manifesto-embarque-${selectedId}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      window.alert(errorMessage(err));
    }
  }

  function printManifest() {
    window.print();
  }

  return (
    <div>
      <Header
        title="Manifesto de Embarque"
        subtitle="Relação oficial de passageiros para Pousada, Marinha e órgãos ambientais."
        action={
          <div className="flex gap-2">
            <button
              onClick={printManifest}
              className="rounded-lg border bg-white px-3 py-2 text-sm font-bold shadow-xs hover:bg-gray-50"
            >
              <Printer className="mr-1.5 inline size-4" />
              Imprimir / PDF
            </button>
            <button
              onClick={() => void downloadCsv()}
              className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-bold text-white shadow-xs hover:bg-brand-700"
            >
              <Download className="mr-1.5 inline size-4" />
              Baixar CSV
            </button>
          </div>
        }
      />
      <div className="mt-5">
        <ExpeditionSelect value={selectedId} set={setSelected} items={expeditions.data ?? []} all={false} />
      </div>
      <div className="mt-6">
        <State loading={manifest.loading} error={manifest.error} />
        {manifest.data && (
          <div className="rounded-xl bg-white p-6 shadow-xs">
            <div className="border-b pb-4">
              <div className="flex flex-col justify-between sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-2xl font-black">{manifest.data.expedition.name}</h3>
                  <p className="text-sm text-ink-600">
                    <strong>Base / Pousada:</strong> {manifest.data.expedition.lodge_name} · <strong>Saída:</strong>{" "}
                    {manifest.data.expedition.departure_location || manifest.data.expedition.destination}
                  </p>
                  <p className="text-xs text-ink-500">
                    Período: {shortDate(manifest.data.expedition.starts_at)} a {shortDate(manifest.data.expedition.ends_at)}
                  </p>
                </div>
                <div className="mt-3 rounded-lg bg-brand-50 p-3 text-right sm:mt-0">
                  <span className="block text-xs font-bold text-ink-500">Passageiros Confirmados</span>
                  <strong className="text-xl font-black text-brand-800">
                    {manifest.data.expedition.total_passengers} / {manifest.data.expedition.capacity} vagas
                  </strong>
                </div>
              </div>
            </div>

            {manifest.data.gear_summary && manifest.data.gear_summary.length > 0 && (
              <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50/50 p-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-brand-900">
                  Resumo de Tralhas & Equipamentos para a Pousada / Piloteiros:
                </h4>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {manifest.data.gear_summary.map((g) => (
                    <div
                      key={g.gear_product_id + g.modality}
                      className="rounded-lg bg-white px-3 py-1.5 text-xs shadow-xs border"
                    >
                      <strong className="text-ink-900">{g.total_quantity}x {g.name}</strong>
                      <span className="ml-1.5 text-[10px] font-bold text-brand-700">({g.modality})</span>
                      <span className="ml-2 text-[10px] text-ink-500">
                        ({g.delivered_quantity}/{g.total_quantity} entregues)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-brand-900 text-xs uppercase text-white">
                  <tr>
                    <th className="px-4 py-3">Nº</th>
                    <th>Pescador / Passageiro</th>
                    <th>CPF / Contato</th>
                    <th>Emergência</th>
                    <th>Restrições / Saúde</th>
                    <th>Tralhas & Loja</th>
                    <th>Ficha</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {manifest.data.passengers.map((p, idx) => (
                    <tr key={p.id}>
                      <td className="px-4 py-3 font-bold text-ink-500">{idx + 1}</td>
                      <td>
                        <strong>{p.name}</strong>
                        {p.customer_name && p.customer_name !== p.name && (
                          <span className="block text-[11px] text-ink-500">Reserva de {p.customer_name}</span>
                        )}
                      </td>
                      <td>
                        <span>{p.cpf || "CPF pendente"}</span>
                        <span className="block text-xs text-ink-500">{p.phone || "s/ tel"}</span>
                      </td>
                      <td>
                        {p.emergency_contact_name ? (
                          <>
                            <strong>{p.emergency_contact_name}</strong>
                            <span className="block text-xs text-ink-500">{p.emergency_contact_phone}</span>
                          </>
                        ) : (
                          <span className="text-xs font-bold text-amber-700">Não informado</span>
                        )}
                      </td>
                      <td>
                        {p.dietary_restrictions?.length ? (
                          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">
                            {p.dietary_restrictions.join(", ")}
                            {p.dietary_details ? ` (${p.dietary_details})` : ""}
                          </span>
                        ) : (
                          <span className="text-xs text-ink-400">Nenhuma</span>
                        )}
                        {p.operational_notes && (
                          <p className="mt-1 text-[11px] text-ink-600">Obs: {p.operational_notes}</p>
                        )}
                      </td>
                      <td>
                        {p.gear_addons?.length ? (
                          <div className="flex flex-col gap-1">
                            {p.gear_addons.map((g) => (
                              <span
                                key={g.id}
                                className="inline-flex items-center gap-1 rounded bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-900 border border-brand-200"
                              >
                                {g.quantity}x {g.gear_name} ({g.modality})
                                {g.delivered && <Check className="size-3 text-emerald-600 inline" />}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-ink-400">—</span>
                        )}
                      </td>
                      <td>
                        <Pill ok={p.onboarding_status === "COMPLETED"}>
                          {p.onboarding_status === "COMPLETED" ? "Completa" : "Pendente"}
                        </Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!manifest.data.passengers.length && (
                <Empty>Nenhum passageiro confirmado para esta expedição.</Empty>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ShoppingPanel({token,unauthorized}:{token:string;unauthorized:()=>void}){const expeditions=useData<Expedition[]>("expeditions/",token,unauthorized);const[selected,setSelected]=useState("");const selectedId=selected||expeditions.data?.[0]?.id||"";const[copied,setCopied]=useState(false);const result=useData<Consolidation>(selectedId?`expeditions/${selectedId}/consolidation/`:null,token,unauthorized);const text=useMemo(()=>result.data?.text??result.data?.items.map(row=>`${row.product}: ${row.total} ${row.unit}${row.package_size?` (${row.full_packages??0} embalagem(ns) + ${row.remainder??0} ${row.unit})`:""}`).join("\n")??"",[result.data]);async function download(format:"csv"|"txt"){try{const content=await request<string>(`expeditions/${selectedId}/consolidation.${format}`,token);const url=URL.createObjectURL(new Blob([content],{type:"text/plain;charset=utf-8"}));const anchor=document.createElement("a");anchor.href=url;anchor.download=`lista-compras-${selectedId}.${format}`;anchor.click();URL.revokeObjectURL(url)}catch(value){window.alert(errorMessage(value))}}async function copy(){await navigator.clipboard.writeText(text);setCopied(true);window.setTimeout(()=>setCopied(false),1500)}return <div><Header title="Lista de compras" subtitle="Consolidação por escolhas e padrão vigente das reservas garantidas." action={<div className="flex gap-2"><button onClick={()=>void copy()} className="rounded-lg border bg-white px-3 py-2 text-sm font-bold"><Copy className="mr-1 inline size-4"/>{copied?"Copiado":"Copiar"}</button><button onClick={()=>void download("csv")} className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-bold text-white"><Download className="mr-1 inline size-4"/>CSV</button><button onClick={()=>void download("txt")} className="rounded-lg bg-brand-900 px-3 py-2 text-sm font-bold text-white"><Download className="mr-1 inline size-4"/>Texto</button></div>}/><div className="mt-5"><ExpeditionSelect value={selectedId} set={setSelected} items={expeditions.data??[]} all={false}/></div><div className="mt-6"><State loading={result.loading} error={result.error}/>{result.data&&<div className="overflow-x-auto rounded-xl bg-white"><p className="p-4 text-xs">Snapshot: {new Date(result.data.generated_at).toLocaleString("pt-BR")}</p><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-brand-900 text-xs uppercase text-white"><tr><th className="px-5 py-4">Produto</th><th>Pessoas</th><th>Padrão</th><th>Total</th><th>Embalagens</th><th>Sobra</th><th>Atualização</th></tr></thead><tbody className="divide-y">{result.data.items.map(row=><tr key={row.offer_id}><td className="px-5 py-4"><strong>{row.product}</strong>{row.details?.length ? <details className="mt-2"><summary className="cursor-pointer text-xs font-bold text-brand-700">Ver {row.details.length} participante(s)</summary><ul className="mt-2 space-y-1 text-xs text-ink-500">{row.details.map((detail,index)=><li key={detail.participant_id??`${detail.reservation_id}-${index}`}>{detail.participant_name}{detail.customer_name ? ` · reserva de ${detail.customer_name}` : ""}</li>)}</ul></details> : null}</td><td>{row.people}</td><td>{row.standard_quantity_per_participant} {row.unit}</td><td className="font-black text-brand-800">{row.total} {row.unit}</td><td>{row.package_size?`${row.full_packages??0} × ${row.package_size}`:"—"}</td><td>{row.package_size?`${row.remainder??0} ${row.unit}`:"—"}</td><td>{shortDate(row.updated_at)}</td></tr>)}</tbody></table>{!result.data.items.length&&<Empty>Nenhuma escolha elegível.</Empty>}</div>}</div></div>}

function GearPanel({ token, unauthorized }: { token: string; unauthorized: () => void }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [modality, setModality] = useState("");
  const [editingGear, setEditingGear] = useState<Partial<FishingGearProduct> | null>(null);
  const path = `gear-products/?q=${encodeURIComponent(query)}&category=${category}&modality=${modality}`;
  const list = useData<FishingGearProduct[]>(path, token, unauthorized);

  async function handleDelete(item: FishingGearProduct) {
    if (!window.confirm(`Tem certeza que deseja excluir "${item.name}"?`)) return;
    try {
      await request(`gear-products/${item.id}/`, token, { method: "DELETE" });
      await list.load();
    } catch (err) {
      window.alert(errorMessage(err));
    }
  }

  const items = list.data ?? [];
  const totalStock = items.reduce((acc, g) => acc + (g.inventory_quantity || 0), 0);
  const rentalCount = items.filter((g) => g.modality === "RENTAL" || g.modality === "BOTH").length;
  const saleCount = items.filter((g) => g.modality === "SALE" || g.modality === "BOTH").length;

  return (
    <div>
      <Header
        title="Tralhas & Loja de Equipamentos"
        subtitle="Controle de estoque, preços de locação e venda para as expedições."
        action={
          <button
            onClick={() =>
              setEditingGear({
                active: true,
                modality: "RENTAL",
                inventory_quantity: 1,
                rental_price_cents: 0,
                sale_price_cents: 0,
                category: "HEAVY_ROD_REEL",
              })
            }
            className="rounded-lg bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-brand-700"
          >
            <Plus className="mr-2 inline size-4" />
            Novo Equipamento
          </button>
        }
      />

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl bg-white p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-ink-500">Catálogo de Itens</span>
          <strong className="mt-2 block text-2xl font-black text-brand-900">{items.length}</strong>
        </article>
        <article className="rounded-xl bg-white p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-ink-500">Estoque Total</span>
          <strong className="mt-2 block text-2xl font-black text-brand-900">{totalStock} unid.</strong>
        </article>
        <article className="rounded-xl bg-white p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-ink-500">Para Locação</span>
          <strong className="mt-2 block text-2xl font-black text-blue-700">{rentalCount} produtos</strong>
        </article>
        <article className="rounded-xl bg-white p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-ink-500">Para Venda</span>
          <strong className="mt-2 block text-2xl font-black text-emerald-700">{saleCount} produtos</strong>
        </article>
      </section>

      <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
        <label className="flex min-h-11 items-center gap-2 rounded-lg border bg-white px-3 shadow-xs">
          <Search className="size-4 text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, categoria ou especificações..."
            className="w-full bg-transparent text-sm font-bold outline-none"
          />
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="min-h-11 rounded-lg border bg-white px-3 text-sm font-bold shadow-xs"
        >
          <option value="">Todas as categorias</option>
          <option value="HEAVY_ROD_REEL">Conjunto Pesado (Piraíba/Jaú)</option>
          <option value="MEDIUM_ROD_REEL">Conjunto Médio (Pirarara/Tucunaré)</option>
          <option value="TERMINAL_TACKLE">Tralhas Terminais & Acessórios</option>
          <option value="APPAREL">Vestuário & Proteção UV</option>
          <option value="SPECIALTY_BAIT">Iscas Especiais & Essências</option>
        </select>
        <select
          value={modality}
          onChange={(e) => setModality(e.target.value)}
          className="min-h-11 rounded-lg border bg-white px-3 text-sm font-bold shadow-xs"
        >
          <option value="">Todas as modalidades</option>
          <option value="RENTAL">Apenas Locação</option>
          <option value="SALE">Apenas Venda</option>
          <option value="BOTH">Ambos (Locação e Venda)</option>
        </select>
      </div>

      <div className="mt-6">
        <State loading={list.loading} error={list.error} />
        {list.data && (
          <div className="overflow-x-auto rounded-xl bg-white shadow-xs">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-brand-900 text-xs uppercase text-white">
                <tr>
                  <th className="px-5 py-4">Equipamento</th>
                  <th>Categoria</th>
                  <th>Modalidade</th>
                  <th>Estoque</th>
                  <th>Locação</th>
                  <th>Venda</th>
                  <th>Status</th>
                  <th className="px-5 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-4">
                      <strong>{item.name}</strong>
                      {item.description && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-ink-500">{item.description}</p>
                      )}
                    </td>
                    <td>
                      <span className="rounded bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-900 border border-brand-200">
                        {item.category_display || item.category}
                      </span>
                    </td>
                    <td>
                      <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-800">
                        {item.modality_display || item.modality}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-bold ${
                          item.inventory_quantity === 0
                            ? "bg-red-100 text-red-800"
                            : item.inventory_quantity <= 3
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {item.inventory_quantity} {item.inventory_quantity === 1 ? "unid." : "unids."}
                      </span>
                    </td>
                    <td>
                      {item.modality === "SALE" ? (
                        <span className="text-xs text-ink-400">—</span>
                      ) : (
                        <strong className="text-brand-900">{money(item.rental_price_cents)}</strong>
                      )}
                    </td>
                    <td>
                      {item.modality === "RENTAL" ? (
                        <span className="text-xs text-ink-400">—</span>
                      ) : (
                        <strong className="text-emerald-900">{money(item.sale_price_cents)}</strong>
                      )}
                    </td>
                    <td>
                      <Pill ok={item.active}>{item.active ? "Ativo" : "Inativo"}</Pill>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingGear(item)}
                          className="rounded-lg border px-3 py-1.5 text-xs font-bold hover:bg-gray-50"
                        >
                          <Pencil className="mr-1 inline size-3" />
                          Editar
                        </button>
                        <button
                          onClick={() => void handleDelete(item)}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="mr-1 inline size-3" />
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!items.length && <Empty>Nenhum equipamento cadastrado.</Empty>}
          </div>
        )}
      </div>

      {editingGear && (
        <GearModal
          token={token}
          gear={editingGear}
          close={() => setEditingGear(null)}
          saved={async () => {
            await list.load();
            setEditingGear(null);
          }}
        />
      )}
    </div>
  );
}

const GEAR_PRESETS = [
  {
    label: "Kit Piraíba Pesada",
    icon: "🎣",
    name: "Kit Pesca Pesada Piraíba (Vara 80-100lb + Carretilha 50W)",
    category: "HEAVY_ROD_REEL",
    modality: "RENTAL" as const,
    inventory_quantity: 6,
    rental_price: "250.00",
    sale_price: "0.00",
    description: "Conjunto profissional de pesca pesada no Araguaia: Vara de carbono maciço 80-100lbs, carretilha de perfil alto com 300m de linha multifilamento 0.90mm e líder de aço 150lb.",
    technical_specs: {
      "vara": "80-100 lbs carbono maciço 6'0",
      "carretilha": "Perfil Alto 50W / Alumínio usinado",
      "linha": "Multifilamento 8 fios 0.90mm (130lb)",
      "lider": "Aço encastoado flexível 150lb com girador e anzol circular 10/0"
    }
  },
  {
    label: "Kit Pirarara Médio",
    icon: "🐟",
    name: "Kit Pesca Média Pirarara (Vara 50-80lb + Carretilha Perfil Alto)",
    category: "MEDIUM_ROD_REEL",
    modality: "RENTAL" as const,
    inventory_quantity: 8,
    rental_price: "200.00",
    sale_price: "0.00",
    description: "Conjunto ágil e resistente para peixes de couro médios (Pirarara, Cachara, Jaú médio). Vara 50-80lb com carretilha abastecida com 250m de multifilamento 0.70mm.",
    technical_specs: {
      "vara": "50-80 lbs carbono tubular reforçado 6'0",
      "carretilha": "Perfil Alto 400 com freio centrífugo",
      "linha": "Multifilamento 0.70mm (80lb)",
      "lider": "Fluorocarbono 0.90mm com anzol Wide Gap 8/0"
    }
  },
  {
    label: "Kit Tucunaré Azul",
    icon: "🎯",
    name: "Kit Iscas Artificiais & Carretilha Baitcasting (Tucunaré)",
    category: "MEDIUM_ROD_REEL",
    modality: "RENTAL" as const,
    inventory_quantity: 10,
    rental_price: "150.00",
    sale_price: "0.00",
    description: "Conjunto para pincho e arremesso em lagoas e praias do Araguaia para Tucunaré Azul e Aruanã.",
    technical_specs: {
      "vara": "17-25 lbs carbono IM8 5'8",
      "carretilha": "Perfil Baixo recolhimento 7.1:1 com 10 rolamentos",
      "linha": "Multifilamento 0.35mm (40lb)",
      "lider": "Fluorocarbono 0.50mm"
    }
  },
  {
    label: "Camisa UV Oficial",
    icon: "👕",
    name: "Camisa Dry-Fit Manga Longa Proteção UV 50+ Expedição Piraíba",
    category: "APPAREL",
    modality: "SALE" as const,
    inventory_quantity: 30,
    rental_price: "0.00",
    sale_price: "150.00",
    description: "Camisa oficial de alta performance com proteção solar UV50+, tecido respirável que seca rápido e capuz integrado.",
    technical_specs: {
      "tecido": "100% Poliamida Dry-Fit antibacteriano",
      "fator_uv": "FPU 50+ permanente",
      "tamanhos": "P, M, G, GG, XG"
    }
  }
];

function GearModal({
  token,
  gear,
  close,
  saved,
}: {
  token: string;
  gear: Partial<FishingGearProduct>;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: gear.name ?? "",
    category: gear.category ?? "HEAVY_ROD_REEL",
    modality: gear.modality ?? "RENTAL",
    inventory_quantity: gear.inventory_quantity ?? 1,
    rental_price: gear.rental_price_cents ? (gear.rental_price_cents / 100).toFixed(2) : "0.00",
    sale_price: gear.sale_price_cents ? (gear.sale_price_cents / 100).toFixed(2) : "0.00",
    description: gear.description ?? "",
    image_url: gear.image_url ?? "",
    active: gear.active ?? true,
    technical_specs: gear.technical_specs ? JSON.stringify(gear.technical_specs, null, 2) : "{}",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function applyPreset(preset: typeof GEAR_PRESETS[number]) {
    setForm((prev) => ({
      ...prev,
      name: preset.name,
      category: preset.category,
      modality: preset.modality,
      inventory_quantity: preset.inventory_quantity,
      rental_price: preset.rental_price,
      sale_price: preset.sale_price,
      description: preset.description,
      technical_specs: JSON.stringify(preset.technical_specs, null, 2),
    }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return setError("O nome do equipamento é obrigatório.");
    let parsedSpecs = {};
    if (form.technical_specs.trim()) {
      try {
        parsedSpecs = JSON.parse(form.technical_specs);
      } catch {
        return setError("Especificações técnicas devem ser um JSON válido (ex: {\"vara\": \"80lbs\", \"carretilha\": \"Perfil Alto\"}).");
      }
    }
    const rentalCents = Math.round(Number(form.rental_price.replace(",", ".")) * 100);
    const saleCents = Math.round(Number(form.sale_price.replace(",", ".")) * 100);
    if (isNaN(rentalCents) || rentalCents < 0) return setError("Preço de locação inválido.");
    if (isNaN(saleCents) || saleCents < 0) return setError("Preço de venda inválido.");

    setSaving(true);
    setError("");
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        modality: form.modality,
        inventory_quantity: Math.max(0, Number(form.inventory_quantity) || 0),
        rental_price_cents: rentalCents,
        sale_price_cents: saleCents,
        description: form.description.trim(),
        image_url: form.image_url.trim(),
        active: form.active,
        technical_specs: parsedSpecs,
      };
      if (gear.id) {
        await request(`gear-products/${gear.id}/`, token, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await request("gear-products/", token, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      await saved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={submit} className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-lg font-black text-brand-950">
            {gear.id ? "Editar Equipamento" : "Novo Equipamento de Pesca"}
          </h3>
          <button type="button" onClick={close} className="rounded p-1 text-ink-500 hover:bg-gray-100">
            <X className="size-5" />
          </button>
        </div>

        {/* Modelos Prontos Preset Bar */}
        <div className="mt-3 rounded-xl border border-brand-100 bg-brand-50/60 p-3">
          <span className="block text-[11px] font-black uppercase tracking-wider text-brand-900">
            ⚡ Modelos Prontos (Preenchimento em 1 Clique):
          </span>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {GEAR_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset)}
                className="flex items-center gap-1.5 rounded-lg border border-brand-200 bg-white px-2.5 py-1 text-xs font-bold text-brand-900 shadow-xs hover:border-brand-500 hover:bg-brand-50 transition"
              >
                <span>{preset.icon}</span>
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-bold sm:col-span-2">
            Nome do Equipamento *
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Conjunto Pesado 80-100lbs (Piraíba)"
              className="mt-1 h-10 w-full rounded-lg border px-3 text-sm font-bold"
            />
          </label>

          <label className="text-xs font-bold">
            Categoria *
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="mt-1 h-10 w-full rounded-lg border px-3 text-sm font-bold"
            >
              <option value="HEAVY_ROD_REEL">Conjunto Pesado (Piraíba/Jaú)</option>
              <option value="MEDIUM_ROD_REEL">Conjunto Médio (Pirarara/Tucunaré)</option>
              <option value="TERMINAL_TACKLE">Tralhas Terminais & Acessórios</option>
              <option value="APPAREL">Vestuário & Proteção UV</option>
              <option value="SPECIALTY_BAIT">Iscas Especiais & Essências</option>
            </select>
          </label>

          <label className="text-xs font-bold">
            Modalidade Comercial *
            <select
              value={form.modality}
              onChange={(e) => setForm({ ...form, modality: e.target.value as "RENTAL" | "SALE" | "BOTH" })}
              className="mt-1 h-10 w-full rounded-lg border px-3 text-sm font-bold"
            >
              <option value="RENTAL">Apenas Locação</option>
              <option value="SALE">Apenas Venda</option>
              <option value="BOTH">Ambos (Locação e Venda)</option>
            </select>
          </label>

          <label className="text-xs font-bold">
            Estoque Disponível (unidades) *
            <input
              type="number"
              min={0}
              required
              value={form.inventory_quantity}
              onChange={(e) => setForm({ ...form, inventory_quantity: Number(e.target.value) })}
              className="mt-1 h-10 w-full rounded-lg border px-3 text-sm font-bold"
            />
          </label>

          <label className="text-xs font-bold">
            Preço de Locação (R$) {form.modality === "SALE" && "(Desativado)"}
            <input
              type="text"
              disabled={form.modality === "SALE"}
              value={form.rental_price}
              onChange={(e) => setForm({ ...form, rental_price: e.target.value })}
              className="mt-1 h-10 w-full rounded-lg border px-3 text-sm font-bold disabled:bg-gray-100"
            />
          </label>

          <label className="text-xs font-bold">
            Preço de Venda (R$) {form.modality === "RENTAL" && "(Desativado)"}
            <input
              type="text"
              disabled={form.modality === "RENTAL"}
              value={form.sale_price}
              onChange={(e) => setForm({ ...form, sale_price: e.target.value })}
              className="mt-1 h-10 w-full rounded-lg border px-3 text-sm font-bold disabled:bg-gray-100"
            />
          </label>

          <label className="text-xs font-bold">
            URL da Imagem (opcional)
            <input
              type="url"
              value={form.image_url}
              onChange={(e) => setForm({ ...form, image_url: e.target.value })}
              placeholder="https://..."
              className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
            />
          </label>

          <label className="text-xs font-bold sm:col-span-2">
            Descrição do Produto
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Ex: Vara especial de 80 lbs, carretilha com 300m de linha multifilamento 0.70mm e líder fluorocarbono."
              className="mt-1 min-h-16 w-full rounded-lg border p-3 text-xs"
            />
          </label>

          <label className="text-xs font-bold sm:col-span-2">
            Especificações Técnicas (JSON chave-valor)
            <textarea
              value={form.technical_specs}
              onChange={(e) => setForm({ ...form, technical_specs: e.target.value })}
              placeholder='{"vara": "80lbs carbono maciço", "carretilha": "Perfil alto 400", "linha": "0.70mm"}'
              className="mt-1 min-h-16 w-full rounded-lg border p-3 font-mono text-xs"
            />
          </label>

          <label className="flex items-center gap-2 text-xs font-bold sm:col-span-2">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="size-4 rounded text-brand-600"
            />
            Equipamento ativo no catálogo
          </label>
        </div>

        {error && <p className="mt-3 text-sm font-bold text-red-700">{error}</p>}

        <div className="mt-6 flex justify-end gap-3 border-t pt-4">
          <button
            type="button"
            onClick={close}
            className="rounded-lg border px-4 py-2 text-sm font-bold text-ink-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar Equipamento"}
          </button>
        </div>
      </form>
    </div>
  );
}

function CustomersPanel({ token, unauthorized }: { token: string; unauthorized: () => void }) {
  const [query, setQuery] = useState("");
  const [hasLicense, setHasLicense] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const path = `customers/?q=${encodeURIComponent(query)}&has_valid_license=${hasLicense}`;
  const list = useData<CustomerCRM[]>(path, token, unauthorized);

  const items = list.data ?? [];
  const validLicenseCount = items.filter((c) => c.has_valid_license).length;
  const totalLtv = items.reduce((acc, c) => acc + (c.lifetime_value_cents || 0), 0);
  const avgLtv = items.length ? Math.round(totalLtv / items.length) : 0;

  return (
    <div>
      <Header
        title="CRM de Pescadores & Clientes"
        subtitle="Histórico consolidado, licença RGP, Lifetime Value (LTV) e anotações operacionais."
      />

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <article className="rounded-xl bg-white p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-ink-500">Pescadores Cadastrados</span>
          <strong className="mt-2 block text-2xl font-black text-brand-900">{items.length}</strong>
        </article>
        <article className="rounded-xl bg-white p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-ink-500">Licença RGP Válida</span>
          <strong className="mt-2 block text-2xl font-black text-emerald-700">
            {validLicenseCount}{" "}
            <span className="text-sm font-normal text-ink-400">
              ({items.length ? Math.round((validLicenseCount / items.length) * 100) : 0}%)
            </span>
          </strong>
        </article>
        <article className="rounded-xl bg-white p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-ink-500">LTV Médio</span>
          <strong className="mt-2 block text-2xl font-black text-brand-800">{money(avgLtv)}</strong>
        </article>
      </section>

      <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_auto]">
        <label className="flex min-h-11 items-center gap-2 rounded-lg border bg-white px-3 shadow-xs">
          <Search className="size-4 text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, CPF, e-mail, telefone ou cidade..."
            className="w-full bg-transparent text-sm font-bold outline-none"
          />
        </label>
        <select
          value={hasLicense}
          onChange={(e) => setHasLicense(e.target.value)}
          className="min-h-11 rounded-lg border bg-white px-3 text-sm font-bold shadow-xs"
        >
          <option value="">Todas as licenças</option>
          <option value="true">Apenas RGP Válida</option>
          <option value="false">RGP Pendente / Expirada</option>
        </select>
      </div>

      <div className="mt-6">
        <State loading={list.loading} error={list.error} />
        {list.data && (
          <div className="overflow-x-auto rounded-xl bg-white shadow-xs">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-brand-900 text-xs uppercase text-white">
                <tr>
                  <th className="px-5 py-4">Pescador</th>
                  <th>Contato</th>
                  <th>Origem</th>
                  <th>Licença RGP</th>
                  <th>Reservas</th>
                  <th>LTV (Total Pago)</th>
                  <th className="px-5 py-4 text-right">Ficha</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-4">
                      <strong>{c.full_name}</strong>
                      <span className="block text-xs text-ink-500">CPF {c.cpf}</span>
                    </td>
                    <td>
                      <span className="block text-xs font-bold text-ink-800">{c.phone}</span>
                      <span className="block text-xs text-ink-500">{c.email}</span>
                    </td>
                    <td>
                      <span className="text-xs">
                        {c.city && c.state ? `${c.city} - ${c.state}` : c.city || c.state || "—"}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-bold ${
                          c.has_valid_license
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {c.has_valid_license ? "RGP Válida" : "Pendente / Vencida"}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs font-bold text-brand-900">
                        {c.total_reservations} {c.total_reservations === 1 ? "expedição" : "expedições"}
                      </span>
                    </td>
                    <td>
                      <strong className="text-brand-900">{money(c.lifetime_value_cents)}</strong>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => setSelectedCustomerId(c.id)}
                        className="rounded-lg border px-3 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-50"
                      >
                        Ver Perfil CRM
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!items.length && <Empty>Nenhum cliente cadastrado.</Empty>}
          </div>
        )}
      </div>

      {selectedCustomerId && (
        <CustomerModal
          token={token}
          customerId={selectedCustomerId}
          close={() => setSelectedCustomerId(null)}
          saved={async () => {
            await list.load();
          }}
        />
      )}
    </div>
  );
}

function CustomerModal({
  token,
  customerId,
  close,
  saved,
}: {
  token: string;
  customerId: string;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const result = useData<CustomerCRM>(`customers/${customerId}/`, token, () => {});
  const customer = result.data;

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    rg: "",
    rg_issuer: "",
    birth_date: "",
    city: "",
    state: "",
    fishing_license_number: "",
    fishing_license_expiry: "",
    default_vest_size: "",
    dietary_notes: "",
    medical_notes: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    internal_admin_notes: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (customer) {
      const p = customer.profile ?? {};
      setForm({
        full_name: customer.full_name ?? "",
        email: customer.email ?? "",
        phone: customer.phone ?? "",
        rg: p.rg ?? "",
        rg_issuer: p.rg_issuer ?? "",
        birth_date: p.birth_date ?? "",
        city: p.city ?? customer.city ?? "",
        state: p.state ?? customer.state ?? "",
        fishing_license_number: p.fishing_license_number ?? "",
        fishing_license_expiry: p.fishing_license_expiry ?? "",
        default_vest_size: p.default_vest_size ?? "",
        dietary_notes: p.dietary_notes ?? "",
        medical_notes: p.medical_notes ?? "",
        emergency_contact_name: p.emergency_contact_name ?? "",
        emergency_contact_phone: p.emergency_contact_phone ?? "",
        internal_admin_notes: p.internal_admin_notes ?? "",
      });
    }
  }, [customer]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await request(`customers/${customerId}/`, token, {
        method: "PATCH",
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          profile: {
            rg: form.rg.trim(),
            rg_issuer: form.rg_issuer.trim(),
            birth_date: form.birth_date || null,
            city: form.city.trim(),
            state: form.state.trim().toUpperCase(),
            fishing_license_number: form.fishing_license_number.trim(),
            fishing_license_expiry: form.fishing_license_expiry || null,
            default_vest_size: form.default_vest_size.trim().toUpperCase(),
            dietary_notes: form.dietary_notes.trim(),
            medical_notes: form.medical_notes.trim(),
            emergency_contact_name: form.emergency_contact_name.trim(),
            emergency_contact_phone: form.emergency_contact_phone.trim(),
            internal_admin_notes: form.internal_admin_notes.trim(),
          },
        }),
      });
      await saved();
      close();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (result.loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-2xl rounded-2xl bg-white p-8 text-center text-sm font-bold text-ink-600">
          Carregando ficha do pescador...
        </div>
      </div>
    );
  }

  if (!customer) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between border-b pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-brand-950">{customer.full_name}</h2>
              <span
                className={`rounded px-2 py-0.5 text-xs font-bold ${
                  customer.has_valid_license ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                }`}
              >
                {customer.has_valid_license ? "RGP Válida" : "RGP Pendente"}
              </span>
            </div>
            <p className="text-xs text-ink-500 mt-1">
              CPF {customer.cpf} · {customer.email} · {customer.phone}
            </p>
          </div>
          <button type="button" onClick={close} className="rounded p-1 text-ink-500 hover:bg-gray-100">
            <X className="size-5" />
          </button>
        </div>

        {/* LTV & Metrics strip */}
        <div className="mt-4 grid grid-cols-3 gap-3 rounded-xl bg-brand-50/60 p-3 border border-brand-100 text-center">
          <div>
            <span className="block text-[11px] font-bold uppercase text-brand-700">Expedições</span>
            <strong className="text-lg font-black text-brand-950">{customer.total_reservations}</strong>
          </div>
          <div>
            <span className="block text-[11px] font-bold uppercase text-brand-700">Lifetime Value</span>
            <strong className="text-lg font-black text-brand-950">{money(customer.lifetime_value_cents)}</strong>
          </div>
          <div>
            <span className="block text-[11px] font-bold uppercase text-brand-700">Última Viagem</span>
            <span className="block text-xs font-bold text-brand-900 mt-1">
              {customer.last_expedition_name ? customer.last_expedition_name : "Nenhuma"}
            </span>
          </div>
        </div>

        <div className="mt-5 space-y-6">
          {/* Seção 1: Documentos & RGP */}
          <div className="rounded-xl border p-4">
            <h4 className="font-bold text-sm text-brand-900 flex items-center gap-2">
              <FileText className="size-4" />
              Documentação & Licença de Pesca Amadora (RGP)
            </h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="text-xs font-bold">
                RG
                <input
                  type="text"
                  value={form.rg}
                  onChange={(e) => setForm({ ...form, rg: e.target.value })}
                  placeholder="Número do RG"
                  className="mt-1 h-9 w-full rounded-lg border px-3 text-xs"
                />
              </label>
              <label className="text-xs font-bold">
                Órgão Emissor / UF
                <input
                  type="text"
                  value={form.rg_issuer}
                  onChange={(e) => setForm({ ...form, rg_issuer: e.target.value })}
                  placeholder="Ex: SSP/SP"
                  className="mt-1 h-9 w-full rounded-lg border px-3 text-xs"
                />
              </label>
              <label className="text-xs font-bold">
                Data de Nascimento
                <input
                  type="date"
                  value={form.birth_date}
                  onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                  className="mt-1 h-9 w-full rounded-lg border px-3 text-xs"
                />
              </label>
              <label className="text-xs font-bold">
                Cidade de Residência
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="Cidade"
                  className="mt-1 h-9 w-full rounded-lg border px-3 text-xs"
                />
              </label>
              <label className="text-xs font-bold">
                Estado (UF)
                <input
                  type="text"
                  maxLength={2}
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })}
                  placeholder="SP"
                  className="mt-1 h-9 w-full rounded-lg border px-3 text-xs uppercase"
                />
              </label>
              <label className="text-xs font-bold">
                Tamanho do Colete
                <select
                  value={form.default_vest_size}
                  onChange={(e) => setForm({ ...form, default_vest_size: e.target.value })}
                  className="mt-1 h-9 w-full rounded-lg border px-2 text-xs"
                >
                  <option value="">Não informado</option>
                  <option value="P">P</option>
                  <option value="M">M</option>
                  <option value="G">G</option>
                  <option value="GG">GG</option>
                  <option value="XG">XG</option>
                  <option value="XXG">XXG</option>
                </select>
              </label>
              <label className="text-xs font-bold sm:col-span-2">
                Número da Licença RGP (Federal ou Estadual)
                <input
                  type="text"
                  value={form.fishing_license_number}
                  onChange={(e) => setForm({ ...form, fishing_license_number: e.target.value })}
                  placeholder="Ex: 12345678-9"
                  className="mt-1 h-9 w-full rounded-lg border px-3 text-xs font-mono"
                />
              </label>
              <label className="text-xs font-bold">
                Validade da Licença RGP
                <input
                  type="date"
                  value={form.fishing_license_expiry}
                  onChange={(e) => setForm({ ...form, fishing_license_expiry: e.target.value })}
                  className="mt-1 h-9 w-full rounded-lg border px-3 text-xs"
                />
              </label>
            </div>
          </div>

          {/* Seção 2: Saúde, Alimentação & Emergência */}
          <div className="rounded-xl border p-4">
            <h4 className="font-bold text-sm text-brand-900 flex items-center gap-2">
              <AlertTriangle className="size-4" />
              Saúde, Preferências & Emergência
            </h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold">
                Restrições Alimentares / Notas Dietéticas
                <textarea
                  value={form.dietary_notes}
                  onChange={(e) => setForm({ ...form, dietary_notes: e.target.value })}
                  placeholder="Ex: Não consome frutos do mar, intolerância à lactose."
                  className="mt-1 min-h-16 w-full rounded-lg border p-2 text-xs"
                />
              </label>
              <label className="text-xs font-bold">
                Condições Médicas / Alergias
                <textarea
                  value={form.medical_notes}
                  onChange={(e) => setForm({ ...form, medical_notes: e.target.value })}
                  placeholder="Ex: Alérgico a picada de abelha (leva epinefrina), hipertenso."
                  className="mt-1 min-h-16 w-full rounded-lg border p-2 text-xs"
                />
              </label>
              <label className="text-xs font-bold">
                Contato de Emergência (Nome)
                <input
                  type="text"
                  value={form.emergency_contact_name}
                  onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value })}
                  placeholder="Ex: Maria da Silva (Esposa)"
                  className="mt-1 h-9 w-full rounded-lg border px-3 text-xs"
                />
              </label>
              <label className="text-xs font-bold">
                Contato de Emergência (Telefone)
                <input
                  type="text"
                  value={form.emergency_contact_phone}
                  onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value })}
                  placeholder="Ex: (11) 98765-4321"
                  className="mt-1 h-9 w-full rounded-lg border px-3 text-xs"
                />
              </label>
            </div>
          </div>

          {/* Seção 3: Histórico de Reservas */}
          {customer.reservations && customer.reservations.length > 0 && (
            <div className="rounded-xl border p-4">
              <h4 className="font-bold text-sm text-brand-900 flex items-center gap-2">
                <TicketCheck className="size-4" />
                Histórico de Reservas ({customer.reservations.length})
              </h4>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-100 text-ink-700">
                    <tr>
                      <th className="p-2">Expedição</th>
                      <th className="p-2">Data</th>
                      <th className="p-2">Vagas</th>
                      <th className="p-2">Tralhas</th>
                      <th className="p-2">Total</th>
                      <th className="p-2">Pago</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {customer.reservations.map((res) => (
                      <tr key={res.id}>
                        <td className="p-2 font-bold">{res.expedition_name}</td>
                        <td className="p-2">{shortDate(res.starts_at)}</td>
                        <td className="p-2">{res.participant_count}</td>
                        <td className="p-2">{res.gear_addons_count} itens</td>
                        <td className="p-2 font-bold">{money(res.total_price_cents)}</td>
                        <td className="p-2 font-bold text-brand-800">{money(res.paid_amount_cents)}</td>
                        <td className="p-2">
                          <Status value={res.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Seção 4: Anotações Internas Restritas */}
          <div className="rounded-xl border-2 border-amber-300 bg-amber-50/40 p-4">
            <div className="flex items-center gap-2 text-amber-900">
              <ShieldCheck className="size-4 text-amber-800" />
              <h4 className="font-bold text-sm">Anotações Internas da Operação (Restrito)</h4>
            </div>
            <p className="mt-1 text-[11px] text-amber-800 font-medium">
              Confidencial: estas notas são visíveis exclusivamente para os administradores. Nunca são enviadas para o
              cliente ou para convidados.
            </p>
            <textarea
              value={form.internal_admin_notes}
              onChange={(e) => setForm({ ...form, internal_admin_notes: e.target.value })}
              placeholder="Ex: Pescador muito experiente, prefere pescar na popa do barco. Pontual nos pagamentos. Tem interesse em expedições no Rio Marié."
              className="mt-2 min-h-24 w-full rounded-lg border border-amber-300 bg-white p-3 text-xs"
            />
          </div>
        </div>

        {error && <p className="mt-3 text-sm font-bold text-red-700">{error}</p>}

        <div className="mt-6 flex justify-end gap-3 border-t pt-4">
          <button
            type="button"
            onClick={close}
            className="rounded-lg border px-4 py-2 text-sm font-bold text-ink-700 hover:bg-gray-50"
          >
            Fechar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar Perfil"}
          </button>
        </div>
      </form>
    </div>
  );
}

function AddGearAddonModal({
  token,
  reservation,
  close,
  added,
}: {
  token: string;
  reservation: Reservation;
  close: () => void;
  added: () => Promise<void>;
}) {
  const gearList = useData<FishingGearProduct[]>("gear-products/?active=true", token, () => {});
  const [selectedGearId, setSelectedGearId] = useState("");
  const [modality, setModality] = useState<"RENTAL" | "SALE">("RENTAL");
  const [quantity, setQuantity] = useState(1);
  const [participantId, setParticipantId] = useState("");
  const [unitPrice, setUnitPrice] = useState("0.00");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedGear = useMemo(() => {
    return gearList.data?.find((g) => g.id === selectedGearId) ?? null;
  }, [gearList.data, selectedGearId]);

  useEffect(() => {
    if (selectedGear) {
      let defaultModality: "RENTAL" | "SALE" = "RENTAL";
      if (selectedGear.modality === "SALE") defaultModality = "SALE";
      setModality(defaultModality);
      const defaultPriceCents =
        defaultModality === "RENTAL"
          ? selectedGear.rental_price_cents
          : selectedGear.sale_price_cents;
      setUnitPrice((defaultPriceCents / 100).toFixed(2));
    }
  }, [selectedGear]);

  function handleModalityChange(newModality: "RENTAL" | "SALE") {
    setModality(newModality);
    if (selectedGear) {
      const priceCents =
        newModality === "RENTAL"
          ? selectedGear.rental_price_cents
          : selectedGear.sale_price_cents;
      setUnitPrice((priceCents / 100).toFixed(2));
    }
  }

  const unitPriceCents = Math.round(Number(unitPrice.replace(",", ".")) * 100) || 0;
  const totalPriceCents = unitPriceCents * quantity;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!selectedGear) return setError("Selecione um equipamento.");
    if (quantity <= 0) return setError("Quantidade deve ser maior que zero.");
    if (quantity > selectedGear.inventory_quantity) {
      return setError(`Estoque insuficiente. Apenas ${selectedGear.inventory_quantity} unidade(s) disponível(is).`);
    }

    setSaving(true);
    setError("");
    try {
      await request(`reservations/${reservation.id}/gear-addons/`, token, {
        method: "POST",
        body: JSON.stringify({
          gear_product_id: selectedGear.id,
          modality,
          quantity,
          participant_id: participantId || null,
          unit_price_cents: unitPriceCents,
          notes: notes.trim(),
        }),
      });
      await added();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={submit} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-lg font-black text-brand-950">Adicionar Tralha à Reserva</h3>
          <button type="button" onClick={close} className="rounded p-1 text-ink-500 hover:bg-gray-100">
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <label className="block text-xs font-bold">
            Equipamento / Tralha *
            <select
              required
              value={selectedGearId}
              onChange={(e) => setSelectedGearId(e.target.value)}
              className="mt-1 h-10 w-full rounded-lg border px-3 text-sm font-bold"
            >
              <option value="">Selecione um equipamento...</option>
              {gearList.data?.map((g) => (
                <option key={g.id} value={g.id} disabled={g.inventory_quantity <= 0}>
                  {g.name} — Estoque: {g.inventory_quantity} {g.inventory_quantity <= 0 ? "(ESGOTADO)" : ""}
                </option>
              ))}
            </select>
          </label>

          {selectedGear && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-bold">
                  Modalidade *
                  <select
                    value={modality}
                    onChange={(e) => handleModalityChange(e.target.value as "RENTAL" | "SALE")}
                    className="mt-1 h-10 w-full rounded-lg border px-3 text-sm font-bold"
                  >
                    {(selectedGear.modality === "RENTAL" || selectedGear.modality === "BOTH") && (
                      <option value="RENTAL">Locação (Aluguel)</option>
                    )}
                    {(selectedGear.modality === "SALE" || selectedGear.modality === "BOTH") && (
                      <option value="SALE">Venda (Compra definitiva)</option>
                    )}
                  </select>
                </label>

                <label className="block text-xs font-bold">
                  Quantidade * (Máx: {selectedGear.inventory_quantity})
                  <input
                    type="number"
                    min={1}
                    max={selectedGear.inventory_quantity}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                    className="mt-1 h-10 w-full rounded-lg border px-3 text-sm font-bold"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-bold">
                  Preço Unitário (R$)
                  <input
                    type="text"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border px-3 text-sm font-bold"
                  />
                </label>

                <div>
                  <span className="block text-xs font-bold text-ink-500">Valor Total Adicional</span>
                  <div className="mt-1 flex h-10 items-center rounded-lg bg-brand-50 px-3 text-sm font-black text-brand-900 border border-brand-200">
                    {money(totalPriceCents)}
                  </div>
                </div>
              </div>

              <label className="block text-xs font-bold">
                Destinado ao Participante (opcional)
                <select
                  value={participantId}
                  onChange={(e) => setParticipantId(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
                >
                  <option value="">Geral / Toda a reserva</option>
                  {reservation.participants?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-bold">
                Observações Operacionais (ex: canhoto, entregar no barco 02)
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Conjunto montado para canhoto."
                  className="mt-1 min-h-16 w-full rounded-lg border p-2 text-xs"
                />
              </label>

              <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-900 border border-blue-200">
                <strong>Impacto Financeiro:</strong> O saldo devedor da reserva aumentará em{" "}
                <strong>{money(totalPriceCents)}</strong> e {quantity} unidade(s) de estoque serão reservadas
                imediatamente.
              </div>
            </>
          )}
        </div>

        {error && <p className="mt-3 text-sm font-bold text-red-700">{error}</p>}

        <div className="mt-6 flex justify-end gap-3 border-t pt-4">
          <button
            type="button"
            onClick={close}
            className="rounded-lg border px-4 py-2 text-sm font-bold text-ink-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || !selectedGear}
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? "Adicionando..." : "Confirmar e Recalcular"}
          </button>
        </div>
      </form>
    </div>
  );
}
