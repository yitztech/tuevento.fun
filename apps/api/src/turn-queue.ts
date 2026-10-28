/** La cola de ese carril está llena: se responde al momento en vez de esperar turno. */
export class QueueFull extends Error {}

export type Lane = "priority" | "normal";
type Job = { task: () => Promise<unknown>; resolve: (value: unknown) => void; reject: (error: unknown) => void };

/**
 * Turnos para un servicio externo con un ritmo máximo (Nominatim: una petición por segundo para
 * toda la API). El carril prioritario pasa siempre antes que el normal, y cada carril tiene un tope
 * de peticiones en espera: pasado el tope, `run` falla con `QueueFull` sin ocupar memoria ni
 * conexiones (AGENTS.md §28).
 */
export class TurnQueue {
  private readonly lanes: Record<Lane, Job[]> = { priority: [], normal: [] };
  private busy = false;
  private last = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly intervalMs: number,
    private readonly maxPending: Record<Lane, number>,
  ) {}

  run<T>(lane: Lane, task: () => Promise<T>): Promise<T> {
    if (this.lanes[lane].length >= this.maxPending[lane]) return Promise.reject(new QueueFull());
    return new Promise<T>((resolve, reject) => {
      this.lanes[lane].push({ task, resolve: resolve as (value: unknown) => void, reject });
      void this.pump();
    });
  }

  /** Peticiones que esperan turno en un carril (sin contar la que está en curso). */
  pending(lane: Lane) {
    return this.lanes[lane].length;
  }

  private async pump() {
    if (this.busy) return;
    this.busy = true;
    try {
      for (let job = this.next(); job; job = this.next()) {
        const wait = this.last + this.intervalMs - Date.now();
        if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
        this.last = Date.now();
        await job.task().then(job.resolve, job.reject);
      }
    } finally {
      this.busy = false;
    }
  }

  private next() {
    return this.lanes.priority.shift() ?? this.lanes.normal.shift();
  }
}
