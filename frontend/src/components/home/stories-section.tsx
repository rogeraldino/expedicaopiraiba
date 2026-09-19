import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function StoriesSection() {
  return (
    <section id="depoimentos" className="home-shell grid scroll-mt-20 gap-8 py-16 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:py-20" aria-labelledby="stories-title">
      <div className="relative min-h-64 overflow-hidden rounded-lg bg-river-100 sm:min-h-80">
        <Image src="/home/group.webp" alt="Grupo de participantes reunido após uma expedição de pesca" fill sizes="(min-width:1024px) 50vw, 100vw" className="object-cover object-center" />
      </div>
      <div className="lg:pl-6">
        <p className="home-eyebrow text-gold-700">Histórias do Araguaia</p>
        <h2 id="stories-title" className="home-display mt-2 text-4xl leading-[1.02] md:text-5xl">Momentos que ficam para sempre.</h2>
        <p className="mt-4 max-w-lg text-sm leading-relaxed text-ink-muted">Peixes gigantes, grandes amizades e encontros à beira do rio. As imagens mostram um pouco do que cada expedição pode proporcionar.</p>
        <Link href="/galeria" className="home-button home-button-green mt-6 inline-flex">Veja os registros <ArrowRight size={16} /></Link>
      </div>
    </section>
  );
}
