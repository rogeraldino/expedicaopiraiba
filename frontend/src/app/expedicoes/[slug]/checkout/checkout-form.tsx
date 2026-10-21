"use client";

import { FormEvent, useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, Copy, CreditCard, ExternalLink, Loader2, LockKeyhole, QrCode, Receipt, RefreshCw } from "lucide-react";
import Link from "next/link";
import QRCode from "qrcode";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
const inputClass =
  "mt-2 h-11 w-full rounded-md border border-ink-900/15 bg-white px-3 text-sm outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100";
type Step = "FORM" | "OTP" | "PAYMENT" | "SUCCESS";
type Method = "PIX" | "CREDIT_CARD" | "BOLETO";

type ExpeditionProp = {
  id: string;
  name: string;
  slug: string;
  destination: string;
  starts_at?: string;
  ends_at?: string;
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
  const [pixQrCodeBase64, setPixQrCodeBase64] = useState("");
  const [pixQrDataUrl, setPixQrDataUrl] = useState("");
  const [copiedPix, setCopiedPix] = useState(false);
  const [ticketUrl, setTicketUrl] = useState("");
  const [boletoBarcode, setBoletoBarcode] = useState("");
  const [amountDue, setAmountDue] = useState(0);
  const [participantCount, setParticipantCount] = useState(2);
  const [participants, setParticipants] = useState(["", ""]);
  const [identity, setIdentity] = useState({ cpf: "", full_name: "", phone: "", email: "" });
  const [paymentPlan, setPaymentPlan] = useState("DEPOSIT");
  const [paymentMethod, setPaymentMethod] = useState<Method>("PIX");
  const [terms, setTerms] = useState(false);

  // Address state for Boleto Bancário
  const [address, setAddress] = useState({
    zip_code: "",
    street_name: "",
    street_number: "",
    complement: "",
    neighborhood: "",
    city: "",
    federal_unit: "",
  });

  // Credit card state
  const [cardData, setCardData] = useState({
    cardholder_name: "",
    card_number: "",
    expiry: "",
    cvv: "",
    installments: 1,
  });

  // Check Boleto window: allowed only if starts_at > 7 days from now
  const daysUntilDeparture = expedition.starts_at
    ? Math.ceil((new Date(expedition.starts_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 30;
  const isBoletoAvailable = daysUntilDeparture > 7;
  const [isEditing, setIsEditing] = useState(false);

  function updateCount(count: number) {
    setParticipantCount(count);
    setParticipants((current) => Array.from({ length: count }, (_, index) => current[index] ?? ""));
  }

  async function cancelHoldAndGoBack() {
    setError("");
    setLoading(true);
    try {
      if (reservationId && verificationToken) {
        await fetch(`${api}/checkout/cancel-hold/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            verification_token: verificationToken,
            reservation_id: reservationId,
          }),
        });
      }
    } catch {
      // Ignore network errors on cancel
    } finally {
      setLoading(false);
      setReservationId("");
      setPaymentId("");
      setPixCode("");
      setPixQrCodeBase64("");
      setPixQrDataUrl("");
      setCopiedPix(false);
      setTicketUrl("");
      setBoletoBarcode("");
      setIsEditing(true);
      setStep("FORM");
    }
  }

  // Fallback client-side QR Code generation if base64 image from gateway is not available
  useEffect(() => {
    if (pixCode && !pixQrCodeBase64) {
      QRCode.toDataURL(pixCode, { width: 320, margin: 1 })
        .then((url) => setPixQrDataUrl(url))
        .catch(() => setPixQrDataUrl(""));
    }
  }, [pixCode, pixQrCodeBase64]);

  function handleCopyPix() {
    if (!pixCode) return;
    navigator.clipboard.writeText(pixCode);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 2500);
  }

  // Polling payment status when on PAYMENT step
  useEffect(() => {
    if (step !== "PAYMENT" || !paymentId) return;

    let active = true;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${api}/payments/${paymentId}/status/`);
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;

        if (data.pix_qr_code_base64 && !pixQrCodeBase64) {
          setPixQrCodeBase64(data.pix_qr_code_base64);
        }

        if (data.status === "PAID" || data.reservation_status === "CONFIRMED" || data.reservation_status === "PAID") {
          if (data.customer_session_token) {
            sessionStorage.setItem("customer-session-token", data.customer_session_token);
            localStorage.setItem("customer-session-token", data.customer_session_token);
          }
          if (data.reservation_id) {
            setReservationId(data.reservation_id);
          }
          setStep("SUCCESS");
          clearInterval(interval);
        }
      } catch {
        // Continue polling silently
      }
    }, 3500);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [step, paymentId, pixQrCodeBase64]);

  async function requestCode(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!terms) return setError("Aceite os termos e a política de cancelamento para continuar.");
    if (participants.some((name) => !name.trim())) return setError("Informe o nome de todos os participantes.");

    // Validate Boleto address
    if (paymentMethod === "BOLETO") {
      if (!isBoletoAvailable) {
        return setError("Boleto bancário indisponível a menos de 7 dias do embarque.");
      }
      if (!address.zip_code.trim() || !address.street_name.trim() || !address.street_number.trim() || !address.city.trim() || !address.federal_unit.trim()) {
        return setError("Preencha o endereço completo (CEP, rua, número, bairro, cidade e estado) para emissão do boleto.");
      }
    }

    // Validate card data
    if (paymentMethod === "CREDIT_CARD") {
      const cleanCard = cardData.card_number.replace(/\D/g, "");
      if (cleanCard.length < 13) {
        return setError("Informe um número de cartão de crédito válido.");
      }
      if (!cardData.cardholder_name.trim()) {
        return setError("Informe o nome impresso no cartão de crédito.");
      }
    }

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
      if (data.dev_code) {
        setCode(data.dev_code);
      }
      setStep("OTP");
    } catch (requestError) {
      setError(messageFrom(requestError));
    } finally {
      setLoading(false);
    }
  }

  function fillDemoData() {
    setIdentity({
      cpf: "529.982.247-25",
      full_name: "Rodrigo Geraldo",
      phone: "(62) 98161-2128",
      email: "rodrigo@alvor.lat",
    });
    setTerms(true);
    setParticipants((prev) =>
      prev.map((p, idx) => (p && p.trim() ? p : idx === 0 ? "Rodrigo Geraldo" : `Pescador Convidado ${idx + 1}`))
    );
    if (paymentMethod === "BOLETO") {
      setAddress({
        zip_code: "74000-000",
        street_name: "Avenida Goiás",
        street_number: "100",
        complement: "Sala 2",
        neighborhood: "Setor Central",
        city: "Goiânia",
        federal_unit: "GO",
      });
    }
    if (paymentMethod === "CREDIT_CARD") {
      setCardData({
        cardholder_name: "RODRIGO GERALDO",
        card_number: "4111 1111 1111 1111",
        expiry: "12/28",
        cvv: "123",
        installments: 3,
      });
    }
  }

  async function verifyAndHold(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      // 1. Verify OTP challenge
      const verificationResponse = await fetch(`${api}/checkout/verify/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge_id: challengeId, code }),
      });
      const verification = await verificationResponse.json();
      if (!verificationResponse.ok) throw verification;

      // 2. Hold seats
      const holdPayload: Record<string, unknown> = {
        verification_token: verification.verification_token,
        expedition_slug: expedition.slug,
        participant_names: participants,
        payment_plan: paymentPlan,
      };
      if (reservationId) {
        holdPayload.replace_reservation_id = reservationId;
      }
      const holdResponse = await fetch(`${api}/checkout/hold/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(holdPayload),
      });
      const hold = await holdResponse.json();
      if (!holdResponse.ok) throw hold;

      // 3. Create payment
      const paymentPayload: Record<string, unknown> = {
        verification_token: verification.verification_token,
        reservation_id: hold.reservation_id,
        method: paymentMethod,
      };

      if (paymentMethod === "BOLETO") {
        paymentPayload.address = address;
      } else if (paymentMethod === "CREDIT_CARD") {
        paymentPayload.card_token = `tok_${cardData.card_number.replace(/\D/g, "")}`;
        paymentPayload.installments = cardData.installments;
        paymentPayload.payment_method_id = "visa";
      }

      const paymentResponse = await fetch(`${api}/payments/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentPayload),
      });
      const payment = await paymentResponse.json();
      if (!paymentResponse.ok) throw payment;

      setVerificationToken(verification.verification_token);
      setPaymentId(payment.payment_id);
      setReservationId(hold.reservation_id);
      setAmountDue(payment.amount_cents);

      if (payment.expires_at) {
        setHoldUntil(new Date(payment.expires_at).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }));
      } else {
        setHoldUntil(new Date(hold.held_until).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
      }

      // Check if card payment was approved immediately
      if (payment.status === "PAID" || payment.reservation_status === "CONFIRMED" || payment.reservation_status === "PAID") {
        if (payment.customer_session_token) {
          sessionStorage.setItem("customer-session-token", payment.customer_session_token);
          localStorage.setItem("customer-session-token", payment.customer_session_token);
        }
        setStep("SUCCESS");
        return;
      }

      if (payment.status === "FAILED") {
        throw new Error("O cartão informado foi recusado pelo banco emissor. Tente novamente com outro cartão ou selecione a opção PIX.");
      }

      setPixCode(payment.pix_copy_paste ?? "");
      setPixQrCodeBase64(payment.pix_qr_code_base64 ?? "");
      setTicketUrl(payment.ticket_url ?? "");
      setBoletoBarcode(payment.boleto_barcode ?? "");
      setStep("PAYMENT");
    } catch (requestError) {
      setError(messageFrom(requestError));
    } finally {
      setLoading(false);
    }
  }

  // Developer simulation helper for tests/staging
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
      if (data.customer_session_token) {
        sessionStorage.setItem("customer-session-token", data.customer_session_token);
        localStorage.setItem("customer-session-token", data.customer_session_token);
      }
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
        <p className="mt-2 text-xs font-bold uppercase tracking-widest text-brand-600">Pagamento Confirmado</p>
        <h2 className="mt-2 text-3xl font-black text-brand-900">Expedição Garantida!</h2>
        <p className="mt-2 text-sm text-ink-700">
          Recebemos a confirmação do pagamento e suas <strong>{participantCount} vagas</strong> estão 100% reservadas.
        </p>
        <p className="mt-1 text-xs text-ink-500">
          Enviamos o comprovante completo e os detalhes do embarque para o seu e-mail.
        </p>
        <Link
          href={`/expedicoes/${expedition.slug}/confirmacao/${reservationId}` as never}
          className="mt-6 inline-flex min-h-12 items-center justify-center rounded-lg bg-brand-600 px-8 font-bold text-white shadow hover:bg-brand-700"
        >
          Acessar minha reserva & escolher bebidas
        </Link>
      </div>
    );

  if (step === "PAYMENT")
    return (
      <div className="rounded-2xl border border-ink-900/10 bg-white p-7 shadow-sm">
        {paymentMethod === "PIX" && (
          <>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-brand-50 p-3">
                <QrCode className="size-7 text-brand-700" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-brand-600">PIX Gerado com Sucesso</p>
                <h2 className="text-2xl font-black text-brand-900">Pague para Confirmar</h2>
              </div>
            </div>
            <p className="mt-5 text-xs text-ink-500">Valor desta cobrança ({paymentPlan === "DEPOSIT" ? "Sinal" : "Integral"}):</p>
            <p className="text-3xl font-black text-brand-700">{money.format(amountDue / 100)}</p>
            <p className="mt-1 text-xs text-ink-500">
              Suas vagas ficam protegidas no sistema até <strong>{holdUntil}</strong>.
            </p>

            {/* Visual QR Code Image */}
            <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border-2 border-brand-200 bg-brand-50/50 p-6 text-center">
              <p className="text-xs font-bold uppercase tracking-wider text-brand-800">
                1. Aponte a câmera do seu banco para o QR Code
              </p>
              <div className="mt-4 flex size-64 items-center justify-center overflow-hidden rounded-2xl border border-ink-900/10 bg-white p-3 shadow-md">
                {(pixQrCodeBase64 || pixQrDataUrl) ? (
                  <img
                    src={pixQrCodeBase64 ? `data:image/png;base64,${pixQrCodeBase64}` : pixQrDataUrl}
                    alt="QR Code PIX para leitura e pagamento"
                    className="size-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 text-xs text-ink-400">
                    <RefreshCw className="size-6 animate-spin text-brand-600" />
                    <span>Gerando imagem do QR Code...</span>
                  </div>
                )}
              </div>
              <p className="mt-3 text-xs text-ink-600">
                Abra o aplicativo do seu banco, escolha <strong>Pagar via PIX</strong> e escaneie o código acima.
              </p>
            </div>

            {/* Copia e Cola Code Box */}
            <div className="mt-5 rounded-xl bg-sand-50 p-4 border border-sand-200">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-ink-600">2. Ou utilize o Copia e Cola</p>
                {copiedPix && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 animate-pulse">
                    <CheckCircle2 className="size-3.5" /> Copiado!
                  </span>
                )}
              </div>
              <p className="mt-2 break-all font-mono text-xs text-ink-800 select-all bg-white p-3 rounded-lg border border-sand-300">
                {pixCode}
              </p>
            </div>

            <button
              type="button"
              onClick={handleCopyPix}
              className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 font-bold text-white shadow hover:bg-brand-700 transition"
            >
              {copiedPix ? (
                <>
                  <CheckCircle2 className="size-5 text-white" /> Código PIX Copiado!
                </>
              ) : (
                <>
                  <Copy className="size-5 text-white" /> Copiar Código PIX
                </>
              )}
            </button>

            <div className="mt-5 flex items-center justify-center gap-2.5 rounded-xl bg-brand-50 p-3.5 text-xs font-medium text-brand-900 border border-brand-200">
              <RefreshCw className="size-4 animate-spin text-brand-600 shrink-0" />
              <span>Aguardando compensação instantânea... Assim que o banco confirmar, a tela atualizará automaticamente.</span>
            </div>
          </>
        )}

        {paymentMethod === "BOLETO" && (
          <>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-brand-50 p-3">
                <Receipt className="size-7 text-brand-700" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-brand-600">Boleto Bancário Registrado</p>
                <h2 className="text-2xl font-black text-brand-900">Vagas Pré-Reservadas</h2>
              </div>
            </div>
            <p className="mt-5 text-xs text-ink-500">Valor do boleto ({paymentPlan === "DEPOSIT" ? "Sinal" : "Integral"}):</p>
            <p className="text-3xl font-black text-brand-700">{money.format(amountDue / 100)}</p>
            <p className="mt-1 text-xs text-ink-500">
              Vencimento em 3 dias (até <strong>{holdUntil}</strong>). Suas vagas permanecem seguras durante o período de compensação.
            </p>
            {boletoBarcode && (
              <div className="mt-5 rounded-xl bg-sand-50 p-4 border border-sand-200">
                <p className="text-xs font-bold uppercase tracking-wider text-ink-600">Linha Digitável do Boleto</p>
                <p className="mt-2 break-all font-mono text-xs text-ink-800 select-all">{boletoBarcode}</p>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(boletoBarcode)}
                  className="mt-3 flex min-h-9 w-full items-center justify-center gap-2 rounded-lg border border-brand-600 text-xs font-bold text-brand-700 hover:bg-brand-50"
                >
                  <Copy className="size-3.5" /> Copiar código de barras
                </button>
              </div>
            )}
            {ticketUrl && (
              <a
                href={ticketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 font-bold text-white shadow hover:bg-brand-700 transition"
              >
                <ExternalLink className="size-4" /> Visualizar / Imprimir Boleto (PDF)
              </a>
            )}
            <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-sand-50 p-3 text-xs text-ink-600">
              Após o pagamento, a compensação bancária é reconhecida automaticamente em até 2 dias úteis.
            </div>
          </>
        )}

        {/* Developer simulation fallback in test/mock environment */}
        {process.env.NODE_ENV !== "production" && (
          <div className="mt-6 pt-4 border-t border-ink-100">
            <button
              type="button"
              onClick={simulateConfirmation}
              disabled={loading}
              className="min-h-10 w-full rounded-lg border border-sand-300 bg-sand-50 text-xs font-bold text-ink-600 hover:bg-sand-100 disabled:opacity-50"
            >
              {loading ? "Processando..." : "Simular Confirmação Bancária (Ambiente Demo)"}
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={cancelHoldAndGoBack}
          disabled={loading}
          className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-ink-300 text-xs font-bold text-ink-700 hover:bg-sand-50 hover:text-ink-900 transition disabled:opacity-50"
        >
          <ArrowLeft className="size-4" /> Voltar e alterar dados ou forma de pagamento
        </button>

        {error && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
        <p className="mt-4 flex items-center justify-center gap-2 text-xs text-ink-500">
          <LockKeyhole className="size-4 text-brand-600" /> Transação 100% segura e monitorada.
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
          <div className="mt-4 rounded-xl bg-sand-100 p-4 text-sm text-brand-900 border border-sand-300">
            <div className="flex items-center justify-between">
              <div>
                <strong className="block text-xs uppercase tracking-wider text-brand-700">Código de Verificação (Ambiente Demo)</strong>
                <code className="font-mono font-black text-2xl text-brand-900 tracking-wider">{devCode}</code>
              </div>
              <button
                type="button"
                onClick={() => setCode(devCode)}
                className="rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-800 transition"
              >
                Inserir código
              </button>
            </div>
          </div>
        )}
        <input
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          className="mt-5 h-14 w-full rounded-lg border border-ink-900/15 text-center text-3xl font-black tracking-[.4em] outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          inputMode="numeric"
          placeholder="000000"
          autoFocus
        />
        {error && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
        <button
          disabled={loading || code.length !== 6}
          className="mt-5 min-h-12 w-full rounded-lg bg-brand-600 font-bold text-white shadow hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "Verificando..." : "Confirmar código e prosseguir para pagamento"}
        </button>
        <button
          type="button"
          onClick={cancelHoldAndGoBack}
          disabled={loading}
          className="mt-3 flex items-center justify-center gap-1.5 w-full text-sm font-bold text-brand-700 hover:underline disabled:opacity-50"
        >
          <ArrowLeft className="size-4" /> Voltar e corrigir dados
        </button>
      </form>
    );

  return (
    <form onSubmit={requestCode} className="space-y-5">
      {isEditing && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 shadow-sm">
          <AlertCircle className="size-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong className="block font-bold">Edição de Dados da Reserva</strong>
            <p className="mt-0.5 text-amber-800">
              Você voltou para a etapa de preenchimento. Todos os seus dados informados continuam preenchidos abaixo para você ajustar o que precisar (participantes, dados de contato ou forma de pagamento). A pré-reserva anterior foi liberada.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-brand-500/30 bg-brand-50/80 p-4 shadow-sm">
        <div>
          <span className="inline-block rounded bg-brand-700 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-white">
            Demonstração & Testes
          </span>
          <p className="mt-1 text-xs text-brand-950">
            Clique para preencher todos os campos do formulário automaticamente e testar o onboarding completo.
          </p>
        </div>
        <button
          type="button"
          onClick={fillDemoData}
          className="shrink-0 rounded-lg bg-brand-700 px-4 py-2 text-xs font-bold text-white shadow hover:bg-brand-800 transition"
        >
          Preencher dados de teste
        </button>
      </div>

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
              `Sinal a partir de ${money.format(depositTotal)} (${money.format(expedition.deposit_cents / 100)}/pessoa) — à vista no PIX, cartão ou boleto. Saldo restante quitado até a data da viagem.`,
            ],
            [
              "FULL",
              "Pagamento Integral",
              `Pague o valor total de ${money.format(fullTotal)} (${money.format(expedition.price_per_person_cents / 100)}/pessoa) à vista ou parcelado.`,
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
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {/* PIX */}
          <label
            onClick={() => setPaymentMethod("PIX")}
            className={`cursor-pointer flex items-center gap-3 rounded-xl border-2 p-4 transition ${
              paymentMethod === "PIX" ? "border-brand-600 bg-brand-50" : "border-ink-900/15 bg-white hover:border-brand-300"
            }`}
          >
            <input
              type="radio"
              name="payment-method"
              checked={paymentMethod === "PIX"}
              onChange={() => setPaymentMethod("PIX")}
              className="accent-brand-600"
            />
            <QrCode className="size-6 text-brand-700 shrink-0" />
            <div>
              <strong className="text-brand-900 block text-sm">PIX</strong>
              <small className="block text-xs text-brand-700">Liberação imediata</small>
            </div>
          </label>

          {/* Cartão de Crédito */}
          <label
            onClick={() => setPaymentMethod("CREDIT_CARD")}
            className={`cursor-pointer flex items-center gap-3 rounded-xl border-2 p-4 transition ${
              paymentMethod === "CREDIT_CARD" ? "border-brand-600 bg-brand-50" : "border-ink-900/15 bg-white hover:border-brand-300"
            }`}
          >
            <input
              type="radio"
              name="payment-method"
              checked={paymentMethod === "CREDIT_CARD"}
              onChange={() => setPaymentMethod("CREDIT_CARD")}
              className="accent-brand-600"
            />
            <CreditCard className="size-6 text-brand-700 shrink-0" />
            <div>
              <strong className="text-brand-900 block text-sm">Cartão de Crédito</strong>
              <small className="block text-xs text-brand-700">Em até 10x</small>
            </div>
          </label>

          {/* Boleto Bancário */}
          <label
            onClick={() => isBoletoAvailable && setPaymentMethod("BOLETO")}
            className={`flex items-center gap-3 rounded-xl border-2 p-4 transition ${
              !isBoletoAvailable
                ? "border-ink-900/10 bg-ink-50/50 opacity-60 cursor-not-allowed"
                : paymentMethod === "BOLETO"
                ? "border-brand-600 bg-brand-50 cursor-pointer"
                : "border-ink-900/15 bg-white hover:border-brand-300 cursor-pointer"
            }`}
          >
            <input
              type="radio"
              name="payment-method"
              disabled={!isBoletoAvailable}
              checked={paymentMethod === "BOLETO"}
              onChange={() => isBoletoAvailable && setPaymentMethod("BOLETO")}
              className="accent-brand-600"
            />
            <Receipt className="size-6 text-brand-700 shrink-0" />
            <div>
              <strong className="text-brand-900 block text-sm">Boleto Bancário</strong>
              <small className="block text-xs text-ink-500">
                {isBoletoAvailable ? "Vencimento em 3 dias" : "Indisponível (a menos de 7 dias)"}
              </small>
            </div>
          </label>
        </div>

        {/* Conditional Address Fields exclusively for Boleto Bancário */}
        {paymentMethod === "BOLETO" && (
          <div className="mt-5 rounded-xl border border-brand-200 bg-brand-50/50 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Receipt className="size-4 text-brand-700" />
              <strong className="text-sm text-brand-950">Endereço do Pagador (Exigência do Banco Central para Boleto)</strong>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs font-semibold text-ink-800">
                CEP
                <input
                  required
                  value={address.zip_code}
                  onChange={(e) => setAddress({ ...address, zip_code: e.target.value })}
                  placeholder="00000-000"
                  className={inputClass}
                />
              </label>
              <label className="text-xs font-semibold text-ink-800 sm:col-span-2">
                Logradouro / Rua
                <input
                  required
                  value={address.street_name}
                  onChange={(e) => setAddress({ ...address, street_name: e.target.value })}
                  placeholder="Ex: Avenida Goiás"
                  className={inputClass}
                />
              </label>
              <label className="text-xs font-semibold text-ink-800">
                Número
                <input
                  required
                  value={address.street_number}
                  onChange={(e) => setAddress({ ...address, street_number: e.target.value })}
                  placeholder="Ex: 123"
                  className={inputClass}
                />
              </label>
              <label className="text-xs font-semibold text-ink-800 sm:col-span-2">
                Bairro
                <input
                  required
                  value={address.neighborhood}
                  onChange={(e) => setAddress({ ...address, neighborhood: e.target.value })}
                  placeholder="Ex: Setor Central"
                  className={inputClass}
                />
              </label>
              <label className="text-xs font-semibold text-ink-800">
                Complemento (opcional)
                <input
                  value={address.complement}
                  onChange={(e) => setAddress({ ...address, complement: e.target.value })}
                  placeholder="Ex: Apto 101"
                  className={inputClass}
                />
              </label>
              <label className="text-xs font-semibold text-ink-800">
                Cidade
                <input
                  required
                  value={address.city}
                  onChange={(e) => setAddress({ ...address, city: e.target.value })}
                  placeholder="Ex: Goiânia"
                  className={inputClass}
                />
              </label>
              <label className="text-xs font-semibold text-ink-800">
                Estado (UF)
                <input
                  required
                  maxLength={2}
                  value={address.federal_unit}
                  onChange={(e) => setAddress({ ...address, federal_unit: e.target.value.toUpperCase() })}
                  placeholder="GO"
                  className={inputClass}
                />
              </label>
            </div>
          </div>
        )}

        {/* Credit Card inputs */}
        {paymentMethod === "CREDIT_CARD" && (
          <div className="mt-5 rounded-xl border border-brand-200 bg-brand-50/50 p-5">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="size-4 text-brand-700" />
              <strong className="text-sm text-brand-950">Dados do Cartão de Crédito</strong>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-ink-800 sm:col-span-2">
                Nome impresso no cartão
                <input
                  required
                  value={cardData.cardholder_name}
                  onChange={(e) => setCardData({ ...cardData, cardholder_name: e.target.value })}
                  placeholder="NOME COMO NO CARTÃO"
                  className={inputClass}
                />
              </label>
              <label className="text-xs font-semibold text-ink-800 sm:col-span-2">
                Número do cartão
                <input
                  required
                  value={cardData.card_number}
                  onChange={(e) => setCardData({ ...cardData, card_number: e.target.value })}
                  placeholder="0000 0000 0000 0000"
                  className={inputClass}
                />
              </label>
              <label className="text-xs font-semibold text-ink-800">
                Validade (MM/AA)
                <input
                  required
                  maxLength={5}
                  value={cardData.expiry}
                  onChange={(e) => setCardData({ ...cardData, expiry: e.target.value })}
                  placeholder="MM/AA"
                  className={inputClass}
                />
              </label>
              <label className="text-xs font-semibold text-ink-800">
                Código de Segurança (CVV)
                <input
                  required
                  maxLength={4}
                  value={cardData.cvv}
                  onChange={(e) => setCardData({ ...cardData, cvv: e.target.value })}
                  placeholder="123"
                  className={inputClass}
                />
              </label>
              <label className="text-xs font-semibold text-ink-800 sm:col-span-2">
                Parcelamento
                <select
                  value={cardData.installments}
                  onChange={(e) => setCardData({ ...cardData, installments: Number(e.target.value) })}
                  className={inputClass}
                >
                  <option value={1}>1x de {money.format(paymentPlan === "DEPOSIT" ? depositTotal : fullTotal)} (à vista)</option>
                  {[2, 3, 4, 5, 6, 10].map((n) => (
                    <option key={n} value={n}>
                      {n}x de {money.format((paymentPlan === "DEPOSIT" ? depositTotal : fullTotal) / n)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        )}
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
        className="min-h-12 w-full rounded-xl bg-brand-600 px-6 font-black text-white shadow-md transition hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading && <Loader2 className="size-4 animate-spin" />}
        {loading
          ? "Processando..."
          : `Confirmar dados e pagar ${paymentPlan === "DEPOSIT" ? money.format(depositTotal) : money.format(fullTotal)}`}
      </button>

      <p className="flex items-center justify-center gap-2 text-xs text-ink-500">
        <LockKeyhole className="size-4 text-brand-600" /> Seus dados estão seguros e o processo é 100% protegido.
      </p>
    </form>
  );
}
