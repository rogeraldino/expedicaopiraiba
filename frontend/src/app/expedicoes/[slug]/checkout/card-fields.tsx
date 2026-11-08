"use client";

import { useEffect, useRef, useState } from "react";

type CardData = { token: string; paymentMethodId: string; issuerId?: string; installments: string; amount: string };
type CardForm = { getCardFormData: () => CardData; unmount: () => void };
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

export function CardFields({ amount, email, cpf, cardBin, onToken, onReadyChange, onBinChange, onInstallmentsChange, onIssuerChange }: {
  amount: number;
  email: string;
  cpf: string;
  cardBin: string;
  onToken: (data: CardData) => void;
  onReadyChange: (ready: boolean) => void;
  onBinChange?: (bin: string) => void;
  onInstallmentsChange: (installments: number | null) => void;
  onIssuerChange: (issuerId: string) => void;
}) {
  const callback = useRef(onToken);
  const readyCallback = useRef(onReadyChange);
  const binCallback = useRef(onBinChange);
  const installmentsCallback = useRef(onInstallmentsChange);
  const issuerCallback = useRef(onIssuerChange);
  const [error, setError] = useState("");
  const [issuerRequired, setIssuerRequired] = useState(false);
  const [installmentsMissing, setInstallmentsMissing] = useState(false);

  useEffect(() => {
    if (!cardBin) return;
    const timer = window.setTimeout(() => {
      const select = document.getElementById("mp-installments") as HTMLSelectElement | null;
      setInstallmentsMissing(!select || !Array.from(select.options).some((option) => /^([1-9]|10)$/.test(option.value)));
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [cardBin]);

  useEffect(() => {
    callback.current = onToken;
    readyCallback.current = onReadyChange;
    binCallback.current = onBinChange;
    installmentsCallback.current = onInstallmentsChange;
    issuerCallback.current = onIssuerChange;
  }, [onToken, onReadyChange, onBinChange, onInstallmentsChange, onIssuerChange]);

  useEffect(() => {
    let active = true;
    let lastBin = "";
    let cardForm: CardForm | undefined;
    const readyTimer = window.setTimeout(() => {
      if (active) setError("Os campos seguros do cartão não carregaram. Atualize a página ou escolha outra forma de pagamento.");
    }, 10000);
    readyCallback.current(false);
    const issuer = document.getElementById("mp-issuer") as HTMLSelectElement | null;
    const handleIssuer = () => issuerCallback.current(issuer?.value && /^\d+$/.test(issuer.value) ? issuer.value : "");
    issuer?.addEventListener("change", handleIssuer);
    const installments = document.getElementById("mp-installments") as HTMLSelectElement | null;
    const identificationType = document.getElementById("mp-identification-type") as HTMLSelectElement | null;
    const syncIssuer = () => {
      if (!issuer) return;
      const choices = Array.from(issuer.options).filter((option) => option.value && option.value !== "Banco emissor");
      setIssuerRequired(choices.length > 1);
      if (choices.length === 1 && issuer.value !== choices[0].value) {
        issuer.value = choices[0].value;
        issuer.dispatchEvent(new Event("change", { bubbles: true }));
      }
      handleIssuer();
    };
    const syncIdentification = () => {
      if (!identificationType) return;
      const cpfOption = Array.from(identificationType.options).find((option) => option.value === "CPF");
      if (cpfOption && identificationType.value !== "CPF") {
        identificationType.value = "CPF";
        identificationType.dispatchEvent(new Event("change", { bubbles: true }));
      }
    };
    const handleInstallments = () => {
      const value = Number(installments?.value);
      if (Array.from(installments?.options ?? []).some((option) => /^([1-9]|10)$/.test(option.value))) setInstallmentsMissing(false);
      installmentsCallback.current(Number.isInteger(value) && value >= 1 && value <= 10 ? value : null);
    };
    installments?.addEventListener("change", handleInstallments);
    const installmentsObserver = installments ? new MutationObserver(handleInstallments) : null;
    if (installments) installmentsObserver?.observe(installments, { childList: true, subtree: true, attributes: true });
    const issuerObserver = issuer ? new MutationObserver(syncIssuer) : null;
    const identificationObserver = identificationType ? new MutationObserver(syncIdentification) : null;
    if (issuer) issuerObserver?.observe(issuer, { childList: true, subtree: true });
    if (identificationType) identificationObserver?.observe(identificationType, { childList: true, subtree: true });
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
      cardForm = mp.cardForm({
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
            if (mountError) {
              window.clearTimeout(readyTimer);
              setError("Não foi possível carregar os campos do cartão.");
            }
          },
          onReady: () => {
            if (!active) return;
            window.clearTimeout(readyTimer);
            setError("");
            readyCallback.current(true);
          },
          onSubmit: (event: Event) => {
            event.preventDefault();
            if (active && cardForm) callback.current(cardForm.getCardFormData());
          },
          onBinChange: (bin: string) => {
            if (active) {
              const normalized = /^\d{6,8}$/.test(bin) ? bin : "";
              if (normalized !== lastBin) {
                lastBin = normalized;
                setInstallmentsMissing(false);
                installmentsCallback.current(null);
                issuerCallback.current("");
                binCallback.current?.(normalized);
                window.setTimeout(() => {
                  if (active) { syncIssuer(); handleInstallments(); }
                }, 100);
              }
            }
          },
        },
      });
    })().catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "Cartão indisponível no momento.");
    });
    return () => {
      active = false;
      window.clearTimeout(readyTimer);
      try { cardForm?.unmount(); } catch { /* The SDK may already have removed its fields. */ }
      installments?.removeEventListener("change", handleInstallments);
      issuer?.removeEventListener("change", handleIssuer);
      installmentsObserver?.disconnect();
      issuerObserver?.disconnect();
      identificationObserver?.disconnect();
      readyCallback.current(false);
    };
  }, [amount]);

  return <div className="mt-5 rounded-xl border border-brand-200 bg-brand-50/50 p-5">
    <strong className="text-sm text-brand-950">Dados do cartão de crédito</strong>
    <p className="mt-1 text-xs text-ink-600">Os dados do cartão são recebidos diretamente pelo Mercado Pago.</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <div className="text-xs font-semibold sm:col-span-2"><span>Número do cartão</span><div id="mp-card-number" className="mt-2 h-11 rounded-md border border-ink-900/15 bg-white px-3 focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-100" /></div>
      <div className="text-xs font-semibold"><span>Validade</span><div id="mp-card-expiration" className="mt-2 h-11 rounded-md border border-ink-900/15 bg-white px-3 focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-100" /></div>
      <div className="text-xs font-semibold"><span>Código de segurança</span><div id="mp-card-security" className="mt-2 h-11 rounded-md border border-ink-900/15 bg-white px-3 focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-100" /></div>
      <label className="text-xs font-semibold sm:col-span-2">Nome no cartão<input id="mp-cardholder-name" required className="mt-2 h-11 w-full rounded-md border bg-white px-3" /></label>
      <label className={`text-xs font-semibold sm:col-span-2 ${issuerRequired ? "" : "sr-only"}`}>Emissor do cartão<select id="mp-issuer" className="mt-2 h-11 w-full rounded-md border bg-white px-3" tabIndex={issuerRequired ? 0 : -1} /></label>
      <label className="text-xs font-semibold sm:col-span-2">Parcelas<select id="mp-installments" required className="mt-2 h-11 w-full rounded-md border bg-white px-3" /></label>
      <select id="mp-identification-type" aria-label="Tipo de documento já informado" className="sr-only" tabIndex={-1} />
      <input id="mp-identification-number" type="hidden" defaultValue={cpf} />
      <input id="mp-cardholder-email" type="hidden" defaultValue={email} />
    </div>
    {installmentsMissing && <p role="status" className="mt-3 text-sm text-amber-800">Não foi possível carregar as parcelas deste cartão. Confira o número ou tente outro cartão.</p>}
    {error && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
  </div>;
}
