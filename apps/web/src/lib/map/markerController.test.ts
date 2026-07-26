import { describe, expect, it } from "vitest";
import { markerHtml, type MapMarker } from "./markerController";

const alpha = (palId: string, level = 30): MapMarker => ({
  id: `alpha_${palId}`,
  type: "alpha",
  px: 100,
  py: 200,
  meta: { palId, level },
});

describe("markerHtml", () => {
  it("rend un portrait pour un Alpha dont le Pal a une icône", () => {
    const html = markerHtml(alpha("Anubis"), false);
    expect(html).toContain("mk-pal");
    expect(html).toContain('src="/icons/pals/Anubis.webp"');
    expect(html).toContain("<i>30</i>");
  });

  it("retombe sur le glyphe quand le Pal est inconnu", () => {
    const html = markerHtml(alpha("None"), false);
    expect(html).not.toContain("mk-pal");
    expect(html).toContain("▲");
  });

  it("retombe sur le glyphe pour un Alpha sans palId", () => {
    const html = markerHtml({ id: "a", type: "alpha", px: 0, py: 0 }, false);
    expect(html).toContain("▲");
  });

  it("laisse les effigies et voyages rapides inchangés", () => {
    expect(markerHtml({ id: "r", type: "relic", px: 0, py: 0 }, false)).toContain("✦");
    expect(markerHtml({ id: "f", type: "ft", px: 0, py: 0 }, false)).toContain("◆");
  });

  it("propage l'état coché", () => {
    expect(markerHtml({ id: "r", type: "relic", px: 0, py: 0 }, true)).toContain("mk-checked");
  });

  it("rend un glyphe distinct pour chaque nouveau type", () => {
    expect(markerHtml({ id: "b", type: "boss", px: 0, py: 0 }, false)).toContain("mk-boss");
    expect(markerHtml({ id: "t", type: "tower", px: 0, py: 0 }, false)).toContain("mk-tower");
    expect(markerHtml({ id: "w", type: "watchtower", px: 0, py: 0 }, false)).toContain("mk-watchtower");
  });

  it("affiche le niveau d'un boss PNJ comme celui d'un alpha", () => {
    const html = markerHtml({ id: "b", type: "boss", px: 0, py: 0, meta: { level: 30 } }, false);
    expect(html).toContain("<i>30</i>");
  });
});
