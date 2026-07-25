import type { TeamSlot } from "$lib/types";
import { GUEST_SLUG } from "$lib/guest";
import { upsertLocalTeam } from "./localTeams";

type Snapshot = { name: string; notes: string; slots: TeamSlot[] };

const clone = (s: Snapshot): Snapshot => JSON.parse(JSON.stringify(s));

/** État de l'éditeur d'équipe. Sauvegarde EXPLICITE (pas d'autosave) :
 *  invariants inter-champs + pas d'amplification d'écritures sur les notes. */
export class TeamEditorStore {
  id = $state<string | null>(null);
  name = $state("");
  notes = $state("");
  slots = $state<TeamSlot[]>([null, null, null, null, null]);
  status = $state<"idle" | "saving" | "saved" | "error">("idle");
  #slug: string;
  #saved = $state<Snapshot>({ name: "", notes: "", slots: [] });

  dirty = $derived(
    JSON.stringify({ name: this.name, notes: this.notes, slots: this.slots }) !==
      JSON.stringify(this.#saved),
  );

  constructor(
    slug: string,
    initial: { id: string | null; name: string; notes: string; slots: TeamSlot[] },
  ) {
    this.#slug = slug;
    this.id = initial.id;
    this.name = initial.name;
    this.notes = initial.notes;
    this.slots = padSlots(initial.slots);
    this.#saved = clone({ name: this.name, notes: this.notes, slots: this.slots });
  }

  setSlot(i: number, slot: TeamSlot) {
    this.slots[i] = slot;
  }

  clearSlot(i: number) {
    this.slots[i] = null;
  }

  async save(): Promise<string | null> {
    if (this.status === "saving") return this.id;
    this.status = "saving";

    // Invité : persistance en localStorage. On reproduit les mêmes contraintes
    // et le même réalignement post-sauvegarde que le serveur, pour que les deux
    // backends se comportent à l'identique vis-à-vis de l'éditeur.
    if (this.#slug === GUEST_SLUG) {
      const name = this.name.trim();
      if (name.length < 1 || name.length > 80) {
        this.status = "error";
        return null;
      }
      // crypto.randomUUID() produit un v4, donc accepté par src/params/uuid.ts.
      const id = this.id ?? crypto.randomUUID();
      const slots = padSlots(this.slots);
      const ok = upsertLocalTeam({
        id,
        name,
        notes: this.notes,
        slots: JSON.parse(JSON.stringify(slots)),
        updatedAt: new Date().toISOString(),
      });
      if (!ok) {
        this.status = "error"; // plafond d'équipes locales atteint
        return null;
      }
      this.id = id;
      this.name = name;
      this.slots = slots;
      this.#saved = clone({ name: this.name, notes: this.notes, slots: this.slots });
      this.status = "saved";
      return id;
    }

    const body = JSON.stringify({ name: this.name, notes: this.notes, slots: this.slots });
    const url =
      this.id === null
        ? `/api/servers/${this.#slug}/teams`
        : `/api/servers/${this.#slug}/teams/${this.id}`;
    const res = await fetch(url, {
      method: this.id === null ? "POST" : "PUT",
      headers: { "content-type": "application/json" },
      body,
    }).catch(() => null);
    if (!res?.ok) {
      this.status = "error";
      return null;
    }
    // Le parsing peut échouer même avec un 2xx (corps invalide) : ne jamais
    // rester bloqué sur "saving" dans ce cas (voir garde de ré-entrée ci-dessus).
    const team = await res.json().catch(() => null);
    if (!team) {
      this.status = "error";
      return null;
    }
    // On réaligne l'état local sur la réponse serveur (nom trimé, slots
    // normalisés) : ce qui est affiché correspond à ce qui a été persisté.
    this.id = team.id;
    this.name = team.name;
    this.notes = team.notes;
    this.slots = padSlots(team.slots);
    this.#saved = clone({ name: this.name, notes: this.notes, slots: this.slots });
    this.status = "saved";
    return this.id;
  }
}

export function padSlots(slots: TeamSlot[]): TeamSlot[] {
  const out = slots.slice(0, 5);
  while (out.length < 5) out.push(null);
  return out;
}
