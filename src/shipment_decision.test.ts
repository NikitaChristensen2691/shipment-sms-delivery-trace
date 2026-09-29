import assert from "node:assert/strict";
import test from "node:test";
import { notification, shipmentEvent } from "./shipment_decision.ts";

test("delivery stores proof without texting; exception texts the reason", () => {
  const common = { shipmentId: "ORDER-42", phone: "+14155550123", occurredAt: "2026-09-19T08:00:00Z" };
  const delivered = shipmentEvent.parse({ ...common, kind: "delivered", proofOfDelivery: { name: "signature.pdf", url: "https://store.example/signature.pdf" } });
  assert.equal(notification(delivered), null);
  const exception = shipmentEvent.parse({ ...common, kind: "exception", exceptionReason: "Address check needed" });
  assert.equal(notification(exception), "Shipment ORDER-42 needs attention: Address check needed");
  assert.equal(shipmentEvent.safeParse({ ...common, kind: "delivered" }).success, false);
});
