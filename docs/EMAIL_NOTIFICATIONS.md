# Amorah Transactional Email Notifications

Amorah uses Nodemailer with generic SMTP settings for order-related transactional emails only. Marketing emails, newsletters, WhatsApp notifications and invoice PDF attachments are intentionally out of scope.

## Required Variables

Add SMTP settings to `Backend/.env` only:

```env
EMAIL_ENABLED=true
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=

EMAIL_FROM_NAME=Amorah
EMAIL_FROM_ADDRESS=
EMAIL_REPLY_TO=
SUPPORT_EMAIL=
ADMIN_ORDER_EMAIL=

EMAIL_LOGO_URL=
FRONTEND_URL=http://localhost:5173
EMAIL_CONNECTION_TIMEOUT_MS=10000
EMAIL_GREETING_NAME=Amorah Customer Care
TEST_EMAIL_TO=
```

Do not place SMTP credentials in frontend `.env` files.

## Supported Events

- Order confirmation after verified captured Razorpay payment
- Order shipped
- Order out for delivery
- Order delivered
- Customer cancellation request acknowledgment
- Admin cancellation request notification
- Cancellation approved
- Cancellation rejected
- Refund initiated
- Refund processed
- Refund failed

## Behaviour

`EMAIL_ENABLED=false` records email attempts as `skipped`. Missing SMTP configuration also records skipped attempts with a safe internal reason. Email failures never reverse payment, stock, cart or order-status changes.

Order-confirmation emails are sent only after payment verification, inventory application and cart processing have succeeded. Duplicate Razorpay verification or webhook delivery uses the same email dedupe key, so only one confirmation is sent.

## Test Email

Configure `TEST_EMAIL_TO` and run:

```bash
npm run email:test
```

The script sends one simple SMTP test email and does not use a customer order.

## Failed Notifications

Admins can inspect attempts:

```text
GET /api/admin/email-notifications
```

Useful filters include `orderNumber`, `eventType`, `status`, `recipient`, `dateFrom` and `dateTo`.

Retry a failed or skipped notification:

```text
POST /api/admin/email-notifications/:notificationId/retry
```

Retry uses the saved notification and current order data. It does not accept custom recipient, subject, HTML or text, so it cannot become an open email relay.

## SMTP Examples

Provider-neutral examples:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=transactional@example.com
SMTP_PASS=replace-with-provider-password
EMAIL_FROM_ADDRESS=orders@example.com
```

For SSL SMTP:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_SECURE=true
```

## Production Notes

- Use HTTPS for `FRONTEND_URL` so email links are secure.
- Configure `ADMIN_ORDER_EMAIL` for cancellation-review alerts.
- Never include Razorpay signatures, Razorpay secrets, SMTP secrets or private admin notes in email content.
- Refund emails never include Razorpay secrets, payment signatures or private admin notes.
- Invoice attachments will be added in a separate phase.
