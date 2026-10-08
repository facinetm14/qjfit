import { toErrorMessage } from "./to-error-message.js";

describe("toErrorMessage", () => {
  it("returns the message of an Error instance", () => {
    expect(toErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("falls back to a generic message for a non-Error throw", () => {
    expect(toErrorMessage("boom")).toBe("Unknown error");
    expect(toErrorMessage(null)).toBe("Unknown error");
    expect(toErrorMessage(undefined)).toBe("Unknown error");
  });
});
