import { ArrowRight } from "lucide-react";

import { ExpeditionCard } from "@/components/home/expedition-card";
import type { Expedition } from "@/lib/api/expeditions";

export function ExpeditionSection({ expeditions }: { expeditions: Expedition[] }) {
  const featured = expeditions.slice(0, 4);

  return (
    <section id="expedicoes" className="scroll-mt-20 bg-paper py-16 lg:py-20">
      <div className="home-shell">
        <div className="mb-6 flex items-end justify-between gap-4 xl:hidden">
          <div><p className="home-eyebrow text-gold-700">Calendário oficial</p><h2 className="home-display mt-2 text-4xl leading-none sm:text-5xl">Expedições confirmadas.<br />Experiências inesquecíveis.</h2></div>
        </div>
        <div className="home-expedition-grid">
          <div className="hidden xl:block">
            <p className="home-eyebrow text-gold-700">Calendário oficial</p>
            <h2 className="home-display mt-3 text-[clamp(2.2rem,3vw,3.5rem)] leading-[1.02]">Expedições confirmadas.<br />Experiências inesquecíveis.</h2>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-muted">Escolha sua data para viver o Rio Araguaia com toda a estrutura preparada para você.</p>
            <a href="#calendario-2027" className="home-text-link mt-8 inline-flex items-center gap-2">Conheça 2027 <ArrowRight size={16} /></a>
          </div>
          {featured.length ? featured.map((expedition) => <ExpeditionCard key={expedition.id} expedition={expedition} />) : <p className="col-span-full text-sm text-ink-muted">Novas expedições serão anunciadas em breve. Entre em contato para saber mais.</p>}
        </div>
        <p className="mt-3 text-xs text-ink-muted md:hidden">Deslize para ver as próximas expedições →</p>
      </div>
    </section>
  );
}
