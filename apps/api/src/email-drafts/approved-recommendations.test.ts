import { describe, expect, it } from "vitest";
import { isApprovedRecommendationStatus } from "./approved-recommendations";

describe("isApprovedRecommendationStatus", () => {
  it("treats accepted and added_by_therapist as approved", () => {
    expect(isApprovedRecommendationStatus("accepted")).toBe(true);
    expect(isApprovedRecommendationStatus("added_by_therapist")).toBe(true);
  });

  it("does not treat suggested or rejected as approved", () => {
    expect(isApprovedRecommendationStatus("suggested")).toBe(false);
    expect(isApprovedRecommendationStatus("rejected")).toBe(false);
  });
});
