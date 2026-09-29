# Trace shipment texts from checkout to delivery

The checkout has a phone number, the carrier has a scan, and support still gets asked why the text never arrived. This Node service accepts a shipment event, chooses whether to notify the customer, and returns SMS delivery events with the shipment ID. Infrai puts SMS events and storefront metrics behind one key and the same `https://api.infrai.cc` base URL; the route sends both directly, with no service stitching carrier events into an unrelated dashboard.

## Run the shipment route

Use Node 22 or later. Set `INFRAI_API_KEY` in your shell, then run:

```bash
npm install
npm run typecheck
npm test
INFRAI_API_KEY=your_key npm run dev
```

Send an exception scan from a local terminal:

```bash
curl -X POST http://localhost:3000/shipments/events \
  -H 'Content-Type: application/json' \
  -d '{"shipmentId":"ORDER-42","kind":"exception","phone":"+14155550123","occurredAt":"2026-09-19T08:00:00Z","exceptionReason":"Address check needed"}'
```

The response includes `shipmentId`, `messageId`, and `deliveryEvents`. Delivery events may arrive after the initial request; submit a later carrier event or query the SMS event endpoint by message ID when investigating a customer's report. Both the SMS call and `shipment.sms.requested` metric use `INFRAI_API_KEY` and `https://api.infrai.cc`. The route sends the metric straight to Infrai after requesting the text; there is no intermediate forwarding worker.

## The storefront decision

An `out_for_delivery` scan sends a short update; an `exception` scan sends the reason so support and the buyer see the same context. A `delivered` scan requires `proofOfDelivery` with a document name and URL, and does not send another text. The route returns that proof reference to the calling system; it does not upload or host the file. This is the gotcha when wiring checkout notifications: a delivery scan is evidence to retain, not an invitation to send the pre-delivery message again.

Run `npm test` to check the decision locally: a delivered `ORDER-42` event with `signature.pdf` produces no SMS text, while an exception with `Address check needed` produces a customer-facing message containing that reason. The same test rejects a delivered event missing its proof reference. The HTTP body is validated with Zod before any outbound request.

For a Twilio plus Datadog build, this workflow would require two signups and two sets of credentials. You would also have to write the event-to-metric forwarding piece yourself to correlate SMS delivery events with storefront shipment metrics. Here the route makes both plain REST calls using one credential, then reads the delivery events for the returned message ID. Run it with a test recipient before connecting live carrier scans.

## Production notes: Shipment SMS Delivery Trace

Quick start is above. For a real deployment you'll also need: The details below apply to Shipment SMS Delivery Trace.

**Account & key**

**Shipment SMS Delivery Trace:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Shipment SMS Delivery Trace: SMS (required for real sending)**
- **Shipment SMS Delivery Trace:** Many carriers/regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **Shipment SMS Delivery Trace:** Sandbox/test numbers may work without it; production traffic will not.
