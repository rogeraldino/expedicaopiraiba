"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

export function ClearDataButton() {
  const [loading, setLoading] = useState(false);

  async function clearData() {
    if (!window.confirm("Limpar clientes, reservas e pagamentos de teste? As expedições serão preservadas.")) return;
    setLoading(true);
    try {
      const response = await fetch(`${api}/operations/dev/clear-data/`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail ?? "Não foi possível limpar os dados.");
      window.alert(`Dados limpos: ${data.cleared.customers} cliente(s), ${data.cleared.reservations} reserva(s) e ${data.cleared.payments} pagamento(s).`);
      window.location.reload();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Não foi possível limpar os dados.");
    } finally {
      setLoading(false);
    }
  }

  return <button type="button" onClick={clearData} disabled={loading} className="hidden min-h-11 items-center gap-2 rounded-md bg-red-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-60 md:inline-flex"><Trash2 className="size-4" />{loading ? "Limpando..." : "Limpar dados"}</button>;
}
