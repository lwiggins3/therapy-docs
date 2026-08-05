import { describe, expect, it } from "vitest";
import { buildSuggestTagsPrompt, parseTagSuggestionsResponse } from "./suggest-tags";

describe("buildSuggestTagsPrompt", () => {
  it("renders '(none yet)' for empty existing tags and recent feedback", () => {
    const prompt = buildSuggestTagsPrompt({
      documentText: "Some document text.",
      existingTags: [],
      recentFeedback: [],
    });

    expect(prompt).toContain("Existing tags already in use");
    expect(prompt).toContain("Recent feedback on this therapist's suggestions");
    const feedbackSection = prompt.split("Recent feedback on this therapist's suggestions")[1];
    expect(feedbackSection).toContain("(none yet)");
  });

  it("renders ACCEPTED/REJECTED lines for recent feedback examples", () => {
    const prompt = buildSuggestTagsPrompt({
      documentText: "Some document text.",
      existingTags: ["Anxiety"],
      recentFeedback: [
        { label: "Anxiety", decision: "accepted" },
        { label: "Miscellaneous", decision: "rejected" },
      ],
    });

    expect(prompt).toContain('- ACCEPTED: "Anxiety"');
    expect(prompt).toContain('- REJECTED: "Miscellaneous"');
  });
});

describe("parseTagSuggestionsResponse", () => {
  it("parses a valid JSON response", () => {
    const raw = JSON.stringify({ tags: [{ label: "Anxiety", confidence: 0.9 }] });

    expect(parseTagSuggestionsResponse(raw)).toEqual([{ label: "Anxiety", confidence: 0.9 }]);
  });

  it("tolerates a ```json code fence around the response", () => {
    const raw = ["```json", JSON.stringify({ tags: [{ label: "Coping Skills", confidence: 0.7 }] }), "```"].join(
      "\n",
    );

    expect(parseTagSuggestionsResponse(raw)).toEqual([{ label: "Coping Skills", confidence: 0.7 }]);
  });

  it("throws on malformed JSON", () => {
    expect(() => parseTagSuggestionsResponse("not json")).toThrow(/Failed to parse tag suggestion JSON/);
  });

  it("throws when confidence is out of range", () => {
    const raw = JSON.stringify({ tags: [{ label: "x", confidence: 1.5 }] });
    expect(() => parseTagSuggestionsResponse(raw)).toThrow();
  });
});
