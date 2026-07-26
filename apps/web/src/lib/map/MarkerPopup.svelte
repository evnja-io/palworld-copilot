<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { gameName } from '$lib/game/names';
	import { palIcon } from '$lib/game/icons';
	import { appHref } from '$lib/nav';
	import type { ProgressStore } from '$lib/game/progress.svelte';
	import type { MapMarker } from './markerController';
	import { bossLabel, inGameCoords } from './coords';
	import GroupAvatars from '$lib/components/GroupAvatars.svelte';

	let { marker, store }: { marker: MapMarker; store: ProgressStore } = $props();

	const checked = $derived(store.mine.has(marker.id));
	const coords = $derived(inGameCoords(marker.px, marker.py));
</script>

<div class="popup">
	{#if marker.type === 'relic'}
		<strong>{m.map_relic_name()}</strong>
		<span class="coords tnum">({coords[0]}, {coords[1]})</span>
		<button class="sphere" class:on={checked} onclick={() => store.toggle(marker.id)} aria-pressed={checked}>
			<span class="ball" aria-hidden="true"></span>
			{m.map_found()}
		</button>
		<GroupAvatars users={store.group[marker.id] ?? []} />
	{:else if marker.type === 'alpha' || marker.type === 'boss'}
		<strong class="alpha-name">
			{#if marker.meta?.palId && palIcon(marker.meta.palId)}
				<img src={palIcon(marker.meta.palId)} alt="" width="28" height="28" />
			{/if}
			{marker.meta?.palId ? gameName(`pal:${marker.meta.palId}`) : bossLabel(marker.id)}
		</strong>
		{#if marker.meta?.level}<span class="level tnum">{m.map_level({ level: marker.meta.level })}</span>{/if}
		<span class="coords tnum">({coords[0]}, {coords[1]})</span>
		{#if marker.meta?.palId}
			<a href={appHref(`/paldex/${marker.meta.palId}`)} class="link">{m.map_view_pal()}</a>
		{/if}
	{:else}
		<strong>{marker.nameId ? gameName(`ft:${marker.nameId}`) : m.map_filter_ft()}</strong>
		<span class="coords tnum">({coords[0]}, {coords[1]})</span>
	{/if}
</div>

<style>
	.popup {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text-1);
		min-width: 150px;
	}
	.alpha-name {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.coords,
	.level {
		color: var(--text-3);
		font-size: 11px;
	}
	.link {
		color: var(--accent);
		font-size: 12px;
	}
	.sphere {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
		padding: 4px 10px;
	}
	.ball {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		border: 2px solid var(--text-4);
		transition: border-color 140ms, background 140ms;
	}
	.sphere.on .ball {
		border-color: var(--accent);
		background: linear-gradient(to bottom, #f4f8fb 0 45%, var(--accent-ink) 45% 55%, var(--accent) 55%);
	}
</style>
