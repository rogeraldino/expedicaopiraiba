from django.core.management.base import BaseCommand

from apps.reservations.services import expire_holds


class Command(BaseCommand):
    help = "Expira reservas temporárias vencidas de forma idempotente."

    def handle(self, *args, **options):
        expired = expire_holds()
        self.stdout.write(self.style.SUCCESS(f"{expired} reserva(s) expirada(s)."))
