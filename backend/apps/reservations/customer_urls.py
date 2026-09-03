from django.urls import path

from .customer_views import CustomerParticipantDetailView, CustomerReservationDetailView, CustomerReservationPreferencesView

urlpatterns = [
    path("reservations/<uuid:reservation_id>/", CustomerReservationDetailView.as_view(), name="customer-reservation-detail"),
    path("reservations/<uuid:reservation_id>/participants/<uuid:participant_id>/", CustomerParticipantDetailView.as_view(), name="customer-participant-detail"),
    path("reservations/<uuid:reservation_id>/preferences/", CustomerReservationPreferencesView.as_view(), name="customer-reservation-preferences"),
]
