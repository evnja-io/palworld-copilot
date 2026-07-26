import { describe, expect, it } from "vitest";
import markers from "@palworld-companion/game-data/markers.json";
import { isValidEntity, isValidKind } from "./progress";

const byType = (t: string) =>
	(markers as Array<{ id: string; type: string }>).filter((mk) => mk.type === t);

describe("registre de progression", () => {
	it("accepte les trois kinds", () => {
		expect(isValidKind("pal_caught")).toBe(true);
		expect(isValidKind("tech_unlocked")).toBe(true);
		expect(isValidKind("marker")).toBe(true);
		expect(isValidKind("nope")).toBe(false);
	});

	it("accepte un id de chaque catégorie de marqueur", () => {
		for (const type of ["relic", "alpha", "boss", "tower", "watchtower", "ft"]) {
			const sample = byType(type)[0];
			expect(sample, `aucun marqueur de type ${type}`).toBeDefined();
			expect(isValidEntity("marker", sample.id), type).toBe(true);
		}
	});

	it("refuse un id inconnu", () => {
		expect(isValidEntity("marker", "relic_inexistant")).toBe(false);
	});
});
