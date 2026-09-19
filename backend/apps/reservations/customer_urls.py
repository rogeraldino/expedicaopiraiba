from django.urls import path

from .customer_views import (
    CustomerAuthLookupView,
    CustomerGuestChecklistView,
    CustomerGuestDetailView,
    CustomerGuestPreferencesView,
    CustomerParticipantChecklistView,
    CustomerParticipantDetailView,
    CustomerParticipantPreferencesView,
    CustomerReservationDetailView,
    CustomerReservationListView,
    CustomerReservationPreferencesView,
)
from apps.payments.views import BalancePaymentConfirmView, BalancePaymentView

urlpatterns = [
    path("auth/lookup/", CustomerAuthLookupView.as_view(), name="customer-auth-lookup"),
    path("reservations/", CustomerReservationListView.as_view(), name="customer-reservation-list"),
    path("reservations/<uuid:reservation_id>/", CustomerReservationDetailView.as_view(), name="customer-reservation-detail"),
    path("reservations/<uuid:reservation_id>/participants/<uuid:participant_id>/", CustomerParticipantDetailView.as_view(), name="customer-participant-detail"),
    path("reservations/<uuid:reservation_id>/participants/<uuid:participant_id>/preferences/", CustomerParticipantPreferencesView.as_view()),
    path("reservations/<uuid:reservation_id>/participants/<uuid:participant_id>/checklist/", CustomerParticipantChecklistView.as_view()),
    path("reservations/<uuid:reservation_id>/preferences/", CustomerReservationPreferencesView.as_view(), name="customer-reservation-preferences"),
    path("reservations/<uuid:reservation_id>/balance-payment/", BalancePaymentView.as_view()),
    path("reservations/<uuid:reservation_id>/balance-payment/confirm/", BalancePaymentConfirmView.as_view()),
    path("guest/<str:token>/", CustomerGuestDetailView.as_view(), name="customer-guest-detail"),
    path("guest/<str:token>/preferences/", CustomerGuestPreferencesView.as_view(), name="customer-guest-preferences"),
    path("guest/<str:token>/checklist/", CustomerGuestChecklistView.as_view(), name="customer-guest-checklist"),
]
