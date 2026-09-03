import Image from "next/image";
import Link from "next/link";

import { ButtonLink } from "@/components/ui/button-link";
import { ClearDataButton } from "@/components/dev/clear-data-button";

const navigation = [
  ["Expedições", "#expedicoes"],
  ["Estrutura", "#estrutura"],
  ["Galeria", "#galeria"],
  ["Depoimentos", "#depoimentos"],
  ["Contato", "#contato"],
] as const;

export function SiteHeader() {
  return (
    <header className="border-b border-ink-900/10 bg-white">
      <div className="container-page flex min-h-16 items-center justify-between gap-5 py-2">
        <Link href="/" aria-label="Expedição Piraíba — início" className="flex items-center gap-3 leading-none text-brand-700">
          <Image src="/brand/logo-expedicao-piraiba.png" alt="" width={58} height={58} className="size-12 rounded-full object-cover sm:size-14" priority />
          <span>
            <strong className="block text-base font-black tracking-wide sm:text-xl">EXPEDIÇÃO PIRAÍBA</strong>
            <span className="mt-1 block text-[8px] font-bold tracking-[0.38em]">PESCA ESPORTIVA</span>
          </span>
        </Link>
        <nav aria-label="Navegação principal" className="hidden items-center gap-7 text-sm font-semibold lg:flex">
          {navigation.map(([label, href]) => <a key={href} href={href} className="transition-colors hover:text-brand-600">{label}</a>)}
        </nav>
        <div className="flex items-center gap-2">
          <ButtonLink href="#contato" variant="whatsapp">Falar no WhatsApp</ButtonLink>
          {process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS === "true" && <ClearDataButton />}
        </div>
      </div>
    </header>
  );
}
