"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, CalendarDays, Check, Copy, Download, Fish, House, ListChecks, LogOut, Menu, Pencil, Plus, RefreshCw, Search, ShieldCheck, ShoppingCart, TicketCheck, X } from "lucide-react";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
type Section = "overview" | "reservations" | "expeditions" | "lodges" | "configuration" | "shopping";
type Lodge = { id: string; name: string; slug: string; city: string; state: string; river_section?: string; description?: string; amenities?: string[]; meeting_point?: string; directions?: string; cover_image_url?: string; active: boolean };
type Species = { id: string; common_name: string; slug: string; scientific_name?: string; category: string; active: boolean };
type Expedition = { id: string; name: string; slug: string; destination: string; departure_location?: string; starts_at: string; ends_at: string; capacity: number; occupied_slots: number; available_slots: number; price_per_person_cents: number; deposit_cents: number; balance_due_days_before: number; status: string; summary: string; lodge?: Lodge | null; lodge_id?: string | null; cover_image_url?: string; target_species?: (Species & { is_primary?: boolean })[]; species_slugs?: string[]; inclusions?: string[] };
type Participant = { id: string; name: string; phone: string; onboarding_status: string; preferences_confirmed?: boolean; dietary_confirmed?: boolean; checklist_completed?: boolean; selected_offers?: { id: string; name: string }[]; dietary_restrictions?: string[]; dietary_details?: string };
type OperationalAlert = { id?: string; type?: string; level?: string; title?: string; message: string; reservation_id?: string; expedition_id?: string };
type ExpeditionIndicator = { expedition_id?: string; id?: string; expedition_name?: string; name?: string; capacity: number; held_slots?: number; confirmed_slots?: number; occupied_slots?: number; available_slots: number; sold_cents?: number; received_cents?: number; outstanding_cents?: number; pending_preferences?: number; pending_checklists?: number; restrictions?: number };
type Reservation = { id: string; status: string; participant_count: number; total_price_cents: number; payment_plan: string; paid_amount_cents: number; remaining_balance_cents: number; balance_due_at: string | null; held_until: string | null; created_at: string; alerts?: (string | OperationalAlert)[]; customer: { name: string; cpf: string; email: string; phone: string }; expedition: { id: string; name: string; starts_at: string }; participants: Participant[]; payments: { id: string; amount_cents: number; status: string; paid_at: string | null }[]; events: { id: string; event_type: string; reason: string; created_at: string }[] };
type Overview = { revenue_cents: number; sold_cents: number; outstanding_cents: number; incomplete_participants: number; reservations: { total: number; confirmed: number; awaiting: number }; alerts?: OperationalAlert[]; expedition_indicators?: ExpeditionIndicator[]; expeditions?: ExpeditionIndicator[]; upcoming_expeditions: Expedition[]; recent_reservations: Reservation[] };
type Product = { id: string; name: string; category?: string; unit: string; package_size?: number | null; aliases?: string[]; active?: boolean };
type Offer = { id?: string; product_id: string; name?: string; standard_quantity_per_participant: number; display_order: number; note: string; active: boolean };
type ChecklistItem = { id?: string; title: string; description: string; required: boolean; active: boolean; display_order: number };
type Meeting = { location: string; date: string; time: string; instructions: string };
type Configuration = { meeting?: Meeting; meeting_instructions?: string; departure_location?: string; products?: Product[]; offers: Offer[]; checklist?: ChecklistItem[]; checklist_items?: ChecklistItem[] };
type ConsolidationDetail = { reservation_id?: string; customer_name?: string; participant_id?: string; participant_name: string };
type ConsolidationRow = { offer_id: string; product: string; unit: string; people: number; standard_quantity_per_participant: number; total: number; package_size: number | null; full_packages: number | null; remainder: number | null; updated_at: string; details?: ConsolidationDetail[] };
type Consolidation = { generated_at: string; items: ConsolidationRow[]; text?: string };

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
  const nav = [["overview", "Visão geral", BarChart3], ["reservations", "Reservas", TicketCheck], ["expeditions", "Expedições", CalendarDays], ["lodges", "Pousadas", House], ["configuration", "Configuração", ListChecks], ["shopping", "Lista de compras", ShoppingCart]] as const;
  return <div className="min-h-screen bg-[#f4f6f2] lg:grid lg:grid-cols-[260px_1fr]">
    <aside className={`fixed inset-y-0 left-0 z-40 w-[260px] bg-brand-900 text-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${menu ? "translate-x-0" : "-translate-x-full"}`}><div className="flex h-full flex-col p-5"><div className="flex items-center gap-3 border-b border-white/10 pb-5"><Image src="/brand/logo-expedicao-piraiba.png" alt="" width={48} height={48} className="size-12 rounded-full" /><div><strong className="block text-sm">EXPEDIÇÃO PIRAÍBA</strong><span className="text-[10px] tracking-[.2em] text-white/60">PAINEL OPERACIONAL</span></div><button aria-label="Fechar menu" onClick={() => setMenu(false)} className="ml-auto lg:hidden"><X /></button></div><nav className="mt-6 space-y-2">{nav.map(([value,label,Icon]) => <button key={value} onClick={() => { setSection(value); setMenu(false); }} className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-bold ${section === value ? "bg-white text-brand-900" : "text-white/75 hover:bg-white/10"}`}><Icon className="size-5" />{label}</button>)}</nav><Link href="/" className="mt-auto flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-bold text-white/70"><Fish className="size-5" />Ver site</Link><button onClick={logout} className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-bold text-white/70"><LogOut className="size-5" />Sair</button></div></aside>
    {menu && <button aria-label="Fechar menu" className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setMenu(false)} />}
    <main className="min-w-0"><header className="flex min-h-16 items-center border-b bg-white px-5 lg:px-8"><button aria-label="Abrir menu" onClick={() => setMenu(true)} className="mr-4 lg:hidden"><Menu /></button><div><p className="text-xs font-bold uppercase tracking-widest text-brand-600">Área administrativa</p><h1 className="text-xl font-black">{nav.find(item => item[0] === section)?.[1]}</h1></div><div className="ml-auto flex items-center gap-2 text-sm text-ink-500"><ShieldCheck className="size-5 text-brand-600" /><span className="hidden sm:inline">Sessão protegida</span></div></header><div className="p-5 lg:p-8">{section === "overview" && <OverviewPanel token={token} unauthorized={logout} go={setSection} />}{section === "reservations" && <ReservationsPanel token={token} unauthorized={logout} />}{section === "expeditions" && <ExpeditionsPanel token={token} unauthorized={logout} />}{section === "lodges" && <LodgesPanel token={token} unauthorized={logout} />}{section === "configuration" && <ConfigurationPanel token={token} unauthorized={logout} />}{section === "shopping" && <ShoppingPanel token={token} unauthorized={logout} />}</div></main>
  </div>;
}

function Login({ onLogin }: { onLogin: (token: string) => void }) { const [email,setEmail] = useState("admin@expedicaopiraiba.com.br"); const [password,setPassword] = useState("admin-local-2026"); const [error,setError] = useState(""); const [loading,setLoading] = useState(false); async function submit(event: FormEvent) { event.preventDefault(); setLoading(true); setError(""); try { const response = await fetch(`${api}/operations/login/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email,password }) }); const data = await response.json(); if (!response.ok) throw data; onLogin(data.token); } catch (value) { setError(errorMessage(value)); } finally { setLoading(false); } } return <main className="grid min-h-screen place-items-center bg-brand-900 p-5"><form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-8"><Image src="/brand/logo-expedicao-piraiba.png" alt="Expedição Piraíba" width={72} height={72} className="mx-auto rounded-full" /><h1 className="mt-5 text-center text-2xl font-black">Painel operacional</h1><label className="mt-7 block text-sm font-bold">E-mail<input type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-2 h-12 w-full rounded-lg border px-3" /></label><label className="mt-4 block text-sm font-bold">Senha<input type="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-2 h-12 w-full rounded-lg border px-3" /></label>{error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}<button disabled={loading} className="mt-5 min-h-12 w-full rounded-lg bg-brand-600 font-bold text-white">{loading ? "Entrando..." : "Entrar"}</button></form></main>; }

function OverviewPanel({ token, unauthorized, go }: { token: string; unauthorized: () => void; go: (value: Section) => void }) { const result = useData<Overview>("overview/", token, unauthorized); if (!result.data) return <State loading={result.loading} error={result.error} />; const data = result.data; const cards = [["Valor vendido", money(data.sold_cents)], ["Valor recebido", money(data.revenue_cents)], ["Saldo pendente", money(data.outstanding_cents)], ["Reservas confirmadas", data.reservations.confirmed], ["Cadastros pendentes", data.incomplete_participants], ["Reservas totais", data.reservations.total]]; const indicators=data.expedition_indicators??data.expeditions??[]; return <div><Header title="Resumo do negócio" subtitle="Financeiro, ocupação e pendências operacionais." action={<button onClick={() => void result.load()} className="rounded-lg border bg-white p-2.5"><RefreshCw className="size-5" /></button>} /><section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map(([label,value]) => <article key={label} className="rounded-xl bg-white p-5"><span className="text-sm font-bold text-ink-500">{label}</span><strong className="mt-3 block text-2xl font-black">{value}</strong></article>)}</section>{Boolean(data.alerts?.length || data.incomplete_participants) && <section className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5"><h3 className="font-black text-amber-900"><AlertTriangle className="mr-2 inline size-5" />Alertas operacionais</h3>{data.alerts?.map((alert,index) => <button key={alert.id ?? index} onClick={() => go("reservations")} className="mt-3 block w-full rounded-lg bg-white p-3 text-left text-sm"><strong>{alert.title ?? "Atenção"}</strong><span className="ml-2 text-ink-500">{alert.message}</span></button>)}{!data.alerts?.length && <p className="mt-2 text-sm">Há {data.incomplete_participants} cadastro(s) pendente(s).</p>}</section>}{indicators.length>0&&<ExpeditionIndicators items={indicators}/>}<div className="mt-6 grid gap-6 xl:grid-cols-2"><section className="rounded-xl bg-white p-5"><h3 className="font-black">Próximas expedições</h3>{data.upcoming_expeditions.map(item => <div key={item.id} className="mt-3 flex items-center gap-3 rounded-lg bg-[#f7f8f4] p-3"><CalendarDays className="text-brand-700" /><div className="flex-1"><strong>{item.name}</strong><p className="text-xs text-ink-500">{shortDate(item.starts_at)} · {item.destination}</p></div><strong>{item.occupied_slots}/{item.capacity}</strong></div>)}</section><section className="rounded-xl bg-white p-5"><h3 className="font-black">Reservas recentes</h3>{data.recent_reservations.map(item => <button key={item.id} onClick={() => go("reservations")} className="mt-3 flex w-full items-center gap-3 border-b pb-3 text-left"><div className="flex-1"><strong>{item.customer.name}</strong><p className="text-xs text-ink-500">{item.expedition.name}</p></div><Status value={item.status} /></button>)}</section></div></div>; }

function ExpeditionIndicators({items}:{items:ExpeditionIndicator[]}){return <section className="mt-6"><h3 className="text-lg font-black">Indicadores por expedição</h3><div className="mt-3 grid gap-4 xl:grid-cols-2">{items.map((item,index)=><article key={item.expedition_id??item.id??index} className="rounded-xl bg-white p-5"><div className="flex justify-between gap-3"><strong>{item.expedition_name??item.name??"Expedição"}</strong><span className="text-sm font-bold text-brand-700">{item.available_slots} vagas livres</span></div><div className="mt-4 grid grid-cols-3 gap-2 text-sm"><Indicator label="Confirmadas" value={item.confirmed_slots??item.occupied_slots??0}/><Indicator label="Em hold" value={item.held_slots??0}/><Indicator label="Capacidade" value={item.capacity}/><Indicator label="A receber" value={money(item.outstanding_cents??0)}/><Indicator label="Preferências" value={item.pending_preferences??0}/><Indicator label="Checklists" value={item.pending_checklists??0}/></div>{Boolean(item.restrictions)&&<p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs font-bold text-amber-900">{item.restrictions} participante(s) com restrição alimentar.</p>}</article>)}</div></section>}
function Indicator({label,value}:{label:string;value:string|number}){return <div><span className="block text-xs text-ink-500">{label}</span><strong>{value}</strong></div>}

function ExpeditionSelect({ value, set, items, all = true }: { value: string; set: (value: string) => void; items: Expedition[]; all?: boolean }) { return <select value={value} onChange={e => set(e.target.value)} className="min-h-11 rounded-lg border bg-white px-3 text-sm font-bold">{all ? <option value="">Todas as expedições</option> : <option value="">Selecione uma expedição</option>}{items.map(item => <option key={item.id} value={item.id}>{item.name} · {shortDate(item.starts_at)}</option>)}</select>; }
function ReservationsPanel({ token, unauthorized }: { token: string; unauthorized: () => void }) { const expeditions = useData<Expedition[]>("expeditions/", token, unauthorized); const [query,setQuery] = useState(""); const [status,setStatus] = useState(""); const [expedition,setExpedition] = useState(""); const [selected,setSelected] = useState<Reservation | null>(null); const path = `reservations/?q=${encodeURIComponent(query)}&status=${status}&expedition=${expedition}`; const list = useData<Reservation[]>(path, token, unauthorized); async function open(id:string){try{setSelected(await request<Reservation>(`reservations/${id}/`,token))}catch(value){window.alert(errorMessage(value))}} return <div><Header title="Reservas e clientes" subtitle="Filtre, confira pendências e execute ações operacionais." /><div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto_auto]"><label className="flex min-h-11 items-center gap-2 rounded-lg border bg-white px-3"><Search className="size-4" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Nome, CPF, telefone ou e-mail" className="min-w-0 flex-1 outline-none" /></label><ExpeditionSelect value={expedition} set={setExpedition} items={expeditions.data ?? []} /><select value={status} onChange={e => setStatus(e.target.value)} className="rounded-lg border bg-white px-3 font-bold"><option value="">Todos os status</option>{Object.entries(labels).slice(7).map(([key,value]) => <option key={key} value={key}>{value}</option>)}</select></div><div className="mt-6"><State loading={list.loading} error={list.error} />{list.data && <div className="overflow-x-auto rounded-xl bg-white"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-brand-900 text-xs uppercase text-white"><tr><th className="px-5 py-4">Cliente</th><th>Expedição</th><th>Progresso</th><th>Financeiro</th><th>Status</th><th></th></tr></thead><tbody className="divide-y">{list.data.map(item => <tr key={item.id}><td className="px-5 py-4"><strong>{item.customer.name}</strong><span className="block text-xs text-ink-500">{item.customer.phone}</span></td><td>{item.expedition.name}<span className="block text-xs">{item.participant_count} participante(s)</span></td><td>{item.participants.filter(p => p.onboarding_status === "COMPLETED").length}/{item.participant_count} cadastros</td><td><strong>{money(item.paid_amount_cents)}</strong><span className="block text-xs">Saldo {money(item.remaining_balance_cents)}</span></td><td><Status value={item.status} /></td><td><button onClick={() => void open(item.id)} className="rounded-lg border px-3 py-2 text-xs font-bold">Abrir detalhe</button></td></tr>)}</tbody></table>{!list.data.length && <Empty>Nenhuma reserva encontrada.</Empty>}</div>}</div>{selected && <ReservationDrawer item={selected} token={token} close={() => setSelected(null)} changed={async () => { await list.load(); setSelected(null); }} />}</div>; }

function ReservationDrawer({ item, token, close, changed }: { item: Reservation; token: string; close: () => void; changed: () => Promise<void> }) { const [action,setAction] = useState<"payment"|"cancel"|"">(""); const [reason,setReason] = useState(""); const [amount,setAmount] = useState((item.remaining_balance_cents / 100).toFixed(2)); const [error,setError] = useState(""); const [saving,setSaving] = useState(false); async function submit() { if (!reason.trim()) return setError("Informe o motivo para a auditoria."); setSaving(true); try { const path = action === "payment" ? `reservations/${item.id}/manual-payment/` : `reservations/${item.id}/cancel/`; await request(path, token, { method: "POST", body: JSON.stringify(action === "payment" ? { amount_cents: Math.round(Number(amount.replace(",",".")) * 100), reason } : { reason }) }); await changed(); } catch (value) { setError(errorMessage(value)); } finally { setSaving(false); } } return <div className="fixed inset-0 z-50 flex justify-end bg-black/45"><aside className="h-full w-full max-w-2xl overflow-y-auto bg-[#f7f8f4] p-6"><div className="flex justify-between"><div><Status value={item.status} /><h2 className="mt-3 text-2xl font-black">{item.customer.name}</h2><p className="text-sm">{item.expedition.name}</p></div><button onClick={close}><X /></button></div>{item.alerts?.map((value,index) => { const alert=typeof value === "string" ? { message:value } : value; return <p key={alert.id??index} className="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-bold"><AlertTriangle className="mr-2 inline size-4" />{alert.title ? `${alert.title}: ` : ""}{alert.message}</p> })}<div className="mt-5 grid gap-4 sm:grid-cols-2"><Box title="Contato"><p>{item.customer.email}</p><p>{item.customer.phone}</p><p>CPF {item.customer.cpf}</p></Box><Box title="Financeiro"><p>Pago: <strong>{money(item.paid_amount_cents)}</strong></p><p>Saldo: <strong>{money(item.remaining_balance_cents)}</strong></p><p>Vencimento: {shortDate(item.balance_due_at)}</p></Box></div><Box title="Participantes e preparação">{item.participants.map(person => <div key={person.id} className="mt-3 rounded-lg border p-3"><strong>{person.name}</strong><div className="mt-2 flex flex-wrap gap-2 text-xs"><Pill ok={person.onboarding_status === "COMPLETED"}>Cadastro</Pill><Pill ok={person.preferences_confirmed}>Bebidas</Pill><Pill ok={person.dietary_confirmed}>Restrições</Pill><Pill ok={person.checklist_completed}>Checklist</Pill></div>{person.selected_offers?.length ? <p className="mt-2 text-xs">Escolhas: {person.selected_offers.map(value => value.name).join(", ")}</p> : null}{person.dietary_restrictions?.length ? <p className="mt-1 text-xs font-bold text-amber-800">Restrições: {person.dietary_restrictions.join(", ")}{person.dietary_details ? ` — ${person.dietary_details}` : ""}</p> : null}</div>)}</Box><Box title="Histórico">{item.events.map(event => <div key={event.id} className="mt-2 border-l-2 border-brand-500 pl-3 text-xs"><strong>{event.event_type.replaceAll("_"," ")}</strong> · {shortDate(event.created_at)}{event.reason && <p>{event.reason}</p>}</div>)}</Box><div className="mt-5 flex gap-3">{item.remaining_balance_cents > 0 && ["HELD","AWAITING_PAYMENT","PARTIALLY_PAID","CONFIRMED"].includes(item.status) && <button onClick={() => setAction("payment")} className="rounded-lg bg-brand-600 px-4 py-3 text-sm font-bold text-white">Registrar pagamento</button>}{!danger.includes(item.status) && <button onClick={() => setAction("cancel")} className="rounded-lg border border-red-200 px-4 text-sm font-bold text-red-700">Cancelar reserva</button>}</div>{action && <div className="mt-4 rounded-xl bg-white p-5"><h3 className="font-black">{action === "payment" ? "Pagamento manual simulado" : "Cancelamento"}</h3>{action === "payment" && <Field label="Valor (R$)" type="number" value={amount} set={setAmount} />}<label className="mt-3 block text-xs font-bold">Motivo<textarea value={reason} onChange={e => setReason(e.target.value)} className="mt-1 min-h-20 w-full rounded-lg border p-3" /></label>{error && <p className="mt-2 text-sm font-bold text-red-700">{error}</p>}<button disabled={saving} onClick={() => void submit()} className="mt-3 rounded-lg bg-brand-700 px-4 py-2 font-bold text-white">Confirmar</button></div>}</aside></div>; }
function Box({ title,children }: { title: string; children: ReactNode }) { return <section className="mt-4 rounded-xl bg-white p-5 text-sm"><h3 className="mb-2 font-black">{title}</h3>{children}</section>; }
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
        <ExpeditionModal
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

function ExpeditionModal({
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
  const lodges = useData<Lodge[]>("lodges/", token, () => {});
  const speciesList = useData<Species[]>("species/", token, () => {});

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
    lodge_id: item?.lodge?.id ?? item?.lodge_id ?? "",
    cover_image_url: item?.cover_image_url ?? "",
    inclusions: (item?.inclusions ?? [
      "Hospedagem Completa na Pousada",
      "Combustível e Óleo 100% Inclusos",
      "Open Bar (Cervejas e Refrigerantes)",
      "Kit Sashimi, Ceviche e petiscos",
      "Iscas Nativas Vivas",
      "Guias Nativos Especializados",
      "Torneio com Troféus e Banner da Equipe",
      "Seguro Viagem",
      "Água mineral, Refrigerante e Gelo abundante",
      "Internet Wi-Fi na Pousada",
    ]).join("\n"),
  });

  const [selectedSpecies, setSelectedSpecies] = useState<string[]>(
    item?.target_species?.map((s) => s.slug) ?? item?.species_slugs ?? ["piraiba", "pirarara", "bargada"]
  );
  const [error, setError] = useState("");

  const onLodgeChange = (lodgeId: string) => {
    const chosen = lodges.data?.find((l) => l.id === lodgeId);
    setForm((prev) => ({
      ...prev,
      lodge_id: lodgeId,
      departure_location: prev.departure_location || (chosen ? `${chosen.city}/${chosen.state}` : ""),
      destination: chosen ? `${chosen.city}/${chosen.state} (${chosen.name})` : prev.destination,
    }));
  };

  const toggleSpecies = (slug: string) => {
    setSelectedSpecies((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const body = {
        ...form,
        capacity: Number(form.capacity),
        price_per_person_cents: Math.round(Number(form.price) * 100),
        deposit_cents: Math.round(Number(form.deposit) * 100),
        balance_due_days_before: Number(form.balance_due_days_before),
        lodge_id: form.lodge_id || null,
        species_slugs: selectedSpecies,
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
    } catch (value) {
      setError(errorMessage(value));
    }
  }

  const input = (name: keyof typeof form, label: string, type = "text") => (
    <Field label={label} type={type} value={form[name]} set={(value) => setForm({ ...form, [name]: value })} />
  );

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/55 p-4">
      <form onSubmit={submit} className="my-5 w-full max-w-2xl rounded-2xl bg-white p-6">
        <div className="flex justify-between">
          <h2 className="text-2xl font-black">{item ? "Editar expedição" : "Nova expedição"}</h2>
          <button type="button" onClick={close}>
            <X />
          </button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {input("name", "Nome")}
          <label className="text-xs font-bold">
            Pousada parceira
            <select
              value={form.lodge_id}
              onChange={(e) => onLodgeChange(e.target.value)}
              className="mt-1 h-10 w-full rounded-lg border px-3"
            >
              <option value="">Nenhuma / Personalizada</option>
              {lodges.data?.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.city}/{l.state})
                </option>
              ))}
            </select>
          </label>
          {input("destination", "Destino")}
          {input("departure_location", "Local de saída")}
          {input("capacity", "Capacidade", "number")}
          {input("starts_at", "Data inicial", "date")}
          {input("ends_at", "Data final", "date")}
          {input("price", "Valor por pessoa", "number")}
          {input("deposit", "Sinal", "number")}
          {input("balance_due_days_before", "Vencimento do saldo (dias)", "number")}
          <label className="text-xs font-bold">
            Status
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="mt-1 h-10 w-full rounded-lg border px-3"
            >
              {Object.entries(labels)
                .slice(0, 7)
                .map(([key, value]) => (
                  <option key={key} value={key}>
                    {value}
                  </option>
                ))}
            </select>
          </label>
          {input("cover_image_url", "URL da Imagem de Capa")}
          <label className="text-xs font-bold sm:col-span-2">
            Resumo
            <textarea
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
              className="mt-1 min-h-20 w-full rounded-lg border p-3"
            />
          </label>
          <div className="sm:col-span-2">
            <span className="text-xs font-bold">Espécies-alvo da expedição</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {speciesList.data?.map((s) => (
                <label
                  key={s.slug}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold transition ${
                    selectedSpecies.includes(s.slug)
                      ? "border-brand-600 bg-brand-50 text-brand-800"
                      : "border-ink-900/10 text-ink-600"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedSpecies.includes(s.slug)}
                    onChange={() => toggleSpecies(s.slug)}
                    className="sr-only"
                  />
                  <Fish className="size-3" />
                  {s.common_name}
                </label>
              ))}
            </div>
          </div>
          <label className="text-xs font-bold sm:col-span-2">
            Inclusões All Inclusive (uma por linha)
            <textarea
              value={form.inclusions}
              onChange={(e) => setForm({ ...form, inclusions: e.target.value })}
              rows={4}
              className="mt-1 w-full rounded-lg border p-3 font-mono text-xs"
            />
          </label>
        </div>
        {error && <p className="mt-3 text-red-700">{error}</p>}
        <button className="mt-5 rounded-lg bg-brand-600 px-5 py-3 font-bold text-white">Salvar</button>
      </form>
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
        subtitle="Gerencie pousadas parceiras, comodidades, localização e ponto de encontro."
        action={
          <button
            onClick={() => setEditing("new")}
            className="rounded-lg bg-brand-600 px-4 py-3 text-sm font-bold text-white"
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
              <article key={item.id} className="rounded-xl bg-white p-5">
                <div className="flex justify-between">
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
                      {item.river_section ? ` · ${item.river_section}` : ""}
                    </p>
                  </div>
                  <button onClick={() => setEditing(item)} className="rounded-lg border p-2">
                    <Pencil className="size-4" />
                  </button>
                </div>
                {item.description && (
                  <p className="mt-3 text-xs text-ink-600 line-clamp-2">{item.description}</p>
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
  const [form, setForm] = useState({
    name: item?.name ?? "",
    slug: item?.slug ?? "",
    city: item?.city ?? "",
    state: item?.state ?? "MT",
    river_section: item?.river_section ?? "Médio Araguaia",
    description: item?.description ?? "",
    amenities: (item?.amenities ?? []).join(", "),
    meeting_point: item?.meeting_point ?? "",
    directions: item?.directions ?? "",
    cover_image_url: item?.cover_image_url ?? "",
    active: item?.active ?? true,
  });
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const body = {
        ...form,
        amenities: form.amenities
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };
      await request(item ? `lodges/${item.id}/` : "lodges/", token, {
        method: item ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      await saved();
    } catch (value) {
      setError(errorMessage(value));
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
      <form onSubmit={submit} className="my-5 w-full max-w-2xl rounded-2xl bg-white p-6">
        <div className="flex justify-between">
          <h2 className="text-2xl font-black">{item ? "Editar pousada" : "Nova pousada"}</h2>
          <button type="button" onClick={close}>
            <X />
          </button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {input("name", "Nome da pousada")}
          {input("slug", "Identificador (slug)")}
          {input("city", "Cidade")}
          {input("state", "Estado (UF)")}
          {input("river_section", "Trecho do rio")}
          {input("cover_image_url", "URL da imagem de capa")}
          <label className="text-xs font-bold sm:col-span-2">
            Comodidades (separadas por vírgula)
            <input
              value={form.amenities}
              onChange={(e) => setForm({ ...form, amenities: e.target.value })}
              placeholder="Ex: Suítes Climatizadas, Piscina, Wi-Fi, Deck Flutuante"
              className="mt-1 h-10 w-full rounded-lg border px-3"
            />
          </label>
          <label className="text-xs font-bold sm:col-span-2">
            Ponto de encontro
            <input
              value={form.meeting_point}
              onChange={(e) => setForm({ ...form, meeting_point: e.target.value })}
              placeholder="Ex: Pousada Solar das Águas — Recepção"
              className="mt-1 h-10 w-full rounded-lg border px-3"
            />
          </label>
          <label className="text-xs font-bold sm:col-span-2">
            Descrição da pousada
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="mt-1 min-h-20 w-full rounded-lg border p-3"
            />
          </label>
          <label className="text-xs font-bold sm:col-span-2">
            Como chegar (direções)
            <textarea
              value={form.directions}
              onChange={(e) => setForm({ ...form, directions: e.target.value })}
              className="mt-1 min-h-16 w-full rounded-lg border p-3"
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
        {error && <p className="mt-3 text-red-700">{error}</p>}
        <button className="mt-5 rounded-lg bg-brand-600 px-5 py-3 font-bold text-white">Salvar</button>
      </form>
    </div>
  );
}

function ConfigurationPanel({ token, unauthorized }: { token:string; unauthorized:()=>void }) { const expeditions=useData<Expedition[]>("expeditions/",token,unauthorized); const [selected,setSelected]=useState(""); const selectedId=selected||expeditions.data?.[0]?.id||""; const config=useData<Configuration>(selectedId?`expeditions/${selectedId}/configuration/`:null,token,unauthorized); return <div><Header title="Configuração operacional" subtitle="Defina encontro, bebidas oferecidas e checklist." /><div className="mt-5"><ExpeditionSelect value={selectedId} set={setSelected} items={expeditions.data??[]} all={false}/></div><div className="mt-6"><State loading={config.loading} error={config.error}/>{config.data&&<ConfigEditor key={selectedId} expedition={expeditions.data?.find(value=>value.id===selectedId)} config={config.data} token={token} reload={config.load}/>}</div></div>; }
function ConfigEditor({ expedition,config,token,reload }: { expedition?:Expedition; config:Configuration; token:string; reload:()=>Promise<void> }) { const [departure,setDeparture]=useState(config.departure_location??""); const [instructions,setInstructions]=useState(config.meeting_instructions??""); const [products,setProducts]=useState(config.products??[]); const [offers,setOffers]=useState(config.offers??[]); const [checklist,setChecklist]=useState(config.checklist_items??config.checklist??[]); const [message,setMessage]=useState(""); const locked=["IN_PROGRESS","COMPLETED"].includes(expedition?.status??""); async function save(){if(!expedition)return;try{await request(`expeditions/${expedition.id}/configuration/`,token,{method:"PUT",body:JSON.stringify({departure_location:departure,meeting_instructions:instructions,products,offers,checklist_items:checklist})});setMessage("Configuração salva.");await reload();}catch(value){setMessage(errorMessage(value));}} function updatePackage(productId:string,size:number){setProducts(products.map(product=>product.id===productId?{...product,package_size:size||null}:product))} return <div className="space-y-6">{locked&&<p className="rounded-lg bg-amber-50 p-4 font-bold">Configuração bloqueada após o início da expedição.</p>}<Box title="Encontro"><div className="grid gap-3 sm:grid-cols-2"><Field label="Local de saída" value={departure} set={setDeparture}/><Field label="Orientações de encontro" value={instructions} set={setInstructions}/></div></Box><section className="rounded-xl bg-white p-5"><div className="flex justify-between"><div><h3 className="font-black">Oferta de bebidas</h3><p className="text-sm text-ink-500">O viajante escolhe opções, sem informar unidades.</p></div><button disabled={locked} onClick={()=>setOffers([...offers,{product_id:"",standard_quantity_per_participant:1,display_order:offers.length+1,note:"",active:true}])} className="rounded-lg border px-3 text-sm font-bold"><Plus className="mr-1 inline size-4"/>Oferta</button></div>{offers.map((offer,index)=><div key={offer.id??index} className="mt-3 grid gap-3 rounded-lg border p-3 lg:grid-cols-[2fr_1fr_1fr_2fr_auto]"><label className="text-xs font-bold">Bebida<select value={offer.product_id} onChange={e=>setOffers(offers.map((value,i)=>i===index?{...value,product_id:e.target.value}:value))} className="mt-1 h-10 w-full rounded-lg border"><option value="">Selecione</option>{products.map(product=><option key={product.id} value={product.id}>{product.name} ({product.unit})</option>)}</select></label><NumberField label="Padrão/pessoa" value={offer.standard_quantity_per_participant} set={number=>setOffers(offers.map((value,i)=>i===index?{...value,standard_quantity_per_participant:number}:value))}/><NumberField label="Por embalagem" value={products.find(product=>product.id===offer.product_id)?.package_size??0} set={number=>updatePackage(offer.product_id,number)}/><Field label="Observação" value={offer.note} set={note=>setOffers(offers.map((value,i)=>i===index?{...value,note}:value))}/><label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={offer.active} onChange={e=>setOffers(offers.map((value,i)=>i===index?{...value,active:e.target.checked}:value))}/>Ativa</label></div>)}{!offers.length&&<Empty>Nenhuma bebida oferecida.</Empty>}</section><section className="rounded-xl bg-white p-5"><div className="flex justify-between"><h3 className="font-black">Checklist</h3><button disabled={locked} onClick={()=>setChecklist([...checklist,{title:"",description:"",required:true,active:true,display_order:checklist.length+1}])} className="rounded-lg border px-3 text-sm font-bold"><Plus className="mr-1 inline size-4"/>Item</button></div>{checklist.map((item,index)=><div key={item.id??index} className="mt-3 grid gap-3 rounded-lg border p-3 lg:grid-cols-[2fr_3fr_auto_auto]"><Field label="Título" value={item.title} set={title=>setChecklist(checklist.map((value,i)=>i===index?{...value,title}:value))}/><Field label="Orientação" value={item.description} set={description=>setChecklist(checklist.map((value,i)=>i===index?{...value,description}:value))}/><label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={item.required} onChange={e=>setChecklist(checklist.map((value,i)=>i===index?{...value,required:e.target.checked}:value))}/>Obrigatório</label><label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={item.active} onChange={e=>setChecklist(checklist.map((value,i)=>i===index?{...value,active:e.target.checked}:value))}/>Ativo</label></div>)}{!checklist.length&&<Empty>Nenhum item configurado.</Empty>}</section>{message&&<p className="rounded-lg bg-brand-50 p-3 font-bold">{message}</p>}<button disabled={locked} onClick={()=>void save()} className="rounded-lg bg-brand-600 px-5 py-3 font-bold text-white disabled:opacity-50">Salvar configuração</button></div>; }
function Field({label,value,set,type="text"}:{label:string;value:string;set:(value:string)=>void;type?:string}){return <label className="text-xs font-bold">{label}<input type={type} value={value??""} onChange={e=>set(e.target.value)} className="mt-1 h-10 w-full rounded-lg border px-3"/></label>}
function NumberField({label,value,set}:{label:string;value:number;set:(value:number)=>void}){return <label className="text-xs font-bold">{label}<input type="number" min="0" step="1" value={value} onChange={e=>set(Number(e.target.value))} className="mt-1 h-10 w-full rounded-lg border px-3"/></label>}

function ShoppingPanel({token,unauthorized}:{token:string;unauthorized:()=>void}){const expeditions=useData<Expedition[]>("expeditions/",token,unauthorized);const[selected,setSelected]=useState("");const selectedId=selected||expeditions.data?.[0]?.id||"";const[copied,setCopied]=useState(false);const result=useData<Consolidation>(selectedId?`expeditions/${selectedId}/consolidation/`:null,token,unauthorized);const text=useMemo(()=>result.data?.text??result.data?.items.map(row=>`${row.product}: ${row.total} ${row.unit}${row.package_size?` (${row.full_packages??0} embalagem(ns) + ${row.remainder??0} ${row.unit})`:""}`).join("\n")??"",[result.data]);async function download(format:"csv"|"txt"){try{const content=await request<string>(`expeditions/${selectedId}/consolidation.${format}`,token);const url=URL.createObjectURL(new Blob([content],{type:"text/plain;charset=utf-8"}));const anchor=document.createElement("a");anchor.href=url;anchor.download=`lista-compras-${selectedId}.${format}`;anchor.click();URL.revokeObjectURL(url)}catch(value){window.alert(errorMessage(value))}}async function copy(){await navigator.clipboard.writeText(text);setCopied(true);window.setTimeout(()=>setCopied(false),1500)}return <div><Header title="Lista de compras" subtitle="Consolidação por escolhas e padrão vigente das reservas garantidas." action={<div className="flex gap-2"><button onClick={()=>void copy()} className="rounded-lg border bg-white px-3 py-2 text-sm font-bold"><Copy className="mr-1 inline size-4"/>{copied?"Copiado":"Copiar"}</button><button onClick={()=>void download("csv")} className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-bold text-white"><Download className="mr-1 inline size-4"/>CSV</button><button onClick={()=>void download("txt")} className="rounded-lg bg-brand-900 px-3 py-2 text-sm font-bold text-white"><Download className="mr-1 inline size-4"/>Texto</button></div>}/><div className="mt-5"><ExpeditionSelect value={selectedId} set={setSelected} items={expeditions.data??[]} all={false}/></div><div className="mt-6"><State loading={result.loading} error={result.error}/>{result.data&&<div className="overflow-x-auto rounded-xl bg-white"><p className="p-4 text-xs">Snapshot: {new Date(result.data.generated_at).toLocaleString("pt-BR")}</p><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-brand-900 text-xs uppercase text-white"><tr><th className="px-5 py-4">Produto</th><th>Pessoas</th><th>Padrão</th><th>Total</th><th>Embalagens</th><th>Sobra</th><th>Atualização</th></tr></thead><tbody className="divide-y">{result.data.items.map(row=><tr key={row.offer_id}><td className="px-5 py-4"><strong>{row.product}</strong>{row.details?.length ? <details className="mt-2"><summary className="cursor-pointer text-xs font-bold text-brand-700">Ver {row.details.length} participante(s)</summary><ul className="mt-2 space-y-1 text-xs text-ink-500">{row.details.map((detail,index)=><li key={detail.participant_id??`${detail.reservation_id}-${index}`}>{detail.participant_name}{detail.customer_name ? ` · reserva de ${detail.customer_name}` : ""}</li>)}</ul></details> : null}</td><td>{row.people}</td><td>{row.standard_quantity_per_participant} {row.unit}</td><td className="font-black text-brand-800">{row.total} {row.unit}</td><td>{row.package_size?`${row.full_packages??0} × ${row.package_size}`:"—"}</td><td>{row.package_size?`${row.remainder??0} ${row.unit}`:"—"}</td><td>{shortDate(row.updated_at)}</td></tr>)}</tbody></table>{!result.data.items.length&&<Empty>Nenhuma escolha elegível.</Empty>}</div>}</div></div>}
