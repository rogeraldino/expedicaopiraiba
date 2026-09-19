import Image from "next/image";
import { ArrowRight, BedDouble, Fuel, ShieldCheck, Ship, Users, UtensilsCrossed } from "lucide-react";

const amenities = [
  { icon: Ship, title: "Barcos equipados" },
  { icon: Users, title: "Guias nativos" },
  { icon: UtensilsCrossed, title: "Gastronomia" },
  { icon: Fuel, title: "Combustível incluso" },
  { icon: ShieldCheck, title: "Suporte na viagem" },
  { icon: BedDouble, title: "Hospedagem confortável" },
];

export function ExperienceSection() {
  return (
    <section id="estrutura" className="relative isolate scroll-mt-20 overflow-hidden bg-river-950 text-white" aria-labelledby="experience-title">
      <Image src="/home/river-sunset.webp" alt="Pôr do sol no Rio Araguaia" fill sizes="100vw" className="object-cover object-center opacity-55" />
      <div className="absolute inset-0 bg-gradient-to-r from-river-950 via-river-950/95 to-river-950/25" />
      <div className="home-shell relative grid gap-8 py-14 lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:py-16">
        <div>
          <p className="home-eyebrow text-gold-300">All Inclusive</p>
          <h2 id="experience-title" className="home-display mt-2 text-4xl leading-tight md:text-5xl">Estrutura da experiência</h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/85">Conforto, segurança e toda a infraestrutura para você focar no que realmente importa: pescar, relaxar e viver o Araguaia.</p>
          <a href="#galeria" className="home-button home-button-outline mt-6 inline-flex">Veja a experiência <ArrowRight size={16} /></a>
        </div>
        <div className="grid grid-cols-2 gap-x-5 gap-y-6 border-l border-white/20 pl-6 sm:grid-cols-3 lg:pl-9">
          {amenities.map(({ icon: Icon, title }) => (
            <div key={title}><Icon aria-hidden="true" className="size-7 text-gold-300" strokeWidth={1.5} /><p className="mt-2 max-w-28 text-xs font-semibold leading-snug">{title}</p></div>
          ))}
        </div>
      </div>
    </section>
  );
}
