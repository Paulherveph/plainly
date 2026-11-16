"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setFlagAction } from "@/server/actions/admin";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

/** Emergency levers (docs/AI_PROVIDERS.md section 5). Admin tool, English only on purpose. */
export function FlagSwitches({
  flags,
  providers,
}: {
  flags: Record<string, unknown>;
  providers: readonly string[];
}) {
  const [pending, start] = useTransition();
  const [override, setOverride] = useState(String(flags["profile_override:analysis"] ?? ""));
  const set = (key: string, value: unknown) =>
    start(async () => {
      const res = await setFlagAction({ key, value });
      if (res.ok) toast.success(`${key} saved`);
      else toast.error(res.error.kind);
    });
  const aiOn = flags.ai_enabled !== false;

  return (
    <section className="grid gap-4 rounded-2xl border bg-surface p-5">
      <h2 className="font-semibold">Flags (applied within 30 s)</h2>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm">AI calls: {aiOn ? "on" : "off"}</span>
        <Button
          variant={aiOn ? "destructive" : "outline"}
          size="sm"
          disabled={pending}
          onClick={() => set("ai_enabled", !aiOn)}
        >
          {aiOn ? "Turn AI off" : "Turn AI on"}
        </Button>
      </div>
      {providers.map((p) => {
        const disabled = flags[`provider_disabled:${p}`] === true;
        return (
          <div key={p} className="flex flex-wrap items-center gap-3">
            <span className="text-sm">
              {p}: {disabled ? "disabled" : "enabled"}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => set(`provider_disabled:${p}`, !disabled)}
            >
              {disabled ? "Enable" : "Disable"}
            </Button>
          </div>
        );
      })}
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          set("profile_override:analysis", override.trim() || null);
        }}
      >
        <label htmlFor="override" className="text-sm">
          Analysis profile override
        </label>
        <Input
          id="override"
          className="max-w-md font-mono"
          placeholder="anthropic:claude-haiku-5-5"
          value={override}
          onChange={(e) => setOverride(e.target.value)}
        />
        <Button type="submit" size="sm" disabled={pending}>
          Save
        </Button>
      </form>
    </section>
  );
}
