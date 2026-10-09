/**
 * Shared primitive types used across all Moffu services.
 * Human reference IDs (e.g. ORG-00001) are stable route-facing identifiers.
 * Internal UUIDs are never exposed in URLs or client responses.
 */

export type UUID = string;

/** Human-readable reference ID, format: PREFIX-NNNNN (e.g. ORG-00001, USR-00042) */
export type HumanRefId = `${string}-${string}`;

/** ISO 8601 timestamp string (UTC) */
export type ISOTimestamp = string;

/** ISO 4217 currency code (e.g. "AUD", "USD") */
export type CurrencyCode = string;

/** BCP 47 locale tag (e.g. "en-AU", "ur") */
export type LocaleTag = string;

/** IANA timezone (e.g. "Australia/Sydney") */
export type Timezone = string;

/** ISO 3166-1 alpha-2 country code */
export type CountryCode = string;

/** Pagination cursor */
export interface PaginationCursor {
  cursor?: string;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  nextCursor?: string;
  total?: number;
}

/** Standard API error shape */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/** Standard API response envelope */
export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: ApiError };
