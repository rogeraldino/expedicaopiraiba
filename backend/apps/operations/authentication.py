import secrets

from django.conf import settings
from django.core import signing
from rest_framework import authentication, exceptions

TOKEN_SALT = "operations-admin"


def create_admin_token():
    return signing.dumps({"email": settings.ADMIN_EMAIL}, salt=TOKEN_SALT, compress=True)


def validate_credentials(email, password):
    return secrets.compare_digest(email.lower(), settings.ADMIN_EMAIL.lower()) and secrets.compare_digest(password, settings.ADMIN_PASSWORD)


class OperationsUser:
    is_authenticated = True
    is_staff = True
    email = "operations"


class OperationsAuthentication(authentication.BaseAuthentication):
    def authenticate(self, request):
        header = authentication.get_authorization_header(request).decode()
        if not header.startswith("Bearer "):
            return None
        try:
            data = signing.loads(header[7:], salt=TOKEN_SALT, max_age=60 * 60 * 12)
        except signing.BadSignature as error:
            raise exceptions.AuthenticationFailed("Sessão administrativa inválida ou expirada.") from error
        if data.get("email", "").lower() != settings.ADMIN_EMAIL.lower():
            raise exceptions.AuthenticationFailed("Administrador inválido.")
        return OperationsUser(), None
