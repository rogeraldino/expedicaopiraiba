import type { Metadata } from "next";

import { AdminPanel } from "./admin-panel";

export const metadata: Metadata = { title: "Painel administrativo — Expedição Piraíba" };

export default function AdminPage() {
  return <AdminPanel />;
}
