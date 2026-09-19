import Image from "next/image";
import Link from "next/link";
import {
  Beer,
  CalendarDays,
  Clock,
  Fish,
  Fuel,
  Heart,
  MapPin,
  MessageCircle,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  Utensils,
  Waves,
} from "lucide-react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ButtonLink } from "@/components/ui/button-link";

type Expedition = {
  id: string;
  name: string;
  slug: string;
  destination: string;
  departure_location: string;
  starts_at: string;
  ends_at: string;
  duration_days: number;
  available_slots: number;
  price_per_person_cents: number;
  summary: string;
};

const preview: Expedition[] = [
  {
    id: "bandeirantes-casais-22-out",
    name: "Pescaria de Casais — 22 a 24 Out",
    slug: "bandeirantes-casais-22-out",
    destination: "Bandeirantes/GO (Pousada Canoa)",
    departure_location: "Bandeirantes/GO",
    starts_at: "2026-10-22",
    ends_at: "2026-10-24",
    duration_days: 3,
    available_slots: 12,
    price_per_person_cents: 420000,
    summary: "Momentos a dois e memórias para sempre. R$ 8.400 por casal.",
  },
  {
    id: "sao-felix-28-out",
    name: "São Félix do Araguaia — 28 a 31 Out",
    slug: "sao-felix-28-out",
    destination: "São Félix do Araguaia/MT (Pousada Solar das Águas)",
    departure_location: "São Félix do Araguaia/MT",
    starts_at: "2026-10-28",
    ends_at: "2026-10-31",
    duration_days: 4,
    available_slots: 12,
    price_per_person_cents: 560000,
    summary: "Fechamento de temporada 2026 com chave de ouro em São Félix do Araguaia.",
  },
];

const expeditionImages: Record<string, string> = {
  "sao-felix-01-out": "/ims-pesca/rogerio-e-uli-piraiba-206-1.jpg",
  "bandeirantes-15-out": "/ims-pesca/wender-piraiba-186-3.jpg",
  "bandeirantes-casais-22-out": "/ims-pesca/img-20260723-wa0173.jpg",
  "sao-felix-28-out": "/ims-pesca/trible-de-pirararas-3.jpg",
  "rio-araguaia": "/ims-pesca/duble-de-piraiba-e-pirarara-top-1.jpg",
};

async function getExpeditions(): Promise<Expedition[]> {
  const api = process.env.API_URL ?? "http://localhost:8000/api";
  try {
    const response = await fetch(`${api}/expeditions/`, { next: { revalidate: 60 } });
    if (!response.ok) return preview;
    const data = (await response.json()) as Expedition[];
    return data.length ? data : preview;
  } catch {
    return preview;
  }
}

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

const gallery = [
  ["rogerio-e-uli-piraiba-206-1.jpg", "Piraíba de 2,06m — Rogério e Uli"],
  ["wender-piraiba-186-3.jpg", "Piraíba de 1,86m — Wender"],
  ["trible-de-pirararas-3.jpg", "Triplê Histórico de Pirararas"],
  ["duble-de-piraiba-e-pirarara-top-1.jpg", "Dublê de Piraíba e Pirarara"],
  ["img-20260723-wa0173.jpg", "Troféu Pescaria de Casais"],
  ["img-20250417-wa0027.jpg", "Pirarara Monstro no Barranco"],
  ["img-20260723-wa0169.jpg", "Pirarara Gigante na Praia"],
  ["img-20260723-wa0170.jpg", "Pirarara Vermelha no Barco"],
  ["img-20260723-wa0198.jpg", "Piraíba Prateada do Araguaia"],
  ["img-20250412-wa0033.jpg", "Pescador com Peixe de Couro"],
  ["img-20250412-wa0041.jpg", "Pirarara de Mais de 35kg"],
  ["img-20250413-wa0123.jpg", "Piraíba no Bico da Voadeira"],
];

const season2027Dates = [
  { date: "06 a 10 de Abril", days: "5 dias", location: "São Félix — MT", type: "Pesca Esportiva" },
  { date: "03 a 07 de Maio", days: "5 dias", location: "São Félix — MT", type: "Pesca Esportiva" },
  { date: "11 a 15 de Maio", days: "5 dias", location: "São Félix — MT", type: "Pesca Esportiva" },
  { date: "01 a 05 de Junho", days: "5 dias", location: "São Félix — MT", type: "Pesca Esportiva" },
  { date: "10 a 12 de Junho", days: "3 dias", location: "São Félix — MT", type: "Pescaria de Casais (Namorados)", highlight: true },
  { date: "11 a 14 de Agosto", days: "4 dias", location: "São Félix — MT", type: "Pesca Esportiva" },
  { date: "03 a 06 de Setembro", days: "4 dias", location: "São Félix — MT", type: "Pesca Esportiva" },
  { date: "26 a 30 de Outubro", days: "5 dias", location: "São Félix — MT", type: "Pesca Esportiva" },
];

export default async function Home() {
  const expeditions = await getExpeditions();

  return (
    <main className="min-h-screen bg-background text-ink-900">
      <SiteHeader />

      {/* HERO SECTION WITH CINEMATIC BACKGROUND */}
      <section className="relative overflow-hidden bg-brand-950 text-white min-h-[560px] flex items-center">
        <Image
          src="/hero-bg.jpg"
          alt="Pescaria esportiva de Piraíba no Rio Araguaia"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center opacity-75"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-950 via-brand-950/80 to-transparent lg:w-3/4" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-950 via-transparent to-black/30" />

        <div className="container-page relative grid min-h-[480px] items-center gap-10 py-16 lg:grid-cols-[1.25fr_.75fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-sand-300/30 bg-black/40 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-sand-300 backdrop-blur-md">
              <Sparkles className="size-3.5" /> Temporada Oficial 2026 • 2027
            </div>
            <h1 className="mt-4 max-w-3xl text-5xl font-black leading-[.95] tracking-tight sm:text-6xl lg:text-7xl hero-headline">
              O Rio Araguaia está chamando.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-7 text-emerald-300 font-medium drop-shadow-md">
              Há mais de 20 anos mostrando o que existe de melhor na pesca esportiva de gigantes. Barco, guias nativos, combustível,
              gastronomia e estrutura <strong className="text-white font-black underline decoration-emerald-400 decoration-2 underline-offset-4">Tudo All Inclusive</strong>.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="#expedicoes" variant="secondary" className="shadow-xl">
                <CalendarDays className="mr-2 size-5" /> Ver Expedições 2026
              </ButtonLink>
              <a
                href="https://wa.me/5562981612128?text=Olá!%20Gostaria%20de%20informações%20sobre%20as%20vagas%20da%20Expedição%20Piraíba."
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-12 items-center justify-center rounded-md border border-white/30 bg-black/40 px-6 font-bold text-white backdrop-blur-sm transition hover:bg-black/60 shadow-lg"
              >
                <MessageCircle className="mr-2 size-5 text-[#25D366]" /> Falar no WhatsApp
              </a>
            </div>
          </div>

          <div className="rounded-2xl border border-white/20 bg-black/50 p-7 shadow-2xl backdrop-blur-md">
            <p className="text-xs font-bold uppercase tracking-widest text-sand-300">Muito mais que pesca esportiva</p>
            <ul className="mt-4 space-y-3.5 text-sm text-white/95">
              <li className="flex items-center gap-3">
                <Trophy className="size-5 shrink-0 text-sand-300" />
                <span><strong>Enfrentar Gigantes:</strong> Piraíbas de +2m e Pirararas lendárias.</span>
              </li>
              <li className="flex items-center gap-3">
                <Waves className="size-5 shrink-0 text-sand-300" />
                <span><strong>Batalhas Inesquecíveis:</strong> Guias nativos nos poços mais produtivos.</span>
              </li>
              <li className="flex items-center gap-3">
                <Utensils className="size-5 shrink-0 text-sand-300" />
                <span><strong>Gastronomia no Rio:</strong> Sashimi, ceviche e churrasco de praia.</span>
              </li>
              <li className="flex items-center gap-3">
                <Users className="size-5 shrink-0 text-sand-300" />
                <span><strong>Torneio com Troféus:</strong> Premiação de duplas e resenha noturna.</span>
              </li>
            </ul>
            <div className="mt-6 rounded-lg bg-amber-500/20 border border-amber-400/30 p-3 text-center text-xs font-semibold text-sand-200">
              ⚠️ Vagas extremamente limitadas por turma.
            </div>
          </div>
        </div>
      </section>

      {/* EXPEDIÇÕES 2026 */}
      <section id="expedicoes" className="container-page scroll-mt-20 py-14">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">Calendário Oficial 2026</p>
            <h2 className="mt-2 text-3xl font-black leading-tight sm:text-4xl text-brand-900">
              Expedições Confirmadas 2026. Experiências Inesquecíveis.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-600">
              Pescaria de alta performance para fechar o ano com chave de ouro no Rio Araguaia. Escolha sua data e garanta sua vaga.
            </p>
          </div>
          <span className="rounded-full bg-brand-100 px-4 py-1.5 text-xs font-black uppercase tracking-wider text-brand-800">
            Tudo All Inclusive
          </span>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2 max-w-5xl">
          {expeditions.map((item) => {
            const isCasais = item.slug.includes("casais");
            const imageSrc = expeditionImages[item.slug] || "/expeditions/duble-peixes.jpg";

            return (
              <article
                key={item.id}
                className={`flex flex-col overflow-hidden rounded-2xl border transition hover:shadow-xl ${
                  isCasais ? "border-amber-400 bg-amber-50/30" : "border-ink-900/10 bg-white"
                }`}
              >
                <div className="relative h-52">
                  <Image
                    src={imageSrc}
                    alt={item.name}
                    fill
                    sizes="(min-width:1280px) 25vw, (min-width:768px) 50vw, 100vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                  <span className="absolute left-3 top-3 rounded-md bg-white px-2.5 py-1.5 text-xs font-black text-brand-800 shadow">
                    {shortDate.format(new Date(`${item.starts_at}T12:00:00`))} a {shortDate.format(new Date(`${item.ends_at}T12:00:00`))}
                  </span>
                  {isCasais && (
                    <span className="absolute right-3 top-3 flex items-center gap-1 rounded-md bg-amber-500 px-2 py-1 text-[11px] font-black text-white shadow">
                      <Heart className="size-3 fill-white" /> Casais
                    </span>
                  )}
                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    <p className="text-xs font-bold text-sand-300">{item.departure_location}</p>
                    <h3 className="text-lg font-black leading-tight drop-shadow">{item.name}</h3>
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <p className="text-xs text-ink-600 line-clamp-2">{item.summary}</p>

                  <div className="mt-4 space-y-2 border-y border-ink-900/10 py-3 text-xs text-ink-500">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="size-3.5 text-brand-600" /> Destino
                      </span>
                      <strong className="text-ink-900">{item.destination.split(" (")[0]}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Clock className="size-3.5 text-brand-600" /> Duração
                      </span>
                      <strong className="text-ink-900">{item.duration_days} dias de pesca</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Users className="size-3.5 text-brand-600" /> Vagas
                      </span>
                      <strong className="text-brand-700">{item.available_slots} vagas restantes</strong>
                    </div>
                  </div>

                  <div className="mt-4">
                    <span className="text-[11px] text-ink-500">{isCasais ? "Valor por casal:" : "Valor por pessoa:"}</span>
                    <p className="text-2xl font-black text-brand-800">
                      {money.format(item.price_per_person_cents / 100)}
                      {isCasais && <small className="text-xs font-normal text-ink-500"> (R$ 8.400 casal)</small>}
                    </p>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-brand-600">★ Tudo All Inclusive ★</span>
                  </div>

                  <Link
                    href={`/expedicoes/${item.slug}` as never}
                    className="mt-5 block w-full rounded-lg bg-brand-600 py-2.5 text-center text-sm font-bold text-white shadow-sm transition hover:bg-brand-700"
                  >
                    Ver detalhes e reservar
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* PACOTE ALL INCLUSIVE DETALHADO */}
      <section id="estrutura" className="border-y border-ink-900/10 bg-white py-14">
        <div className="container-page">
          <div className="text-center">
            <span className="rounded-full bg-brand-50 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-brand-700">
              Estrutura Completa de Ponta a Ponta
            </span>
            <h2 className="mt-3 text-3xl font-black sm:text-4xl text-brand-900">O que está incluso em todas as expedições</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-ink-600">
              Você não precisa se preocupar com gasolina, iscas, bebidas ou comida. O pacote é 100% All Inclusive.
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[
              [PackageCheck, "Hospedagem Completa", "Pousadas Solar das Águas e Canoa com café, almoço no rio ou kit para o rio, petiscos e jantar."],
              [Fuel, "Combustível & Óleo 100% Inclusos", "Gasolina durante os 4 dias e Óleo para os motores."],
              [Beer, "Open Bar de Cervejas Premium", "Heineken, Original e Stella geladas em abundância nos barcos e na pousada."],
              [Utensils, "Kit Sashimi & Ceviche", "Kit para preparo de ceviche, sashimi e outros petiscos, dentro do barco."],
              [Fish, "Iscas Nativas Inclusas", "Iscas vivas da região, selecionadas para os grandes peixes, de couro e outros."],
              [Users, "Guias Nativos Experientes", "Guias nativos, que conhecem os pontos de pesca da região do nosso Rio Araguaia e outros."],
              [Trophy, "Torneio entre as Duplas", "Competição sadia com troféus para os maiores peixes e banner personalizado."],
              [ShieldCheck, "Seguro Viagem", "Um seguro completo para o cliente, na hora que o cliente sai de casa até a volta."],
            ].map(([Icon, title, desc]) => {
              const ItemIcon = Icon as typeof PackageCheck;
              return (
                <article key={title as string} className="flex gap-4 rounded-xl border border-ink-900/8 bg-gray-50/60 p-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-brand-900 text-white">
                    <ItemIcon className="size-5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-black text-brand-900">{title as string}</h3>
                    <p className="mt-1 text-xs leading-5 text-ink-600">{desc as string}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* CALENDÁRIO 2027 (PRÉ-RESERVA) */}
      <section className="container-page py-14">
        <div className="rounded-3xl border border-brand-900/15 bg-[radial-gradient(ellipse_at_top,#0b5e39_0%,#042618_100%)] p-8 text-white md:p-12">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <span className="rounded-full bg-sand-300/20 px-3.5 py-1 text-xs font-black uppercase tracking-widest text-sand-300">
                Prévia Oficial
              </span>
              <h2 className="mt-3 text-3xl font-black sm:text-4xl">Expedições 2027 — São Félix do Araguaia</h2>
              <p className="mt-2 max-w-xl text-sm text-white/80">
                Todas as expedições de 2027 acontecerão em São Félix do Araguaia — MT. Planeje sua turma com antecedência.
              </p>
            </div>
            <a
              href="https://wa.me/5562981612128?text=Olá!%20Gostaria%20de%20entrar%20na%20lista%20de%20espera%20para%20as%20Expedições%202027."
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-12 items-center justify-center rounded-md bg-sand-400 px-6 font-bold text-brand-900 shadow hover:bg-sand-300"
            >
              <MessageCircle className="mr-2 size-5" /> Lista de Espera 2027
            </a>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {season2027Dates.map((item) => (
              <div
                key={item.date}
                className={`rounded-xl border p-3.5 backdrop-blur-sm ${
                  item.highlight ? "border-amber-400/60 bg-amber-500/20" : "border-white/10 bg-white/5"
                }`}
              >
                <div className="flex items-center justify-between">
                  <strong className="text-sm font-black text-sand-200">{item.date}</strong>
                  <span className="text-[10px] font-bold uppercase text-white/70">{item.days}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-white/80">
                  <span>{item.location}</span>
                  <span className="font-semibold text-sand-300">{item.type}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GALERIA */}
      <section id="galeria" className="bg-brand-950 text-white">
        <div className="container-page py-12">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-sand-300">Galeria de Troféus</p>
              <h2 className="mt-2 text-3xl font-black sm:text-4xl">Histórias reais, peixes gigantes!</h2>
              <p className="mt-2 text-sm text-white/70">Mais de 20 anos registrando as maiores capturas do Rio Araguaia.</p>
            </div>
            <ButtonLink href={"/galeria" as never} variant="outlineLight">
              Ver todos os registros ({gallery.length})
            </ButtonLink>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {gallery.map(([src, alt]) => (
              <div key={src} className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-black/40">
                <Image
                  src={`/ims-pesca/${src}`}
                  alt={alt}
                  fill
                  sizes="(min-width:1024px) 16vw, (min-width:640px) 33vw, 50vw"
                  className="object-cover transition duration-300 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
                <span className="absolute bottom-2 left-2 right-2 text-[11px] font-bold text-white line-clamp-1 opacity-0 transition group-hover:opacity-100">
                  {alt}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
