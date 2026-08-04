import assert from 'node:assert/strict';
import test from 'node:test';
import app from '../src/app.js';

async function withTestServer(callback) {
  const server = app.listen(0);

  try {
    const { port } = server.address();
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test('localhost frontend receives credentialed CORS headers on unauthenticated JSON responses', async () => {
  await withTestServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        origin: 'http://localhost:5173',
      },
    });

    assert.equal(response.status, 401);
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true');

    const body = await response.json();
    assert.equal(body.message, 'Authentication required');
  });
});

test('live Amorah frontend receives credentialed CORS headers', async () => {
  await withTestServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        origin: 'https://www.amorah.online',
      },
    });

    assert.equal(response.status, 401);
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://www.amorah.online');
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
  });
});

test('login OPTIONS preflight succeeds with the required CORS headers', async () => {
  await withTestServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'OPTIONS',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });

    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
    assert.match(response.headers.get('access-control-allow-methods') || '', /POST/);
  });
});

test('Vite fallback ports receive credentialed CORS headers in development', async () => {
  await withTestServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/contact/enquiries`, {
      method: 'OPTIONS',
      headers: {
        origin: 'http://localhost:5174',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });

    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5174');
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
  });
});

test('untrusted non-loopback origins remain blocked', async () => {
  await withTestServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        origin: 'https://example.com',
      },
    });

    assert.equal(response.status, 403);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
  });
});

test('localhost frontend receives CORS headers on 404 responses', async () => {
  await withTestServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/not-a-route`, {
      headers: {
        origin: 'http://localhost:5173',
      },
    });

    assert.equal(response.status, 404);
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
  });
});

test('bearer headers do not authenticate the cookie-only session', async () => {
  await withTestServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        authorization: 'Bearer not-a-cookie-session',
        origin: 'http://localhost:5173',
      },
    });

    assert.equal(response.status, 401);
  });
});
