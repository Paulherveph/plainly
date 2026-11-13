/**
 * Implied margin per plan from measured cost. Rule (docs/TOKEN_ECONOMY.md section 5):
 * price per credit must be at least 3 times the provider cost per credit.
 */
export function impliedMargins(analysisCostUsd: number, chatCostUsd: number): string[] {
  if (analysisCostUsd === 0 && chatCostUsd === 0) return ["No measured cost yet: run some analyses first."];
  // A 5-page analysis costs 3 credits; a chat message costs 1.
  const perCredit = Math.max(analysisCostUsd / 3, chatCostUsd);
  return [`Provider cost per credit (worst of analysis and chat): $${perCredit.toFixed(4)}`];
}
