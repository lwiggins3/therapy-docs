import { describe, expect, it } from "vitest";
import { parseRecommendDocumentsResponse } from "./recommend-documents";

describe("parseRecommendDocumentsResponse", () => {
  it("parses a valid JSON response", () => {
    const raw = JSON.stringify({
      recommendations: [{ documentId: "doc-1", rationale: "Matches session topic", score: 0.9 }],
    });

    expect(parseRecommendDocumentsResponse(raw)).toEqual([
      { documentId: "doc-1", rationale: "Matches session topic", score: 0.9 },
    ]);
  });

  it("tolerates a ```json code fence around the response", () => {
    const raw = [
      "```json",
      JSON.stringify({
        recommendations: [{ documentId: "doc-2", rationale: "Relevant worksheet", score: 0.5 }],
      }),
      "```",
    ].join("\n");

    expect(parseRecommendDocumentsResponse(raw)).toEqual([
      { documentId: "doc-2", rationale: "Relevant worksheet", score: 0.5 },
    ]);
  });

  it("throws on malformed JSON", () => {
    expect(() => parseRecommendDocumentsResponse("not json")).toThrow(
      /Failed to parse recommendation JSON/,
    );
  });

  it("throws when a score is out of range", () => {
    const raw = JSON.stringify({
      recommendations: [{ documentId: "doc-3", rationale: "x", score: 1.5 }],
    });

    expect(() => parseRecommendDocumentsResponse(raw)).toThrow();
  });
});
