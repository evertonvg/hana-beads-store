/**
 * Infrastructure failures throw. The message stays neutral (it may reach logs or error pages);
 * the original error travels in `cause` for debugging only.
 */
export function toPortError(e: unknown): never {
  throw new Error("Data source request failed", { cause: e });
}
