import type { Guest } from "@/types";

export const sampleGuests = (): Guest[] => [
  { id: "g1", name: "Ana", kind: "adult", status: "attending" },
  { id: "g2", name: "Leo", kind: "child", status: "waiting" },
  { id: "g3", name: "Luz", kind: "adult", status: "attending" },
];
