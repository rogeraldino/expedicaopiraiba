import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.core import signing
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from .models import Customer, VerificationChallenge
from .validators import normalize_phone, validate_cpf


MAX_ATTEMPTS = 5
CUSTOMER_SESSION_SALT = "customer-session"


@transaction.atomic
def start_verification(*, cpf, full_name, email, phone):
    normalized_cpf = validate_cpf(cpf)
    normalized_phone = normalize_phone(phone)
    customer, created = Customer.objects.select_for_update().get_or_create(
        cpf=normalized_cpf,
        defaults={"full_name": full_name.strip(), "email": email.lower().strip(), "phone": normalized_phone},
    )
    if not created and (customer.full_name != full_name.strip() or customer.email != email.lower().strip() or customer.phone != normalized_phone):
        customer.full_name = full_name.strip()
        customer.email = email.lower().strip()
        customer.phone = normalized_phone
        customer.save(update_fields=("full_name", "email", "phone", "updated_at"))
    VerificationChallenge.objects.filter(customer=customer, verified_at__isnull=True).delete()
    code = f"{secrets.randbelow(1_000_000):06d}"
    challenge = VerificationChallenge.objects.create(
        customer=customer,
        channel=VerificationChallenge.Channel.WHATSAPP,
        code_digest=make_password(code),
        expires_at=timezone.now() + timedelta(minutes=settings.OTP_EXPIRY_MINUTES),
    )
    return challenge, code


@transaction.atomic
def verify_challenge(*, challenge_id, code):
    try:
        challenge = VerificationChallenge.objects.select_for_update().select_related("customer").get(id=challenge_id)
    except (VerificationChallenge.DoesNotExist, ValidationError):
        raise ValidationError("Código inválido ou expirado.")
    now = timezone.now()
    if challenge.verified_at or challenge.expires_at <= now or challenge.attempts >= MAX_ATTEMPTS:
        raise ValidationError("Código inválido ou expirado.")
    challenge.attempts += 1
    if not check_password(str(code), challenge.code_digest):
        challenge.save(update_fields=("attempts",))
        raise ValidationError("Código inválido ou expirado.")
    challenge.verified_at = now
    challenge.consumed_at = now
    challenge.save(update_fields=("attempts", "verified_at", "consumed_at"))
    challenge.customer.phone_verified_at = now
    challenge.customer.save(update_fields=("phone_verified_at", "updated_at"))
    token = signing.dumps({"challenge_id": str(challenge.id), "customer_id": str(challenge.customer_id)}, salt="checkout-verification")
    return token


def customer_from_token(token):
    try:
        payload = signing.loads(token, salt="checkout-verification", max_age=900)
        challenge = VerificationChallenge.objects.select_related("customer").get(
            id=payload["challenge_id"], customer_id=payload["customer_id"], verified_at__isnull=False
        )
    except (signing.BadSignature, signing.SignatureExpired, KeyError, VerificationChallenge.DoesNotExist, ValidationError):
        raise ValidationError("Verificação expirada. Solicite um novo código.")
    return challenge.customer


def create_customer_session_token(customer):
    return signing.dumps({"customer_id": str(customer.id)}, salt=CUSTOMER_SESSION_SALT, compress=True)


def customer_from_session_token(token):
    try:
        payload = signing.loads(token, salt=CUSTOMER_SESSION_SALT, max_age=60 * 60 * 24 * 30)
        return Customer.objects.get(id=payload["customer_id"])
    except (signing.BadSignature, signing.SignatureExpired, KeyError, Customer.DoesNotExist, ValidationError):
        raise ValidationError("Sessão expirada. Confirme seu contato novamente.")
