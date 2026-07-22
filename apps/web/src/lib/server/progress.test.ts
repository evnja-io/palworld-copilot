import { describe, expect, it } from "vitest";
import { isValidEntity, isValidKind } from "./progress";

describe("registre de progression", () => {
  it("accepte un pal connu pour pal_caught", () => {
    expect(isValidEntity("pal_caught", "Anubis")).toBe(true);
  });
  it("refuse un id inconnu et un kind inconnu", () => {
    expect(isValidEntity("pal_caught", "NotAPal")).toBe(false);
    expect(isValidEntity("__proto__", "Anubis")).toBe(false);
  });
  it("accepte une techno connue pour tech_unlocked", () => {
    expect(isValidEntity("tech_unlocked", "Workbench")).toBe(true);
    expect(isValidEntity("tech_unlocked", "NotATech")).toBe(false);
  });
  it("isValidKind ne connaît que les kinds du registre", () => {
    expect(isValidKind("pal_caught")).toBe(true);
    expect(isValidKind("constructor")).toBe(false);
  });
});
