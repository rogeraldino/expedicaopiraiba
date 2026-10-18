import hashlib
import hmac
from django.test import TestCase, override_settings
from django.urls import reverse


class WhatsAppWebhookTests(TestCase):
    @override_settings(WHATSAPP_WEBHOOK_VERIFY_TOKEN="test-verify-token")
    def test_webhook_verification_success(self):
        url = reverse("whatsapp-webhook")
        response = self.client.get(
            url,
            {
                "hub.mode": "subscribe",
                "hub.verify_token": "test-verify-token",
                "hub.challenge": "123456789",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content.decode("utf-8"), "123456789")
        self.assertEqual(response["Content-Type"], "text/plain")

    @override_settings(WHATSAPP_WEBHOOK_VERIFY_TOKEN="test-verify-token")
    def test_webhook_verification_failure(self):
        url = reverse("whatsapp-webhook")
        response = self.client.get(
            url,
            {
                "hub.mode": "subscribe",
                "hub.verify_token": "wrong-token",
                "hub.challenge": "123456789",
            },
        )
        self.assertEqual(response.status_code, 403)

    @override_settings(META_APP_SECRET="")
    def test_webhook_event_post_without_secret(self):
        url = reverse("whatsapp-webhook")
        payload = {"object": "whatsapp_business_account", "entry": []}
        response = self.client.post(url, payload, content_type="application/json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "received"})

    @override_settings(META_APP_SECRET="super-secret")
    def test_webhook_event_post_with_valid_signature(self):
        url = reverse("whatsapp-webhook")
        body = b'{"object": "whatsapp_business_account"}'
        sig = "sha256=" + hmac.new(b"super-secret", body, hashlib.sha256).hexdigest()
        response = self.client.post(
            url,
            data=body,
            content_type="application/json",
            HTTP_X_HUB_SIGNATURE_256=sig,
        )
        self.assertEqual(response.status_code, 200)

    @override_settings(META_APP_SECRET="super-secret")
    def test_webhook_event_post_with_invalid_signature(self):
        url = reverse("whatsapp-webhook")
        body = b'{"object": "whatsapp_business_account"}'
        response = self.client.post(
            url,
            data=body,
            content_type="application/json",
            HTTP_X_HUB_SIGNATURE_256="sha256=invalid-signature",
        )
        self.assertEqual(response.status_code, 401)
