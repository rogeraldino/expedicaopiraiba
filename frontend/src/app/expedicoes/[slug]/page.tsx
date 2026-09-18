import Image from "next/image";
import Link from "next/link";
import {
  Beer,
  Check,
  Fish,
  Fuel,
  Headphones,
  House,
  LockKeyhole,
  Radio,
  ShieldCheck,
  Snowflake,
  Trophy,
  Users,
  Utensils,
  Wifi,
} from "lucide-react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ButtonLink } from "@/components/ui/button-link";

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
  name: "São Félix do Araguaia — Outubro",
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
  summary: "4 dias completos de pescaria All Inclusive no Rio Araguaia na Pousada Solar das Águas.",
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
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

export default async function ExpeditionDetails({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const expedition = await getExpedition(slug);
  const isCasais = expedition.slug.includes("casais");

  return (
    <main className="min-h-screen bg-background text-ink-900">
      <SiteHeader />
      <div className="container-page py-5 text-sm text-ink-500">
        <Link href="/" className="hover:text-brand-700">Início</Link>
        <span className="px-2">›</span>
        <Link href="/#expedicoes" className="hover:text-brand-700">Expedições</Link>
        <span className="px-2">›</span>
        <span className="text-ink-900 font-bold">{expedition.name}</span>
      </div>

      <section className="container-page grid gap-8 pb-10 lg:grid-cols-[.85fr_1.15fr]">
        <div className="self-center">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-800">
              Temporada Oficial 2026
            </span>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-800">
              Tudo All Inclusive
            </span>
          </div>

          <h1 className="mt-3 text-4xl font-black uppercase leading-tight sm:text-5xl lg:text-6xl text-brand-900">
            {expedition.name}
          </h1>
          <p className="mt-4 text-lg text-ink-700 leading-relaxed">{expedition.summary}</p>

          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl border border-ink-900/10 bg-white p-3.5">
              <span className="text-xs text-ink-500 block">Data</span>
              <strong className="mt-1 block text-sm font-black text-ink-900">
                {shortDate.format(new Date(`${expedition.starts_at}T12:00:00`)).split(" de ").slice(0, 2).join(" ")}
              </strong>
            </div>
            <div className="rounded-xl border border-ink-900/10 bg-white p-3.5">
              <span className="text-xs text-ink-500 block">Duração</span>
              <strong className="mt-1 block text-sm font-black text-ink-900">{expedition.duration_days} dias de pesca</strong>
            </div>
            <div className="rounded-xl border border-ink-900/10 bg-white p-3.5">
              <span className="text-xs text-ink-500 block">Turma</span>
              <strong className="mt-1 block text-sm font-black text-ink-900">{expedition.capacity} pescadores</strong>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-brand-900/10 bg-white p-6 shadow-sm">
            <div className="flex items-end justify-between">
              <div>
                <span className="text-xs font-bold uppercase text-ink-500">
                  {isCasais ? "Valor total por casal:" : "Valor por pessoa:"}
                </span>
                <p className="text-3xl font-black text-brand-800">
                  {money.format((expedition.price_per_person_cents * (isCasais ? 2 : 1)) / 100)}
                </p>
                <span className="text-xs font-bold text-brand-600">Sinal de reserva: {money.format(expedition.deposit_cents / 100)}</span>
              </div>
              <div className="text-right">
                <span className="text-xs text-ink-500">Vagas disponíveis</span>
                <p className="text-2xl font-black text-brand-700">
                  {expedition.available_slots} / {expedition.capacity}
                </p>
              </div>
            </div>

            <ButtonLink href={`/expedicoes/${slug}/checkout` as never} className="mt-6 w-full text-base font-bold shadow-md">
              Garantir minha vaga agora
            </ButtonLink>
          </div>
        </div>

        <div className="relative min-h-[420px] overflow-hidden rounded-2xl shadow-md">
          <Image
            src="/expeditions/rio-araguaia/pescaria.jpg"
            alt="Pescadores durante uma expedição no Rio Araguaia"
            fill
            sizes="(min-width: 1024px) 60vw, 100vw"
            className="object-cover"
            priority
          />
        </div>
      </section>

      {/* DETALHAMENTO DO PACOTE ALL INCLUSIVE */}
      <section className="container-page grid gap-5 pb-12 lg:grid-cols-2">
        <article className="rounded-2xl border border-ink-900/10 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black uppercase text-brand-800">★ Pacote All Inclusive Completo</h2>
          <p className="mt-1 text-xs text-ink-500">Sem custos adicionais de combustível, iscas ou bebidas durante a pescaria.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              [House, "Hospedagem Completa na Pousada"],
              [Fuel, "Combustível e Óleo 100% Inclusos"],
              [Beer, "Open Bar (Heineken, Original, Amstel)"],
              [Utensils, "Kit Sashimi, Ceviche e Churrasco"],
              [Fish, "Iscas Nativas (Tuviras inclusas)"],
              [Users, "Guias de Pesca e Piloteiros Nativos"],
              [Trophy, "Torneio com Troféus e Banner da Equipe"],
              [Radio, "Rádio VHF em cada embarcação"],
              [Snowflake, "Água, Refrigerante e Gelo abundante"],
              [Wifi, "Internet Wi-Fi na Pousada"],
            ].map(([Icon, label]) => {
              const ItemIcon = Icon as typeof Check;
              return (
                <p key={label as string} className="flex items-center gap-2.5 text-sm font-semibold text-ink-800">
                  <ItemIcon className="size-4 shrink-0 text-brand-600" />
                  {label as string}
                </p>
              );
            })}
          </div>
        </article>

        <article className="rounded-2xl border border-ink-900/10 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black uppercase text-brand-800">Peixes Gigantes do Rio Araguaia</h2>
          <p className="mt-1 text-xs text-ink-500">Os maiores peixes de água doce do Brasil no seu anzol.</p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            {["Piraíba (+2m)", "Pirarara Lendária", "Filhote", "Jaú Gigante", "Bargada", "Tucunaré Azul", "Aruanã"].map(
              (name) => (
                <span
                  key={name}
                  className="flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50/80 px-3.5 py-1.5 text-xs font-black text-brand-800"
                >
                  <Fish className="size-3.5 text-brand-600" />
                  {name}
                </span>
              )
            )}
          </div>

          <h3 className="mt-6 text-sm font-black uppercase text-brand-800">Pousada & Estrutura</h3>
          <p className="mt-2 text-sm text-ink-600 leading-relaxed">
            Acomodações climatizadas com ar-condicionado, quartos suítes confortáveis, piscina, área de convivência e gastronomia regional
            preparada por cozinheiras nativas.
          </p>
        </article>
      </section>

      <section className="bg-brand-900 text-white">
        <div className="container-page grid gap-6 py-8 md:grid-cols-4">
          {[
            [ShieldCheck, "Segurança em 1º lugar", "Protocolos rigorosos e coletes homologados."],
            [Users, "Equipe Especializada", "Mais de 20 anos operando no Rio Araguaia."],
            [LockKeyhole, "Pagamento Seguro", "Reserva protegida com sinal e saldo na viagem."],
            [Headphones, "Suporte Contínuo", "Atendimento direto pelo WhatsApp antes e depois."],
          ].map(([Icon, title, copy]) => {
            const TrustIcon = Icon as typeof ShieldCheck;
            return (
              <div key={title as string} className="flex gap-3">
                <TrustIcon className="size-6 shrink-0 text-sand-300" />
                <div>
                  <h3 className="text-sm font-black uppercase text-sand-200">{title as string}</h3>
                  <p className="mt-1 text-xs leading-5 text-white/75">{copy as string}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
