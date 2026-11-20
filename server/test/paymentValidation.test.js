"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { toCents, verifyBkashPayment } = require("../utils/paymentValidation");

const payment = {
  amount: "125.50",
  merchant_invoice_number: "FF-1234",
  bkash_payment_id: "PAY-1234"
};

test("converts monetary values to integer paisa", () => {
  assert.equal(toCents("125.50"), 12550);
  assert.equal(toCents("invalid"), null);
});

test("accepts a completed payment whose returned details match", () => {
  assert.doesNotThrow(() => verifyBkashPayment(payment, {
    amount: "125.50",
    currency: "BDT",
    merchantInvoiceNumber: "FF-1234",
    paymentID: "PAY-1234",
    transactionStatus: "Completed"
  }));
});

test("rejects a completed response with a mismatched amount or invoice", () => {
  assert.throws(
    () => verifyBkashPayment(payment, {
      amount: "1.00",
      merchantInvoiceNumber: "FF-1234",
      transactionStatus: "Completed"
    }),
    /amount does not match/
  );
  assert.throws(
    () => verifyBkashPayment(payment, {
      amount: "125.50",
      merchantInvoiceNumber: "OTHER-INVOICE",
      transactionStatus: "Completed"
    }),
    /invoice does not match/
  );
});

test("rejects unsupported currency and non-completed status", () => {
  assert.throws(
    () => verifyBkashPayment(payment, {
      amount: "125.50",
      merchantInvoiceNumber: "FF-1234",
      currency: "USD",
      transactionStatus: "Completed"
    }),
    /currency is not supported/
  );
  assert.throws(
    () => verifyBkashPayment(payment, { transactionStatus: "Initiated" }),
    /did not confirm a completed transaction/
  );
  assert.throws(
    () => verifyBkashPayment(payment, {
      amount: "125.50",
      currency: "BDT",
      transactionStatus: "Completed"
    }),
    /invoice does not match/
  );
});
