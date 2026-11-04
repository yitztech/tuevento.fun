import { z } from "zod";
import { limits } from "@/features/auth/schemas";
import { copy } from "@/lib/copy";

export const detailsSchema = z.object({
  name: z.string().trim().min(1, copy.demo.invalidName).max(150, copy.auth.tooLong(150)),
  date: z.string(),
  time: z.string(),
  place: z.string().trim().max(200, copy.auth.tooLong(200)),
  message: z.string().trim().max(limits.message, copy.auth.tooLong(limits.message)),
});

export type Details = z.infer<typeof detailsSchema>;

export const defaultDetails: Details = { ...copy.demo.defaults };
