import hashlib
import hmac
import json
import logging
from pathlib import Path
from django.conf import settings
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views import View
from django.utils.decorators import method_decorator

logger = logging.getLogger(__name__)


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
        except Exception as e:
            logger.error("Error decoding WhatsApp webhook payload: %s", e)

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
