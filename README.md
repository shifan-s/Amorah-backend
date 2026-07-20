# Amorah Backend

Node.js, Express.js and MongoDB backend foundation for Amorah by N-ZAN Designs.

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

## Project Rules

Amorah supports main categories and one-level subcategories. Products also use `productType`, `style`, `fabric`, `occasion` and `tags` for discovery. Amorah has no coupons and no Cash on Delivery. Razorpay will be the only payment gateway later.
