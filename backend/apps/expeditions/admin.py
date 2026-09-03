from django.contrib import admin

from .models import Expedition


@admin.register(Expedition)
class ExpeditionAdmin(admin.ModelAdmin):
    list_display = ("name", "starts_at", "capacity", "status")
    list_filter = ("status", "starts_at")
    prepopulated_fields = {"slug": ("name",)}
    search_fields = ("name", "destination")
