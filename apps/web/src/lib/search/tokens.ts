// Facettes de la palette de recherche : définitions, libellés FR/EN et
// suggestion de tokens depuis le texte tapé. Module pur (testable sans Svelte).

export type Ns = "pal" | "item" | "skill" | "passive" | "tech" | "building" | "marker";
export type MarkerType = "alpha" | "ft" | "relic";
export type Locale = "fr" | "en";

export type Token =
  | { kind: "ns"; value: Ns }
  | { kind: "element"; value: string }
  | { kind: "work"; value: string; min: number }
  | { kind: "cat"; value: string }
  | { kind: "marker"; value: MarkerType }
  | { kind: "progress"; value: "unchecked" | "checked" }
  | { kind: "skill"; value: string; label: string } // pals apprenant la compétence
  | { kind: "passive"; value: string; label: string }; // pals possédant le talent passif

type L10n = { fr: string; en: string };

export const NS_LABELS: Record<Ns, L10n> = {
  pal: { fr: "Pals", en: "Pals" },
  item: { fr: "Objets", en: "Items" },
  skill: { fr: "Compétences", en: "Skills" },
  passive: { fr: "Talents passifs", en: "Passive skills" },
  tech: { fr: "Technologies", en: "Technology" },
  building: { fr: "Constructions", en: "Buildings" },
  marker: { fr: "Carte", en: "Map" },
};

export const ELEMENT_LABELS: Record<string, L10n> = {
  Normal: { fr: "Neutre", en: "Neutral" },
  Fire: { fr: "Feu", en: "Fire" },
  Water: { fr: "Eau", en: "Water" },
  Leaf: { fr: "Plante", en: "Grass" },
  Electricity: { fr: "Électricité", en: "Electric" },
  Ice: { fr: "Glace", en: "Ice" },
  Earth: { fr: "Terre", en: "Ground" },
  Dark: { fr: "Ténèbres", en: "Dark" },
  Dragon: { fr: "Dragon", en: "Dragon" },
};

export const WORK_LABELS: Record<string, L10n> = {
  EmitFlame: { fr: "Embrasement", en: "Kindling" },
  Watering: { fr: "Arrosage", en: "Watering" },
  Seeding: { fr: "Semis", en: "Planting" },
  GenerateElectricity: { fr: "Production d'électricité", en: "Generating Electricity" },
  Handcraft: { fr: "Travail manuel", en: "Handiwork" },
  Collection: { fr: "Collecte", en: "Gathering" },
  Deforest: { fr: "Coupe de bois", en: "Lumbering" },
  Mining: { fr: "Minage", en: "Mining" },
  ProductMedicine: { fr: "Pharmacologie", en: "Medicine Production" },
  Cool: { fr: "Réfrigération", en: "Cooling" },
  Transport: { fr: "Transport", en: "Transporting" },
  MonsterFarm: { fr: "Élevage", en: "Farming" },
};

export const CAT_LABELS: Record<string, L10n> = {
  Accessory: { fr: "Accessoire", en: "Accessory" },
  Essential: { fr: "Essentiel", en: "Essential" },
  Consume: { fr: "Consommable", en: "Consumable" },
  Material: { fr: "Matériau", en: "Material" },
  Weapon: { fr: "Arme", en: "Weapon" },
  Armor: { fr: "Armure", en: "Armor" },
  Ammo: { fr: "Munitions", en: "Ammo" },
  Food: { fr: "Nourriture", en: "Food" },
  Blueprint: { fr: "Plan", en: "Blueprint" },
  Glider: { fr: "Planeur", en: "Glider" },
  MonsterEquipWeapon: { fr: "Arme de Pal", en: "Pal Weapon" },
  SpecialWeapon: { fr: "Arme spéciale", en: "Special Weapon" },
  CaptureItemModifier: { fr: "Modificateur de capture", en: "Capture Modifier" },
};

export const MARKER_LABELS: Record<MarkerType, L10n> = {
  alpha: { fr: "Boss Alpha", en: "Alpha Boss" },
  ft: { fr: "Voyage rapide", en: "Fast Travel" },
  relic: { fr: "Effigie", en: "Effigy" },
};

export const PROGRESS_LABELS: Record<"unchecked" | "checked", L10n> = {
  unchecked: { fr: "Non cochée", en: "Unchecked" },
  checked: { fr: "Cochée", en: "Checked" },
};

/** Minuscules + suppression des diacritiques ("sphère" trouvable via "sphere"). */
export function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function tokenLabel(t: Token, locale: Locale): string {
  switch (t.kind) {
    case "ns":
      return NS_LABELS[t.value][locale];
    case "element":
      return ELEMENT_LABELS[t.value]?.[locale] ?? t.value;
    case "work": {
      const base = WORK_LABELS[t.value]?.[locale] ?? t.value;
      return t.min > 1 ? `${base} ${t.min}+` : base;
    }
    case "cat":
      return CAT_LABELS[t.value]?.[locale] ?? t.value;
    case "marker":
      return MARKER_LABELS[t.value][locale];
    case "progress":
      return PROGRESS_LABELS[t.value][locale];
    case "skill":
    case "passive":
      return t.label;
  }
}

export function tokenKey(t: Token): string {
  return `${t.kind}:${t.value}`;
}

type Candidate = { token: Token; labels: string[] };

const CANDIDATES: Candidate[] = [
  ...Object.entries(NS_LABELS).map(([value, l]) => ({
    token: { kind: "ns", value: value as Ns } as Token,
    labels: [l.fr, l.en],
  })),
  ...Object.entries(ELEMENT_LABELS).map(([value, l]) => ({
    token: { kind: "element", value } as Token,
    labels: [l.fr, l.en],
  })),
  ...Object.entries(WORK_LABELS).map(([value, l]) => ({
    token: { kind: "work", value, min: 1 } as Token,
    labels: [l.fr, l.en],
  })),
  ...Object.entries(CAT_LABELS).map(([value, l]) => ({
    token: { kind: "cat", value } as Token,
    labels: [l.fr, l.en],
  })),
  ...Object.entries(MARKER_LABELS).map(([value, l]) => ({
    token: { kind: "marker", value: value as MarkerType } as Token,
    labels: [l.fr, l.en],
  })),
  ...Object.entries(PROGRESS_LABELS).map(([value, l]) => ({
    token: { kind: "progress", value: value as "unchecked" | "checked" } as Token,
    labels: [l.fr, l.en],
  })),
];

/**
 * Suggère des tokens depuis le texte tapé (≥ 2 caractères), FR et EN confondus.
 * Un nombre final est interprété comme niveau minimum pour les aptitudes
 * ("embrasement 2" → Embrasement 2+). Les tokens déjà actifs sont exclus.
 */
export function suggestTokens(input: string, active: Token[] = []): Token[] {
  const m = /^(.*?)\s*([1-8])?$/.exec(input.trim());
  const text = fold(m?.[1] ?? "");
  const min = m?.[2] ? Number(m[2]) : undefined;
  if (text.length < 2) return [];

  const activeKeys = new Set(active.map(tokenKey));
  const out: Array<[number, Token]> = [];
  for (const c of CANDIDATES) {
    if (activeKeys.has(tokenKey(c.token))) continue;
    let score = -1;
    for (const label of c.labels) {
      const l = fold(label);
      if (l.startsWith(text)) {
        score = 0;
        break;
      }
      if (l.split(/[\s']/).some((w) => w.startsWith(text))) score = 1;
    }
    if (score < 0) continue;
    const token: Token =
      c.token.kind === "work" && min ? { ...c.token, min } : structuredClone(c.token);
    out.push([score, token]);
  }
  return out
    .sort((a, b) => a[0] - b[0])
    .slice(0, 4)
    .map(([, t]) => t);
}
