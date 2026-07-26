import assert from 'node:assert/strict';
import test from 'node:test';
import contactEnquiryEmail from '../src/templates/email/contactEnquiryEmail.js';

test('contact enquiry email includes submitted details and escapes HTML', () => {
  const email = contactEnquiryEmail({
    name: 'Nisha <script>',
    email: 'nisha@example.com',
    phone: '9876543210',
    subject: 'Sizing and styling',
    message: 'Please help <b>with sizing</b>.',
  });

  assert.match(email.subject, /Sizing and styling/);
  assert.match(email.text, /nisha@example\.com/);
  assert.match(email.html, /Nisha &lt;script&gt;/);
  assert.match(email.html, /&lt;b&gt;with sizing&lt;\/b&gt;/);
  assert.doesNotMatch(email.html, /<script>/);
});
