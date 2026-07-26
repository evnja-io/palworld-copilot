import { describe, expect, it } from "vitest";
import { rowMeta } from "./ResultList.svelte";

describe("rowMeta", () => {
	it("compose élément et coéquipiers", () => {
		expect(rowMeta("Terre", 2)).toBe("Terre · 2 coéquipiers");
	});

	it("accorde le singulier", () => {
		expect(rowMeta("Terre", 1)).toBe("Terre · 1 coéquipier");
	});

	it("omet ce qui manque", () => {
		expect(rowMeta("Terre", 0)).toBe("Terre");
		expect(rowMeta(undefined, 0)).toBe("");
		expect(rowMeta(undefined, 3)).toBe("3 coéquipiers");
	});
});
