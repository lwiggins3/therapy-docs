import { describe, expect, it } from "vitest";
import { isValidEmail } from "./is-valid-email";

describe("isValidEmail", () => {
  it("accepts a well-formed email", () => {
    expect(isValidEmail("patient@example.com")).toBe(true);
  });

  it.each(["not-an-email", "missing-domain@", "@missing-local.com", "no-at-sign.com", ""])(
    "rejects %s",
    (value) => {
      expect(isValidEmail(value)).toBe(false);
    },
  );
});
