import type { AppError } from "@/shared/lib/errors";
import type { Result } from "@/shared/lib/result";
import type { QuotaKind, QuotaStatus } from "../domain/quota";

/** Acts for the current session user. Consumption is atomic in the database. */
export interface QuotaService {
  consume(kind: QuotaKind): Promise<Result<QuotaStatus, AppError>>;
  refund(kind: QuotaKind): Promise<void>;
  status(kind: QuotaKind): Promise<Result<QuotaStatus, AppError>>;
}
