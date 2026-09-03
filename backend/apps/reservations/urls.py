from django.urls import path

from .views import HoldView, IdentifyView, VerifyView

urlpatterns = [
    path("identify/", IdentifyView.as_view(), name="checkout-identify"),
    path("verify/", VerifyView.as_view(), name="checkout-verify"),
    path("hold/", HoldView.as_view(), name="checkout-hold"),
]
