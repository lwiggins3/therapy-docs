import { describe, expect, it } from "vitest";
import { buildSummarizeTranscriptPrompt, parseSummarizeTranscriptResponse } from "./summarize-transcript";

describe("buildSummarizeTranscriptPrompt", () => {
  it("includes the transcript text and JSON response instructions", () => {
    const prompt = buildSummarizeTranscriptPrompt({ transcriptText: "Patient discussed work stress." });

    expect(prompt).toContain("Patient discussed work stress.");
    expect(prompt).toContain('{"summary": string}');
  });
});

describe("parseSummarizeTranscriptResponse", () => {
  it("parses a valid JSON response", () => {
    const raw = JSON.stringify({ summary: "Patient discussed work stress and sleep difficulty." });

    expect(parseSummarizeTranscriptResponse(raw)).toBe("Patient discussed work stress and sleep difficulty.");
  });

  it("tolerates a ```json code fence around the response", () => {
    const raw = ["```json", JSON.stringify({ summary: "Brief recap." }), "```"].join("\n");

    expect(parseSummarizeTranscriptResponse(raw)).toBe("Brief recap.");
  });

  it("throws on malformed JSON", () => {
    expect(() => parseSummarizeTranscriptResponse("not json")).toThrow(/Failed to parse transcript summary JSON/);
  });

  it("throws when summary is empty", () => {
    const raw = JSON.stringify({ summary: "" });
    expect(() => parseSummarizeTranscriptResponse(raw)).toThrow();
  });
});
