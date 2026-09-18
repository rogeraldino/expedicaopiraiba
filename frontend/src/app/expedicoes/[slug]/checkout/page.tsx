import Link from "next/link";
import { CalendarDays, Clock, MapPin, Users } from "lucide-react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { CheckoutForm } from "./checkout-form";

type ExpeditionData = {
  id: string;
  name: string;
  slug: string;
  destination: string;
  departure_location: string;
  starts_at: string;
  ends_at: string;
  duration_days: number;
  capacity: number;
  available_slots: number;
  price_per_person_cents: number;
  deposit_cents: number;
  summary: string;
};

const fallback: ExpeditionData = {
  id: "sao-felix-01-out",
  name: "São Félix do Araguaia — 01 a 04 Out",
  slug: "sao-felix-01-out",
  destination: "São Félix do Araguaia/MT (Pousada Solar das Águas)",
  departure_location: "São Félix do Araguaia/MT",
  starts_at: "2026-10-01",
  ends_at: "2026-10-04",
  duration_days: 4,
  capacity: 12,
  available_slots: 12,
  price_per_person_cents: 560000,
  deposit_cents: 250000,
  summary: "4 dias completos de pescaria All Inclusive no Rio Araguaia.",
};

async function getExpedition(slug: string): Promise<ExpeditionData> {
  const api = process.env.API_URL ?? "http://localhost:8000/api";
  try {
    const res = await fetch(`${api}/expeditions/${slug}/`, { next: { revalidate: 60 } });
    if (!res.ok) return fallback;
    return (await res.json()) as ExpeditionData;
  } catch {
    return fallback;
  }
}

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long" });

export default async function CheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const expedition = await getExpedition(slug);
  const isCasais = expedition.slug.includes("casais");

  return (
    <main className="min-h-screen bg-background text-ink-900">
      <SiteHeader />
      <div className="container-page py-5 text-sm text-ink-500">
        <Link href="/" className="hover:text-brand-700">Início</Link>
        <span className="px-2">›</span>
        <Link href={`/expedicoes/${slug}` as never} className="hover:text-brand-700">{expedition.name}</Link>
        <span className="px-2">›</span>
        <span className="font-bold text-ink-900">Checkout</span>
      </div>

      <section className="container-page grid gap-8 pb-16 lg:grid-cols-[1.55fr_.85fr]">
        <div>
          <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-800">
            Reserva Online & Segura
          </span>
          <h1 className="mt-2 text-4xl font-black sm:text-5xl text-brand-900">Finalizar Reserva</h1>
          <p className="mb-7 mt-2 text-ink-600">
            Informe seus dados para proteger suas vagas por 15 minutos com lock transacional.
          </p>
          <CheckoutForm expedition={expedition} />
        </div>

        <aside className="h-fit rounded-2xl border border-ink-900/10 bg-white p-6 shadow-sm lg:sticky lg:top-5">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-600">Resumo da Expedição</p>
          <h2 className="mt-2 text-2xl font-black text-brand-900 leading-tight">{expedition.name}</h2>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-500">
            <MapPin className="size-3.5 text-brand-600" />
            {expedition.destination}
          </p>

          <div className="mt-5 space-y-3 border-y border-ink-900/10 py-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-ink-500">
                <CalendarDays className="size-4 text-brand-600" /> Datas
              </span>
              <strong className="text-right text-xs">
                {shortDate.format(new Date(`${expedition.starts_at}T12:00:00`))} a {shortDate.format(new Date(`${expedition.ends_at}T12:00:00`))}
              </strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-ink-500">
                <Clock className="size-4 text-brand-600" /> Duração
              </span>
              <strong className="text-xs">{expedition.duration_days} dias de pesca</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-500">{isCasais ? "Valor total casal" : "Valor por pessoa"}</span>
              <strong className="text-base text-brand-900">
                {money.format((expedition.price_per_person_cents * (isCasais ? 2 : 1)) / 100)}
              </strong>
            </div>
            <div className="flex items-center justify-between text-brand-700">
              <span>Sinal por pessoa</span>
              <strong className="text-base">{money.format(expedition.deposit_cents / 100)}</strong>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between rounded-xl bg-brand-50 p-4 border border-brand-100">
            <span className="flex items-center gap-1.5 text-xs font-bold text-brand-900">
              <Users className="size-4 text-brand-700" /> Vagas disponíveis
            </span>
            <strong className="text-xl text-brand-700">{expedition.available_slots} / {expedition.capacity}</strong>
          </div>

          <div className="mt-5 rounded-xl bg-sand-50 p-3.5 text-xs text-ink-700 space-y-1 border border-sand-200">
            <p className="font-bold text-brand-900">★ Pacote Tudo All Inclusive</p>
            <p className="text-[11px] leading-4 text-ink-600">
              Inclui hospedagem completa, combustível livre, iscas, kit ceviche/sashimi, open bar (Heineken, Original, Amstel), gelo e guias.
            </p>
          </div>
        </aside>
      </section>
      <SiteFooter />
    </main>
  );
}
