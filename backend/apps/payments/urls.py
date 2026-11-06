from django.urls import path

from .views import (
    CreatePixView,
    FakeWebhookView,
    MercadoPagoWebhookView,
    PaymentStatusView,
    PaymentPublicConfigView,
    FeeQuoteView,
    BalanceFeeQuoteView,
    SimulateConfirmationView,
)

urlpatterns = [
    path("config/", PaymentPublicConfigView.as_view(), name="payment-public-config"),
    path("quote/", FeeQuoteView.as_view(), name="payment-fee-quote"),
    path("balance-quote/<uuid:reservation_id>/", BalanceFeeQuoteView.as_view(), name="balance-fee-quote"),
    path("", CreatePixView.as_view(), name="payment-create-pix"),
    path("<uuid:payment_id>/status/", PaymentStatusView.as_view(), name="payment-status"),
    path("<uuid:payment_id>/simulate-confirmation/", SimulateConfirmationView.as_view(), name="payment-simulate"),
    path("webhooks/fake/", FakeWebhookView.as_view(), name="payment-webhook-fake"),
    path("webhooks/mercadopago/", MercadoPagoWebhookView.as_view(), name="payment-webhook-mercadopago"),
]
