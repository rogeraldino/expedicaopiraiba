import { ArrowRight, MessageCircle } from "lucide-react";

import { season2027Dates } from "@/lib/home-content";

export function Season2027() {
  return (
    <section id="calendario-2027" className="scroll-mt-20 bg-[#eae8dc] py-14" aria-labelledby="season-title">
      <div className="home-shell">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div><p className="home-eyebrow text-gold-700">Planeje sua próxima aventura</p><h2 id="season-title" className="home-display mt-2 text-3xl md:text-4xl">Temporada 2027</h2><p className="mt-2 text-sm text-ink-muted">Datas previstas para São Félix do Araguaia · MT.</p></div>
          <a href="https://wa.me/5562981612128?text=Olá!%20Gostaria%20de%20informações%20sobre%20a%20temporada%202027." target="_blank" rel="noreferrer" className="home-button home-button-green"><MessageCircle size={17} /> Falar sobre 2027 <ArrowRight size={16} /></a>
        </div>
        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {season2027Dates.map((item) => <div key={item.date} className="rounded-md border border-river-900/15 bg-white/75 p-4"><p className="text-sm font-bold text-river-900">{item.date}</p><p className="mt-1 text-xs text-ink-muted">{item.days} · {item.type}</p></div>)}
        </div>
      </div>
    </section>
  );
}
