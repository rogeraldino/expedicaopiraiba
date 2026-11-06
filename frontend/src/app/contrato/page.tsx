import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import ReactMarkdown from "react-markdown";

export const metadata: Metadata = {
  title: "Contrato de serviço | Expedição Piraíba",
  description: "Condições de reserva, cancelamento e reembolso das expedições.",
};

export default function ContractPage() {
  const content = readFileSync(join(process.cwd(), "public", "contrato-servico-v1.md"), "utf8");
  return <main className="min-h-screen bg-sand-50 px-5 py-12 text-ink-900">
    <div className="mx-auto max-w-3xl">
      <Link href="/" className="text-sm font-bold text-brand-700 hover:underline">← Voltar ao site</Link>
      <article className="mt-6 rounded-2xl bg-white p-6 shadow-sm sm:p-10 [&_h1]:mb-6 [&_h1]:text-3xl [&_h1]:font-black [&_h2]:mb-3 [&_h2]:mt-9 [&_h2]:text-xl [&_h2]:font-black [&_p]:mb-4 [&_p]:leading-7 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mb-2">
        <ReactMarkdown>{content}</ReactMarkdown>
      </article>
    </div>
  </main>;
}
