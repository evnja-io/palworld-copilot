import { describe, expect, it } from "vitest";
import { rowMeta } from "./ResultList.svelte";
import type { MapMarker } from "$lib/map/markerController";

const alpha: MapMarker = { id: "a", type: "alpha", px: 0, py: 0, meta: { palId: "Anubis", level: 47 } };
const relic: MapMarker = { id: "r", type: "relic", px: 0, py: 0 };

describe("rowMeta", () => {
	it("compose élément et coéquipiers", () => {
		expect(rowMeta(alpha, "Terre", 2)).toBe("Terre · 2 coéquipiers");
	});

	it("accorde le singulier", () => {
		expect(rowMeta(alpha, "Terre", 1)).toBe("Terre · 1 coéquipier");
	});

	it("omet ce qui manque", () => {
		expect(rowMeta(alpha, "Terre", 0)).toBe("Terre");
		expect(rowMeta(relic, undefined, 0)).toBe("");
		expect(rowMeta(relic, undefined, 3)).toBe("3 coéquipiers");
	});
});
