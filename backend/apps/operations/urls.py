from django.urls import path

from .views import *

urlpatterns = [
    path("login/", LoginView.as_view(), name="operations-login"),
    path("dev/clear-data/", ClearDevelopmentDataView.as_view(), name="operations-clear-development-data"),
    path("overview/", OverviewView.as_view(), name="operations-overview"),
    path("reservations/", ReservationListView.as_view(), name="operations-reservations"),
    path("reservations/<uuid:reservation_id>/", ReservationDetailView.as_view()),
    path("reservations/<uuid:reservation_id>/manual-payment/", ManualPaymentView.as_view()),
    path("reservations/<uuid:reservation_id>/cancel/", CancelReservationView.as_view()),
    path("expeditions/", ExpeditionListCreateView.as_view(), name="operations-expeditions"),
    path("expeditions/<uuid:pk>/", ExpeditionDetailView.as_view(), name="operations-expedition-detail"),
    path("expeditions/<uuid:expedition_id>/configuration/", ExpeditionConfigurationView.as_view()),
    path("expeditions/<uuid:expedition_id>/consolidation/", ConsolidationView.as_view()),
    path("expeditions/<uuid:expedition_id>/consolidation.csv", ConsolidationCsvView.as_view()),
    path("expeditions/<uuid:expedition_id>/consolidation.txt", ConsolidationTxtView.as_view()),
]
