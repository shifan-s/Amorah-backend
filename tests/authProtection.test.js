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

test('checkout, payment and customer order APIs reject unauthenticated requests', async () => {
  await withTestServer(async (baseUrl) => {
    const requests = [
      fetch(`${baseUrl}/api/checkout/preview`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
      fetch(`${baseUrl}/api/payments/razorpay/create-order`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
      fetch(`${baseUrl}/api/payments/razorpay/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
      fetch(`${baseUrl}/api/orders/my`),
    ];

    const responses = await Promise.all(requests);

    for (const response of responses) {
      assert.equal(response.status, 401);
      const body = await response.json();
      assert.equal(body.success, false);
      assert.equal(body.message, 'Authentication required');
    }
  });
});
