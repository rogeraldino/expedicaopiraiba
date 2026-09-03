import Link from "next/link";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ConfirmationOnboarding } from "./confirmation-onboarding";

export default async function ConfirmationPage({ params }: { params: Promise<{ slug: string; reservationId: string }> }) {
  const { slug, reservationId } = await params;
  return <main className="min-h-screen bg-background text-ink-900"><SiteHeader /><div className="container-page py-5 text-sm text-ink-500"><Link href="/">Início</Link><span className="px-2">›</span><Link href={`/expedicoes/${slug}` as never}>Expedição</Link><span className="px-2">›</span>Confirmação</div><ConfirmationOnboarding reservationId={reservationId} /><SiteFooter /></main>;
}
