from django.urls import path

from .customer_views import CustomerParticipantChecklistView, CustomerParticipantDetailView, CustomerParticipantPreferencesView, CustomerReservationDetailView, CustomerReservationPreferencesView
from apps.payments.views import BalancePaymentConfirmView, BalancePaymentView

urlpatterns = [
    path("reservations/<uuid:reservation_id>/", CustomerReservationDetailView.as_view(), name="customer-reservation-detail"),
    path("reservations/<uuid:reservation_id>/participants/<uuid:participant_id>/", CustomerParticipantDetailView.as_view(), name="customer-participant-detail"),
    path("reservations/<uuid:reservation_id>/participants/<uuid:participant_id>/preferences/", CustomerParticipantPreferencesView.as_view()),
    path("reservations/<uuid:reservation_id>/participants/<uuid:participant_id>/checklist/", CustomerParticipantChecklistView.as_view()),
    path("reservations/<uuid:reservation_id>/preferences/", CustomerReservationPreferencesView.as_view(), name="customer-reservation-preferences"),
    path("reservations/<uuid:reservation_id>/balance-payment/", BalancePaymentView.as_view()),
    path("reservations/<uuid:reservation_id>/balance-payment/confirm/", BalancePaymentConfirmView.as_view()),
]
