<script lang="ts">
	// Rail de catégories : SÉLECTION (clic) et VISIBILITÉ (barre oblique) sont
	// deux notions distinctes - cf. spec. La visibilité se règle dans l'en-tête.
	import { CATEGORIES, CATEGORY_ORDER, type CatCount, type CatKey } from '$lib/map/categories';
	import { catLabel } from '$lib/map/categoryLabels';
	import { m } from '$lib/paraglide/messages';
	import { palIcon } from '$lib/game/icons';
	import { gameName } from '$lib/game/names';

	let {
		selected,
		visible,
		counts,
		spawnPal,
		thumbOf,
		onselect
	}: {
		selected: CatKey;
		visible: CatKey[];
		counts: Record<CatKey, CatCount>;
		spawnPal: string | null;
		/** Portrait d'aperçu d'une catégorie, si elle en a un. */
		thumbOf: (key: CatKey) => string | undefined;
		onselect: (key: CatKey) => void;
	} = $props();

	const shown = $derived(new Set(visible));
</script>

<nav class="rail" aria-label={m.map_categories()}>
	{#each CATEGORY_ORDER as key (key)}
		{@const meta = CATEGORIES[key]}
		{#if key !== 'spawn'}
			{@const c = counts[key]}
			<button
				class="tile"
				class:active={selected === key}
				class:hidden={!shown.has(key)}
				class:future={meta.future}
				disabled={meta.future}
				style="--c:{meta.color}"
				aria-current={selected === key}
				aria-label="{catLabel(key)} — {meta.future
					? m.map_cat_soon()
					: m.map_counter_of({ count: c.mine, total: c.total })}"
				onclick={() => onselect(key)}
			>
				{#if thumbOf(key)}
					<img src={thumbOf(key)} alt="" width="22" height="22" />
				{:else}
					<span class="gl" aria-hidden="true">{meta.glyph}</span>
				{/if}
				<span class="tnum n">{meta.future ? '—' : c.total}</span>
				{#if !shown.has(key) && !meta.future}<span class="off" aria-hidden="true"></span>{/if}
			</button>
		{/if}
	{/each}

	<button
		class="tile spawnt"
		class:active={selected === 'spawn'}
		aria-current={selected === 'spawn'}
		aria-label={spawnPal ? `${m.map_cat_spawn()} — ${gameName(`pal:${spawnPal}`)}` : m.map_cat_spawn()}
		onclick={() => onselect('spawn')}
	>
		{#if spawnPal && palIcon(spawnPal)}
			<img src={palIcon(spawnPal)} alt="" width="22" height="22" />
		{:else}
			<span class="gl" aria-hidden="true">{CATEGORIES.spawn.glyph}</span>
		{/if}
		<span class="tnum n">{m.map_cat_spawn_short()}</span>
	</button>
</nav>

<style>
	.rail {
		flex: none;
		width: 56px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 10px 7px;
		overflow: auto;
		background: var(--bg);
		border-right: 1px solid var(--border);
		scrollbar-width: none;
	}
	.tile {
		position: relative;
		display: grid;
		place-items: center;
		gap: 1px;
		min-height: 44px;
		padding: 5px 0 3px;
		background: transparent;
		border: 1px solid transparent;
		border-radius: var(--r-md);
		color: var(--text-3);
	}
	.tile:hover {
		background: var(--surface-2);
	}
	.tile.active {
		background: linear-gradient(180deg, color-mix(in srgb, var(--c) 22%, transparent), transparent);
		border-color: color-mix(in srgb, var(--c) 50%, transparent);
		color: var(--c);
	}
	.tile.hidden img,
	.tile.hidden .gl {
		opacity: 0.3;
	}
	.tile.future {
		opacity: 0.3;
	}
	.gl {
		font-size: 15px;
		line-height: 1;
		color: var(--c);
	}
	img {
		border-radius: 50%;
		background: var(--surface-3);
	}
	.n {
		font-size: 9px;
		color: var(--text-4);
	}
	/* Barre oblique : catégorie masquée sur la carte. */
	.off {
		position: absolute;
		inset: 6px 8px;
		border-top: 1.5px solid var(--text-3);
		transform: rotate(-35deg);
	}
	.spawnt {
		margin-top: auto;
		border: 1px dashed var(--border-strong);
	}
</style>
