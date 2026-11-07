"use client";

import { useEffect, useRef, useState } from "react";

type CardData = { token: string; paymentMethodId: string; issuerId?: string; installments: string; amount: string };
type CardForm = { getCardFormData: () => CardData };
type MercadoPagoClient = { cardForm: (options: unknown) => CardForm };
type MercadoPagoWindow = Window & { MercadoPago?: new (key: string) => MercadoPagoClient };

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
let sdkPromise: Promise<void> | undefined;

function loadSdk(): Promise<void> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<void>((resolve, reject) => {
    const current = window as MercadoPagoWindow;
    if (current.MercadoPago) return resolve();
    const script = document.createElement("script");
    script.src = "https://sdk.mercadopago.com/js/v2";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Não foi possível carregar o formulário seguro de cartão."));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    sdkPromise = undefined;
    throw error;
  });
  return sdkPromise;
}

export function CardFields({ amount, email, cpf, onToken, onReadyChange, onBinChange }: {
  amount: number;
  email: string;
  cpf: string;
  onToken: (data: CardData) => void;
  onReadyChange: (ready: boolean) => void;
  onBinChange?: (bin: string) => void;
}) {
  const callback = useRef(onToken);
  const readyCallback = useRef(onReadyChange);
  const binCallback = useRef(onBinChange);
  const [error, setError] = useState("");

  useEffect(() => {
    callback.current = onToken;
    readyCallback.current = onReadyChange;
    binCallback.current = onBinChange;
  }, [onToken, onReadyChange, onBinChange]);

  useEffect(() => {
    let active = true;
    readyCallback.current(false);
    (async () => {
      const response = await fetch(`${api}/payments/config/`, { cache: "no-store" });
      if (!response.ok) throw new Error("Cartão indisponível no momento.");
      const config = await response.json() as { mercadopago_public_key?: string };
      if (!config.mercadopago_public_key) throw new Error("Cartão indisponível no momento.");
      await loadSdk();
      if (!active) return;
      const MercadoPago = (window as MercadoPagoWindow).MercadoPago;
      if (!MercadoPago) throw new Error("Não foi possível iniciar o formulário seguro de cartão.");
      const mp = new MercadoPago(config.mercadopago_public_key);
      const cardForm = mp.cardForm({
        amount: amount.toFixed(2),
        iframe: true,
        form: {
          id: "payment-checkout-form",
          cardNumber: { id: "mp-card-number", placeholder: "Número do cartão" },
          expirationDate: { id: "mp-card-expiration", placeholder: "MM/AA" },
          securityCode: { id: "mp-card-security", placeholder: "CVV" },
          cardholderName: { id: "mp-cardholder-name", placeholder: "Nome no cartão" },
          issuer: { id: "mp-issuer", placeholder: "Banco emissor" },
          installments: { id: "mp-installments", placeholder: "Parcelas" },
          identificationType: { id: "mp-identification-type", placeholder: "Documento" },
          identificationNumber: { id: "mp-identification-number", placeholder: "CPF" },
          cardholderEmail: { id: "mp-cardholder-email", placeholder: "E-mail" },
        },
        callbacks: {
          onFormMounted: (mountError: unknown) => {
            if (!active) return;
            if (mountError) setError("Não foi possível carregar os campos do cartão.");
            else readyCallback.current(true);
          },
          onSubmit: (event: Event) => {
            event.preventDefault();
            if (active) callback.current(cardForm.getCardFormData());
          },
          onBinChange: (bin: string) => {
            if (active) binCallback.current?.(/^\d{6,8}$/.test(bin) ? bin : "");
          },
        },
      });
    })().catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "Cartão indisponível no momento.");
    });
    return () => { active = false; readyCallback.current(false); };
  }, [amount]);

  return <div className="mt-5 rounded-xl border border-brand-200 bg-brand-50/50 p-5">
    <strong className="text-sm text-brand-950">Dados do cartão de crédito</strong>
    <p className="mt-1 text-xs text-ink-600">Os dados do cartão são recebidos diretamente pelo Mercado Pago.</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-semibold sm:col-span-2">Número do cartão<div id="mp-card-number" className="mt-2 h-11 rounded-md border bg-white px-3" /></label>
      <label className="text-xs font-semibold">Validade<div id="mp-card-expiration" className="mt-2 h-11 rounded-md border bg-white px-3" /></label>
      <label className="text-xs font-semibold">Código de segurança<div id="mp-card-security" className="mt-2 h-11 rounded-md border bg-white px-3" /></label>
      <label className="text-xs font-semibold sm:col-span-2">Nome no cartão<input id="mp-cardholder-name" required className="mt-2 h-11 w-full rounded-md border bg-white px-3" /></label>
      <label className="text-xs font-semibold">Banco emissor<select id="mp-issuer" className="mt-2 h-11 w-full rounded-md border bg-white px-3" /></label>
      <label className="text-xs font-semibold">Parcelas<select id="mp-installments" className="mt-2 h-11 w-full rounded-md border bg-white px-3" /></label>
      <label className="text-xs font-semibold">Documento<select id="mp-identification-type" className="mt-2 h-11 w-full rounded-md border bg-white px-3" /></label>
      <label className="text-xs font-semibold">CPF<input id="mp-identification-number" defaultValue={cpf} required className="mt-2 h-11 w-full rounded-md border bg-white px-3" /></label>
      <label className="text-xs font-semibold sm:col-span-2">E-mail<input id="mp-cardholder-email" type="email" defaultValue={email} required className="mt-2 h-11 w-full rounded-md border bg-white px-3" /></label>
    </div>
    {error && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
  </div>;
}
