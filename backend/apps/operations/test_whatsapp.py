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

    @override_settings(META_APP_SECRET="")
    def test_inbound_message_passively_stored_and_linked_to_customer(self):
        from apps.customers.models import Customer, WhatsAppContact, WhatsAppMessage

        customer = Customer.objects.create(
            cpf="12345678901",
            full_name="Pescador Araguaia",
            email="pescador@araguaia.com",
            phone="62981612128",
        )

        payload = {
            "object": "whatsapp_business_account",
            "entry": [
                {
                    "id": "123456",
                    "changes": [
                        {
                            "field": "messages",
                            "value": {
                                "messaging_product": "whatsapp",
                                "contacts": [{"profile": {"name": "Pescador Araguaia"}, "wa_id": "5562981612128"}],
                                "messages": [
                                    {
                                        "from": "5562981612128",
                                        "id": "wamid.HBgLMjAyNjEwMjE=",
                                        "timestamp": "1729541234",
                                        "text": {"body": "Olá, qual a melhor época para a Piraíba?"},
                                        "type": "text",
                                    }
                                ],
                            },
                        }
                    ],
                }
            ],
        }

        url = reverse("whatsapp-webhook")
        response = self.client.post(url, payload, content_type="application/json")
        self.assertEqual(response.status_code, 200)

        contact = WhatsAppContact.objects.get(phone="5562981612128")
        self.assertEqual(contact.profile_name, "Pescador Araguaia")
        self.assertEqual(contact.customer, customer)
        self.assertEqual(contact.total_messages_count, 1)

        msg = WhatsAppMessage.objects.get(wamid="wamid.HBgLMjAyNjEwMjE=")
        self.assertEqual(msg.contact, contact)
        self.assertEqual(msg.direction, WhatsAppMessage.Direction.INBOUND)
        self.assertEqual(msg.body, "Olá, qual a melhor época para a Piraíba?")
        self.assertEqual(msg.message_type, "text")

    @override_settings(META_APP_SECRET="")
    def test_inbound_message_idempotent_deduplication(self):
        from apps.customers.models import WhatsAppContact, WhatsAppMessage

        payload = {
            "object": "whatsapp_business_account",
            "entry": [
                {
                    "id": "123456",
                    "changes": [
                        {
                            "field": "messages",
                            "value": {
                                "messaging_product": "whatsapp",
                                "contacts": [{"profile": {"name": "Novo Lead"}, "wa_id": "5511999998888"}],
                                "messages": [
                                    {
                                        "from": "5511999998888",
                                        "id": "wamid.DUPLICATE_TEST_1",
                                        "timestamp": "1729541234",
                                        "text": {"body": "Primeiro envio"},
                                        "type": "text",
                                    }
                                ],
                            },
                        }
                    ],
                }
            ],
        }

        url = reverse("whatsapp-webhook")
        res1 = self.client.post(url, payload, content_type="application/json")
        self.assertEqual(res1.status_code, 200)

        # Send same payload second time
        res2 = self.client.post(url, payload, content_type="application/json")
        self.assertEqual(res2.status_code, 200)

        self.assertEqual(WhatsAppMessage.objects.filter(wamid="wamid.DUPLICATE_TEST_1").count(), 1)
