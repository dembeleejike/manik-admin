// What a sale looks like AFTER returns and refunds. The server keeps the original
// sale untouched and records returns beside it; every screen reads these numbers.
const r2 = (n) => Math.round(n * 100) / 100;
const r4 = (n) => Math.round(n * 10000) / 10000;

export function saleNet(s) {
  const returnedQty = s.returnedQuantity || 0;
  const returnedAmt = s.returnedAmount || 0;
  const refunded = s.refundedAmount || 0;
  const qty = r4(s.quantity - returnedQty);
  const total = r2(s.totalAmount - returnedAmt); // what the customer still has to pay for
  const paid = r2(s.amountPaid - refunded); // money actually kept
  return {
    qty, total, paid, returnedQty, returnedAmt, refunded,
    owed: Math.max(0, r2(total - paid)),
    credit: Math.max(0, r2(paid - total)), // overpaid, not yet handed back
    fullyReturned: qty <= 0.00005,
    hasReturns: returnedQty > 0,
  };
}

// The same limits the server enforces, so the form can show them before saving.
// Returns { leftQty, leftValue, defaultAmount, maxRefund(amount) }.
export function returnLimits(s, quantity) {
  const n = saleNet(s);
  const leftQty = n.qty;
  const leftValue = r2(s.totalAmount - (s.returnedAmount || 0));
  const q = Number(quantity) || 0;
  const defaultAmount = Math.abs(q - leftQty) < 0.00005 ? leftValue : r2(q * s.unitPrice);
  const maxRefundFor = (amount) => Math.max(0, r2(n.paid - (leftValue - (Number(amount) || 0))));
  return { leftQty, leftValue, defaultAmount, maxRefundFor, netPaid: n.paid };
}
