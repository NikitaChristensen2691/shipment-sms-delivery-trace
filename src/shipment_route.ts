import { createServer } from "node:http";
import { ZodError } from "zod";
import { infrai, InfraiError } from "./infrai.ts";
import { notification, shipmentEvent } from "./shipment_decision.ts";

const server = createServer(async (req, res) => {
  const reply = (status: number, data: unknown) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  };
  if (req.method !== "POST" || req.url !== "/shipments/events") {
    reply(404, { error: "Route not found" });
    return;
  }
  try {
    let raw = "";
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 65536) { reply(413, { error: "Body too large" }); return; }
    }
    const event = shipmentEvent.parse(JSON.parse(raw));
    const text = notification(event);
    if (!text) {
      reply(200, { shipmentId: event.shipmentId, state: "delivered", proofOfDelivery: event.proofOfDelivery });
      return;
    }
    const eventId = `${event.shipmentId}:${event.kind}:${event.occurredAt}`;
    const sent = await infrai.sms.batch.send([{ to: event.phone, text }], `sms:${eventId}`);
    await infrai.metrics.report("shipment.sms.requested", 1, `metric:${eventId}`);
    const deliveryEvents = await infrai.sms.events(sent.message_id);
    reply(200, { shipmentId: event.shipmentId, messageId: sent.message_id, deliveryEvents });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) reply(400, { error: "Invalid shipment event" });
    else if (error instanceof InfraiError) reply(error.status >= 400 && error.status < 500 ? error.status : 502, { error: error.code, message: error.message });
    else reply(502, { error: "Unable to process shipment event" });
  }
});

server.listen(Number(process.env.PORT ?? 3000), () => console.log(`Shipment route listening on ${process.env.PORT ?? 3000}`));
