from django.urls import path

from .views import ClearDevelopmentDataView, ExpeditionDetailView, ExpeditionListCreateView, LoginView, OverviewView, ReservationListView

urlpatterns = [
    path("login/", LoginView.as_view(), name="operations-login"),
    path("dev/clear-data/", ClearDevelopmentDataView.as_view(), name="operations-clear-development-data"),
    path("overview/", OverviewView.as_view(), name="operations-overview"),
    path("reservations/", ReservationListView.as_view(), name="operations-reservations"),
    path("expeditions/", ExpeditionListCreateView.as_view(), name="operations-expeditions"),
    path("expeditions/<uuid:pk>/", ExpeditionDetailView.as_view(), name="operations-expedition-detail"),
]
