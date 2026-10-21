import json
import logging
import urllib.error
import urllib.request

from django.conf import settings
from django.core.mail import send_mail

from .email_templates import render_order_confirmation_html, render_otp_email_html

logger = logging.getLogger(__name__)


def send_otp_email(*, email: str, code: str, full_name: str = "") -> bool:
    """
    Sends the 6-digit OTP verification code via Gmail SMTP.
    """
    if not email:
        return False
    greeting = f"Olá, {full_name.strip()}!" if full_name and full_name.strip() else "Olá!"
    subject = f"Código de verificação: {code} — Expedição Piraíba"
    message = (
        f"{greeting}\n\n"
        f"Seu código de confirmação para a Expedição Piraíba é:\n\n"
        f"    {code}\n\n"
        f"Este código é válido por 5 minutos. Não compartilhe este código com ninguém.\n\n"
        f"Se você não solicitou esta confirmação, por favor desconsidere este e-mail.\n\n"
        f"Atenciosamente,\n"
        f"Equipe Expedição Piraíba\n"
        f"https://www.expedicaopiraiba.com.br"
    )
    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "Expedição Piraíba <expedicaopiraiba@gmail.com>")
    html_message = render_otp_email_html(code=code, full_name=full_name)

    # If SMTP password is not set (e.g. running mock unit tests), log and succeed
    if not getattr(settings, "EMAIL_HOST_PASSWORD", ""):
        logger.info("[MOCK/LOCAL] OTP code %s generated for email %s", code, email)
        return True

    try:
        send_mail(
            subject=subject,
            message=message,
            html_message=html_message,
            from_email=from_email,
            recipient_list=[email],
            fail_silently=False,
        )
        logger.info("OTP verification email sent successfully to %s", email)
        return True
    except Exception as e:
        logger.error("Failed to send OTP email to %s: %s", email, e)
        return False


def send_otp_whatsapp(*, phone: str, code: str, full_name: str = "") -> bool:
    """
    Sends OTP via WhatsApp Meta Cloud API when active and template is available.
    """
    phone_id = getattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "")
    token = getattr(settings, "META_ACCESS_TOKEN", "")
    if not phone_id or not token:
        logger.info("Meta WhatsApp not fully configured, OTP dispatched via Email contingency.")
        return False

    clean_phone = "".join(c for c in phone if c.isdigit())
    if not clean_phone.startswith("55"):
        clean_phone = f"55{clean_phone}"

    url = f"https://graph.facebook.com/v21.0/{phone_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": clean_phone,
        "type": "template",
        "template": {
            "name": "codigo_verificacao",
            "language": {"code": "pt_BR"},
            "components": [
                {
                    "type": "body",
                    "parameters": [{"type": "text", "text": code}],
                },
                {
                    "type": "button",
                    "sub_type": "url",
                    "index": "0",
                    "parameters": [{"type": "text", "text": code}],
                },
            ],
        },
    }
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            logger.info("WhatsApp OTP sent to %s: %s", clean_phone, data)
            return True
    except Exception as e:
        logger.warning("WhatsApp OTP send failed (template or permission not ready): %s", e)
        return False


def send_order_confirmation_email(*, reservation, payment) -> bool:
    """
    Dispatches order confirmation receipt to the buyer via Email.
    """
    customer = reservation.customer
    if not customer or not customer.email:
        return False

    expedition = reservation.expedition
    amount_reais = f"R$ {payment.amount_cents / 100:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    starts = expedition.starts_at.strftime("%d/%m/%Y") if hasattr(expedition.starts_at, "strftime") else str(expedition.starts_at)

    from apps.customers.services import create_customer_session_token
    session_token = create_customer_session_token(customer)
    journey_url = f"https://www.expedicaopiraiba.com.br/expedicoes/{expedition.slug}/minha-expedicao/{reservation.id}?auth={session_token}"

    subject = f"Pagamento Confirmado! Expedição {expedition.name} — Reserva Garantida"
    message = (
        f"Olá, {customer.full_name}!\n\n"
        f"Seu pagamento foi confirmado com sucesso e suas vagas estão 100% garantidas!\n\n"
        f"Detalhes da sua Expedição:\n"
        f"• Expedição: {expedition.name}\n"
        f"• Destino: {expedition.destination}\n"
        f"• Embarque: {starts}\n"
        f"• Vagas reservadas: {reservation.participant_count}\n"
        f"• Valor pago: {amount_reais} ({payment.get_method_display() if hasattr(payment, 'get_method_display') else payment.method})\n\n"
        f"Próximos Passos (Importante):\n"
        f"Para escolher o kit de bebidas dos participantes, preencher os dados dos pescadores e conferir o checklist de tralhas, acesse o link seguro da sua reserva:\n"
        f"{journey_url}\n\n"
        f"Nos vemos em breve no Rio Araguaia!\n\n"
        f"Equipe Expedição Piraíba\n"
        f"Dúvidas ou suporte: (62) 98161-2128\n"
    )
    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "Expedição Piraíba <expedicaopiraiba@gmail.com>")
    payment_method_label = payment.get_method_display() if hasattr(payment, "get_method_display") else getattr(payment, "method", "PIX")
    html_message = render_order_confirmation_html(
        customer_name=customer.full_name or "Pescador",
        expedition_name=expedition.name,
        destination=getattr(expedition, "destination", "Rio Araguaia") or "Rio Araguaia",
        starts_at_formatted=starts,
        participant_count=reservation.participant_count,
        amount_reais=amount_reais,
        payment_method_label=payment_method_label,
        journey_url=journey_url,
    )

    if not getattr(settings, "EMAIL_HOST_PASSWORD", ""):
        logger.info("[MOCK/LOCAL] Confirmation email prepared for %s (Reserva %s)", customer.email, reservation.id)
        return True

    try:
        send_mail(
            subject=subject,
            message=message,
            html_message=html_message,
            from_email=from_email,
            recipient_list=[customer.email],
            fail_silently=False,
        )
        logger.info("Order confirmation email sent to %s for reservation %s", customer.email, reservation.id)
        return True
    except Exception as e:
        logger.error("Failed to send order confirmation email: %s", e)
        return False
