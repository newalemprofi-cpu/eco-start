/**
 * One structured log line per failed media request, so Coolify's
 * application logs answer "why is this photo broken?" directly:
 *
 *   [media] {"reason":"file_missing","kind":"recognitions","key":"recognitions/<school>/<child>/<ts>.jpg","driver":"local"}
 *
 * reasons: unauthenticated (401) · denied (404, no access) · invalid_key
 * (404, malformed path) · file_missing (404, access OK but no bytes —
 * the volume/bucket problem). Keys contain only uuids and a timestamp;
 * no names, no cookies, no IP addresses are logged.
 */
export type MediaMissReason = "unauthenticated" | "denied" | "invalid_key" | "file_missing";

export function logMediaMiss(reason: MediaMissReason, detail: Record<string, string | undefined>): void {
  console.warn(`[media] ${JSON.stringify({ reason, ...detail })}`);
}
