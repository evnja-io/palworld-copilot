import { describe, expect, it } from "vitest";
import { generateInviteCode, generateSlug } from "./servers";

describe("generateSlug", () => {
  it("produit 10 caractères base62", () => {
    const slug = generateSlug();
    expect(slug).toHaveLength(10);
    expect(slug).toMatch(/^[0-9A-Za-z]{10}$/);
  });
  it("produit des valeurs distinctes", () => {
    expect(generateSlug()).not.toBe(generateSlug());
  });
});

describe("generateInviteCode", () => {
  it("produit un code base64url de 22 caractères (128 bits)", () => {
    const code = generateInviteCode();
    expect(code).toHaveLength(22);
    expect(code).toMatch(/^[0-9A-Za-z_-]{22}$/);
  });
  it("produit des valeurs distinctes", () => {
    expect(generateInviteCode()).not.toBe(generateInviteCode());
  });
});
