import type { UIMessage } from "ai";
import type { Cite } from "@/modules/analysis/domain/analysis";

export type CitationsData = { citations: Cite[]; refused: boolean };

/** UI message with one data part carrying verified citations (or a refusal flag). */
export type ChatUIMessage = UIMessage<never, { citations: CitationsData }>;
