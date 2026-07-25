<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { gameName } from '$lib/game/names';
	import { palIcon } from '$lib/game/icons';
	import type { SpawnPhase } from './spawnLayer';

	let {
		palId,
		phase,
		counts,
		onphase,
		onclear
	}: {
		palId: string;
		phase: SpawnPhase;
		counts: { day: number; night: number };
		onphase: (p: SpawnPhase) => void;
		onclear: () => void;
	} = $props();
</script>

<div class="panel">
	<p class="head">
		{#if palIcon(palId)}
			<img src={palIcon(palId)} alt="" width="24" height="24" />
		{/if}
		<span class="name">{gameName(`pal:${palId}`)}</span>
	</p>
	<div class="segs">
		<button class="seg" class:on={phase === 'day'} aria-pressed={phase === 'day'} onclick={() => onphase('day')}>
			☀ {m.map_spawn_day()}
		</button>
		<button class="seg" class:on={phase === 'night'} aria-pressed={phase === 'night'} onclick={() => onphase('night')}>
			☾ {m.map_spawn_night()}
		</button>
	</div>
	<p class="count tnum">{m.map_spawn_zones({ count: counts[phase] })}</p>
	<button class="clear" onclick={onclear}>{m.map_spawn_clear()}</button>
</div>

<style>
	.panel {
		position: absolute;
		top: 12px;
		right: 12px;
		z-index: 500;
		display: flex;
		flex-direction: column;
		gap: 6px;
		background: color-mix(in srgb, var(--surface-2) 92%, transparent);
		border: 1px solid var(--border-strong);
		border-radius: var(--r-md);
		padding: 10px 12px;
		font-size: 13px;
		backdrop-filter: blur(4px);
	}
	.head {
		display: flex;
		align-items: center;
		gap: 7px;
		margin: 0;
	}
	.name {
		font-weight: 600;
		color: var(--text-1);
	}
	.segs {
		display: flex;
		gap: 4px;
	}
	.seg {
		flex: 1;
		padding: 4px 8px;
		font-size: 12px;
	}
	.seg.on {
		background: var(--accent);
		color: var(--accent-ink);
		border-color: var(--accent);
	}
	.count {
		margin: 0;
		font-size: 12px;
		color: var(--text-3);
	}
	.clear {
		font-size: 12px;
	}
</style>
