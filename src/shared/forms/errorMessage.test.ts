import { describe, expect, it } from "vitest";
import { isNetworkError, publicErrorMessage } from "./errorMessage";

const options = { fallback: "We couldn't submit your event. Please try again." };

describe("publicErrorMessage", () => {
  it("keeps a useful Error message", () => {
    expect(publicErrorMessage(new Error("Event title must be 120 characters or fewer"), options)).toBe(
      "Event title must be 120 characters or fewer"
    );
  });

  it("turns a fetch TypeError into connection copy, never “Failed to fetch”", () => {
    const message = publicErrorMessage(new TypeError("Failed to fetch"), options);

    expect(message).toBe("We couldn't reach the server. Check your connection and try again.");
    expect(message).not.toMatch(/failed to fetch/i);
  });

  it("honours a caller-supplied network fallback", () => {
    expect(
      publicErrorMessage(new TypeError("Load failed"), {
        ...options,
        networkFallback: "We couldn't send your message. Check your connection and try again.",
      })
    ).toBe("We couldn't send your message. Check your connection and try again.");
  });

  it("reads a Supabase PostgrestError-shaped plain object", () => {
    expect(
      publicErrorMessage({ code: "22001", message: "Value too long for this field" }, options)
    ).toBe("Value too long for this field");
  });

  it("hides internal database detail behind the fallback", () => {
    for (const error of [
      { code: "42501", message: "new row violates row-level security policy for table \"events\"" },
      { code: "23503", message: "insert or update violates foreign key constraint" },
      new Error("JWT expired"),
    ]) {
      expect(publicErrorMessage(error, options)).toBe(options.fallback);
    }
  });

  it("accepts a plain string message", () => {
    expect(publicErrorMessage("Choose a city.", options)).toBe("Choose a city.");
  });

  it("falls back for null, undefined, and opaque messages", () => {
    for (const error of [null, undefined, {}, new Error(""), new Error("Unknown error"), "Error"]) {
      expect(publicErrorMessage(error, options)).toBe(options.fallback);
    }
  });

  it("never emits “Unknown error” as user-facing copy", () => {
    const outputs = [null, undefined, new Error("unknown error"), { message: "Unknown error" }].map(
      (error) => publicErrorMessage(error, options)
    );

    expect(outputs.every((message) => !/unknown error/i.test(message))).toBe(true);
  });
});

describe("isNetworkError", () => {
  it("recognises fetch-layer failures", () => {
    expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkError(new Error("NetworkError when attempting to fetch resource."))).toBe(true);
    expect(isNetworkError({ message: "Load failed" })).toBe(true);
  });

  it("does not treat service rejections as network failures", () => {
    expect(isNetworkError(new Error("Choose a JPEG, PNG, or WebP image"))).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
});
