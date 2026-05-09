# Hovaluxe Backend

Production-ready Express + MongoDB API for the Hovaluxe storefront.

## Features
- Admin authentication with JWT
- Product catalog CRUD
- Public storefront config endpoint
- Flutterwave checkout initialization and verification
- Flutterwave webhook support
- Manual WhatsApp order recording from admin panel
- Order status management and dashboard summary

## Quick start
1. Copy `.env.example` to `.env`
2. Set MongoDB and Flutterwave credentials
3. Run `npm install`
4. Run `npm run dev`

## Default routes
- `GET /health`
- `GET /api/config/public`
- `GET /api/products`
- `POST /api/payments/flutterwave/checkout`
- `GET /api/payments/flutterwave/verify`
- `POST /api/webhooks/flutterwave`
- `POST /api/admin/login`
- `GET /api/admin/summary`
