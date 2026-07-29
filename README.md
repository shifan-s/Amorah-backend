# Amorah Backend

Node.js, Express.js and MongoDB backend foundation for Amorah N-ZAN Designs.

## Stack

- Node.js
- Express.js
- MongoDB with Mongoose
- ES modules
- dotenv, cors, helmet, morgan, compression, cookie-parser and rate limiting
- Cloudinary and Multer for admin-only image uploads

## Structure

```text
Backend/
  src/
    config/
    controllers/
    middleware/
    models/
    routes/
    services/
    utils/
    validators/
    app.js
    server.js
  tests/
  scripts/
  .env.example
  package.json
```

## Install

```bash
cd Backend
npm install
```

## Environment

Create `Backend/.env` locally using `Backend/.env.example`.

All secrets belong in `Backend/.env`. Never commit `Backend/.env`.

Required values:

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/amorah
CLIENT_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173
```

## Commands

```bash
npm run dev
npm start
npm run check
```

## Health Endpoints

- `GET /api`
- `GET /api/health`

## Media Uploads

Admin image uploads are available at `POST /api/admin/uploads/images`, and deletion is available at `DELETE /api/admin/uploads/images`.

Uploads support JPEG, JPG, PNG, WebP and AVIF files, use Multer memory storage, and stream directly to Cloudinary. See `Backend/docs/UPLOADS.md` for environment variables, examples, folder rules and deletion safety.

## Razorpay payments

Amorah uses Razorpay Standard Checkout only; Cash on Delivery is not supported. Install both
applications with `npm install` inside `Backend` and `frontend`.

Copy `Backend/.env.example` to `Backend/.env` and configure:

```env
RAZORPAY_KEY_ID=rzp_test_replace_me
RAZORPAY_KEY_SECRET=replace_me
RAZORPAY_WEBHOOK_SECRET=replace_me
FRONTEND_URL=http://localhost:5173
```

The Key ID identifies the account and is the only Razorpay value returned to the browser. The Key
Secret authenticates backend API operations. The Webhook Secret is a separate strong value chosen
when the webhook is configured; it is not necessarily the Key Secret. Both secrets stay on the
backend.

### Dashboard configuration

1. Open Razorpay Dashboard, enable Test Mode, and generate Test API keys.
2. Add the keys only to `Backend/.env`.
3. Deploy the backend or expose it with an approved public HTTPS development tunnel.
4. Configure `https://YOUR-BACKEND-DOMAIN/api/payments/razorpay/webhook`. `localhost` cannot be
   used because Razorpay must reach the endpoint over the public internet.
5. Choose a strong webhook secret and put the identical value in `RAZORPAY_WEBHOOK_SECRET`.
6. Enable `order.paid`, `payment.captured`, and `payment.failed`. For the existing refund workflow,
   also enable `refund.created`, `refund.processed`, `refund.failed`, and `refund.speed_changed`.
7. Save and enable the webhook. Make a Test Mode payment, then inspect safe backend logs, the
   MongoDB Order, and Razorpay webhook delivery logs.

### Testing checklist

1. Start MongoDB and run `npm run dev` in both applications.
2. Sign in, add an in-stock colour/size variant, save an address, and complete a successful test
   payment. Confirm paid/confirmed state, one stock deduction, cart clearing, and admin Razorpay IDs.
3. Try a failed test payment and dismiss Checkout. The cart must remain and the order must not be
   confirmed.
4. Retry a captured webhook from Razorpay. It must return 2xx without repeating inventory, cart, or
   email work.
5. Alter `x-razorpay-signature` and confirm HTTP 400 with no order change.
6. Deliver an old `payment.failed` event after capture and confirm the paid order stays paid.

Run:

```bash
cd Backend
npm run check
npm test
cd ../frontend
npm run build
```

No separate lint scripts currently exist; these are the repository's available quality gates.

### Live Mode deployment

1. Complete activation and settlement-bank verification in the client/business Razorpay account.
2. Deploy behind HTTPS with production MongoDB, allowed CORS origins, secure cookies, and backend
   environment variables.
3. Replace Test keys with the client/business Live keys. Never use a developer's personal account
   for the client's production store.
4. Create a separate Live Mode webhook and secret at the production URL with the same events.
5. Restart, check `/api/health`, place a controlled live order, and verify payment, webhook,
   MongoDB, inventory, cart, email, and admin results.
6. Keep Test and Live credentials separate and retain the documented rollback procedure.

See `Backend/docs/RAZORPAY.md` for implementation and refund details.

## Project Rules

Amorah supports main categories and one-level subcategories. Products also use `productType`, `style`, `fabric`, `occasion` and `tags` for discovery. Amorah has no coupons and no Cash on Delivery. Razorpay is the only payment gateway.
