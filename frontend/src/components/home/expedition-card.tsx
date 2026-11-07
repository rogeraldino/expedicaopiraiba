import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, MapPin, Users } from "lucide-react";

import { type Expedition, expeditionImages, money, shortDate } from "@/lib/api/expeditions";

export function ExpeditionCard({ expedition }: { expedition: Expedition }) {
  const imageSrc = expedition.cover_image_url || expeditionImages[expedition.slug] || "/home/hero-desktop.webp";
  const start = new Date(`${expedition.starts_at}T12:00:00`);
  const end = new Date(`${expedition.ends_at}T12:00:00`);
  const soldOut = expedition.available_slots === 0;
  const isTest = expedition.slug.startsWith("teste-de-compra-");

  return (
    <article className="home-card flex h-full flex-col overflow-hidden rounded-xl border border-river-900/10 bg-white shadow-card">
      <Link href={`/expedicoes/${expedition.slug}` as never} className="group relative block h-52 overflow-hidden bg-river-100" aria-label={`Ver ${expedition.name}`}>
        <Image src={imageSrc} alt="" fill unoptimized={imageSrc.startsWith("http") || imageSrc.startsWith("/api/media/")} sizes="(min-width:1280px) 290px, (min-width:640px) 45vw, 85vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
        <span className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-river-950/85 to-transparent" />
        <span className="absolute bottom-4 left-4 text-sm font-black text-white">{shortDate.format(start)} a {shortDate.format(end)} · {start.getFullYear()}</span>
        <span className="absolute left-4 top-4 rounded-full bg-gold-300 px-3 py-1 text-xs font-black uppercase tracking-wide text-river-950">{isTest ? "Compra de teste" : soldOut ? "Vagas esgotadas" : "Expedição aberta"}</span>
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="min-h-12 text-lg font-black leading-tight text-ink">{expedition.name}</h3>
        <p className="mt-2 flex items-start gap-1.5 text-sm text-ink-muted"><MapPin size={16} className="mt-0.5 shrink-0 text-gold-600" />{expedition.lodge?.name || expedition.destination}</p>
        <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold text-ink-muted"><span className="flex items-center gap-1.5"><CalendarDays size={16} className="text-gold-600" />{expedition.duration_days} dias</span><span className="flex items-center gap-1.5"><Users size={16} className="text-gold-600" />{soldOut ? "Esgotada" : `${expedition.available_slots} vagas`}</span></p>
        <div className="mt-auto border-t border-river-900/10 pt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Pagamento integral no Pix · por pessoa</p>
          <p className="mt-1 text-[clamp(1.45rem,2vw,1.8rem)] font-black leading-none text-river-900">{expedition.pix_full_price_cents != null ? money.format(expedition.pix_full_price_cents / 100) : "Consulte o valor final"}</p>
          <Link href={`/expedicoes/${expedition.slug}` as never} className="mt-4 flex min-h-11 items-center justify-between rounded-lg bg-river-900 px-4 text-sm font-black text-white transition-colors hover:bg-river-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-600">{isTest ? "Ver compra de teste" : soldOut ? "Ver detalhes" : "Ver oferta e reservar"} <ArrowUpRight size={18} /></Link>
        </div>
      </div>
    </article>
  );
}
