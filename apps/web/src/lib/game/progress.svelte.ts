import type { GroupUser } from "$lib/types";

export class ProgressStore {
  kind = "";
  mine = $state(new Set<string>());
  group = $state<Record<string, GroupUser[]>>({});
  #timer: ReturnType<typeof setInterval> | undefined;
  #onVisible = () => {
    if (document.visibilityState === "visible") this.refetch();
  };

  init(kind: string, mine: string[], group: Record<string, GroupUser[]>) {
    this.kind = kind;
    this.mine = new Set(mine);
    this.group = group;
  }

  async toggle(entityId: string) {
    const next = new Set(this.mine);
    const checked = !next.has(entityId);
    if (checked) next.add(entityId);
    else next.delete(entityId);
    this.mine = next; // optimiste
    const res = await fetch("/api/progress", {
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
    const res = await fetch(`/api/progress?kind=${this.kind}`).catch(() => null);
    if (!res?.ok) return;
    const data = await res.json();
    this.mine = new Set(data.mine);
    this.group = data.group;
  }

  startSync() {
    document.addEventListener("visibilitychange", this.#onVisible);
    this.#timer = setInterval(() => {
      if (document.visibilityState === "visible") this.refetch();
    }, 60_000);
  }

  stopSync() {
    document.removeEventListener("visibilitychange", this.#onVisible);
    clearInterval(this.#timer);
  }
}
