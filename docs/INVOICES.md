# Amorah Invoices

Amorah generates invoice PDFs on demand from immutable Order snapshots. PDF files are created in memory and are not stored permanently on the backend filesystem.

## Environment Variables

Configure these in `Backend/.env`:

```env
INVOICE_ENABLED=true
INVOICE_PREFIX=AMR-INV
INVOICE_DOCUMENT_TYPE=receipt

BUSINESS_LEGAL_NAME=
BUSINESS_DISPLAY_NAME=Amorah
BUSINESS_ADDRESS_LINE_1=
BUSINESS_ADDRESS_LINE_2=
BUSINESS_CITY=
BUSINESS_STATE=
BUSINESS_POSTAL_CODE=
BUSINESS_COUNTRY=India

BUSINESS_EMAIL=
BUSINESS_PHONE=
BUSINESS_WEBSITE=

BUSINESS_GSTIN=
BUSINESS_PAN=
BUSINESS_STATE_CODE=

INVOICE_LOGO_URL=
INVOICE_FOOTER_TEXT=Thank you for shopping with Amorah.
```

Do not put real client secrets or private tax data in `.env.example`.

## Document Modes

- `receipt`: Uses the heading `Order Receipt` and can be generated with basic Amorah business details.
- `invoice`: Uses the heading `Invoice` and requires complete business name and address details.
- `tax_invoice`: Uses the heading `Tax Invoice` only when complete legal, address, GSTIN, state-code and stored order tax-breakdown data exists.

Do not use `tax_invoice` mode without reviewing the implementation with the client's accountant or tax professional.

GST percentages, CGST, SGST, IGST, HSN codes, SAC codes and taxable values are not invented by the invoice service. GST-specific calculation and formal credit-note generation are deferred until the client's tax information is finalized.

## Number Format

Invoice numbers are assigned once using an atomic MongoDB counter:

```text
AMR-INV-2026-000001
```

The prefix comes from `INVOICE_PREFIX`. Existing invoice numbers remain unchanged.

## Eligibility

Invoices are available for paid or refunded Razorpay orders that have verified payment, valid stored totals, item snapshots, billing address snapshots and shipping address snapshots.

Invoices are blocked for unpaid, failed, pending-payment and unresolved payment-review orders.

Refunded orders keep the original invoice and show refund status separately. A credit note is not generated in this task.

## Endpoints

Customer download:

```text
GET /api/orders/:orderNumber/invoice
```

Customers can download only their own invoices.

Admin download:

```text
GET /api/admin/orders/:orderNumber/invoice
```

Admins can download invoices for eligible orders through protected admin routes.

Both endpoints return `application/pdf` with an attachment filename. They do not return invoice JSON.

## PDF Generation

PDFKit generates the document directly on the backend from stored Order snapshots. Product prices, customer addresses and totals are not read from current product, cart or address records.

The PDF includes:

- Amorah business header
- Receipt or invoice number
- Order number
- Invoice and order dates
- Payment and order status
- Billing and shipping addresses
- Purchased item table
- Stored subtotal, shipping, tax and total
- Refund information when applicable
- Customer support details
- Footer text

No permanent invoice directory is created, and no PDF binary or Base64 data is stored in MongoDB.

## Existing Orders

Existing eligible orders without invoice numbers receive one on first invoice download.

An optional backfill script is available:

```bash
npm run invoice:assign
```

Run it only against safe data. The script assigns numbers to eligible orders, skips ineligible orders, does not generate PDFs and does not print customer addresses or payment details.

## Testing Steps

1. Use a completed Razorpay Test Mode order.
2. Download the invoice as the customer.
3. Download again and confirm the invoice number is unchanged.
4. Edit the current Product name or price and confirm the old invoice still uses the Order snapshot.
5. Edit the customer's saved address and confirm the old invoice still uses the Order address snapshot.
6. Download from the admin endpoint and confirm the same invoice number.
7. Test a refunded order and confirm original sale totals plus refund status.
8. Confirm pending, failed and unresolved payment-review orders are rejected.
9. Test missing logo fallback, multiple products, long product names and multi-page PDFs.
10. Test receipt mode, invoice mode and tax-invoice rejection when configuration is incomplete.

