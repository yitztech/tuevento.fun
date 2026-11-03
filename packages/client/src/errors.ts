/** Error de la API: estado, mensaje ya traducido y, si lo hay, el `code` y el cuerpo de Problem Details. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Record<string, string[]>,
    /** `code` estable de Problem Details (`version_conflict`, `id_taken`…). */
    public code?: string,
    /** Cuerpo completo del error (p. ej. `currentVersion` en un conflicto). */
    public body?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
