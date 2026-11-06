from django.core.management.base import BaseCommand
from apps.payments.reconciliation import reconcile_unknown_intents


class Command(BaseCommand):
    help = "Reconcile interrupted Mercado Pago payment attempts."

    def handle(self, *args, **options):
        count = reconcile_unknown_intents()
        self.stdout.write(f"Reconciled {count} payment intents")
