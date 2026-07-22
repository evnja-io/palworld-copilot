<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import type { MapFilters } from './mapState.svelte';

	let {
		filters,
		counts,
		onchange
	}: {
		filters: MapFilters;
		counts: { mine: number; group: number; total: number };
		onchange: () => void;
	} = $props();
</script>

<div class="panel">
	<p class="counter tnum">
		<span class="me">{m.map_counter_me({ count: counts.mine, total: counts.total })}</span>
		<span class="grp">{m.map_counter_group({ count: counts.group, total: counts.total })}</span>
	</p>
	<label><input type="checkbox" bind:checked={filters.relic} onchange={onchange} /> <span class="dot relic"></span>{m.map_filter_relic()}</label>
	<label><input type="checkbox" bind:checked={filters.alpha} onchange={onchange} /> <span class="dot alpha"></span>{m.map_filter_alpha()}</label>
	<label><input type="checkbox" bind:checked={filters.ft} onchange={onchange} /> <span class="dot ft"></span>{m.map_filter_ft()}</label>
	<label class="sep"><input type="checkbox" bind:checked={filters.hideChecked} onchange={onchange} /> {m.map_hide_checked()}</label>
</div>

<style>
	.panel {
		position: absolute;
		top: 12px;
		left: 12px;
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
	.counter {
		margin: 0 0 2px;
		display: flex;
		flex-direction: column;
		font-size: 12px;
	}
	.counter .me {
		color: var(--accent);
		font-weight: 600;
	}
	.counter .grp {
		color: var(--text-3);
	}
	label {
		display: flex;
		align-items: center;
		gap: 7px;
		color: var(--text-2);
		cursor: pointer;
	}
	.sep {
		border-top: 1px solid var(--border);
		padding-top: 8px;
		margin-top: 2px;
	}
	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}
	.dot.relic {
		background: var(--el-leaf);
	}
	.dot.alpha {
		background: var(--el-fire);
	}
	.dot.ft {
		background: var(--accent);
	}
</style>
