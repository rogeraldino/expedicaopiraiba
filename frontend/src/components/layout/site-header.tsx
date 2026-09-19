"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Compass, Menu, MessageCircle, X } from "lucide-react";

import { ClearDataButton } from "@/components/dev/clear-data-button";
import { CustomerLoginModal } from "@/components/customer/customer-login-modal";

const navigation = [
  ["Expedições", "/#expedicoes"],
  ["Estrutura", "/#estrutura"],
  ["Galeria", "/#galeria"],
  ["Histórias", "/#depoimentos"],
  ["Contato", "/#contato"],
] as const;

export function SiteHeader() {
  const [loginOpen, setLoginOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[#dbc384]/20 bg-[#102b20] text-white shadow-md">
        <div className="container-page flex min-h-16 items-center justify-between gap-2 py-2 sm:gap-4">
          <Link href="/" aria-label="Expedição Piraíba — início" className="flex min-w-0 items-center gap-2 leading-none text-white sm:gap-3">
            <Image src="/home/logo.webp" alt="" width={56} height={56} className="size-10 shrink-0 rounded-full object-cover sm:size-12" priority />
            <span>
              <strong className="block text-[11px] font-black tracking-wide sm:text-lg">EXPEDIÇÃO PIRAÍBA</strong>
              <span className="mt-1 hidden text-[8px] font-bold tracking-[.38em] text-[#efd08a] sm:block">PESCA ESPORTIVA</span>
            </span>
          </Link>
          <nav aria-label="Navegação principal" className="hidden items-center gap-5 text-xs font-bold xl:flex">
            {navigation.map(([label, href]) => <Link key={href} href={href} className="transition-colors hover:text-[#efd08a] focus-visible:text-[#efd08a]">{label}</Link>)}
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={() => setLoginOpen(true)} type="button" aria-label="Abrir minha reserva" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-[#efd08a]/50 px-2 text-xs font-bold text-[#efd08a] transition-colors hover:bg-white/10 sm:px-3">
              <Compass className="size-4" /><span className="hidden lg:inline">Minha Reserva</span>
            </button>
            <a href="https://wa.me/5562981612128?text=Olá!%20Gostaria%20de%20informações%20sobre%20as%20expedições." target="_blank" rel="noreferrer" aria-label="Falar no WhatsApp" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-[#e7cb89] px-2 text-xs font-bold text-white transition-colors hover:bg-white/10 sm:px-3"><MessageCircle size={17} className="text-[#39d76b]" /><span className="hidden lg:inline">Falar no WhatsApp</span></a>
            <button type="button" aria-label={menuOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen(!menuOpen)} className="inline-flex size-10 items-center justify-center rounded-md border border-white/25 xl:hidden">{menuOpen ? <X size={21} /> : <Menu size={21} />}</button>
            {process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS === "true" && <ClearDataButton />}
          </div>
        </div>
        {menuOpen && <nav id="mobile-navigation" aria-label="Navegação móvel" className="container-page grid gap-1 border-t border-white/15 py-3 xl:hidden">{navigation.map(([label, href]) => <Link key={href} href={href} onClick={() => setMenuOpen(false)} className="rounded-md px-3 py-2 text-sm font-semibold hover:bg-white/10">{label}</Link>)}</nav>}
      </header>
      <CustomerLoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}
