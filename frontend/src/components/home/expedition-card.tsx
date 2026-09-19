import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, Users } from "lucide-react";

import { type Expedition, expeditionImages, money, shortDate } from "@/lib/api/expeditions";

export function ExpeditionCard({ expedition }: { expedition: Expedition }) {
  const imageSrc = expedition.cover_image_url || expeditionImages[expedition.slug] || "/home/hero-desktop.webp";
  const start = new Date(`${expedition.starts_at}T12:00:00`);
  const end = new Date(`${expedition.ends_at}T12:00:00`);
  const soldOut = expedition.available_slots === 0;

  return (
    <article className="home-card flex h-full flex-col overflow-hidden rounded-lg border border-river-900/10 bg-white shadow-card">
      <Link href={`/expedicoes/${expedition.slug}` as never} className="group relative block h-40 overflow-hidden bg-river-100" aria-label={`Ver ${expedition.name}`}>
        <Image src={imageSrc} alt="" fill unoptimized={imageSrc.startsWith("http")} sizes="(min-width:1280px) 210px, (min-width:640px) 45vw, 78vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <p className="home-eyebrow text-[9px] text-gold-700">{shortDate.format(start)} a {shortDate.format(end)} · {start.getFullYear()}</p>
        <h3 className="mt-2 min-h-11 text-[15px] font-bold leading-tight text-ink">{expedition.name}</h3>
        <p className="mt-1 truncate text-xs text-ink-muted">{expedition.lodge?.name || expedition.destination}</p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-4">
          <div className="space-y-1.5 text-[11px] text-ink-muted">
            <p className="flex items-center gap-1"><CalendarDays size={13} className="text-gold-600" /> {expedition.duration_days} dias <Users size={13} className="ml-2 text-gold-600" /> {soldOut ? "Esgotada" : `${expedition.available_slots} vagas`}</p>
            <p className="font-bold text-river-900">{money.format(expedition.price_per_person_cents / 100)} <span className="font-normal text-ink-muted">/ pessoa</span></p>
          </div>
          <Link href={`/expedicoes/${expedition.slug}` as never} aria-label={`Ver detalhes de ${expedition.name}`} className="grid size-9 shrink-0 place-items-center rounded-full bg-river-900 text-white transition-colors hover:bg-river-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-600"><ArrowUpRight size={17} /></Link>
        </div>
      </div>
    </article>
  );
}
