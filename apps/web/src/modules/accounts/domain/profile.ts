import { z } from "zod";

export const THEMES = ["system", "light", "dark"] as const;

export const ProfilePatch = z.object({
  displayName: z
    .string()
    .trim()
    .max(80)
    .transform((v) => (v.length === 0 ? null : v))
    .nullable()
    .optional(),
  locale: z.enum(["en", "fr", "zh"]).optional(),
  theme: z.enum(THEMES).optional(),
});
export type ProfilePatch = z.infer<typeof ProfilePatch>;

export type Profile = {
  userId: string;
  displayName: string | null;
  locale: "en" | "fr" | "zh";
  theme: (typeof THEMES)[number];
};

/** Type-to-confirm for account deletion: the user types the exact word shown. */
export function confirmsDeletion(typed: string, word: string): boolean {
  return typed.trim().toLocaleLowerCase() === word.trim().toLocaleLowerCase() && word.trim().length > 0;
}

/** Storage paths start with the owner id; a merge moves them under the new owner. */
export function rehomePath(path: string, from: string, to: string): string | null {
  return path.startsWith(`${from}/`) ? `${to}${path.slice(from.length)}` : null;
}
