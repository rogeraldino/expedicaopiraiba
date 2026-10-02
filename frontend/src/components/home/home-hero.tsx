import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, MessageCircle } from "lucide-react";
import type { Expedition } from "@/lib/api/expeditions";
import { selectNextExpedition } from "@/lib/api/next-expedition";

const price = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });

export function HomeHero({ expeditions }: { expeditions: Expedition[] }) {
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const next = selectNextExpedition(expeditions, today);
  return (
    <section className="home-hero relative isolate overflow-hidden bg-river-950 text-white" aria-labelledby="home-title">
      <picture className="absolute inset-0">
        <source media="(max-width: 640px)" srcSet="/home/hero-mobile.webp" type="image/webp" />
        <Image src="/home/hero-desktop.webp" alt="Pescadores no Rio Araguaia ao pôr do sol" fill priority sizes="100vw" className="object-cover object-center" />
      </picture>
      <div className="home-hero-shade absolute inset-0" />
      <div className="home-shell relative grid min-h-[580px] items-center gap-10 py-16 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-16 lg:py-24">
        <div className="max-w-[710px]">
          <p className="home-eyebrow text-gold-300">Temporada oficial 2026 · 2027</p>
          <h1 id="home-title" className="home-display mt-4 text-[clamp(3.65rem,7.2vw,7.2rem)] leading-[.84] tracking-[-.05em]">
            O Rio Araguaia <span className="block text-gold-200">está chamando.</span>
          </h1>
          <p className="mt-7 max-w-[560px] text-[15px] leading-relaxed text-white/90 sm:text-lg">
            Há mais de 20 anos proporcionando o que existe de melhor na pesca esportiva de gigantes. Barco, guias nativos, combustível livre, comida típica no rio e estrutura completa. <strong className="text-white">Experiência completa no Araguaia.</strong>
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#expedicoes" className="home-button home-button-gold"><CalendarDays size={18} /> Ver expedições <ArrowRight size={17} /></a>
            <a href="https://wa.me/5562981612128?text=Olá!%20Gostaria%20de%20informações%20sobre%20as%20expedições." target="_blank" rel="noreferrer" className="home-button home-button-outline"><MessageCircle size={18} /> Falar no WhatsApp</a>
          </div>
        </div>
        <aside className="home-hero-panel rounded-xl border border-gold-300/40 bg-river-950/85 p-6 shadow-2xl backdrop-blur-md">
          <p className="home-eyebrow text-gold-200">Próxima expedição</p>
          {next ? <>
            {next.cover_image_url && <img src={next.cover_image_url} alt="Capa da próxima expedição" className="mt-5 aspect-video w-full rounded-lg object-cover" />}
            <h2 className="mt-5 text-2xl font-black leading-tight">{next.name}</h2>
            <p className="mt-3 text-sm text-white/80">{date.format(new Date(`${next.starts_at}T00:00:00Z`))} a {date.format(new Date(`${next.ends_at}T00:00:00Z`))} · {next.destination}</p>
            <p className="mt-4 text-lg font-bold text-gold-200">{price.format(next.price_per_person_cents / 100)} <span className="text-xs font-normal text-white/70">por pessoa</span></p>
            <p className="mt-1 text-xs text-white/70">{next.available_slots} vaga{next.available_slots === 1 ? "" : "s"} disponível{next.available_slots === 1 ? "" : "is"}</p>
            <Link href={`/expedicoes/${next.slug}/checkout`} className="home-button home-button-gold mt-5 w-full justify-center">Reservar minha vaga <ArrowRight size={16} /></Link>
          </> : <p className="mt-5 text-sm text-white/80">Novas datas serão anunciadas em breve.</p>}
        </aside>
      </div>
      <div className="pointer-events-none absolute bottom-5 left-5 hidden items-center gap-3 text-[10px] font-bold uppercase tracking-[.28em] text-white/65 xl:flex"><span className="h-px w-6 bg-gold-300" /> Gigantes existem aqui</div>
    </section>
  );
}
