import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone as dt_timezone
from pathlib import Path
from django.conf import settings
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views import View
from django.utils.decorators import method_decorator

from apps.customers.models import Customer, WhatsAppContact, WhatsAppMessage

logger = logging.getLogger(__name__)


def process_inbound_whatsapp_webhook(payload: dict) -> int:
    """
    Passively parses and records inbound WhatsApp messages and contacts
    from Meta Cloud API webhook payloads. Auto-correlates to existing Customers.
    """
    processed = 0
    if not isinstance(payload, dict):
        return 0

    entries = payload.get("entry", [])
    for entry in entries:
        changes = entry.get("changes", [])
        for change in changes:
            value = change.get("value", {})
            messages = value.get("messages", [])
            contacts = value.get("contacts", [])

            contact_map = {}
            for c in contacts:
                wa_id = c.get("wa_id")
                name = c.get("profile", {}).get("name", "")
                if wa_id:
                    contact_map[wa_id] = name

            for msg in messages:
                wamid = msg.get("id")
                from_num = msg.get("from")
                if not wamid or not from_num:
                    continue

                clean_phone = "".join(filter(str.isdigit, str(from_num)))
                profile_name = contact_map.get(from_num) or contact_map.get(clean_phone) or ""
                msg_type = msg.get("type", "text")

                # Extract text body or description
                if msg_type == "text":
                    body = msg.get("text", {}).get("body", "")
                elif msg_type in ("image", "video", "audio", "document"):
                    caption = msg.get(msg_type, {}).get("caption", "")
                    body = caption if caption else f"[{msg_type.upper()}]"
                elif msg_type == "interactive":
                    interactive = msg.get("interactive", {})
                    btn = interactive.get("button_reply", {}).get("title")
                    lst = interactive.get("list_reply", {}).get("title")
                    body = btn or lst or "[INTERATIVO]"
                elif msg_type == "button":
                    body = msg.get("button", {}).get("text", "[BOTAO]")
                elif msg_type == "location":
                    loc = msg.get("location", {})
                    body = f"[LOCALIZAÇÃO: {loc.get('latitude')}, {loc.get('longitude')}]"
                else:
                    body = f"[{msg_type.upper()}]"

                # Parse timestamp
                ts = None
                raw_ts = msg.get("timestamp")
                if raw_ts:
                    try:
                        ts = datetime.fromtimestamp(int(raw_ts), tz=dt_timezone.utc)
                    except (ValueError, TypeError, OverflowError):
                        ts = None

                # Correlate to existing Customer if matching phone
                customer = None
                if len(clean_phone) >= 8:
                    suffix = clean_phone[-8:]
                    customer = Customer.objects.filter(phone__endswith=suffix).first()

                # Get or create WhatsAppContact
                contact, _ = WhatsAppContact.objects.get_or_create(
                    phone=clean_phone,
                    defaults={
                        "wa_id": str(from_num),
                        "profile_name": profile_name,
                        "customer": customer,
                    },
                )

                update_fields = []
                if profile_name and not contact.profile_name:
                    contact.profile_name = profile_name
                    update_fields.append("profile_name")
                if customer and not contact.customer:
                    contact.customer = customer
                    update_fields.append("customer")

                contact.total_messages_count += 1
                update_fields.extend(["total_messages_count", "last_message_at"])
                contact.save(update_fields=update_fields)

                # Store message idempotently (ignore duplicates from webhook retries)
                WhatsAppMessage.objects.get_or_create(
                    wamid=wamid,
                    defaults={
                        "contact": contact,
                        "direction": WhatsAppMessage.Direction.INBOUND,
                        "message_type": msg_type,
                        "body": body,
                        "raw_payload": msg,
                        "timestamp": ts,
                    },
                )
                processed += 1

    return processed


@method_decorator(csrf_exempt, name="dispatch")
class WhatsAppWebhookView(View):
    def get(self, request, *args, **kwargs):
        """
        Meta Webhook verification handshake.
        Meta calls GET with:
          - hub.mode = 'subscribe'
          - hub.verify_token = '<VERIFY_TOKEN>'
          - hub.challenge = '<CHALLENGE_STRING>'
        """
        mode = request.GET.get("hub.mode")
        verify_token = request.GET.get("hub.verify_token")
        challenge = request.GET.get("hub.challenge")

        expected_token = getattr(settings, "WHATSAPP_WEBHOOK_VERIFY_TOKEN", "")

        if mode == "subscribe" and verify_token and expected_token and verify_token == expected_token:
            logger.info("WhatsApp webhook verified successfully.")
            return HttpResponse(challenge, content_type="text/plain", status=200)

        logger.warning(
            "WhatsApp webhook verification failed. mode=%s, token_match=%s",
            mode,
            verify_token == expected_token if expected_token else False,
        )
        return HttpResponse("Forbidden", content_type="text/plain", status=403)

    def post(self, request, *args, **kwargs):
        """
        Meta Webhook event delivery (messages, echoes, status updates).
        """
        app_secret = getattr(settings, "META_APP_SECRET", "")
        if app_secret:
            signature_header = request.headers.get("X-Hub-Signature-256", "")
            if not signature_header.startswith("sha256="):
                return HttpResponse("Invalid signature header", status=401)
            expected_sig = "sha256=" + hmac.new(
                app_secret.encode("utf-8"),
                request.body,
                hashlib.sha256
            ).hexdigest()
            if not hmac.compare_digest(signature_header, expected_sig):
                logger.warning("WhatsApp webhook signature mismatch.")
                return HttpResponse("Invalid signature", status=401)

        try:
            payload = json.loads(request.body.decode("utf-8"))
            logger.info("WhatsApp webhook received event: %s", payload.get("object"))
            processed_count = process_inbound_whatsapp_webhook(payload)
            if processed_count > 0:
                logger.info("WhatsApp webhook stored %d incoming message(s).", processed_count)
        except Exception as e:
            logger.error("Error decoding/processing WhatsApp webhook payload: %s", e)

        # Meta requires an immediate 200 OK
        return JsonResponse({"status": "received"}, status=200)


@method_decorator(csrf_exempt, name="dispatch")
class WhatsAppOAuthCallbackView(View):
    def get(self, request, *args, **kwargs):
        """
        Receives the authorization code from Meta Embedded Signup / Facebook Login for Business
        and exchanges it for the permanent System User / Access Token.
        """
        code = request.GET.get("code")
        error = request.GET.get("error_description") or request.GET.get("error")
        if error:
            logger.error("Meta OAuth error: %s", error)
            return HttpResponse(f"Erro na autorização da Meta: {error}", status=400)
        if not code:
            return HttpResponse("Código de autorização não fornecido.", status=400)

        app_id = getattr(settings, "META_APP_ID", "")
        app_secret = getattr(settings, "META_APP_SECRET", "")
        redirect_uri = "https://www.expedicaopiraiba.com.br/api/webhooks/whatsapp/oauth/"

        import urllib.request
        import urllib.error

        token_url = (
            f"https://graph.facebook.com/v21.0/oauth/access_token"
            f"?client_id={app_id}&redirect_uri={redirect_uri}&client_secret={app_secret}&code={code}"
        )

        try:
            req = urllib.request.Request(token_url)
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read().decode())
                access_token = data.get("access_token")
                logger.info("Access token successfully acquired from Meta.")
        except Exception as e:
            msg = e.read().decode() if hasattr(e, "read") else str(e)
            logger.error("Failed to exchange code for token: %s", msg)
            return HttpResponse(f"Erro ao trocar código por token: {msg}", status=500)

        # Atualiza os arquivos de ambiente com o token obtido
        try:
            for env_path in ["/root/.config/expedicaopiraiba/providers.env", "/etc/piraiba/production.env", "/etc/piraiba/sandbox.env"]:
                p = Path(env_path)
                if p.exists():
                    lines = [l for l in p.read_text().splitlines() if not l.startswith("META_ACCESS_TOKEN=")]
                    lines.append(f"META_ACCESS_TOKEN={access_token}")
                    p.write_text("\n".join(lines) + "\n")
        except Exception as e:
            logger.error("Error writing token to env files: %s", e)

        html = """
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="utf-8">
            <title>WhatsApp Conectado</title>
            <style>
                body { font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; text-align: center; }
                .card { background: #1e293b; padding: 2.5rem; border-radius: 1rem; box-shadow: 0 10px 25px rgba(0,0,0,0.5); max-width: 480px; }
                h1 { color: #10b981; margin-bottom: 1rem; }
                p { color: #94a3b8; line-height: 1.6; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>✓ Conectado com Sucesso!</h1>
                <p>A Conta de Mensagem do WhatsApp foi autorizada pela Meta e vinculada com segurança ao sistema da <strong>Expedição Piraíba</strong>.</p>
                <p>Você já pode fechar esta aba e retornar ao chat.</p>
            </div>
        </body>
        </html>
        """
        return HttpResponse(html, content_type="text/html; charset=utf-8", status=200)
