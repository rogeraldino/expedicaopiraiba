import base64
import hashlib
import http.client
from http.cookies import SimpleCookie
import threading
import unittest

from gateway import Gate, COOKIE, LIFETIME, handler_for, ThreadingHTTPServer


class GatewayTests(unittest.TestCase):
    def setUp(self):
        self.now = 1_800_000_000
        salt = bytes(range(16))
        digest = hashlib.scrypt(b'test:password', salt=salt, n=16384, r=8, p=1, dklen=32)
        self.hashed = f'scrypt$16384$8$1${salt.hex()}${digest.hex()}'
        self.gate = Gate('rodrigo', self.hashed, 'a' * 64, 'sb.example.org', lambda: self.now)
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), handler_for(self.gate))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    def request(self, method='GET', path='/check', headers=None, body=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.server.server_port)
        connection.request(method, path, body=body, headers=headers or {})
        response = connection.getresponse()
        result = response.status, dict(response.getheaders())
        response.read()
        connection.close()
        return result

    def test_login_and_cookie_attributes(self):
        auth = base64.b64encode(b'rodrigo:test:password').decode()
        status, headers = self.request(path='/__sandbox/login', headers={'Authorization': 'Basic ' + auth})
        self.assertEqual(status, 303)
        self.assertEqual(headers['Location'], '/')
        self.assertEqual(headers['Cache-Control'], 'no-store')
        cookie = SimpleCookie(headers['Set-Cookie'])[COOKIE]
        for attribute in ('secure', 'httponly'):
            self.assertTrue(cookie[attribute])
        self.assertEqual(cookie['samesite'], 'Strict')
        self.assertEqual(cookie['path'], '/')
        self.assertEqual(cookie['domain'], '')
        self.assertEqual(int(cookie['max-age']), LIFETIME)
        status, _ = self.request(headers={'Cookie': f'{COOKIE}={cookie.value}', 'Authorization': 'Bearer application-token'})
        self.assertEqual(status, 200)

    def test_cookie_expiry_tamper_rotation_and_host(self):
        token = self.gate.issue()
        self.assertTrue(self.gate.valid_cookie(f'{COOKIE}={token}'))
        self.assertFalse(self.gate.valid_cookie(f'{COOKIE}={token}x'))
        for malformed in ('garbage', '.', 'e30=.bad', '💥'):
            self.assertFalse(self.gate.valid_cookie(f'{COOKIE}={malformed}'))
        self.now += LIFETIME
        self.assertFalse(self.gate.valid_cookie(f'{COOKIE}={token}'))
        self.now -= LIFETIME + 1
        self.assertFalse(self.gate.valid_cookie(f'{COOKIE}={token}'))
        self.now += 1
        for secret, host in [('b' * 64, 'sb.example.org'), ('a' * 64, 'www.example.org')]:
            other = Gate('rodrigo', self.hashed, secret, host, lambda: self.now)
            self.assertFalse(other.valid_cookie(f'{COOKIE}={token}'))

    def test_missing_cookie_api_methods_and_normalization(self):
        for uri in ('/api', '/api/', '/api/me', '//api/x', '/%61pi/x', '/x/../api/x'):
            status, _ = self.request(headers={'X-Forwarded-Method': 'GET', 'X-Forwarded-Uri': uri,
                                               'Authorization': 'Bearer valid-product-token'})
            self.assertEqual(status, 401, uri)
        for method in ('POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'):
            status, _ = self.request(headers={'X-Forwarded-Method': method, 'X-Forwarded-Uri': '/'})
            self.assertEqual(status, 401)
        for method in ('GET', 'HEAD'):
            status, headers = self.request(headers={'X-Forwarded-Method': method, 'X-Forwarded-Uri': '/admin'})
            self.assertEqual(status, 302)
            self.assertEqual(headers['Location'], '/__sandbox/login')
        self.assertEqual(self.request()[0], 401)

    def test_login_failure_rate_limit_and_window(self):
        for _ in range(5):
            status, headers = self.request(path='/__sandbox/login', headers={'Authorization': 'Bearer malformed'})
            self.assertEqual(status, 401)
            self.assertIn('WWW-Authenticate', headers)
        self.assertEqual(self.request(path='/__sandbox/login')[0], 429)
        self.now += 60
        self.assertEqual(self.request(path='/__sandbox/login')[0], 401)

    def test_query_string_keeps_cookie_enforcement_and_original_api_semantics(self):
        path = '/check?url=%2Fhome%2Fhero-desktop.webp&w=640&q=75'
        cookie = f'{COOKIE}={self.gate.issue()}'
        self.assertEqual(self.request(path=path, headers={'Cookie': cookie})[0], 200)
        for uri in ('/api/expeditions/?page=1', '/%61pi/operations/?q=abc'):
            self.assertEqual(self.request(path=path, headers={
                'X-Forwarded-Method': 'GET', 'X-Forwarded-Uri': uri,
            })[0], 401)
        for method in ('POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'):
            self.assertEqual(self.request(path=path, headers={
                'X-Forwarded-Method': method, 'X-Forwarded-Uri': '/?q=abc',
            })[0], 401)
        status, headers = self.request(path=path, headers={
            'X-Forwarded-Method': 'GET', 'X-Forwarded-Uri': '/_next/image?url=x',
        })
        self.assertEqual(status, 302)
        self.assertEqual(headers['Location'], '/__sandbox/login')
        self.assertEqual(self.request(path=path, headers={'Cookie': cookie + 'x'})[0], 401)

    def test_global_limit(self):
        for i in range(60):
            self.assertEqual(self.gate.authenticate('', str(i)), 401)
        self.assertEqual(self.gate.authenticate('', 'another'), 429)

    def test_reject_body_methods_headers_and_unknown_paths(self):
        self.assertEqual(self.request(path='/__sandbox/login', body='password')[0], 400)
        self.assertEqual(self.request(method='POST', path='/__sandbox/login')[0], 405)
        self.assertEqual(self.request(method='HEAD', path='/__sandbox/login')[0], 405)
        self.assertEqual(self.request(path='/__sandbox/login?return=https://evil.example')[0], 404)
        self.assertEqual(self.request(path='/unknown')[0], 404)
        self.assertEqual(self.request(path='/health')[0], 200)
        self.assertEqual(self.request(headers={'X-Large': 'a' * 17000})[0], 431)


if __name__ == '__main__':
    unittest.main()
