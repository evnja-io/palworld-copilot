import { describe, expect, it } from "vitest";
import { safeInternalPath } from "./redirect";

describe("safeInternalPath", () => {
  it("accepte un chemin interne simple", () => {
    expect(safeInternalPath("/join/AbC123")).toBe("/join/AbC123");
    expect(safeInternalPath("/s/xyz/settings")).toBe("/s/xyz/settings");
  });
  it("rejette null/vide/non-string", () => {
    expect(safeInternalPath(null)).toBeNull();
    expect(safeInternalPath("")).toBeNull();
    expect(safeInternalPath(undefined)).toBeNull();
  });
  it("rejette les URL absolues et les schémas", () => {
    expect(safeInternalPath("https://evil.com")).toBeNull();
    expect(safeInternalPath("http://evil.com")).toBeNull();
    expect(safeInternalPath("javascript:alert(1)")).toBeNull();
  });
  it("rejette le protocol-relative et le bypass backslash", () => {
    expect(safeInternalPath("//evil.com")).toBeNull();
    expect(safeInternalPath("/\\evil.com")).toBeNull();
    expect(safeInternalPath("/\\/evil.com")).toBeNull();
  });
  it("rejette les chemins ne commençant pas par /", () => {
    expect(safeInternalPath("join/AbC")).toBeNull();
    expect(safeInternalPath("evil.com")).toBeNull();
  });
  it("rejette les caractères de contrôle et backslash", () => {
    expect(safeInternalPath("/join/\nSet-Cookie")).toBeNull();
    expect(safeInternalPath("/join/a\\b")).toBeNull();
  });
  it("rejette un chemin trop long (>512)", () => {
    expect(safeInternalPath("/" + "a".repeat(600))).toBeNull();
  });
});
