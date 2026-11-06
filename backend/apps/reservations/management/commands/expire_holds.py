from django.core.management.base import BaseCommand

from apps.reservations.services import expire_holds
from apps.expeditions.services import close_expired_expeditions


class Command(BaseCommand):
    help = "Expira reservas temporárias vencidas de forma idempotente."

    def handle(self, *args, **options):
        expired = expire_holds()
        closed = close_expired_expeditions()
        self.stdout.write(self.style.SUCCESS(f"{expired} reserva(s) expirada(s)."))
        self.stdout.write(self.style.SUCCESS(f"{closed} expedição(ões) encerrada(s)."))
