"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { BarChart3, CalendarDays, ChevronDown, CircleDollarSign, Fish, LogOut, Menu, Plus, RefreshCw, Search, ShieldCheck, TicketCheck, Users, X } from "lucide-react";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
type Section = "overview" | "reservations" | "expeditions";
type Expedition = { id: string; name: string; slug: string; destination: string; starts_at: string; ends_at: string; duration_days: number; capacity: number; occupied_slots: number; available_slots: number; price_per_person_cents: number; deposit_cents: number; balance_due_days_before: number; status: string; summary: string };
type ReservationEvent = { id: string; event_type: string; actor_type: string; previous_status: string; new_status: string; reason: string; created_at: string };
type Reservation = { id: string; status: string; participant_count: number; total_price_cents: number; deposit_cents: number; payment_plan: string; paid_amount_cents: number; remaining_balance_cents: number; balance_due_at: string | null; held_until: string | null; beverage_preferences?: Record<string, unknown>; created_at: string; customer: { name: string; cpf: string; email: string; phone: string }; expedition: { name: string; starts_at: string }; participants: { id: string; name: string; phone: string; onboarding_status: string }[]; payments: { id: string; method: string; provider: string; amount_cents: number; status: string; paid_at: string | null }[]; events: ReservationEvent[] };
type Overview = { revenue_cents: number; sold_cents: number; outstanding_cents: number; paid_payments: number; incomplete_participants: number; reservations: { total: number; confirmed: number; awaiting: number }; upcoming_expeditions: Expedition[]; recent_reservations: Reservation[] };

const money = (value: number) => (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const date = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
const statusLabels: Record<string, string> = { DRAFT: "Rascunho", PUBLISHED: "Publicada", SOLD_OUT: "Esgotada", CLOSED: "Encerrada", IN_PROGRESS: "Em andamento", COMPLETED: "Concluída", CANCELLED: "Cancelada", HELD: "Vagas protegidas", AWAITING_PAYMENT: "Aguardando pagamento", PARTIALLY_PAID: "Parcialmente paga", CONFIRMED: "Confirmada", PAID: "Paga", EXPIRED: "Expirada", REFUNDED: "Reembolsada" };
const statusTone: Record<string, string> = { PAID: "bg-brand-100 text-brand-800", CONFIRMED: "bg-brand-100 text-brand-800", PUBLISHED: "bg-brand-100 text-brand-800", AWAITING_PAYMENT: "bg-amber-100 text-amber-800", HELD: "bg-blue-100 text-blue-800", DRAFT: "bg-gray-100 text-gray-700", EXPIRED: "bg-red-100 text-red-700", CANCELLED: "bg-red-100 text-red-700" };

function Status({ value }: { value: string }) { return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusTone[value] ?? "bg-gray-100 text-gray-700"}`}>{statusLabels[value] ?? value}</span>; }
function errorMessage(value: unknown) { if (!value || typeof value !== "object") return "Não foi possível concluir a operação."; return Object.values(value as Record<string, unknown>).flat().join(" "); }

export function AdminPanel() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [section, setSection] = useState<Section>("overview");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { const task = window.setTimeout(() => { setToken(sessionStorage.getItem("operations-token")); setReady(true); }, 0); return () => window.clearTimeout(task); }, []);
  const logout = useCallback(() => { sessionStorage.removeItem("operations-token"); setToken(null); }, []);
  if (!ready) return <div className="min-h-screen bg-brand-900" />;
  if (!token) return <Login onLogin={value => { sessionStorage.setItem("operations-token", value); setToken(value); }} />;

  const nav = [["overview", "Visão geral", BarChart3], ["reservations", "Reservas", TicketCheck], ["expeditions", "Expedições", CalendarDays]] as const;
  return <div className="min-h-screen bg-[#f4f6f2] lg:grid lg:grid-cols-[250px_1fr]">
    <aside className={`fixed inset-y-0 left-0 z-40 w-[250px] bg-brand-900 text-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}><div className="flex h-full flex-col p-5"><div className="flex items-center gap-3 border-b border-white/10 pb-5"><Image src="/brand/logo-expedicao-piraiba.png" alt="" width={48} height={48} className="size-12 rounded-full" /><div><strong className="block text-sm">EXPEDIÇÃO PIRAÍBA</strong><span className="text-[10px] tracking-[.2em] text-white/60">PAINEL OPERACIONAL</span></div><button onClick={() => setMenuOpen(false)} className="ml-auto lg:hidden"><X /></button></div><nav className="mt-6 space-y-2">{nav.map(([value, label, Icon]) => <button key={value} onClick={() => { setSection(value); setMenuOpen(false); }} className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-bold transition ${section === value ? "bg-white text-brand-900" : "text-white/75 hover:bg-white/10 hover:text-white"}`}><Icon className="size-5" />{label}</button>)}</nav><Link href="/" className="mt-auto flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-bold text-white/70 hover:bg-white/10"><Fish className="size-5" />Ver site</Link><button onClick={logout} className="mt-1 flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-bold text-white/70 hover:bg-white/10"><LogOut className="size-5" />Sair</button></div></aside>
    {menuOpen && <button aria-label="Fechar menu" className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setMenuOpen(false)} />}
    <main className="min-w-0"><header className="flex min-h-16 items-center border-b border-ink-900/10 bg-white px-5 lg:px-8"><button onClick={() => setMenuOpen(true)} className="mr-4 lg:hidden"><Menu /></button><div><p className="text-xs font-bold uppercase tracking-widest text-brand-600">Área administrativa</p><h1 className="text-xl font-black">{nav.find(item => item[0] === section)?.[1]}</h1></div><div className="ml-auto flex items-center gap-2 text-sm text-ink-500"><ShieldCheck className="size-5 text-brand-600" /><span className="hidden sm:inline">Sessão protegida</span></div></header><div className="p-5 lg:p-8">{section === "overview" && <OverviewPanel token={token} onUnauthorized={logout} />}{section === "reservations" && <ReservationsPanel token={token} onUnauthorized={logout} />}{section === "expeditions" && <ExpeditionsPanel token={token} onUnauthorized={logout} />}</div></main>
  </div>;
}

function Login({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail] = useState("admin@expedicaopiraiba.com.br"); const [password, setPassword] = useState("admin-local-2026"); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setLoading(true); setError(""); try { const response = await fetch(`${api}/operations/login/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) }); const data = await response.json(); if (!response.ok) throw data; onLogin(data.token); } catch (value) { setError(errorMessage(value)); } finally { setLoading(false); } }
  return <main className="grid min-h-screen place-items-center bg-brand-900 p-5"><form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-7 shadow-2xl sm:p-9"><Image src="/brand/logo-expedicao-piraiba.png" alt="Expedição Piraíba" width={72} height={72} className="mx-auto size-[72px] rounded-full" /><p className="mt-5 text-center text-xs font-bold uppercase tracking-[.25em] text-brand-600">Painel operacional</p><h1 className="mt-2 text-center text-2xl font-black">Bem-vindo de volta</h1><label className="mt-7 block text-sm font-bold">E-mail<input type="email" value={email} onChange={event => setEmail(event.target.value)} className="mt-2 h-12 w-full rounded-lg border border-ink-900/15 px-3 outline-none focus:border-brand-600" /></label><label className="mt-4 block text-sm font-bold">Senha<input type="password" value={password} onChange={event => setPassword(event.target.value)} className="mt-2 h-12 w-full rounded-lg border border-ink-900/15 px-3 outline-none focus:border-brand-600" /></label>{error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}<button disabled={loading} className="mt-5 min-h-12 w-full rounded-lg bg-brand-600 font-bold text-white hover:bg-brand-700 disabled:opacity-60">{loading ? "Entrando..." : "Entrar no painel"}</button><p className="mt-4 text-center text-xs text-ink-500">Credenciais locais preenchidas para facilitar os testes.</p></form></main>;
}

function useAdminData<T>(path: string, token: string, onUnauthorized: () => void) {
  const [data, setData] = useState<T | null>(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { setLoading(true); setError(""); try { const response = await fetch(`${api}/operations/${path}`, { headers: { Authorization: `Bearer ${token}` } }); if (response.status === 401) { onUnauthorized(); return; } const result = await response.json(); if (!response.ok) throw result; setData(result); } catch (value) { setError(errorMessage(value)); } finally { setLoading(false); } }, [path, token, onUnauthorized]);
  useEffect(() => { const task = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(task); }, [load]); return { data, error, loading, load };
}

function PanelState({ loading, error }: { loading: boolean; error: string }) { if (loading) return <div className="rounded-xl bg-white p-10 text-center text-ink-500">Carregando dados...</div>; if (error) return <div className="rounded-xl bg-red-50 p-5 font-bold text-red-700">{error}</div>; return null; }

function OverviewPanel({ token, onUnauthorized }: { token: string; onUnauthorized: () => void }) {
  const { data, error, loading, load } = useAdminData<Overview>("overview/", token, onUnauthorized); if (!data) return <PanelState loading={loading} error={error} />;
  const cards = [["Valor vendido", money(data.sold_cents), CircleDollarSign], ["Valor recebido", money(data.revenue_cents), CircleDollarSign], ["Saldo pendente", money(data.outstanding_cents), RefreshCw], ["Reservas confirmadas", data.reservations.confirmed, TicketCheck], ["Cadastros pendentes", data.incomplete_participants, Users], ["Reservas totais", data.reservations.total, Users]] as const;
  return <div><div className="flex items-end justify-between"><div><h2 className="text-2xl font-black">Resumo do negócio</h2><p className="mt-1 text-sm text-ink-500">Dados financeiros e operacionais atualizados.</p></div><button onClick={() => void load()} className="rounded-lg border border-ink-900/10 bg-white p-2.5 text-brand-700" title="Atualizar"><RefreshCw className="size-5" /></button></div><section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value, Icon]) => <article key={label} className="rounded-xl border border-ink-900/8 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><span className="text-sm font-bold text-ink-500">{label}</span><span className="rounded-lg bg-brand-50 p-2 text-brand-700"><Icon className="size-5" /></span></div><strong className="mt-4 block text-2xl font-black">{value}</strong></article>)}</section><div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_.9fr]"><section className="rounded-xl border border-ink-900/8 bg-white p-5"><h3 className="text-lg font-black">Próximas expedições</h3><div className="mt-4 space-y-3">{data.upcoming_expeditions.map(item => <div key={item.id} className="flex items-center gap-4 rounded-lg bg-[#f7f8f4] p-4"><span className="grid size-12 shrink-0 place-items-center rounded-lg bg-brand-900 text-center text-xs font-black text-white">{new Date(`${item.starts_at}T12:00`).getDate()}<small className="block uppercase">{new Date(`${item.starts_at}T12:00`).toLocaleDateString("pt-BR", { month: "short" })}</small></span><div className="min-w-0 flex-1"><strong className="block truncate">{item.name}</strong><span className="text-sm text-ink-500">{item.destination}</span></div><div className="text-right"><strong className="text-brand-700">{item.occupied_slots}/{item.capacity}</strong><span className="block text-xs text-ink-500">ocupadas</span></div></div>)}{!data.upcoming_expeditions.length && <p className="py-8 text-center text-sm text-ink-500">Nenhuma expedição futura.</p>}</div></section><section className="rounded-xl border border-ink-900/8 bg-white p-5"><h3 className="text-lg font-black">Reservas recentes</h3><div className="mt-4 divide-y divide-ink-900/8">{data.recent_reservations.map(item => <div key={item.id} className="flex items-center gap-3 py-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-sand-100 font-black text-brand-800">{item.customer.name.charAt(0)}</span><div className="min-w-0 flex-1"><strong className="block truncate text-sm">{item.customer.name}</strong><span className="block truncate text-xs text-ink-500">{item.expedition.name} · {item.participant_count} vaga(s)</span></div><Status value={item.status} /></div>)}</div></section></div></div>;
}

function ReservationsPanel({ token, onUnauthorized }: { token: string; onUnauthorized: () => void }) {
  const [query, setQuery] = useState(""); const [filter, setFilter] = useState(""); const path = `reservations/?q=${encodeURIComponent(query)}&status=${filter}`; const { data, error, loading } = useAdminData<Reservation[]>(path, token, onUnauthorized); const [expanded, setExpanded] = useState("");
  return <div><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end"><div><h2 className="text-2xl font-black">Reservas e clientes</h2><p className="mt-1 text-sm text-ink-500">Consulte dados do comprador, participantes e pagamentos.</p></div><div className="flex gap-2"><label className="flex h-11 min-w-0 items-center gap-2 rounded-lg border border-ink-900/10 bg-white px-3 sm:min-w-72"><Search className="size-4 text-ink-500" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Nome, CPF, telefone..." className="min-w-0 flex-1 text-sm outline-none" /></label><select value={filter} onChange={event => setFilter(event.target.value)} className="rounded-lg border border-ink-900/10 bg-white px-3 text-sm font-bold"><option value="">Todos</option><option value="CONFIRMED">Confirmadas</option><option value="PAID">Pagas</option><option value="AWAITING_PAYMENT">Aguardando</option><option value="EXPIRED">Expiradas</option></select></div></div><div className="mt-6"><PanelState loading={loading} error={error} />{data && <div className="overflow-hidden rounded-xl border border-ink-900/8 bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-brand-900 text-xs uppercase tracking-wider text-white"><tr><th className="px-5 py-4">Cliente</th><th>Expedição</th><th>Vagas</th><th>Valor</th><th>Status</th><th></th></tr></thead><tbody className="divide-y divide-ink-900/8">{data.map(item => <ReservationRows key={item.id} item={item} expanded={expanded === item.id} toggle={() => setExpanded(current => current === item.id ? "" : item.id)} />)}</tbody></table></div>{!data.length && <p className="p-10 text-center text-ink-500">Nenhuma reserva encontrada.</p>}</div>}</div></div>;
}
function ReservationRows({ item, expanded, toggle }: { item: Reservation; expanded: boolean; toggle: () => void }) {
  const prefs = (item.beverage_preferences || {}) as { beverages?: Record<string, number>; dietary_restrictions?: string; notes?: string };
  const beverageList = Object.entries(prefs.beverages || {}).filter(([, count]) => count > 0);

  return (
    <>
      <tr className="hover:bg-brand-50/40">
        <td className="px-5 py-4">
          <strong className="block">{item.customer.name}</strong>
          <span className="text-xs text-ink-500">{item.customer.phone}</span>
        </td>
        <td>
          <strong>{item.expedition.name}</strong>
          <span className="block text-xs text-ink-500">{date(item.expedition.starts_at)}</span>
        </td>
        <td>{item.participant_count}</td>
        <td>
          <strong>{money(item.total_price_cents)}</strong>
          <span className="block text-xs text-ink-500">Saldo: {money(item.remaining_balance_cents)}</span>
        </td>
        <td>
          <Status value={item.status} />
        </td>
        <td className="pr-4 text-right">
          <button onClick={toggle} className="rounded-md p-2 hover:bg-brand-50">
            <ChevronDown className={`size-5 transition ${expanded ? "rotate-180" : ""}`} />
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} className="bg-[#f7f8f4] px-5 py-5">
            <div className="grid gap-5 md:grid-cols-4">
              <div>
                <strong className="text-xs uppercase tracking-wider text-brand-700">Contato e documento</strong>
                <p className="mt-2">CPF: {item.customer.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}</p>
                <p>{item.customer.email}</p>
                <p>{item.customer.phone}</p>
              </div>
              <div>
                <strong className="text-xs uppercase tracking-wider text-brand-700">Participantes</strong>
                {item.participants.map((person) => (
                  <div className="mt-2" key={person.id}>
                    <p>• {person.name}</p>
                    <span
                      className={`ml-3 text-xs font-bold ${
                        person.onboarding_status === "COMPLETED" ? "text-brand-700" : "text-amber-700"
                      }`}
                    >
                      {person.onboarding_status === "COMPLETED" ? "Cadastro completo" : "Cadastro pendente"}
                    </span>
                  </div>
                ))}
              </div>
              <div>
                <strong className="text-xs uppercase tracking-wider text-brand-700">Bebidas e Preferências (Tela 05)</strong>
                {beverageList.length > 0 ? (
                  <div className="mt-2 space-y-1 text-xs">
                    {beverageList.map(([key, count]) => (
                      <div key={key} className="flex justify-between border-b border-ink-900/5 py-0.5">
                        <span className="capitalize">{key.replace(/_/g, " ")}:</span>
                        <strong>{count} un/cx</strong>
                      </div>
                    ))}
                    {prefs.dietary_restrictions && (
                      <p className="mt-2 text-xs text-brand-800">
                        <strong>Restrições:</strong> {prefs.dietary_restrictions}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-ink-500">Nenhuma preferência preenchida ainda.</p>
                )}
              </div>
              <div>
                <strong className="text-xs uppercase tracking-wider text-brand-700">Financeiro & Histórico</strong>
                <p className="mt-2 text-xs">Modalidade: {item.payment_plan === "FULL" ? "Integral" : "Sinal"}</p>
                <p className="text-xs">Pago: {money(item.paid_amount_cents)}</p>
                <p className="text-xs">Saldo: {money(item.remaining_balance_cents)}</p>
                <div className="mt-3 max-h-28 space-y-1 overflow-y-auto">
                  {item.events.map((event) => (
                    <div key={event.id} className="border-l-2 border-brand-500 pl-2 text-[11px]">
                      <strong>{event.event_type.replace(/_/g, " ")}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function ExpeditionsPanel({ token, onUnauthorized }: { token: string; onUnauthorized: () => void }) {
  const { data, error, loading, load } = useAdminData<Expedition[]>("expeditions/", token, onUnauthorized); const [creating, setCreating] = useState(false); const [saving, setSaving] = useState("");
  async function changeStatus(item: Expedition, status: string) { setSaving(item.id); try { const response = await fetch(`${api}/operations/expeditions/${item.id}/`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ status }) }); if (!response.ok) throw await response.json(); await load(); } catch (value) { window.alert(errorMessage(value)); } finally { setSaving(""); } }
  return <div><div className="flex items-end justify-between"><div><h2 className="text-2xl font-black">Expedições</h2><p className="mt-1 text-sm text-ink-500">Cadastre datas, preços, capacidade e publicação.</p></div><button onClick={() => setCreating(true)} className="flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-bold text-white"><Plus className="size-5" />Nova expedição</button></div><div className="mt-6"><PanelState loading={loading} error={error} />{data && <div className="grid gap-4 xl:grid-cols-2">{data.map(item => <article key={item.id} className="rounded-xl border border-ink-900/8 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><Status value={item.status} /><h3 className="mt-3 text-xl font-black">{item.name}</h3><p className="text-sm text-ink-500">{item.destination}</p></div><select aria-label="Alterar status" disabled={saving === item.id} value={item.status} onChange={event => void changeStatus(item, event.target.value)} className="rounded-lg border border-ink-900/10 bg-white px-2 py-2 text-xs font-bold"><option value="DRAFT">Rascunho</option><option value="PUBLISHED">Publicada</option><option value="SOLD_OUT">Esgotada</option><option value="IN_PROGRESS">Em andamento</option><option value="COMPLETED">Concluída</option><option value="CANCELLED">Cancelada</option></select></div><div className="mt-5 grid grid-cols-3 gap-3 border-t border-ink-900/8 pt-4 text-sm"><div><span className="block text-xs text-ink-500">Data</span><strong>{date(item.starts_at)}</strong></div><div><span className="block text-xs text-ink-500">Ocupação</span><strong>{item.occupied_slots}/{item.capacity}</strong></div><div><span className="block text-xs text-ink-500">Por pessoa</span><strong>{money(item.price_per_person_cents)}</strong></div></div></article>)}</div>}</div>{creating && <ExpeditionModal token={token} close={() => setCreating(false)} created={async () => { setCreating(false); await load(); }} />}</div>;
}

function ExpeditionModal({ token, close, created }: { token: string; close: () => void; created: () => Promise<void> }) {
  const [form, setForm] = useState({ name: "", destination: "", departure_location: "", starts_at: "", ends_at: "", capacity: "12", price: "2490", deposit: "1200", balance_due_days_before: "30", status: "DRAFT", summary: "" }); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setLoading(true); setError(""); try { const response = await fetch(`${api}/operations/expeditions/`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ ...form, capacity: Number(form.capacity), balance_due_days_before: Number(form.balance_due_days_before), price_per_person_cents: Math.round(Number(form.price.replace(",", ".")) * 100), deposit_cents: Math.round(Number(form.deposit.replace(",", ".")) * 100) }) }); const result = await response.json(); if (!response.ok) throw result; await created(); } catch (value) { setError(errorMessage(value)); } finally { setLoading(false); } }
  const field = (name: keyof typeof form, label: string, type = "text") => <label className="text-sm font-bold">{label}<input required={name !== "departure_location" && name !== "summary"} type={type} value={form[name]} onChange={event => setForm({ ...form, [name]: event.target.value })} className="mt-2 h-11 w-full rounded-lg border border-ink-900/15 px-3 outline-none focus:border-brand-600" /></label>;
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/55 p-4"><form onSubmit={submit} className="my-5 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-brand-600">Cadastro</p><h2 className="text-2xl font-black">Nova expedição</h2></div><button type="button" onClick={close} className="rounded-lg p-2 hover:bg-gray-100"><X /></button></div><div className="mt-6 grid gap-4 sm:grid-cols-2">{field("name", "Nome")}{field("destination", "Destino")}{field("departure_location", "Local de saída")}{field("capacity", "Capacidade", "number")}{field("starts_at", "Data inicial", "date")}{field("ends_at", "Data final", "date")}{field("price", "Valor por pessoa (R$)", "number")}{field("deposit", "Sinal (R$)", "number")}{field("balance_due_days_before", "Vencimento do saldo (dias antes)", "number")}<label className="text-sm font-bold">Status<select value={form.status} onChange={event => setForm({ ...form, status: event.target.value })} className="mt-2 h-11 w-full rounded-lg border border-ink-900/15 px-3"><option value="DRAFT">Rascunho</option><option value="PUBLISHED">Publicada</option></select></label><label className="text-sm font-bold sm:col-span-2">Resumo<textarea value={form.summary} onChange={event => setForm({ ...form, summary: event.target.value })} className="mt-2 min-h-24 w-full rounded-lg border border-ink-900/15 p-3" /></label></div>{error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}<div className="mt-5 flex justify-end gap-3"><button type="button" onClick={close} className="min-h-11 rounded-lg border border-ink-900/15 px-5 font-bold">Cancelar</button><button disabled={loading} className="min-h-11 rounded-lg bg-brand-600 px-5 font-bold text-white disabled:opacity-60">{loading ? "Salvando..." : "Criar expedição"}</button></div></form></div>;
}
