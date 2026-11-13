import type { AppError } from "@/shared/lib/errors";
import type { Result } from "@/shared/lib/result";
import type { Deadline, NewDeadline } from "../domain/deadline";

export interface DeadlineRepository {
  countForDocument(documentId: string): Promise<Result<number, AppError>>;
  insertMany(
    userId: string,
    documentId: string,
    items: readonly NewDeadline[],
  ): Promise<Result<null, AppError>>;
  listOwned(userId: string): Promise<Result<Deadline[], AppError>>;
  setDone(userId: string, id: string, done: boolean): Promise<Result<null, AppError>>;
}
