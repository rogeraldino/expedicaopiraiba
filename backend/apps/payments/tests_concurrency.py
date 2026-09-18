from concurrent.futures import ThreadPoolExecutor
from datetime import date
from threading import Barrier
from unittest import skipUnless

from django.db import close_old_connections, connection
from django.test import TransactionTestCase

from apps.customers.models import Customer
from apps.expeditions.models import Expedition
from apps.reservations.models import Reservation
from .models import Payment
from .services import create_balance_payment, simulate_paid_event


@skipUnless(connection.vendor == "postgresql", "Locks concorrentes exigem PostgreSQL")
class BalancePaymentConcurrencyTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        expedition = Expedition.objects.create(name="Concorrência", destination="GO", starts_at=date(2027, 5, 1), ends_at=date(2027, 5, 2), capacity=2, price_per_person_cents=1000, deposit_cents=300, status=Expedition.Status.PUBLISHED)
        self.customer = Customer.objects.create(cpf="52998224725", full_name="Concorrente", email="race@example.com", phone="62999999999")
        self.reservation = Reservation.objects.create(customer=self.customer, expedition=expedition, participant_count=1, status=Reservation.Status.CONFIRMED, unit_price_cents=1000, total_price_cents=1000, deposit_cents=300)
        Payment.objects.create(reservation=self.reservation, external_id="deposit-race", amount_cents=300, status=Payment.Status.PAID)

    def run_parallel(self, function):
        barrier = Barrier(2)
        def wrapped():
            close_old_connections(); barrier.wait(); result = function(); close_old_connections(); return result
        with ThreadPoolExecutor(max_workers=2) as executor:
            return [future.result() for future in (executor.submit(wrapped), executor.submit(wrapped))]

    def test_concurrent_creation_reuses_one_exact_charge_and_confirmation_never_overpays(self):
        payments = self.run_parallel(lambda: create_balance_payment(customer=self.customer, reservation_id=self.reservation.id))
        self.assertEqual(payments[0].id, payments[1].id)
        self.assertEqual(Payment.objects.filter(reservation=self.reservation, purpose=Payment.Purpose.BALANCE).count(), 1)
        payment_id = payments[0].id
        self.run_parallel(lambda: simulate_paid_event(Payment.objects.get(id=payment_id)))
        self.reservation.refresh_from_db()
        self.assertEqual(self.reservation.paid_amount_cents, self.reservation.total_price_cents)
        self.assertEqual(self.reservation.status, Reservation.Status.PAID)
