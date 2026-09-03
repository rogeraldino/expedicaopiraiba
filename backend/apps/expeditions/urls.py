from django.urls import path

from .views import PublishedExpeditionDetail, PublishedExpeditionList

urlpatterns = [
    path("", PublishedExpeditionList.as_view(), name="expedition-list"),
    path("<slug:slug>/", PublishedExpeditionDetail.as_view(), name="expedition-detail"),
]
