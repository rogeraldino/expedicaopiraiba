from django.contrib import admin

from .models import Customer


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ("full_name", "masked_cpf", "email", "phone")
    search_fields = ("full_name", "cpf", "email", "phone")

    @admin.display(description="CPF")
    def masked_cpf(self, customer):
        return f"***.***.***-{customer.cpf[-2:]}"
