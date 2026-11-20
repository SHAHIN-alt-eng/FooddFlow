# bKash sandbox setup

For the local project demo, set `BKASH_DEMO_MODE=true` in the project-root `.env` (or `server/.env` when no root `.env` exists). It shows a clearly labeled local simulation and completes the reservation locally. It does not collect wallet, PIN, or OTP details and does not move real money.

To use the real bKash Checkout sandbox instead, set `BKASH_DEMO_MODE=false` and then:

1. Create or use a Checkout sandbox merchant at https://merchantdemo.sandbox.bka.sh/.
2. Copy its app key, app secret, username, and password into `server/.env` using the matching `BKASH_*` keys in `.env.example`.
3. Set `BKASH_CALLBACK_URL` to a public HTTPS URL that routes to `/api/payments/bkash/callback`. A localhost callback cannot be reached by bKash's servers.
4. Set `CLIENT_PAYMENT_RESULT_URL` to the deployed `client/payment-result.html` URL.
5. Start the API with `npm start` from `server` and publish a meal with a price.

The student is redirected to bKash to pay. FoodFlow only activates the reservation and QR token after the execute response says `Completed`.

Each payment is attributed to the staff member who published the meal and is visible in that staff member's **Payments received** panel. bKash Checkout credits the configured merchant wallet; sending money automatically to individual staff wallets requires a separately approved bKash Payout product and is not part of normal Checkout.
