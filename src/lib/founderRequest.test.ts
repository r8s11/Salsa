import { describe, expect, it } from "vitest";
import {
  normalizeEmail,
  normalizeOrgName,
  normalizeInstagram,
  normalizeWebsite,
  validateEmail,
  validateApplicantName,
  validateOrganizationName,
  validateInstagram,
  validateWebsite,
  validateCity,
  validateRegion,
  validateDescription,
  validateMessage,
  validateFounderRequest,
  hasErrors,
  normalizePayload,
  type FounderRequestPayload,
} from "./founderRequest";

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  USER@EXAMPLE.COM  ")).toBe("user@example.com");
  });
});

describe("normalizeOrgName", () => {
  it("trims, collapses whitespace, lowercases", () => {
    expect(normalizeOrgName("  Havana   Club  Boston  ")).toBe("havana club boston");
  });
});

describe("normalizeInstagram", () => {
  it("removes leading @ and lowercases", () => {
    expect(normalizeInstagram("@HavanaClub")).toBe("havanaclub");
  });
  it("handles bare handle", () => {
    expect(normalizeInstagram("havanaclub")).toBe("havanaclub");
  });
  it("returns null for empty", () => {
    expect(normalizeInstagram("")).toBeNull();
    expect(normalizeInstagram("   ")).toBeNull();
  });
});

describe("normalizeWebsite", () => {
  it("adds https:// when missing", () => {
    expect(normalizeWebsite("example.com")).toBe("https://example.com");
  });
  it("preserves https://", () => {
    expect(normalizeWebsite("https://example.com")).toBe("https://example.com");
  });
  it("preserves http://", () => {
    expect(normalizeWebsite("http://example.com")).toBe("http://example.com");
  });
  it("returns null for empty", () => {
    expect(normalizeWebsite("")).toBeNull();
    expect(normalizeWebsite("   ")).toBeNull();
  });
});

describe("validateEmail", () => {
  it("requires non-empty", () => {
    expect(validateEmail("")).toBe("Email is required");
  });
  it("rejects invalid format", () => {
    expect(validateEmail("not-an-email")).toBe("Invalid email format");
  });
  it("rejects too long", () => {
    expect(validateEmail("a".repeat(250) + "@example.com")).toBe("Email too long (max 255 characters)");
  });
  it("accepts valid", () => {
    expect(validateEmail("user@example.com")).toBeNull();
  });
});

describe("validateApplicantName", () => {
  it("requires non-empty", () => {
    expect(validateApplicantName("")).toBe("Your name is required");
  });
  it("rejects too long", () => {
    expect(validateApplicantName("a".repeat(256))).toBe("Name too long (max 255 characters)");
  });
  it("accepts valid", () => {
    expect(validateApplicantName("John Doe")).toBeNull();
  });
});

describe("validateOrganizationName", () => {
  it("requires non-empty", () => {
    expect(validateOrganizationName("")).toBe("Organization name is required");
  });
  it("rejects too long", () => {
    expect(validateOrganizationName("a".repeat(256))).toBe("Organization name too long (max 255 characters)");
  });
  it("accepts valid", () => {
    expect(validateOrganizationName("Salsa Nights Boston")).toBeNull();
  });
});

describe("validateInstagram", () => {
  it("accepts empty", () => {
    expect(validateInstagram("")).toBeNull();
    expect(validateInstagram(undefined)).toBeNull();
  });
  it("rejects too long", () => {
    expect(validateInstagram("a".repeat(101))).toBe("Instagram handle too long (max 100 characters)");
  });
  it("accepts valid", () => {
    expect(validateInstagram("@havanaclub")).toBeNull();
    expect(validateInstagram("HavanaClub")).toBeNull();
    expect(validateInstagram("@havana_club.bos")).toBeNull();
  });
  it("rejects invalid handle characters", () => {
    expect(validateInstagram("has spaces")).toBe(
      "Enter a valid Instagram handle (letters, numbers, periods, underscores)"
    );
    expect(validateInstagram("@han!dle")).toBe(
      "Enter a valid Instagram handle (letters, numbers, periods, underscores)"
    );
  });
});

describe("validateWebsite", () => {
  it("accepts empty", () => {
    expect(validateWebsite("")).toBeNull();
    expect(validateWebsite(undefined)).toBeNull();
  });
  it("rejects too long", () => {
    expect(validateWebsite("https://" + "a".repeat(495))).toBe("Website URL too long (max 500 characters)");
  });
  it("rejects missing protocol", () => {
    expect(validateWebsite("example.com")).toBe("Website must start with http:// or https://");
  });
  it("accepts http", () => {
    expect(validateWebsite("http://example.com")).toBeNull();
  });
  it("accepts https", () => {
    expect(validateWebsite("https://example.com")).toBeNull();
  });
});

describe("validateCity", () => {
  it("accepts empty", () => {
    expect(validateCity("")).toBeNull();
  });
  it("rejects too long", () => {
    expect(validateCity("a".repeat(101))).toBe("City too long (max 100 characters)");
  });
});

describe("validateRegion", () => {
  it("accepts empty", () => {
    expect(validateRegion("")).toBeNull();
  });
  it("rejects too long", () => {
    expect(validateRegion("a".repeat(101))).toBe("Region too long (max 100 characters)");
  });
});

describe("validateDescription", () => {
  it("accepts empty", () => {
    expect(validateDescription("")).toBeNull();
  });
  it("rejects too long", () => {
    expect(validateDescription("a".repeat(5001))).toBe("Description too long (max 5000 characters)");
  });
});

describe("validateMessage", () => {
  it("accepts empty", () => {
    expect(validateMessage("")).toBeNull();
  });
  it("rejects too long", () => {
    expect(validateMessage("a".repeat(5001))).toBe("Message too long (max 5000 characters)");
  });
});

describe("validateFounderRequest", () => {
  const validPayload: FounderRequestPayload = {
    applicantName: "John Doe",
    email: "john@example.com",
    organizationName: "Salsa Nights Boston",
    instagram: "@salsanights",
    website: "https://salsanights.com",
    city: "Boston",
    region: "MA",
    description: "We run weekly salsa socials",
    message: "Looking forward to joining",
  };

  it("returns no errors for valid payload", () => {
    const errors = validateFounderRequest(validPayload);
    expect(hasErrors(errors)).toBe(false);
  });

  it("catches missing required fields", () => {
    const errors = validateFounderRequest({
      ...validPayload,
      applicantName: "",
      email: "",
      organizationName: "",
    });
    expect(errors.applicantName).toBe("Your name is required");
    expect(errors.email).toBe("Email is required");
    expect(errors.organizationName).toBe("Organization name is required");
  });

  it("catches invalid email", () => {
    const errors = validateFounderRequest({
      ...validPayload,
      email: "not-an-email",
    });
    expect(errors.email).toBe("Invalid email format");
  });

  it("catches too-long fields", () => {
    const errors = validateFounderRequest({
      ...validPayload,
      applicantName: "a".repeat(256),
      email: "a".repeat(250) + "@example.com",
      organizationName: "a".repeat(256),
    });
    expect(errors.applicantName).toBe("Name too long (max 255 characters)");
    expect(errors.email).toBe("Email too long (max 255 characters)");
    expect(errors.organizationName).toBe("Organization name too long (max 255 characters)");
  });

  it("catches invalid website", () => {
    const errors = validateFounderRequest({
      ...validPayload,
      website: "not-a-url",
    });
    expect(errors.website).toBe("Website must start with http:// or https://");
  });
});

describe("normalizePayload", () => {
  it("normalizes all fields", () => {
    const payload: FounderRequestPayload = {
      applicantName: "  John Doe  ",
      email: "  JOHN@EXAMPLE.COM  ",
      organizationName: "  Salsa   Nights  Boston  ",
      instagram: "  @SalsaNights  ",
      website: "  salsanights.com  ",
      city: "  Boston  ",
      region: "  MA  ",
      description: "  Weekly socials  ",
      message: "  Hello  ",
    };

    const normalized = normalizePayload(payload);

    expect(normalized.applicantName).toBe("John Doe");
    expect(normalized.email).toBe("john@example.com");
    expect(normalized.organizationName).toBe("Salsa   Nights  Boston");
    expect(normalized.instagram).toBe("salsanights");
    expect(normalized.website).toBe("https://salsanights.com");
    expect(normalized.city).toBe("Boston");
    expect(normalized.region).toBe("MA");
    expect(normalized.description).toBe("Weekly socials");
    expect(normalized.message).toBe("Hello");
  });

  it("handles undefined optional fields", () => {
    const payload: FounderRequestPayload = {
      applicantName: "John",
      email: "john@example.com",
      organizationName: "Salsa Nights",
    };

    const normalized = normalizePayload(payload);

    expect(normalized.instagram).toBeUndefined();
    expect(normalized.website).toBeUndefined();
    expect(normalized.city).toBeUndefined();
    expect(normalized.region).toBeUndefined();
    expect(normalized.description).toBeUndefined();
    expect(normalized.message).toBeUndefined();
  });

  it("passes the honeypot field through untouched", () => {
    const payload: FounderRequestPayload = {
      applicantName: "John",
      email: "john@example.com",
      organizationName: "Salsa Nights",
      companyWebsite: "http://spam.bot",
    };

    expect(normalizePayload(payload).companyWebsite).toBe("http://spam.bot");
  });
});