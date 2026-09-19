import Image from "next/image";
import { ArrowRight, CalendarDays, Fish, MessageCircle, Trophy, Users, UtensilsCrossed } from "lucide-react";

const highlights = [
  { icon: Fish, title: "Enfrentar gigantes", detail: "Piraíbas e pirararas do Araguaia." },
  { icon: Trophy, title: "Batalhas inesquecíveis", detail: "Pesca esportiva com guias nativos." },
  { icon: UtensilsCrossed, title: "Gastronomia no rio", detail: "Sabores que fazem parte da viagem." },
  { icon: Users, title: "Histórias para compartilhar", detail: "Amizades e momentos para guardar." },
];

export function HomeHero() {
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
            Há mais de 20 anos proporcionando o que existe de melhor na pesca esportiva de gigantes. Barco, guias nativos, combustível, gastronomia e estrutura. <strong className="text-white">Tudo All Inclusive.</strong>
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#expedicoes" className="home-button home-button-gold"><CalendarDays size={18} /> Ver expedições <ArrowRight size={17} /></a>
            <a href="https://wa.me/5562981612128?text=Olá!%20Gostaria%20de%20informações%20sobre%20as%20expedições." target="_blank" rel="noreferrer" className="home-button home-button-outline"><MessageCircle size={18} /> Falar no WhatsApp</a>
          </div>
        </div>
        <aside className="home-hero-panel rounded-xl border border-gold-300/40 bg-river-950/85 p-6 shadow-2xl backdrop-blur-md">
          <p className="home-eyebrow text-gold-200">Muito mais que pesca esportiva</p>
          <ul className="mt-6 space-y-5">
            {highlights.map(({ icon: Icon, title, detail }) => (
              <li key={title} className="flex gap-4">
                <Icon aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-gold-300" strokeWidth={1.5} />
                <span><strong className="block text-sm">{title}</strong><span className="mt-0.5 block text-xs leading-relaxed text-white/70">{detail}</span></span>
              </li>
            ))}
          </ul>
          <p className="mt-6 rounded-md border border-gold-300/55 px-4 py-3 text-center text-xs font-semibold text-gold-200">Consulte as vagas disponíveis em cada expedição</p>
        </aside>
      </div>
      <div className="pointer-events-none absolute bottom-5 left-5 hidden items-center gap-3 text-[10px] font-bold uppercase tracking-[.28em] text-white/65 xl:flex"><span className="h-px w-6 bg-gold-300" /> Gigantes existem aqui</div>
    </section>
  );
}
