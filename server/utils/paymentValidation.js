"use strict";

function toCents(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

function verifyBkashPayment(payment, response) {
  if (response.transactionStatus !== "Completed") {
    throw new Error("bKash did not confirm a completed transaction.");
  }

  if (
    response.amount === undefined ||
    toCents(response.amount) !== toCents(payment.amount)
  ) {
    throw new Error("The confirmed bKash amount does not match the reservation.");
  }

  if (
    response.merchantInvoiceNumber !== payment.merchant_invoice_number
  ) {
    throw new Error("The confirmed bKash invoice does not match the reservation.");
  }

  if (response.currency !== "BDT") {
    throw new Error("The confirmed bKash currency is not supported.");
  }

  if (
    response.paymentID !== payment.bkash_payment_id
  ) {
    throw new Error("The confirmed bKash payment ID does not match.");
  }
}

module.exports = { toCents, verifyBkashPayment };
