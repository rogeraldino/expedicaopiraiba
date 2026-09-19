import Image from "next/image";
import Link from "next/link";
import {
  Check,
  Fish,
  Headphones,
  House,
  LockKeyhole,
  ShieldCheck,
  Users,
} from "lucide-react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ButtonLink } from "@/components/ui/button-link";

type TargetSpecies = {
  id: string;
  common_name: string;
  slug: string;
  scientific_name?: string;
  category: string;
  is_primary: boolean;
};

type Lodge = {
  id: string;
  name: string;
  slug: string;
  city: string;
  state: string;
  river_section?: string;
  description?: string;
  amenities?: string[];
  meeting_point?: string;
  directions?: string;
  cover_image_url?: string;
};

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
  cover_image_url?: string;
  lodge?: Lodge | null;
  target_species?: TargetSpecies[];
  inclusions?: string[];
};

const fallback: ExpeditionData = {
  id: "sao-felix-28-out",
  name: "São Félix do Araguaia — 28 a 31 Out",
  slug: "sao-felix-28-out",
  destination: "São Félix do Araguaia/MT (Pousada Solar das Águas)",
  departure_location: "São Félix do Araguaia/MT",
  starts_at: "2026-10-28",
  ends_at: "2026-10-31",
  duration_days: 4,
  capacity: 12,
  available_slots: 12,
  price_per_person_cents: 560000,
  deposit_cents: 250000,
  summary: "4 dias completos de pescaria All Inclusive no Rio Araguaia na Pousada Solar das Águas.",
  cover_image_url: "/expeditions/ponte-sao-felix.jpg",
  lodge: {
    id: "solar-das-aguas",
    name: "Pousada Solar das Águas",
    slug: "solar-das-aguas",
    city: "São Félix do Araguaia",
    state: "MT",
    river_section: "Médio Araguaia",
    description: "Excelente infraestrutura na beira do Rio Araguaia, quartos suítes climatizados, piscina e cozinha regional de alto padrão.",
    amenities: ["Suítes Climatizadas", "Piscina", "Wi-Fi", "Refeitório Climatizado", "Deck Flutuante"],
    meeting_point: "Pousada Solar das Águas — Recepção",
  },
  target_species: [
    { id: "1", common_name: "Piraíba", slug: "piraiba", scientific_name: "Brachyplatystoma filamentosum", category: "COURO", is_primary: true },
    { id: "2", common_name: "Pirarara", slug: "pirarara", scientific_name: "Phractocephalus hemioliopterus", category: "COURO", is_primary: true },
    { id: "3", common_name: "Bargada", slug: "bargada", category: "COURO", is_primary: false },
    { id: "4", common_name: "Tucunaré Azul", slug: "tucunare-azul", category: "ESCAMA", is_primary: false },
  ],
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

const expeditionHeroImages: Record<string, string> = {
  "bandeirantes-casais-22-out": "/ims-pesca/img-20260723-wa0173.jpg",
  "bandeirantes-15-out": "/ims-pesca/wender-piraiba-186-3.jpg",
  "sao-felix-01-out": "/ims-pesca/rogerio-e-uli-piraiba-206-1.jpg",
  "sao-felix-28-out": "/ims-pesca/trible-de-pirararas-3.jpg",
};

export default async function ExpeditionDetails({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const expedition = await getExpedition(slug);
  const isCasais = expedition.slug.includes("casais");
  const heroImage = expeditionHeroImages[expedition.slug] ?? "/ims-pesca/duble-de-piraiba-e-pirarara-top-1.jpg";

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
            src={expedition.cover_image_url || heroImage}
            alt={expedition.name}
            fill
            unoptimized={Boolean(expedition.cover_image_url?.startsWith("http"))}
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
            {(expedition.inclusions && expedition.inclusions.length > 0
              ? expedition.inclusions
              : [
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
                ]
            ).map((item) => (
              <p key={item} className="flex items-center gap-2.5 text-sm font-semibold text-ink-800">
                <Check className="size-4 shrink-0 text-brand-600" />
                {item}
              </p>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-ink-900/10 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black uppercase text-brand-800">Peixes Gigantes do Rio Araguaia</h2>
          <p className="mt-1 text-xs text-ink-500">Espécies-alvo desta expedição e principais capturas da região.</p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            {expedition.target_species && expedition.target_species.length > 0 ? (
              expedition.target_species.map((species) => (
                <span
                  key={species.slug}
                  className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-black ${
                    species.is_primary
                      ? "bg-brand-600 text-white shadow-sm"
                      : "border border-brand-200 bg-brand-50/80 text-brand-800"
                  }`}
                >
                  <Fish className="size-3.5 text-current" />
                  {species.common_name}
                  {species.scientific_name && (
                    <span className="text-[10px] font-normal italic opacity-85">({species.scientific_name})</span>
                  )}
                  {species.is_primary && (
                    <span className="rounded bg-brand-800/70 px-1 text-[9px] uppercase tracking-wider text-sand-200">
                      Alvo Principal
                    </span>
                  )}
                </span>
              ))
            ) : (
              ["Piraíba (+2m)", "Pirarara Lendária", "Bargada", "Tucunaré Azul", "Aruanã", "Dourada", "Mandubé", "Corvina", "Bicuda", "Cachorra", "Barbado", "Tambaqui", "Cachara", "Pintado"].map(
                (name) => (
                  <span
                    key={name}
                    className="flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50/80 px-3.5 py-1.5 text-xs font-black text-brand-800"
                  >
                    <Fish className="size-3.5 text-brand-600" />
                    {name}
                  </span>
                )
              )
            )}
          </div>

          <h3 className="mt-6 text-sm font-black uppercase text-brand-800 flex items-center gap-2">
            <House className="size-4 text-brand-600" />
            {expedition.lodge ? expedition.lodge.name : "Pousada & Estrutura"}
          </h3>
          {expedition.lodge ? (
            <div className="mt-2 space-y-2 text-sm text-ink-600 leading-relaxed">
              <p className="text-xs font-bold text-brand-700">
                {expedition.lodge.city} — {expedition.lodge.state}
                {expedition.lodge.river_section ? ` (${expedition.lodge.river_section})` : ""}
              </p>
              {expedition.lodge.description && <p>{expedition.lodge.description}</p>}
              {expedition.lodge.amenities && expedition.lodge.amenities.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {expedition.lodge.amenities.map((amenity) => (
                    <span key={amenity} className="rounded-md bg-ink-900/5 px-2.5 py-1 text-xs font-semibold text-ink-700">
                      ✓ {amenity}
                    </span>
                  ))}
                </div>
              )}
              {expedition.lodge.meeting_point && (
                <p className="text-xs text-ink-500 pt-1">
                  <strong>Ponto de encontro:</strong> {expedition.lodge.meeting_point}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm text-ink-600 leading-relaxed">
              {expedition.slug.includes("bandeirantes")
                ? "Acomodações climatizadas com ar-condicionado, quartos suítes confortáveis, piscina, área de convivência e gastronomia regional preparada por cozinheiras nativas."
                : "Acomodações climatizadas com ar-condicionado, quartos suítes confortáveis, área de convivência e gastronomia regional preparada por cozinheiras nativas."}
            </p>
          )}
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
