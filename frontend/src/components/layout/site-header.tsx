"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Compass } from "lucide-react";

import { ButtonLink } from "@/components/ui/button-link";
import { ClearDataButton } from "@/components/dev/clear-data-button";
import { CustomerLoginModal } from "@/components/customer/customer-login-modal";

const navigation = [
  ["Expedições", "#expedicoes"],
  ["Estrutura", "#estrutura"],
  ["Galeria", "#galeria"],
  ["Depoimentos", "#depoimentos"],
  ["Contato", "#contato"],
] as const;

export function SiteHeader() {
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <>
      <header className="border-b border-ink-900/10 bg-white sticky top-0 z-40">
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
            <button
              onClick={() => setLoginOpen(true)}
              type="button"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-brand-600/30 bg-brand-50 px-4 py-2.5 text-xs font-bold text-brand-800 hover:bg-brand-100 hover:text-brand-900 transition-colors"
            >
              <Compass className="size-4 text-brand-700" />
              <span>Minha Reserva</span>
            </button>
            <ButtonLink href="#contato" variant="whatsapp">Falar no WhatsApp</ButtonLink>
            {process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS === "true" && <ClearDataButton />}
          </div>
        </div>
      </header>

      <CustomerLoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}
