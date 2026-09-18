"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, Copy, CreditCard, LockKeyhole, QrCode, Receipt } from "lucide-react";
import Link from "next/link";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
const inputClass =
  "mt-2 h-11 w-full rounded-md border border-ink-900/15 bg-white px-3 text-sm outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100";
type Step = "FORM" | "OTP" | "PIX" | "SUCCESS";

type ExpeditionProp = {
  id: string;
  name: string;
  slug: string;
  destination: string;
  price_per_person_cents: number;
  deposit_cents: number;
  available_slots: number;
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });

function messageFrom(error: unknown) {
  if (!error || typeof error !== "object") return "Não foi possível continuar.";
  return Object.values(error as Record<string, unknown>).flat().join(" ") || "Não foi possível continuar.";
}

export function CheckoutForm({ expedition }: { expedition: ExpeditionProp }) {
  const [step, setStep] = useState<Step>("FORM");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [destination, setDestination] = useState("");
  const [devCode, setDevCode] = useState("");
  const [code, setCode] = useState("");
  const [holdUntil, setHoldUntil] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [reservationId, setReservationId] = useState("");
  const [pixCode, setPixCode] = useState("");
  const [amountDue, setAmountDue] = useState(0);
  const [participantCount, setParticipantCount] = useState(2);
  const [participants, setParticipants] = useState(["", ""]);
  const [identity, setIdentity] = useState({ cpf: "", full_name: "", phone: "", email: "" });
  const [paymentPlan, setPaymentPlan] = useState("DEPOSIT");
  const [terms, setTerms] = useState(false);

  function updateCount(count: number) {
    setParticipantCount(count);
    setParticipants((current) => Array.from({ length: count }, (_, index) => current[index] ?? ""));
  }

  async function requestCode(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!terms) return setError("Aceite os termos e a política de cancelamento para continuar.");
    if (participants.some((name) => !name.trim())) return setError("Informe o nome de todos os participantes.");
    setLoading(true);
    try {
      const cleanIdentity = {
        ...identity,
        cpf: identity.cpf.replace(/\D/g, ""),
        phone: identity.phone.replace(/\D/g, ""),
      };
      const response = await fetch(`${api}/checkout/identify/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanIdentity),
      });
      const data = await response.json();
      if (!response.ok) throw data;
      setChallengeId(data.challenge_id);
      setDestination(data.masked_destination);
      setDevCode(data.dev_code ?? "");
      setStep("OTP");
    } catch (requestError) {
      setError(messageFrom(requestError));
    } finally {
      setLoading(false);
    }
  }

  async function verifyAndHold(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const verificationResponse = await fetch(`${api}/checkout/verify/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge_id: challengeId, code }),
      });
      const verification = await verificationResponse.json();
      if (!verificationResponse.ok) throw verification;

      const holdResponse = await fetch(`${api}/checkout/hold/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verification_token: verification.verification_token,
          expedition_slug: expedition.slug,
          participant_names: participants,
          payment_plan: paymentPlan,
        }),
      });
      const hold = await holdResponse.json();
      if (!holdResponse.ok) throw hold;

      const paymentResponse = await fetch(`${api}/payments/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verification_token: verification.verification_token,
          reservation_id: hold.reservation_id,
        }),
      });
      const payment = await paymentResponse.json();
      if (!paymentResponse.ok) throw payment;

      setVerificationToken(verification.verification_token);
      setPaymentId(payment.payment_id);
      setPixCode(payment.pix_copy_paste);
      setAmountDue(payment.amount_cents);
      setHoldUntil(new Date(hold.held_until).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
      setStep("PIX");
    } catch (requestError) {
      setError(messageFrom(requestError));
    } finally {
      setLoading(false);
    }
  }

  async function simulateConfirmation() {
    setError("");
    setLoading(true);
    try {
      const response = await fetch(`${api}/payments/${paymentId}/simulate-confirmation/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verification_token: verificationToken }),
      });
      const data = await response.json();
      if (!response.ok) throw data;
      sessionStorage.setItem("customer-session-token", data.customer_session_token);
      setReservationId(data.reservation_id);
      setStep("SUCCESS");
    } catch (requestError) {
      setError(messageFrom(requestError));
    } finally {
      setLoading(false);
    }
  }

  const depositTotal = (expedition.deposit_cents * participantCount) / 100;
  const fullTotal = (expedition.price_per_person_cents * participantCount) / 100;

  if (step === "SUCCESS")
    return (
      <div className="rounded-2xl border border-brand-600 bg-brand-50 p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto size-12 text-brand-700" />
        <p className="mt-2 text-xs font-bold uppercase tracking-widest text-brand-600">Pagamento Identificado</p>
        <h2 className="mt-2 text-3xl font-black text-brand-900">Expedição Confirmada!</h2>
        <p className="mt-2 text-sm text-ink-700">
          Recebemos o seu pagamento e suas <strong>{participantCount} vagas</strong> estão 100% garantidas.
        </p>
        <Link
          href={`/expedicoes/${expedition.slug}/confirmacao/${reservationId}` as never}
          className="mt-6 inline-flex min-h-12 items-center justify-center rounded-lg bg-brand-600 px-8 font-bold text-white shadow hover:bg-brand-700"
        >
          Continuar onboarding & escolher bebidas
        </Link>
      </div>
    );

  if (step === "PIX")
    return (
      <div className="rounded-2xl border border-ink-900/10 bg-white p-7 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-brand-50 p-3">
            <QrCode className="size-7 text-brand-700" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-600">PIX Gerado Instantaneamente</p>
            <h2 className="text-2xl font-black text-brand-900">Pague para Confirmar</h2>
          </div>
        </div>
        <p className="mt-5 text-xs text-ink-500">Valor desta cobrança ({paymentPlan === "DEPOSIT" ? "Sinal" : "Integral"}):</p>
        <p className="text-3xl font-black text-brand-700">{money.format(amountDue / 100)}</p>
        <p className="mt-1 text-xs text-ink-500">
          Suas vagas ficam protegidas no sistema até <strong>{holdUntil}</strong>.
        </p>
        <div className="mt-5 rounded-xl bg-sand-50 p-4 border border-sand-200">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-600">PIX Copia e Cola</p>
          <p className="mt-2 break-all font-mono text-xs text-ink-800">{pixCode}</p>
        </div>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(pixCode)}
          className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-brand-600 font-bold text-brand-700 hover:bg-brand-50"
        >
          <Copy className="size-4" /> Copiar código PIX
        </button>
        <button
          type="button"
          onClick={simulateConfirmation}
          disabled={loading}
          className="mt-3 min-h-12 w-full rounded-lg bg-brand-600 font-bold text-white shadow transition hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "Confirmando..." : "Simular pagamento confirmado (PIX)"}
        </button>
        {error && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
        <p className="mt-4 flex items-center justify-center gap-2 text-xs text-ink-500">
          <LockKeyhole className="size-4 text-brand-600" /> Simulador de demonstração — sem cobrança real.
        </p>
      </div>
    );

  if (step === "OTP")
    return (
      <form onSubmit={verifyAndHold} className="rounded-2xl border border-ink-900/10 bg-white p-7 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-600">Confirme seu contato</p>
        <h2 className="mt-2 text-2xl font-black text-brand-900">Digite o código de 6 números</h2>
        <p className="mt-2 text-sm text-ink-500">Enviado para {destination}.</p>
        {devCode && (
          <p className="mt-4 rounded-xl bg-sand-100 p-3.5 text-sm text-brand-900 border border-sand-200">
            <strong>Código de teste:</strong> <code className="font-mono font-black text-base">{devCode}</code>
          </p>
        )}
        <input
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          className="mt-5 h-14 w-full rounded-lg border border-ink-900/15 text-center text-3xl font-black tracking-[.4em] outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          inputMode="numeric"
          autoFocus
        />
        {error && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
        <button
          disabled={loading || code.length !== 6}
          className="mt-5 min-h-12 w-full rounded-lg bg-brand-600 font-bold text-white shadow hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "Verificando..." : "Confirmar código e proteger vagas"}
        </button>
        <button
          type="button"
          onClick={() => setStep("FORM")}
          className="mt-3 w-full text-sm font-bold text-brand-700 hover:underline"
        >
          Voltar e corrigir dados
        </button>
      </form>
    );

  return (
    <form onSubmit={requestCode} className="space-y-5">
      <fieldset className="rounded-2xl border border-ink-900/10 bg-white p-6 shadow-sm">
        <legend className="px-2 font-black text-brand-900">1. Dados do titular da reserva</legend>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          {[
            ["cpf", "CPF", "000.000.000-00"],
            ["full_name", "Nome completo", "Seu nome completo"],
            ["phone", "WhatsApp", "(00) 00000-0000"],
            ["email", "E-mail", "voce@email.com"],
          ].map(([field, label, placeholder]) => (
            <label key={field} className="text-sm font-semibold text-ink-800">
              {label}
              <input
                required
                type={field === "email" ? "email" : "text"}
                value={identity[field as keyof typeof identity]}
                onChange={(event) => setIdentity({ ...identity, [field]: event.target.value })}
                className={inputClass}
                placeholder={placeholder}
              />
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border border-ink-900/10 bg-white p-6 shadow-sm">
        <legend className="px-2 font-black text-brand-900">2. Pescadores / Participantes</legend>
        <label className="block max-w-xs text-sm font-semibold text-ink-800">
          Quantidade de vagas
          <select
            value={participantCount}
            onChange={(event) => updateCount(Number(event.target.value))}
            className={inputClass}
          >
            {[1, 2, 3, 4, 6].map((count) => (
              <option key={count} value={count}>
                {count} pescador{count > 1 ? "es" : ""} ({count} vaga{count > 1 ? "s" : ""})
              </option>
            ))}
          </select>
        </label>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {participants.map((name, index) => (
            <label key={index} className="text-sm font-semibold text-ink-800">
              Nome do participante {index + 1}
              <input
                required
                value={name}
                onChange={(event) =>
                  setParticipants((current) =>
                    current.map((item, itemIndex) => (itemIndex === index ? event.target.value : item))
                  )
                }
                className={inputClass}
                placeholder={`Nome completo do pescador ${index + 1}`}
              />
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border border-ink-900/10 bg-white p-6 shadow-sm">
        <legend className="px-2 font-black text-brand-900">3. Opção de pagamento</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {[
            [
              "DEPOSIT",
              "Sinal da Reserva",
              `Sinal a partir de ${money.format(depositTotal)} (${money.format(expedition.deposit_cents / 100)}/pessoa) — 20% à vista no PIX ou no cartão com acréscimo. Saldo restante parcelado no cartão ou via boleto até a data da viagem.`,
            ],
            [
              "FULL",
              "Pagamento Integral",
              `Pague o valor total de ${money.format(fullTotal)} (${money.format(expedition.price_per_person_cents / 100)}/pessoa) à vista.`,
            ],
          ].map(([value, title, copy]) => (
            <label
              key={value}
              className={`cursor-pointer rounded-xl border p-4 transition ${
                paymentPlan === value ? "border-brand-600 bg-brand-50/70 shadow-sm" : "border-ink-900/15 bg-white"
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="payment-plan"
                  value={value}
                  checked={paymentPlan === value}
                  onChange={() => setPaymentPlan(value)}
                  className="accent-brand-600"
                />
                <strong className="text-brand-900">{title}</strong>
              </div>
              <span className="mt-2 block pl-5 text-xs text-ink-600 leading-relaxed">{copy}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border border-ink-900/10 bg-white p-6 shadow-sm">
        <legend className="px-2 font-black text-brand-900">4. Método de pagamento</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-3 rounded-xl border-2 border-brand-600 bg-brand-50 p-4">
            <input type="radio" defaultChecked className="accent-brand-600" />
            <QrCode className="size-6 text-brand-700" />
            <div>
              <strong className="text-brand-900">PIX Instantâneo</strong>
              <small className="block text-xs text-brand-700">Liberação imediata da reserva</small>
            </div>
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-ink-900/15 p-4 opacity-50">
            <input type="radio" disabled />
            <CreditCard className="size-6 text-ink-500" />
            <div>
              <strong>Cartão de Crédito</strong>
              <small className="block text-xs text-ink-500">Em até 10x com acréscimo (sob consulta / em breve)</small>
            </div>
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-ink-900/15 p-4 opacity-50">
            <input type="radio" disabled />
            <Receipt className="size-6 text-ink-500" />
            <div>
              <strong>Boleto Bancário</strong>
              <small className="block text-xs text-ink-500">Parcelamento programado sem juros até a data da viagem</small>
            </div>
          </label>
        </div>
      </fieldset>

      <label className="flex items-start gap-2.5 rounded-2xl border border-ink-900/10 bg-white p-5 text-xs text-ink-700 shadow-sm">
        <input
          className="mt-0.5 accent-brand-600"
          type="checkbox"
          checked={terms}
          onChange={(event) => setTerms(event.target.checked)}
        />
        <span>
          Li e concordo com os <strong>Termos da Expedição</strong>, normas de segurança do barco e a{" "}
          <strong>Política de Cancelamento</strong>.
        </span>
      </label>

      {error && <p className="rounded-lg bg-red-50 p-3.5 text-sm font-semibold text-red-700">{error}</p>}

      <button
        disabled={loading}
        className="min-h-12 w-full rounded-xl bg-brand-600 px-6 font-black text-white shadow-md transition hover:bg-brand-700 disabled:opacity-50"
      >
        {loading ? "Enviando código de verificação..." : `Confirmar dados e pagar ${paymentPlan === "DEPOSIT" ? money.format(depositTotal) : money.format(fullTotal)}`}
      </button>

      <p className="flex items-center justify-center gap-2 text-xs text-ink-500">
        <LockKeyhole className="size-4 text-brand-600" /> Seus dados estão seguros e o processo é 100% protegido.
      </p>
    </form>
  );
}
