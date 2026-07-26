import { describe, expect, it } from "vitest";
import { defaultQuery } from "./query";
import { fromSearchParams, toSearchParams } from "./shareUrl";

const spawn = { spawnPal: null, spawnPhase: "day" as const };

describe("toSearchParams", () => {
	it("n'écrit que ce qui diffère des défauts", () => {
		const p = toSearchParams(defaultQuery(), spawn);
		expect(p.toString()).toBe("");
	});

	it("sérialise catégories, affinage et recherche", () => {
		const p = toSearchParams(
			{ ...defaultQuery(), selected: "alpha", visible: ["alpha", "tower"], levelMin: 40, element: "Fire", hideTracked: true, search: "anub" },
			{ spawnPal: "Anubis", spawnPhase: "night" }
		);
		expect(p.get("sel")).toBe("alpha");
		expect(p.get("vis")).toBe("alpha,tower");
		expect(p.get("lvl")).toBe("40");
		expect(p.get("el")).toBe("Fire");
		expect(p.get("todo")).toBe("1");
		expect(p.get("q")).toBe("anub");
		expect(p.get("pal")).toBe("Anubis");
		expect(p.get("phase")).toBe("night");
	});
});

describe("fromSearchParams", () => {
	it("renvoie null sans paramètre de filtre", () => {
		expect(fromSearchParams(new URLSearchParams(""))).toBeNull();
		expect(fromSearchParams(new URLSearchParams("focus=relic_x"))).toBeNull();
	});

	it("fait l'aller-retour", () => {
		const q = { ...defaultQuery(), selected: "boss" as const, visible: ["boss"] as const, levelMin: 25, hideTracked: true };
		const parsed = fromSearchParams(toSearchParams({ ...q, visible: [...q.visible] }, spawn));
		expect(parsed?.query.selected).toBe("boss");
		expect(parsed?.query.visible).toEqual(["boss"]);
		expect(parsed?.query.levelMin).toBe(25);
		expect(parsed?.query.hideTracked).toBe(true);
	});

	it("ignore une catégorie inconnue", () => {
		const parsed = fromSearchParams(new URLSearchParams("vis=alpha,licorne&sel=licorne"));
		expect(parsed?.query.visible).toEqual(["alpha"]);
		expect(parsed?.query.selected).toBeUndefined();
	});

	it("borne le niveau", () => {
		expect(fromSearchParams(new URLSearchParams("lvl=0"))?.query.levelMin).toBe(1);
		expect(fromSearchParams(new URLSearchParams("lvl=999"))?.query.levelMin).toBe(70);
		expect(fromSearchParams(new URLSearchParams("lvl=abc"))?.query.levelMin).toBeUndefined();
	});

	it("ignore une phase invalide", () => {
		expect(fromSearchParams(new URLSearchParams("phase=midi"))?.spawn.spawnPhase).toBeUndefined();
		expect(fromSearchParams(new URLSearchParams("phase=night"))?.spawn.spawnPhase).toBe("night");
	});
});
