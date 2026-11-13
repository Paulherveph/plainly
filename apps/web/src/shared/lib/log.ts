/**
 * Structured logs: event name + small, content-free fields (ids, counts, error kinds).
 * Never pass document text, quotes, titles or messages here.
 */
type Field = string | number | boolean | null | undefined;

export function log(event: string, fields: Record<string, Field> = {}): void {
  console.info(JSON.stringify({ level: "info", event, at: new Date().toISOString(), ...fields }));
}

export function logError(event: string, fields: Record<string, Field> = {}): void {
  console.error(JSON.stringify({ level: "error", event, at: new Date().toISOString(), ...fields }));
}
