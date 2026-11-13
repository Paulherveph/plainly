import { zipSync } from "fflate";
import type { Zipper } from "../application/ports";

/** Store-or-deflate zip in memory (exports are small: capped documents per user). */
export const fflateZipper: Zipper = {
  zip(entries) {
    return zipSync(Object.fromEntries(entries.map((e) => [e.path, e.bytes])), { level: 6 });
  },
};
