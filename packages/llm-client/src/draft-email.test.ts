import { describe, expect, it } from "vitest";
import { parseDraftEmailResponse } from "./draft-email";

describe("parseDraftEmailResponse", () => {
  it("parses a valid JSON response", () => {
    const raw = JSON.stringify({
      subject: "Some resources from today's session",
      body: "Hi Alex, following up on today's session with a couple of resources...",
    });

    expect(parseDraftEmailResponse(raw)).toEqual({
      subject: "Some resources from today's session",
      body: "Hi Alex, following up on today's session with a couple of resources...",
    });
  });

  it("tolerates a ```json code fence around the response", () => {
    const raw = [
      "```json",
      JSON.stringify({ subject: "Follow-up", body: "See attached resources." }),
      "```",
    ].join("\n");

    expect(parseDraftEmailResponse(raw)).toEqual({ subject: "Follow-up", body: "See attached resources." });
  });

  it("throws on malformed JSON", () => {
    expect(() => parseDraftEmailResponse("not json")).toThrow(/Failed to parse draft email JSON/);
  });

  it("throws when subject or body is missing", () => {
    expect(() => parseDraftEmailResponse(JSON.stringify({ subject: "Only a subject" }))).toThrow();
  });
});
