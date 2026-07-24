import { describe, expect, it } from "vitest";
import { resolvePasswordChange } from "./importConfig";

describe("resolvePasswordChange", () => {
  it("champ non vide ⇒ à (re)chiffrer", () => {
    expect(resolvePasswordChange("nouveau", false)).toEqual({ store: true });
    expect(resolvePasswordChange("nouveau", true)).toEqual({ store: true });
  });
  it("champ vide + config existante ⇒ conserver l'existant", () => {
    expect(resolvePasswordChange("", true)).toEqual({ store: false });
  });
  it("champ vide + pas de config ⇒ erreur password_required", () => {
    expect(resolvePasswordChange("", false)).toEqual({ store: false, error: "password_required" });
  });
});
