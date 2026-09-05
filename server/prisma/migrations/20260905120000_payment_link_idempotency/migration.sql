-- Durable payment-link claim so retries of POST /payments do not open a
-- second PayPal OrdersCreate for the same local order.
CREATE TABLE "PaymentLink" (
    "orderId"       TEXT         NOT NULL,
    "paypalOrderId" TEXT,
    "approvalUrl"   TEXT,
    "status"        TEXT         NOT NULL DEFAULT 'IN_PROGRESS',
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentLink_pkey" PRIMARY KEY ("orderId")
);

CREATE UNIQUE INDEX "PaymentLink_paypalOrderId_key"
ON "PaymentLink"("paypalOrderId");

ALTER TABLE "PaymentLink"
    ADD CONSTRAINT "PaymentLink_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
