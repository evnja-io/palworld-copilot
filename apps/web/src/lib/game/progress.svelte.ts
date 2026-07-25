import type { GroupUser } from "$lib/types";
import { GUEST_SLUG } from "$lib/guest";
import { localProgressKey, readLocalProgress, writeLocalProgress } from "./localProgress";

export class ProgressStore {
  kind = "";
  mine = $state(new Set<string>());
  group = $state<Record<string, GroupUser[]>>({});
  #api = "";
  /** Invité : localStorage au lieu de l'API. `group` reste vide, ce qui suffit
   *  à faire disparaître les avatars (GroupAvatars ne rend rien sur []). */
  #local = false;
  #timer: ReturnType<typeof setInterval> | undefined;
  #onVisible = () => {
    if (document.visibilityState === "visible") this.refetch();
  };
  // Invité : un autre onglet a modifié la même clé -> on se resynchronise.
  #onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === localProgressKey(this.kind)) this.refetch();
  };

  init(
    kind: string,
    slug: string,
    mine: string[],
    group: Record<string, GroupUser[]>,
    valid?: ReadonlySet<string>,
  ) {
    this.kind = kind;
    this.#local = slug === GUEST_SLUG;
    if (this.#local) {
      this.#api = "";
      this.mine = new Set(readLocalProgress(kind, valid));
      this.group = {};
      return;
    }
    this.#api = `/api/servers/${slug}/progress`;
    this.mine = new Set(mine);
    this.group = group;
  }

  async toggle(entityId: string) {
    const next = new Set(this.mine);
    const checked = !next.has(entityId);
    if (checked) next.add(entityId);
    else next.delete(entityId);
    this.mine = next; // optimiste
    if (this.#local) {
      writeLocalProgress(this.kind, next);
      return;
    }
    const res = await fetch(this.#api, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: this.kind, entityId, checked }),
    }).catch(() => null);
    if (!res || !res.ok) {
      const rollback = new Set(this.mine);
      if (checked) rollback.delete(entityId);
      else rollback.add(entityId);
      this.mine = rollback;
    } else {
      this.refetch(); // rafraîchit les avatars du groupe
    }
  }

  async refetch() {
    if (this.#local) {
      this.mine = new Set(readLocalProgress(this.kind));
      return;
    }
    const res = await fetch(`${this.#api}?kind=${this.kind}`).catch(() => null);
    if (!res?.ok) return;
    const data = await res.json();
    this.mine = new Set(data.mine);
    this.group = data.group;
  }

  startSync() {
    if (this.#local) {
      // Rien à interroger côté serveur : seul le multi-onglets peut diverger.
      window.addEventListener("storage", this.#onStorage);
      return;
    }
    document.addEventListener("visibilitychange", this.#onVisible);
    this.#timer = setInterval(() => {
      if (document.visibilityState === "visible") this.refetch();
    }, 60_000);
  }

  stopSync() {
    if (this.#local) {
      window.removeEventListener("storage", this.#onStorage);
      return;
    }
    document.removeEventListener("visibilitychange", this.#onVisible);
    clearInterval(this.#timer);
  }
}
