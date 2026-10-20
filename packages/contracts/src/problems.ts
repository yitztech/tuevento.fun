import type { z } from "zod";
import type { MessageKey } from "./i18n";

/**
 * Errores de la API en Problem Details (RFC 9457, AGENTS.md §22). `code` es estable y en inglés;
 * `title`, `detail` y cada `message` salen en el idioma de la petición.
 */
export type ProblemFieldError = { field: string; code: string; message: string };
export type Problem = {
  type: "about:blank";
  title: string;
  status: number;
  code: string;
  detail: string;
  requestId: string;
  errors?: ProblemFieldError[];
};

/** Código y título de cada estado HTTP que devuelve la API. */
export const problemStatuses: Record<number, { code: string; title: MessageKey }> = {
  400: { code: "bad_request", title: "problems.badRequest" },
  401: { code: "unauthorized", title: "problems.unauthorized" },
  403: { code: "forbidden", title: "problems.forbidden" },
  404: { code: "not_found", title: "problems.notFound" },
  409: { code: "conflict", title: "problems.conflict" },
  413: { code: "payload_too_large", title: "problems.payloadTooLarge" },
  422: { code: "validation_failed", title: "problems.validationFailed" },
  429: { code: "rate_limited", title: "problems.rateLimited" },
  500: { code: "internal_error", title: "problems.internalError" },
  503: { code: "service_unavailable", title: "problems.serviceUnavailable" },
};
export const problemStatus = (status: number) =>
  problemStatuses[status] ?? problemStatuses[status >= 500 ? 500 : 400];

/** Mensajes de las reglas de caracteres de §6.2: responden `invalid_characters`. */
const characterMessages = new Set(["validation.useLettersSpaces", "validation.useNumbersSpaces"]);

/** Código estable de un fallo de validación de zod (§6.2, §6.3 y §22). */
export function issueCode(issue: z.core.$ZodIssue): string {
  switch (issue.code) {
    case "too_big":
      return issue.origin === "string" ? "too_long" : "too_big";
    case "too_small":
      return issue.origin === "string" ? "too_short" : "too_small";
    case "invalid_type":
      return issue.input === undefined ? "required" : "invalid_type";
    case "invalid_format":
      return characterMessages.has(issue.message) ? "invalid_characters" : "invalid_format";
    case "unrecognized_keys":
      return "unknown_field";
    case "invalid_value":
      return "invalid_value";
    default:
      return issue.message === "validation.enterValidPhoneNumber" ? "invalid_format" : "invalid";
  }
}

/**
 * Un error por campo y regla. Los campos desconocidos dan uno por campo. Los mensajes son claves
 * del catálogo: la API las traduce al responder.
 */
export function problemErrors(error: z.ZodError): ProblemFieldError[] {
  return error.issues.flatMap((issue) => {
    const field = issue.path.map(String).join(".");
    if (issue.code === "unrecognized_keys")
      return issue.keys.map((key) => ({
        field: field ? `${field}.${key}` : key,
        code: "unknown_field",
        message: "validation.unknownField",
      }));
    return [{ field, code: issueCode(issue), message: issue.message }];
  });
}
