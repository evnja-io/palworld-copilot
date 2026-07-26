<script lang="ts">
	// Zones de spawn : un Pal à la fois (cf. spec), avec segment jour / nuit.
	import { m } from '$lib/paraglide/messages';
	import { palIcon } from '$lib/game/icons';
	import { gameName } from '$lib/game/names';
	import { spawnCounts, hasSpawns } from '$lib/game/spawns';
	import { norm } from '$lib/map/query';
	import type { SpawnPhase } from '$lib/map/spawnLayer';

	let {
		palId,
		phase,
		search,
		onsearch,
		onpal,
		onphase
	}: {
		palId: string | null;
		phase: SpawnPhase;
		search: string;
		onsearch: (v: string) => void;
		onpal: (palId: string | null) => void;
		onphase: (phase: SpawnPhase) => void;
	} = $props();

	const counts = $derived(palId ? spawnCounts[palId] : undefined);

	/** Pals ayant des zones, filtrés par la recherche. Liste construite une fois. */
	const ALL = Object.keys(spawnCounts)
		.filter((id) => hasSpawns(spawnCounts[id]))
		.map((id) => ({ id, name: gameName(`pal:${id}`) }))
		.sort((a, b) => a.name.localeCompare(b.name, 'fr'));

	const matches = $derived(
		search.trim()
			? ALL.filter((p) => norm(p.name).includes(norm(search.trim()))).slice(0, 40)
			: ALL.slice(0, 40)
	);
</script>

{#if palId && counts}
	<div class="current">
		{#if palIcon(palId)}<img src={palIcon(palId)} alt="" width="34" height="34" />{/if}
		<span class="nm">{gameName(`pal:${palId}`)}</span>
		<span class="tnum n">{m.map_spawn_zones({ count: phase === 'day' ? counts.day : counts.night })}</span>
		<button class="x" aria-label={m.map_spawn_clear()} onclick={() => onpal(null)}>×</button>
	</div>
	<div class="seg" role="group" aria-label={m.map_spawn_phase()}>
		<button class:on={phase === 'day'} aria-pressed={phase === 'day'} onclick={() => onphase('day')}>☀ {m.map_spawn_day()}</button>
		<button class:on={phase === 'night'} aria-pressed={phase === 'night'} onclick={() => onphase('night')}>☾ {m.map_spawn_night()}</button>
	</div>
{/if}

<input
	type="search"
	class="find"
	placeholder={m.map_spawn_search()}
	value={search}
	oninput={(e) => onsearch(e.currentTarget.value)}
/>

<ul class="pals">
	{#each matches as p (p.id)}
		<li>
			<button class="prow" class:on={p.id === palId} onclick={() => onpal(p.id)}>
				{#if palIcon(p.id)}<img src={palIcon(p.id)} alt="" width="24" height="24" />{/if}
				<span class="pn">{p.name}</span>
				<span class="tnum pc">{spawnCounts[p.id].day + spawnCounts[p.id].night}</span>
			</button>
		</li>
	{:else}
		<li class="empty">{m.map_no_results()}</li>
	{/each}
</ul>

<style>
	.current {
		flex: none;
		display: flex;
		align-items: center;
		gap: 9px;
		padding: 8px 10px;
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		background: var(--surface-2);
	}
	.nm {
		flex: 1;
		min-width: 0;
		font-size: 13px;
		color: var(--text-1);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.n {
		font-size: 11px;
		color: var(--text-3);
	}
	.x {
		position: relative;
		background: none;
		border: none;
		color: var(--text-3);
		padding: 0 4px;
	}
	@media (pointer: coarse) {
		.x::after {
			content: '';
			position: absolute;
			inset: -11px;
		}
	}
	.seg {
		flex: none;
		display: flex;
		gap: 6px;
	}
	.seg button {
		flex: 1;
		min-height: 34px;
		font-size: 12px;
		color: var(--text-3);
	}
	.seg .on {
		background: var(--accent-soft);
		border-color: var(--accent);
		color: var(--accent);
	}
	.find {
		flex: none;
	}
	.pals {
		flex: 1;
		min-height: 0;
		overflow: auto;
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.prow {
		display: flex;
		align-items: center;
		gap: 9px;
		width: 100%;
		min-height: 34px;
		background: none;
		border: none;
		border-left: 2px solid transparent;
		padding: 4px 6px;
		border-radius: var(--r-sm);
		text-align: left;
	}
	.prow:hover {
		background: var(--surface-2);
	}
	.prow.on {
		background: var(--accent-soft);
		border-left-color: var(--accent);
	}
	.pn {
		flex: 1;
		min-width: 0;
		font-size: 13px;
		color: var(--text-1);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.pc {
		font-size: 10px;
		color: var(--text-4);
	}
	.empty {
		padding: 18px 8px;
		color: var(--text-4);
		font-size: 12px;
	}
</style>
