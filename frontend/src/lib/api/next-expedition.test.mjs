import assert from "node:assert/strict";
import test from "node:test";

import { selectNextExpedition } from "./next-expedition.ts";

const item = (slug, starts_at, available_slots) => ({ slug, starts_at, available_slots });

test("mostra a próxima data futura com vagas e desempata por slug", () => {
  const selected = selectNextExpedition([
    item("passada", "2026-10-01", 12),
    item("esgotada", "2026-10-05", 0),
    item("zeta", "2026-10-28", 12),
    item("alfa", "2026-10-28", 1),
    item("posterior", "2027-01-10", 12),
  ], "2026-10-02");
  assert.equal(selected?.slug, "alfa");
});

test("sem dados da API ou vagas elegíveis não oferece reserva", () => {
  assert.equal(selectNextExpedition([], "2026-10-02"), undefined);
  assert.equal(selectNextExpedition([item("esgotada", "2026-10-28", 0)], "2026-10-02"), undefined);
});
