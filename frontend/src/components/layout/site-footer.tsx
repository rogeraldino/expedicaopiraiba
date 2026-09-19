import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Camera, MapPin, MessageCircle } from "lucide-react";

export function SiteFooter() {
  return (
    <footer id="contato" className="scroll-mt-20 bg-[#0b241b] text-white">
      <div className="home-shell grid gap-10 py-12 md:grid-cols-[1.35fr_1fr_1fr]">
        <div>
          <Link href="/" className="inline-flex items-center gap-3">
            <Image src="/home/logo.webp" alt="" width={56} height={56} className="size-12 rounded-full object-cover" />
            <span><strong className="block text-sm font-black tracking-wide">EXPEDIÇÃO PIRAÍBA</strong><span className="text-[9px] font-bold uppercase tracking-[.25em] text-[#e4c57b]">Pesca esportiva</span></span>
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/70">Mais que pesca esportiva. Conexões para a vida toda no Rio Araguaia.</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.22em] text-[#e4c57b]">Explore</p>
          <nav aria-label="Navegação do rodapé" className="mt-4 grid gap-2 text-sm text-white/80"><Link href="/#expedicoes" className="hover:text-white">Expedições</Link><Link href="/#estrutura" className="hover:text-white">Estrutura</Link><Link href="/galeria" className="hover:text-white">Galeria</Link><Link href="/#depoimentos" className="hover:text-white">Histórias</Link></nav>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.22em] text-[#e4c57b]">Contato e reservas</p>
          <div className="mt-4 space-y-3 text-sm">
            <a href="https://wa.me/5562981612128?text=Olá!%20Gostaria%20de%20informações%20sobre%20as%20expedições." target="_blank" rel="noreferrer" className="flex items-center gap-2 text-white/85 hover:text-white"><MessageCircle size={17} className="text-[#39d76b]" /> (62) 9 8161-2128 <ArrowUpRight size={13} /></a>
            <a href="https://instagram.com/expedicaopiraiba" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-white/85 hover:text-white"><Camera size={17} /> @expedicaopiraiba <ArrowUpRight size={13} /></a>
            <p className="flex items-start gap-2 text-white/60"><MapPin size={17} className="mt-0.5 shrink-0" /> Rio Araguaia · Goiás e Mato Grosso</p>
          </div>
        </div>
      </div>
      <div className="border-t border-white/15"><div className="home-shell flex flex-wrap justify-between gap-2 py-5 text-xs text-white/50"><span>© {new Date().getFullYear()} Expedição Piraíba. Todos os direitos reservados.</span><span>Natureza · Pessoas · Histórias sem limites</span></div></div>
    </footer>
  );
}
