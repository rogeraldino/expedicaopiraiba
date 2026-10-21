#!/usr/bin/env python3
"""Sandbox-only access gate, behind trusted Caddy on a loopback-published port.

GATE_PASSWORD_HASH format: scrypt$16384$8$1$<salt hex>$<32-byte digest hex>.
Generate with hashlib.scrypt(password.encode(), salt=os.urandom(16),
n=16384, r=8, p=1, dklen=32). Never put plaintext passwords in this env.
Caddy MUST overwrite X-Real-IP, X-Forwarded-Method and X-Forwarded-Uri.
Browser Basic caches can renew the cookie; revoke by rotating password+secret.
"""
import base64
import hashlib
import hmac
from http import HTTPStatus
from http.cookies import SimpleCookie, CookieError
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
import posixpath
import secrets
import threading
import time
from urllib.parse import unquote

COOKIE = '__Host-piraiba_sandbox'
LIFETIME = 12 * 60 * 60
MAX_HEADERS = 16 * 1024


class Gate:
    def __init__(self, username, password_hash, secret, host, clock=time.time):
        algorithm, n, r, p, salt, digest = password_hash.split('$')
        if (algorithm, n, r, p) != ('scrypt', '16384', '8', '1'):
            raise ValueError('Unsupported password hash parameters')
        self.salt, self.digest = bytes.fromhex(salt), bytes.fromhex(digest)
        if len(self.salt) < 16 or len(self.digest) != 32 or len(secret) < 32:
            raise ValueError('Insufficient credential strength')
        if not username or not host or '/' in host:
            raise ValueError('Invalid gate identity')
        self.username, self.secret, self.host = username, secret.encode(), host
        self.clock, self.lock, self.failures = clock, threading.Lock(), {}

    def authenticate(self, authorization, ip):
        """Limit failed attempts before expensive password work; return HTTP status."""
        now = self.clock()
        with self.lock:
            self.failures = {key: [t for t in times if now - t < 60]
                             for key, times in self.failures.items()
                             if any(now - t < 60 for t in times)}
            if len(self.failures.get(ip, [])) >= 5 or sum(map(len, self.failures.values())) >= 60:
                return 429
            user = password = ''
            try:
                scheme, encoded = authorization.split(' ', 1)
                if scheme.lower() != 'basic':
                    raise ValueError()
                user, password = base64.b64decode(encoded, validate=True).decode('utf-8').split(':', 1)
            except (ValueError, UnicodeError):
                pass
            actual = hashlib.scrypt(password.encode(), salt=self.salt, n=16384, r=8, p=1, dklen=32)
            valid = hmac.compare_digest(actual, self.digest)
            valid &= hmac.compare_digest(user.encode(), self.username.encode())
            if valid:
                return 200
            self.failures.setdefault(ip, []).append(now)
            return 401

    def issue(self):
        payload = json.dumps({'iat': int(self.clock()), 'nonce': secrets.token_hex(16)},
                             separators=(',', ':')).encode()
        encoded = base64.urlsafe_b64encode(payload).rstrip(b'=')
        signature = hmac.new(self.secret, self.host.encode() + b'\0' + encoded, hashlib.sha256).hexdigest()
        return encoded.decode() + '.' + signature

    def valid_cookie(self, header):
        try:
            cookie = SimpleCookie()
            cookie.load(header)
            token = cookie[COOKIE].value
            encoded, signature = token.split('.')
            expected = hmac.new(self.secret, self.host.encode() + b'\0' + encoded.encode(), hashlib.sha256).hexdigest()
            if not hmac.compare_digest(signature, expected):
                return False
            payload = json.loads(base64.b64decode(encoded + '=' * (-len(encoded) % 4), altchars=b'-_', validate=True))
            issued = payload['iat']
            return (type(issued) is int and 0 <= self.clock() - issued < LIFETIME
                    and isinstance(payload['nonce'], str) and len(payload['nonce']) == 32)
        except (ValueError, KeyError, TypeError, CookieError, UnicodeError):
            return False


def api_path(uri):
    path = uri.partition('?')[0]
    # Be conservative for encoded/slash/dot variants. No API may become public.
    for _ in range(3):
        path = unquote(path)
    path = '/' + posixpath.normpath('/' + path.lstrip('/')).lstrip('/')
    return path == '/api' or path.startswith('/api/')


def handler_for(gate):
    class Handler(BaseHTTPRequestHandler):
        server_version = 'SandboxGate'
        sys_version = ''

        def log_message(self, *args):
            pass  # Never emit URLs, Authorization or cookies.

        def setup(self):
            super().setup()
            self.connection.settimeout(10)

        def respond(self, status, headers=None):
            self.send_response(status)
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', '0')
            for key, value in (headers or {}).items():
                self.send_header(key, value)
            self.end_headers()

        def parse_request(self):
            if not super().parse_request():
                return False
            if sum(len(k) + len(v) + 4 for k, v in self.headers.items()) > MAX_HEADERS:
                self.respond(431)
                self.close_connection = True
                return False
            for name in ('Authorization', 'Cookie', 'Content-Length', 'X-Real-IP',
                         'X-Forwarded-Method', 'X-Forwarded-Uri'):
                if len(self.headers.get_all(name, [])) > 1:
                    self.respond(400)
                    self.close_connection = True
                    return False
            if self.headers.get('Transfer-Encoding') or self.headers.get('Content-Length', '0') != '0':
                self.respond(400)
                self.close_connection = True
                return False
            return True

        def do_GET(self):
            if self.path == '/health':
                return self.respond(200)
            if self.path == '/__sandbox/login':
                status = gate.authenticate(self.headers.get('Authorization', ''), self.headers.get('X-Real-IP', 'unknown'))
                if status != 200:
                    headers = {'WWW-Authenticate': 'Basic realm="Piraiba sandbox", charset="UTF-8"'} if status == 401 else {'Retry-After': '60'}
                    return self.respond(status, headers)
                return self.respond(303, {'Location': '/', 'Set-Cookie':
                    f'{COOKIE}={gate.issue()}; Max-Age={LIFETIME}; Path=/; Secure; HttpOnly; SameSite=Strict'})
            # Caddy retains the original query when rewriting forward_auth to
            # /check. Route on the path while still checking the original URI
            # below; login and health deliberately retain their strict routes.
            if self.path.partition('?')[0] == '/check':
                if gate.valid_cookie(self.headers.get('Cookie', '')):
                    return self.respond(200)
                method = self.headers.get('X-Forwarded-Method', '')
                uri = self.headers.get('X-Forwarded-Uri', '')
                if method in ('GET', 'HEAD') and uri.startswith('/') and not api_path(uri):
                    return self.respond(302, {'Location': '/__sandbox/login'})
                return self.respond(401)
            self.respond(404)

        def reject_method(self):
            if self.path in ('/__sandbox/login', '/check', '/health'):
                self.respond(405, {'Allow': 'GET'})
            else:
                self.respond(404)

        do_HEAD = reject_method
        do_POST = reject_method
        do_PUT = reject_method
        do_PATCH = reject_method
        do_DELETE = reject_method
        do_OPTIONS = reject_method
        do_TRACE = reject_method

    return Handler


if __name__ == '__main__':
    gate = Gate(*(os.environ[key] for key in
                  ('GATE_USERNAME', 'GATE_PASSWORD_HASH', 'GATE_COOKIE_SECRET', 'GATE_HOST')))
    server = ThreadingHTTPServer(('0.0.0.0', 8090), handler_for(gate))
    server.daemon_threads = True
    server.serve_forever()
