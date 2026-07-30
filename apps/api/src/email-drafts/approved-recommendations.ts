import type { RecommendationStatus } from "@therapy-docs/shared-types";

/** A recommendation is ready to draft an email from once the therapist has accepted it (whether
 * LLM-suggested and confirmed, or manually added directly). */
export const APPROVED_RECOMMENDATION_STATUSES: readonly RecommendationStatus[] = [
  "accepted",
  "added_by_therapist",
];

export function isApprovedRecommendationStatus(status: RecommendationStatus): boolean {
  return (APPROVED_RECOMMENDATION_STATUSES as readonly string[]).includes(status);
}
