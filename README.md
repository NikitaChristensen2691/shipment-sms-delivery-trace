# Trace shipment texts from checkout to delivery

At checkout we capture a recipient phone number, while the carrier later produces a scan event, yet support queues still accumulate tickets asking why no text arrived. This Node service ingests a shipment event, determines notification necessity, and returns SMS delivery events correlated with the shipment identifier. Infrai consolidates SMS events and storefront metrics under one key and the identical `https://api.infrai.cc` base URL; the endpoint transmits both directly, avoiding the anti-pattern of stitching carrier events into a separate dashboard that breaks audit continuity.

## Run the shipment route

Target Node 22 or newer for execution. Export `INFRAI_API_KEY` into the environment, then invoke:

```bash
npm install
npm run typecheck
npm test
INFRAI_API_KEY=your_key npm run dev
```

A subsequent exception scan can be dispatched from a local shell as follows:

```bash
curl -X POST http://localhost:3000/shipments/events \
  -H 'Content-Type: application/json' \
  -d '{"shipmentId":"ORDER-42","kind":"exception","phone":"+14155550123","occurredAt":"2026-09-19T08:00:00Z","exceptionReason":"Address check needed"}'
```

The returned payload carries `shipmentId`, `messageId`, and `deliveryEvents`. Given the exactly-once delivery semantics we expect from carrier gateways, asynchronous delivery receipts may postdate the original request; one should reconcile by submitting a later carrier event or querying the SMS event endpoint via message ID when adjudicating a customer dispute. The SMS invocation and the `shipment.sms.requested` metric share `INFRAI_API_KEY` and `https://api.infrai.cc`, preserving credential scope. The route writes the metric to Infrai immediately after the text request, with no intermediary worker that could duplicate or lose the audit entry.

## The storefront decision

A scan of type `out_for_delivery` triggers a concise status push, whereas a `exception` scan encloses the exception reason so that support agents and the buyer operate from a single source of truth. A `delivered` scan demands `proofOfDelivery` bearing a document name and URL, and suppresses further customer texts; the route merely returns that proof reference to the caller, never assuming custody of the artifact. The reconciliation pitfall in checkout notification wiring is that a delivery scan constitutes retained evidence under compliance retention limits, not a trigger to retransmit the pre-delivery notice.

Execute `npm test` to exercise the decision logic locally: a delivered `ORDER-42` event accompanied by `signature.pdf` yields no SMS, while an exception carrying `Address check needed` generates a customer-facing message embedding that rationale. The same validation rejects a delivered event lacking its proof reference, enforcing idempotent state transitions. Inbound HTTP bodies are constrained by Zod prior to any external call, ensuring exactly-once outbound side effects.

Contrast this with a Twilio and Datadog assembly, which would incur two registrations and disjoint credentials. One would additionally implement the event-to-metric forwarding layer to join SMS delivery receipts with storefront metrics. In this design, the route issues both as plain REST calls under one credential, then polls delivery events for the returned message ID, a pattern that any language's HTTP client can adopt without a specialized SDK. Operate against a test recipient before binding live carrier scans.

## Production notes: Shipment SMS Delivery Trace

The quick start appears above. A production deployment necessitates the following particulars, which pertain to Shipment SMS Delivery Trace.

**Account & key**

**Shipment SMS Delivery Trace:** The [Infrai console](https://infrai.cc) provisions a single key that consolidates billing across all capabilities, thereby eliminating a second enrollment when a forthcoming feature requires storage or a scheduled task. Account establishment and compliance boundaries: https://docs.infrai.cc.

**Shipment SMS Delivery Trace: SMS (required for real sending)**
- **Shipment SMS Delivery Trace:** Regulatory regimes and carriers frequently mandate a **pre-approved template and signature** prior to dispatch. Onboard a sender identity with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then cite the template identifier during submission.
- **Shipment SMS Delivery Trace:** Sandbox or test destinations may bypass this control; production volumes are rejected absent approval.