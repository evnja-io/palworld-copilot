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
	import type { SheetState } from '$lib/map/sheet.svelte';
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
		asSheet = false,
		sheet
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
		asSheet?: boolean;
		/** Positions et glissement de la feuille ; ignoré hors mode feuille. */
		sheet?: SheetState;
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

	// --- Poignée de la feuille : glissement au doigt + appui simple ---
	// Événements pointeur (pas touch) : le même code sert souris, stylet et
	// doigt, et `setPointerCapture` garantit de recevoir la fin du geste même si
	// le doigt sort de la poignée.
	function onPointerDown(e: PointerEvent) {
		if (!sheet || e.button !== 0) return;
		// Capture au mieux : elle garantit de recevoir la fin du geste même si le
		// doigt sort de la poignée, mais son échec (pointeur déjà relâché) ne doit
		// pas empêcher le glissement — d'où le suivi par `sheet.active`.
		try {
			(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		} catch {
			/* sans capture, on suit quand même le geste */
		}
		sheet.start(e.clientY, e.timeStamp);
	}
	function onPointerMove(e: PointerEvent) {
		sheet?.move(e.clientY, e.timeStamp);
	}
	function onPointerUp(e: PointerEvent) {
		if (!sheet?.active) return;
		try {
			(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
		} catch {
			/* déjà relâchée */
		}
		sheet.end(e.clientY, e.timeStamp);
	}
	function onHandleClick() {
		if (!sheet) return;
		// Un glissement se termine par un `click` sur la poignée : sans ce garde,
		// tirer la feuille à mi-course la ferait aussitôt sauter au palier suivant.
		if (sheet.moved) {
			sheet.moved = false;
			return;
		}
		sheet.cycle();
	}
	function onHandleKey(e: KeyboardEvent) {
		if (!sheet) return;
		if (e.key === 'ArrowUp') sheet.step(1);
		else if (e.key === 'ArrowDown') sheet.step(-1);
		else return;
		e.preventDefault();
	}
</script>

<aside
	class="sb"
	class:sheet={asSheet}
	class:peeking={asSheet && sheet?.stop === 'collapsed' && sheet?.dragging === null}
>
	{#if asSheet && sheet}
		<button
			class="handle"
			aria-label={m.map_sheet_toggle()}
			aria-expanded={sheet.stop !== 'collapsed'}
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointercancel={() => sheet?.cancel()}
			onclick={onHandleClick}
			onkeydown={onHandleKey}
		>
			<span class="grip" aria-hidden="true"></span>
			<span class="peek tnum" class:hidden={sheet.stop !== 'collapsed'}>
				{catShort(query.selected)} · {counts[query.selected].mine}/{counts[query.selected].total}
			</span>
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
			horizontal={asSheet}
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
					compact={asSheet}
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
					{#if meta.trackable || query.hideTracked}
						<!-- `hideTracked` s'applique à toutes les catégories visibles (voir
						     query.ts), pas seulement à celle-ci : si le filtre est déjà actif,
						     le contrôle doit rester atteignable même sur une catégorie non
						     cochable, sinon il devient impossible à désactiver. -->
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
		/* Barre home iOS : le rembourrage vit DANS la feuille. Posé sur son
		   conteneur, il laissait une bande de carte visible sous le fond. */
		padding-bottom: env(safe-area-inset-bottom, 0px);
	}
	.handle {
		display: none;
	}
	.sheet .handle {
		display: grid;
		place-items: center;
		gap: 3px;
		flex: none;
		width: 100%;
		/* Zone de préhension : c'est ce que le pouce attrape pour faire glisser
		   la feuille, elle doit être généreuse dès la souris. */
		min-height: 40px;
		padding: 9px 0 5px;
		background: none;
		border: none;
		border-radius: 0;
		/* Le geste vertical appartient à la feuille, pas au défilement de la
		   page : sans ça le navigateur préempte le glissement. */
		touch-action: none;
	}
	.sheet .handle:hover .grip {
		background: var(--text-3);
	}
	.grip {
		width: 40px;
		height: 4px;
		border-radius: 999px;
		background: var(--text-4);
		transition: background 140ms;
	}
	.peek {
		font-size: 11px;
		color: var(--text-2);
	}
	/* Réservée plutôt que retirée : la faire apparaître/disparaître du flux
	   faisait sauter la hauteur de la poignée pendant le glissement. */
	.peek.hidden {
		visibility: hidden;
		height: 0;
	}
	/* Feuille : le rail passe à l'horizontale, sinon il mange la largeur utile. */
	.sheet .cols {
		flex-direction: column;
	}
	/* Position repliée : la feuille fait 68 px, juste la poignée et son résumé.
	   Laisser le contenu dans le flux y montrait une rangée de tuiles tranchée
	   en deux par `overflow: hidden` — ça se lit comme un bug, pas comme un
	   repli. Retiré seulement une fois posé : pendant un glissement, le contenu
	   doit rester visible sous le doigt. */
	.peeking .cols {
		display: none;
	}
	@media (pointer: coarse) {
		/* 40px reste sous le plancher de 44 px ; la poignée est la seule ligne à
		   cette hauteur (rien en dessous à ne pas recouvrir), donc on agrandit la
		   vraie boîte plutôt qu'un ::after superposé. */
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
	/* En feuille, tout ce qui n'est pas la liste est du chrome : à la position
	   « moitié » il ne reste que ~180 px de résultats, chaque interligne compte.
	   L'encoche en paysage est absorbée ici, au plus près du texte. */
	.sheet .panel {
		gap: 7px;
		padding: 8px max(10px, env(safe-area-inset-right)) 8px max(10px, env(safe-area-inset-left));
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
	@media (pointer: coarse) {
		/* Le `<label>` entier est la cible tactile (clic natif sur la case à
		   cocher) : agrandir sa boîte suffit, pas besoin de ::after. */
		.hide {
			min-height: 44px;
		}
	}
	.soon {
		margin: 0;
		padding: 18px 8px;
		font-size: 12px;
		color: var(--text-4);
	}
</style>
