<script lang="ts">
	// Ossature de la barre latérale : rail + panneau. Ne connaît ni Leaflet ni
	// le store de progression - tout passe par des props et des rappels.
	import { CATEGORIES, type CatCount, type CatKey } from '$lib/map/categories';
	import { catShort } from '$lib/map/categoryLabels';
	import { m } from '$lib/paraglide/messages';
	import { ELEMENT_LABELS, type Locale } from '$lib/search/tokens';
	import { getLocale } from '$lib/paraglide/runtime';
	import type { MapMarker } from '$lib/map/markerController';
	import type { Query } from '$lib/map/query';
	import type { SpawnPhase } from '$lib/map/spawnLayer';
	import type { GroupUser } from '$lib/types';
	import CategoryRail from './CategoryRail.svelte';
	import CategoryHeader from './CategoryHeader.svelte';
	import RefineControls from './RefineControls.svelte';
	import ResultList from './ResultList.svelte';
	import SpawnPicker from './SpawnPicker.svelte';

	let {
		query = $bindable(),
		spawn,
		counts,
		rows,
		mine,
		group,
		guest,
		nameOf,
		elementOf,
		thumbOf,
		onchange,
		onfocus,
		ontoggle,
		onspawn,
		onphase,
		onshare,
		sheet = false,
		stop = 'half',
		onstop
	}: {
		query: Query;
		spawn: { spawnPal: string | null; spawnPhase: SpawnPhase };
		counts: Record<CatKey, CatCount>;
		rows: MapMarker[];
		mine: ReadonlySet<string>;
		group: Record<string, GroupUser[]>;
		guest: boolean;
		nameOf: (mk: MapMarker) => string;
		elementOf: (mk: MapMarker) => string | undefined;
		thumbOf: (key: CatKey) => string | undefined;
		onchange: () => void;
		onfocus: (mk: MapMarker) => void;
		ontoggle: (mk: MapMarker) => void;
		onspawn: (palId: string | null) => void;
		onphase: (phase: SpawnPhase) => void;
		onshare: () => void;
		/** Rendu en feuille glissante (mobile). */
		sheet?: boolean;
		stop?: 'collapsed' | 'half' | 'full';
		onstop?: (stop: 'collapsed' | 'half' | 'full') => void;
	} = $props();

	const locale = getLocale() as Locale;
	const meta = $derived(CATEGORIES[query.selected]);
	const isSpawn = $derived(query.selected === 'spawn');
	const elementLabelOf = (el: string | undefined) => (el ? ELEMENT_LABELS[el]?.[locale] : undefined);

	function select(key: CatKey) {
		query.selected = key;
		// La recherche est propre à la catégorie : la garder en changeant de
		// catégorie donnerait une liste vide sans raison visible.
		query.search = '';
		onchange();
	}
	function toggleVisibility() {
		const next = new Set(query.visible);
		next.has(query.selected) ? next.delete(query.selected) : next.add(query.selected);
		query.visible = [...next];
		onchange();
	}
</script>

<aside class="sb" class:sheet>
	{#if sheet}
		<button
			class="handle"
			aria-label={m.map_sheet_toggle()}
			aria-expanded={stop !== 'collapsed'}
			onclick={() => onstop?.(stop === 'full' ? 'collapsed' : stop === 'half' ? 'full' : 'half')}
		>
			<span class="grip" aria-hidden="true"></span>
			{#if stop === 'collapsed'}
				<span class="peek tnum">
					{catShort(query.selected)} · {counts[query.selected].mine}/{counts[query.selected].total}
				</span>
			{/if}
		</button>
	{/if}
	<div class="cols">
		<CategoryRail
			selected={query.selected}
			visible={query.visible}
			{counts}
			spawnPal={spawn.spawnPal}
			{thumbOf}
			onselect={select}
			horizontal={sheet}
		/>

		<section class="panel">
			{#if isSpawn}
				<header class="spawnhead">
					<h2>{m.map_cat_spawn()}</h2>
					<button class="share" aria-label={m.map_copy_link()} onclick={onshare}>⧉</button>
				</header>
				<SpawnPicker
					palId={spawn.spawnPal}
					phase={spawn.spawnPhase}
					search={query.search}
					onsearch={(v) => {
						query.search = v;
						onchange();
					}}
					onpal={onspawn}
					{onphase}
				/>
			{:else}
				<CategoryHeader
					category={query.selected}
					count={counts[query.selected]}
					visible={query.visible.includes(query.selected)}
					{guest}
					onvisibility={toggleVisibility}
					{onshare}
					compact={sheet}
				/>

				<input
					type="search"
					placeholder={m.map_search_in({ category: catShort(query.selected).toLowerCase() })}
					value={query.search}
					aria-label={m.map_search_in({ category: catShort(query.selected).toLowerCase() })}
					oninput={(e) => {
						query.search = e.currentTarget.value;
						onchange();
					}}
				/>

				{#if meta.refine !== 'none'}
					<RefineControls
						mode={meta.refine}
						levelMin={query.levelMin}
						element={query.element}
						onlevel={(v) => {
							query.levelMin = v;
							onchange();
						}}
						onelement={(v) => {
							query.element = v;
							onchange();
						}}
					/>
				{/if}

				<div class="rbar">
					{#if rows.length > 0}
						<span class="tnum rc">
							{rows.length === 1 ? m.map_results_one() : m.map_results_many({ count: rows.length })}
						</span>
					{/if}
					{#if meta.trackable}
						<label class="hide">
							<input
								type="checkbox"
								checked={query.hideTracked}
								onchange={(e) => {
									query.hideTracked = e.currentTarget.checked;
									onchange();
								}}
							/>
							{m.map_hide_tracked()}
						</label>
					{/if}
				</div>

				{#if meta.future}
					<p class="soon">{m.map_cat_soon_help()}</p>
				{:else}
					<ResultList
						{rows}
						{mine}
						{group}
						trackable={meta.trackable}
						{nameOf}
						{elementOf}
						{elementLabelOf}
						{onfocus}
						{ontoggle}
					/>
				{/if}
			{/if}
		</section>
	</div>
</aside>

<style>
	.sb {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--surface-1);
		border-right: 1px solid var(--border-strong);
	}
	.cols {
		display: flex;
		flex: 1;
		min-height: 0;
	}
	.sheet {
		border-right: none;
		border-top: 1px solid var(--border-strong);
		border-radius: var(--r-lg) var(--r-lg) 0 0;
		overflow: hidden;
	}
	.handle {
		display: none;
	}
	.sheet .handle {
		display: flex;
		flex: none;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		width: 100%;
		min-height: 32px;
		padding: 8px 0 4px;
		background: none;
		border: none;
		border-radius: 0;
	}
	.grip {
		width: 40px;
		height: 4px;
		border-radius: 999px;
		background: var(--text-4);
	}
	.peek {
		font-size: 11px;
		color: var(--text-2);
	}
	/* Feuille : le rail passe à l'horizontale, sinon il mange la largeur utile. */
	.sheet .cols {
		flex-direction: column;
	}
	@media (pointer: coarse) {
		/* 32px de base est trop court pour un doigt ; la poignée est la seule
		   ligne à cette hauteur (rien en dessous à ne pas recouvrir), donc on
		   agrandit la vraie boîte plutôt qu'un ::after superposé. */
		.sheet .handle {
			min-height: 44px;
		}
	}
	.panel {
		flex: 1;
		min-width: 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 9px;
		padding: 10px 11px;
	}
	.spawnhead {
		flex: none;
		display: flex;
		align-items: baseline;
		justify-content: space-between;
	}
	.spawnhead h2 {
		margin: 0;
		font-size: 14px;
		color: var(--text-1);
	}
	.share {
		background: none;
		border: none;
		color: var(--text-3);
		padding: 2px 4px;
	}
	.rbar {
		flex: none;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		border-top: 1px solid var(--border);
		padding-top: 7px;
	}
	.rc {
		font-size: 10px;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--text-4);
	}
	.hide {
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: 11px;
		color: var(--text-3);
	}
	.soon {
		margin: 0;
		padding: 18px 8px;
		font-size: 12px;
		color: var(--text-4);
	}
</style>
