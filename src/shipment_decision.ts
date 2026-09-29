import { z } from "zod";

export const shipmentEvent = z.object({
  shipmentId: z.string().min(1),
  kind: z.enum(["out_for_delivery", "delivered", "exception"]),
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/),
  occurredAt: z.string().datetime(),
  proofOfDelivery: z.object({ name: z.string().min(1), url: z.string().url() }).optional(),
  exceptionReason: z.string().min(1).optional(),
}).superRefine((event, ctx) => {
  if (event.kind === "delivered" && !event.proofOfDelivery) {
    ctx.addIssue({ code: "custom", message: "Delivered shipments need proofOfDelivery" });
  }
  if (event.kind === "exception" && !event.exceptionReason) {
    ctx.addIssue({ code: "custom", message: "Exceptions need exceptionReason" });
  }
});

export type ShipmentEvent = z.infer<typeof shipmentEvent>;

export function notification(event: ShipmentEvent): string | null {
  if (event.kind === "delivered") return null;
  if (event.kind === "exception") return `Shipment ${event.shipmentId} needs attention: ${event.exceptionReason}`;
  return `Shipment ${event.shipmentId} is out for delivery.`;
}
