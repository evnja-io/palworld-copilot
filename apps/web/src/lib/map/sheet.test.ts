import { describe, expect, it } from "vitest";
import { COLLAPSED_PX, SheetState, snapTo, stopHeight } from "./sheet.svelte";

/** Hauteur type d'un conteneur de carte sur un téléphone (844 px - en-tête). */
const AVAILABLE = 792;

describe("stopHeight", () => {
  it("plafonne la position repliée à la hauteur disponible", () => {
    expect(stopHeight("collapsed", AVAILABLE)).toBe(COLLAPSED_PX);
    // Paysage très court : la feuille ne peut pas dépasser son conteneur.
    expect(stopHeight("collapsed", 40)).toBe(40);
  });

  it("ordonne strictement les trois positions", () => {
    const c = stopHeight("collapsed", AVAILABLE);
    const h = stopHeight("half", AVAILABLE);
    const f = stopHeight("full", AVAILABLE);
    expect(c).toBeLessThan(h);
    expect(h).toBeLessThan(f);
    expect(f).toBeLessThan(AVAILABLE);
  });
});

describe("snapTo", () => {
  it("choisit la position la plus proche quand le geste est lent", () => {
    expect(snapTo(stopHeight("half", AVAILABLE) + 5, AVAILABLE)).toBe("half");
    expect(snapTo(COLLAPSED_PX + 10, AVAILABLE)).toBe("collapsed");
    expect(snapTo(stopHeight("full", AVAILABLE) - 10, AVAILABLE)).toBe("full");
  });

  it("monte d'un cran sur un lancer vers le haut, même arrêté sur une position", () => {
    const half = stopHeight("half", AVAILABLE);
    expect(snapTo(half, AVAILABLE, 1.2)).toBe("full");
  });

  it("descend d'un cran sur un lancer vers le bas", () => {
    const half = stopHeight("half", AVAILABLE);
    expect(snapTo(half, AVAILABLE, -1.2)).toBe("collapsed");
  });

  it("ne sort jamais des bornes sur un lancer depuis une extrémité", () => {
    expect(snapTo(stopHeight("full", AVAILABLE), AVAILABLE, 3)).toBe("full");
    expect(snapTo(COLLAPSED_PX, AVAILABLE, -3)).toBe("collapsed");
  });
});

describe("SheetState", () => {
  /** Fait glisser la poignée de `dy` px (positif = vers le bas) en `ms`. */
  function drag(s: SheetState, dy: number, ms = 400) {
    s.start(500, 0);
    s.move(500 + dy / 2, ms / 2);
    s.move(500 + dy, ms);
    s.end(500 + dy, ms);
  }

  it("suit le doigt puis se pose sur une position", () => {
    const s = new SheetState();
    s.available = AVAILABLE;
    s.start(500, 0);
    s.move(400, 100);
    expect(s.dragging).toBe(stopHeight("half", AVAILABLE) + 100);
    s.end(400, 100);
    expect(s.dragging).toBeNull();
    expect(s.stop).toBe("full");
  });

  it("ne descend jamais sous la position repliée ni au-dessus du maximum", () => {
    const s = new SheetState();
    s.available = AVAILABLE;
    s.start(500, 0);
    s.move(500 + 5000, 100);
    expect(s.dragging).toBe(COLLAPSED_PX);
    s.move(500 - 5000, 200);
    expect(s.dragging).toBe(stopHeight("full", AVAILABLE));
  });

  it("ignore un micro-tremblement : un appui reste un appui", () => {
    const s = new SheetState();
    s.available = AVAILABLE;
    s.start(500, 0);
    s.move(502, 20);
    expect(s.moved).toBe(false);
    expect(s.dragging).toBeNull();
  });

  it("marque le geste dès le seuil franchi, pour annuler le clic qui suit", () => {
    const s = new SheetState();
    s.available = AVAILABLE;
    drag(s, 120);
    expect(s.moved).toBe(true);
  });

  it("cycle : moitié → plein → replié → moitié", () => {
    const s = new SheetState();
    expect(s.stop).toBe("half");
    s.cycle();
    expect(s.stop).toBe("full");
    s.cycle();
    expect(s.stop).toBe("collapsed");
    s.cycle();
    expect(s.stop).toBe("half");
  });

  it("step reste borné aux extrémités", () => {
    const s = new SheetState();
    s.step(1);
    expect(s.stop).toBe("full");
    s.step(1);
    expect(s.stop).toBe("full");
    s.step(-1);
    s.step(-1);
    s.step(-1);
    expect(s.stop).toBe("collapsed");
  });

  it("annule un glissement sans changer de position", () => {
    const s = new SheetState();
    s.available = AVAILABLE;
    s.start(500, 0);
    s.move(300, 80);
    s.cancel();
    expect(s.dragging).toBeNull();
    expect(s.stop).toBe("half");
    expect(s.active).toBe(false);
  });

  it("ignore un déplacement reçu hors geste", () => {
    const s = new SheetState();
    s.available = AVAILABLE;
    s.move(300, 80);
    expect(s.dragging).toBeNull();
  });
});
