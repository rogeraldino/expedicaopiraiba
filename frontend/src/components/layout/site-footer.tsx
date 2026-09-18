import Image from "next/image";
import { MapPin, MessageCircle } from "lucide-react";

export function SiteFooter() {
  return (
    <footer id="contato" className="bg-brand-900 text-white">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="flex items-start gap-4">
          <Image
            src="/brand/logo-expedicao-piraiba.png"
            alt="Expedição Piraíba"
            width={72}
            height={72}
            className="size-16 rounded-full object-cover"
          />
          <div>
            <p className="text-xl font-black">EXPEDIÇÃO PIRAÍBA</p>
            <p className="mt-2 text-xs font-bold uppercase tracking-wider text-sand-300">Há mais de 20 anos no Rio Araguaia</p>
            <p className="mt-3 max-w-sm text-sm leading-6 text-white/70">
              Experiência, estrutura All Inclusive de ponta e paixão pela pesca esportiva de gigantes em cada detalhe.
            </p>
          </div>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-sand-300">Destinos de Pesca</p>
          <div className="mt-4 space-y-2 text-sm text-white/80">
            <p className="flex items-center gap-2">
              <MapPin className="size-4 text-sand-300" />
              <strong>São Félix do Araguaia — MT</strong> (Solar das Águas)
            </p>
            <p className="flex items-center gap-2">
              <MapPin className="size-4 text-sand-300" />
              <strong>Bandeirantes — GO</strong> (Pousada Canoa)
            </p>
            <p className="pt-2 text-xs text-white/60">Pesca Esportiva & Pescaria de Casais</p>
          </div>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-sand-300">Contato & Reservas</p>
          <div className="mt-4 space-y-3 text-sm">
            <a
              href="https://wa.me/5562981612128?text=Olá!%20Gostaria%20de%20informações%20sobre%20as%20expedições%20de%20pesca."
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-white/90 transition hover:text-[#25D366]"
            >
              <MessageCircle className="size-4 text-[#25D366]" />
              <strong>WhatsApp: (62) 9 8161-2128</strong>
            </a>
            <a
              href="https://instagram.com/expedicaopiraiba"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-white/90 transition hover:text-pink-400"
            >
              <svg className="size-4 fill-current text-pink-400" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
              <strong>Instagram: @expedicaopiraiba</strong>
            </a>
            <p className="text-xs text-white/60">Atendimento das 08h às 20h para dúvidas e reservas.</p>
          </div>
        </div>
      </div>

      <div className="border-t border-white/15">
        <div className="container-page flex flex-col justify-between gap-2 py-5 text-xs text-white/55 sm:flex-row">
          <span>© 2026 Expedição Piraíba — Todos os direitos reservados.</span>
          <span>Pesca Esportiva • Preservação • Amizade • Respeito</span>
        </div>
      </div>
    </footer>
  );
}
