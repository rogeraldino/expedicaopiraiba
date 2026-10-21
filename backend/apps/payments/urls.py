from django.urls import path

from .views import (
    CreatePixView,
    FakeWebhookView,
    MercadoPagoWebhookView,
    PaymentStatusView,
    SimulateConfirmationView,
)

urlpatterns = [
    path("", CreatePixView.as_view(), name="payment-create-pix"),
    path("<uuid:payment_id>/status/", PaymentStatusView.as_view(), name="payment-status"),
    path("<uuid:payment_id>/simulate-confirmation/", SimulateConfirmationView.as_view(), name="payment-simulate"),
    path("webhooks/fake/", FakeWebhookView.as_view(), name="payment-webhook-fake"),
    path("webhooks/mercadopago/", MercadoPagoWebhookView.as_view(), name="payment-webhook-mercadopago"),
]
