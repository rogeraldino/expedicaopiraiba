"""Settings for isolated HTTPS deployments; local development is unchanged."""
import os

from .settings import *  # noqa: F403

DEBUG = False
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SAMESITE = 'Strict'
CSRF_COOKIE_SAMESITE = 'Strict'
SESSION_COOKIE_NAME = os.environ['SESSION_COOKIE_NAME']
CSRF_COOKIE_NAME = os.environ['CSRF_COOKIE_NAME']
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
# HTTPS is enforced by Caddy. Loopback health checks must remain available.
SECURE_SSL_REDIRECT = False
