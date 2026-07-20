# Amorah Uploads

Amorah stores permanent category, product and banner images in Cloudinary. Backend uploads use Multer memory storage, then stream buffers directly to Cloudinary. Permanent files must not be stored in `Backend/uploads`.

## Environment

Add these values to `Backend/.env`:

```env
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_PRODUCT_FOLDER=amorah/products
CLOUDINARY_CATEGORY_FOLDER=amorah/categories
CLOUDINARY_BANNER_FOLDER=amorah/banners
MAX_IMAGE_SIZE_MB=5
MAX_IMAGES_PER_REQUEST=5
```

Cloudinary credentials stay in `Backend/.env`. Never expose API keys, secrets or signatures to frontend code.

## Limits

- Supported formats: JPEG, JPG, PNG, WebP and AVIF
- Rejected formats: SVG, GIF, PDF, executable files and unknown MIME types
- Default file size: 5 MB per image
- Default request limit: 10 images
- Allowed upload types: `product`, `category`, `banner`

## Endpoints

All upload routes require an authenticated admin.

### Upload Images

`POST /api/admin/uploads/images`

Content type: `multipart/form-data`

Fields:

- `uploadType`: `product`, `category` or `banner`
- `filenamePrefix`: optional, letters, numbers and hyphens after normalisation
- `images`: one or more image files

Example:

```bash
curl -X POST http://localhost:5000/api/admin/uploads/images \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -F "uploadType=product" \
  -F "filenamePrefix=printed-cotton-kurta" \
  -F "images=@./kurta-front.jpg"
```

Response:

```json
{
  "success": true,
  "message": "Image uploaded successfully",
  "data": {
    "images": [
      {
        "url": "https://res.cloudinary.com/example/image/upload/...",
        "secureUrl": "https://res.cloudinary.com/example/image/upload/...",
        "publicId": "amorah/products/printed-cotton-kurta-...",
        "width": 1200,
        "height": 1600,
        "format": "jpg",
        "bytes": 123456,
        "originalFilename": "kurta-front.jpg"
      }
    ]
  }
}
```

### Delete Image

`DELETE /api/admin/uploads/images`

```json
{
  "publicId": "amorah/products/printed-cotton-kurta-example"
}
```

Only public IDs beginning with `amorah/products/`, `amorah/categories/` or `amorah/banners/` may be deleted.

## Workflows

Category image workflow:

1. Admin uploads a category image with `uploadType=category`.
2. The API returns `url` and `publicId`.
3. Admin saves `{ "url": "", "publicId": "", "alt": "" }` on the category.
4. Image `alt` text is required when a category image URL exists.

Product colour workflow:

1. Admin selects a product colour.
2. Admin uploads that colour's real product images with `uploadType=product`.
3. The API returns Cloudinary image objects.
4. Admin saves them inside that product variant as `{ "url": "", "publicId": "", "alt": "", "sortOrder": 0, "isPrimary": true }`.
5. Customer selects the colour.
6. Storefront displays only that colour's images.

Banner workflow:

1. Admin uploads banner art with `uploadType=banner`.
2. Admin saves the returned image metadata in the future banner management feature.

## Deletion Safety

Deleting an image through the upload endpoint does not remove image references from Product or Category documents.

Correct future flow:

1. Admin removes the image from the product or category form.
2. Product or category update succeeds.
3. Frontend requests Cloudinary deletion for the unused `publicId`.

This avoids broken database references and avoids deleting images still used by active products. Callers must confirm an image is unused before deletion.

Cloudinary file upload will be connected to the admin category form during the admin product-panel phase.
