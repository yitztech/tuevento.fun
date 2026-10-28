import assert from "node:assert/strict";
import test from "node:test";
import { QueueFull, TurnQueue } from "./turn-queue";

test("Respeta el intervalo entre peticiones", async () => {
  const queue = new TurnQueue(40, { priority: 10, normal: 10 });
  const times: number[] = [];
  await Promise.all([1, 2, 3].map(() => queue.run("normal", async () => times.push(Date.now()))));
  assert.ok(times[1] - times[0] >= 35 && times[2] - times[1] >= 35, `intervalos: ${times}`);
});

test("El carril prioritario pasa antes que el normal", async () => {
  const queue = new TurnQueue(20, { priority: 10, normal: 10 });
  const order: string[] = [];
  const first = queue.run("normal", async () => order.push("normal-1"));
  const rest = [
    queue.run("normal", async () => order.push("normal-2")),
    queue.run("priority", async () => order.push("prioridad")),
  ];
  await Promise.all([first, ...rest]);
  assert.deepEqual(order, ["normal-1", "prioridad", "normal-2"]);
});

test("Con el carril lleno responde al momento y el otro carril sigue abierto", async () => {
  const queue = new TurnQueue(30, { priority: 2, normal: 1 });
  const running = queue.run("normal", async () => "en curso");
  const waiting = queue.run("normal", async () => "en espera");
  await assert.rejects(queue.run("normal", async () => "sobra"), QueueFull);
  assert.equal(await queue.run("priority", async () => "prioridad"), "prioridad");
  assert.deepEqual(await Promise.all([running, waiting]), ["en curso", "en espera"]);
  assert.equal(queue.pending("normal"), 0);
});

test("Un fallo de una petición no detiene la cola", async () => {
  const queue = new TurnQueue(0, { priority: 1, normal: 5 });
  const failed = queue.run("normal", async () => {
    throw new Error("caído");
  });
  const next = queue.run("normal", async () => "sigue");
  await assert.rejects(failed, /caído/);
  assert.equal(await next, "sigue");
});
