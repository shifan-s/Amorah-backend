# Amorah Razorpay Setup

Amorah uses Razorpay Standard Checkout with all sensitive operations handled by the backend.

## Development Setup

1. Create or use the client's Razorpay business account.
2. Use Razorpay Test Mode during development.
3. Generate a Test Mode Key ID and Key Secret.
4. Add credentials only to `Backend/.env`.
5. Never place the Key Secret in Vite environment variables or frontend code.

Required backend variables:

```env
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
RAZORPAY_CURRENCY=INR
RAZORPAY_COMPANY_NAME=Amorah
RAZORPAY_COMPANY_DESCRIPTION=Secure payment for your Amorah order
RAZORPAY_LOGO_URL=
```

## Webhooks

Configure the webhook URL in Razorpay:

```text
https://YOUR_BACKEND_DOMAIN/api/payments/razorpay/webhook
```

Create a separate webhook secret and store it only in `Backend/.env` as `RAZORPAY_WEBHOOK_SECRET`.

Subscribe to:

- `payment.captured`
- `payment.failed`
- `order.paid`
- `refund.created`
- `refund.processed`
- `refund.failed`
- `refund.speed_changed`

Webhook signatures are verified using the raw request body. Do not place JSON parsing middleware in front of the webhook route.

## Refunds

Amorah supports admin-initiated full refunds only. Partial refunds, customer-initiated refunds, store credit and Cash on Delivery refunds are not supported.

Refund controls are available to authenticated admins only. The frontend sends only the order number and an admin reason; the backend calculates the refund amount from the stored order total and uses the stored Razorpay payment ID. Never accept refund amounts, payment IDs or Razorpay refund IDs from browser input.

Refund lifecycle:

1. Admin approves cancellation and the order is marked refund required.
2. Admin initiates a full refund from the admin refund screen.
3. Backend creates a refund record with a server-generated idempotency key.
4. Backend sends the Razorpay refund request using `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` from `Backend/.env`.
5. Razorpay refund webhooks reconcile the refund status.
6. Inventory is restored only after Razorpay confirms the refund is processed.
7. Customers see read-only refund status in their account order pages.

Operational notes:

- Test the complete flow in Razorpay Test Mode before enabling Live Mode.
- Keep webhook delivery enabled for refund events in both Test Mode and Live Mode.
- Failed refund attempts keep the order paid and cancellation refund-required, so an admin can retry after resolving the issue.
- If inventory restoration fails after a processed refund, the refund remains processed and admins must correct inventory manually.

## Production Notes

- Confirm payment-capture settings before production.
- Replace Test Mode keys with Live Mode keys only after final testing and account activation.
- Use HTTPS in production.
- Do not assume Live Mode is available until the client completes Razorpay onboarding and activation.
