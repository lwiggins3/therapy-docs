import { describe, expect, it } from "vitest";
import { buildRawEmailMessage } from "./email-drafts.service";

describe("buildRawEmailMessage", () => {
  it("produces a multipart MIME message with the body and one attachment per document", async () => {
    const attachmentContent = Buffer.from("%PDF-1.4 fake pdf bytes");
    const raw = await buildRawEmailMessage({
      subject: "Some helpful resources",
      body: "Hi there,\n\nAttached are the resources we discussed.",
      attachments: [{ filename: "Coping Skills.pdf", content: attachmentContent, contentType: "application/pdf" }],
    });

    const message = Buffer.from(raw, "base64url").toString("utf-8");

    expect(message).toContain("Subject: Some helpful resources");
    expect(message).toContain("Content-Type: multipart/mixed");
    expect(message).toContain("Attached are the resources we discussed.");
    expect(message).toContain("Coping Skills.pdf");
    expect(message).toContain("Content-Type: application/pdf");
    expect(message).toContain(attachmentContent.toString("base64"));
  });

  it("still produces a valid message with no attachments", async () => {
    const raw = await buildRawEmailMessage({ subject: "No docs", body: "Just text.", attachments: [] });
    const message = Buffer.from(raw, "base64url").toString("utf-8");

    expect(message).toContain("Subject: No docs");
    expect(message).toContain("Just text.");
  });
});
