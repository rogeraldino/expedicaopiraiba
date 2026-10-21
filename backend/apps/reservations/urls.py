from django.urls import path

from .views import CancelHoldView, HoldView, IdentifyView, VerifyView

urlpatterns = [
    path("identify/", IdentifyView.as_view(), name="checkout-identify"),
    path("verify/", VerifyView.as_view(), name="checkout-verify"),
    path("hold/", HoldView.as_view(), name="checkout-hold"),
    path("cancel-hold/", CancelHoldView.as_view(), name="checkout-cancel-hold"),
]
