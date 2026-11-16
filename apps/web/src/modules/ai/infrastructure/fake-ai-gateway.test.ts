import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { AiCall, UsageRow } from "../application/ports";
import { FakeAiGateway } from "./fake-ai-gateway";

const call = (over: Partial<AiCall> = {}): AiCall => ({
  profile: "analysis",
  task: "analyze",
  system: "s",
  messages: [{ role: "user", content: "hi" }],
  maxOutputTokens: 100,
  maxInputChars: 1000,
  requestId: "r1",
  userId: "u1",
  ...over,
});

function recorder() {
  const rows: UsageRow[] = [];
  return { rows, record: async (r: UsageRow) => void rows.push(r), spendTodayMicros: async () => 0 };
}

describe("FakeAiGateway (fallback drill shape)", () => {
  it("falls back to the next model and writes one usage row per attempt", async () => {
    const usage = recorder();
    const gw = new FakeAiGateway(() => ({ value: { a: 1 } }), {
      usage,
      models: ["primary", "secondary"],
      script: { failModels: new Set(["primary"]) },
    });
    const res = await gw.generateObject({ ...call(), schema: z.object({ a: z.number() }) });
    expect(res.ok && res.value.usage.model).toBe("secondary");
    expect(usage.rows.map((r) => [r.model, r.status])).toEqual([
      ["primary", "failed"],
      ["secondary", "ok"],
    ]);
  });

  it("returns unavailable when every model fails", async () => {
    const gw = new FakeAiGateway(() => ({ value: 1 }), {
      models: ["a", "b"],
      script: { failModels: new Set(["a", "b"]) },
    });
    const res = await gw.generateText(call());
    expect(res).toEqual({ ok: false, error: { kind: "unavailable" } });
  });

  it("stops on abort and records it", async () => {
    const usage = recorder();
    const controller = new AbortController();
    controller.abort();
    const gw = new FakeAiGateway(() => ({ value: { a: 1 }, partials: [{}, { a: 1 }] }), { usage });
    const run = gw.streamObject({
      ...call({ signal: controller.signal }),
      schema: z.object({ a: z.number() }),
    });
    const res = await run.final;
    expect(res).toEqual({ ok: false, error: { kind: "aborted" } });
    expect(usage.rows[0]?.status).toBe("aborted");
  });
});
