<script lang="ts">
	// Craft — écrans 3a (desktop, colonne 380 px + arbre) et 5a (mobile, empilé).
	//
	// L'écran passe d'une LISTE de recettes à un CALCULATEUR : objet cible,
	// quantité, arbre récursif, total des matières premières.
	//
	// Les statuts de stock (« ✓ en stock : 214 », « ⚠ manque 4 laines ») du
	// dessin ne sont PAS repris : l'app n'a aucune donnée d'inventaire — la
	// progression ne couvre que les Pals capturés, les technologies et les
	// marqueurs. Les inventer aurait été pire que les omettre.
	import { fly } from 'svelte/transition';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import { m } from '$lib/paraglide/messages';
	import { reveal } from '$lib/motion';
	import { gameName } from '$lib/game/names';
	import { itemIcon } from '$lib/game/icons';
	import { techUnlocking, recipesByProduct } from '$lib/game/indexes';
	import { buildTree, rawTotals } from '$lib/game/craftTree';
	import { elVar } from '$lib/game/elements';
	import { CAT_LABELS, type Locale } from '$lib/search/tokens';
	import { getLocale } from '$lib/paraglide/runtime';
	import { isGuestContext } from '$lib/nav';
	import items from '@palworld-companion/game-data/items.json';
	import SearchPill from '$lib/components/atlas/SearchPill.svelte';
	import FilterPill from '$lib/components/atlas/FilterPill.svelte';
	import CraftNodeView from '$lib/components/craft/CraftNode.svelte';
	import Seo from '$lib/components/Seo.svelte';

	const locale = getLocale() as Locale;

	/** Univers sélectionnable : les objets qui ont une recette (1 408 / 2 344). */
	const CRAFTABLE = items.filter((i) => recipesByProduct.has(i.id));
	const byId = new Map(CRAFTABLE.map((i) => [i.id, i]));

	// Lien profond depuis la fiche Objet : /craft?item=CompoundBow&qty=3
	let target = $state(page.url.searchParams.get('item') ?? '');
	let qty = $state(Math.max(1, Number(page.url.searchParams.get('qty')) || 1));
	let search = $state('');

	const selected = $derived(target && byId.has(target) ? byId.get(target)! : null);
	const tree = $derived(selected ? buildTree(selected.id, qty) : null);
	const totals = $derived(tree ? [...rawTotals(tree)].sort((a, b) => b[1] - a[1]) : []);
	const tech = $derived(
		selected ? techUnlocking.get(recipesByProduct.get(selected.id)![0]!.id) : undefined
	);

	/** Catalogue parcourable : sans recherche ni sélection, l'écran serait vide
	 *  et il n'y aurait aucun moyen de choisir un objet. On le trie par palier
	 *  de technologie — l'ordre dans lequel on débloque les recettes en jeu. */
	const TECH_OF = new Map(
		CRAFTABLE.map((i) => {
			const r = recipesByProduct.get(i.id)![0]!;
			return [i.id, techUnlocking.get(r.id)?.level ?? 0];
		})
	);
	const BROWSE = [...CRAFTABLE].sort(
		(a, b) => (TECH_OF.get(a.id) ?? 0) - (TECH_OF.get(b.id) ?? 0) || a.sortId - b.sortId
	);

	let cat = $state('');
	const CATS = $derived([...new Set(CRAFTABLE.map((i) => i.typeA).filter(Boolean))].sort() as string[]);

	const matching = $derived.by(() => {
		const q = search.trim().toLowerCase();
		return BROWSE.filter((i) => {
			if (cat && i.typeA !== cat) return false;
			if (!q) return true;
			return gameName(`item:${i.id}`).toLowerCase().includes(q) || i.id.toLowerCase().includes(q);
		});
	});
	const browse = $derived(matching.slice(0, 120));
	/** Liste courte sous le champ, uniquement pendant une recherche active. */
	const results = $derived(search.trim() ? matching.slice(0, 40) : []);

	function pick(id: string) {
		target = id;
		search = '';
		syncUrl();
	}
	/** L'état est partageable. `replaceState` et non `pushState` : chaque clic
	 *  sur « + » n'a pas à empiler une entrée d'historique. */
	function syncUrl() {
		const u = new URL(page.url);
		if (target) {
			u.searchParams.set('item', target);
			u.searchParams.set('qty', String(qty));
		} else {
			u.searchParams.delete('item');
			u.searchParams.delete('qty');
		}
		replaceState(u, page.state);
	}
	function bump(delta: number) {
		qty = Math.min(999, Math.max(1, qty + delta));
		syncUrl();
	}
</script>

<Seo
	title={m.craft_title()}
	description={m.seo_craft_desc()}
	path="/craft"
	indexable={isGuestContext()}
/>

<div class="layout">
	<div class="side">
		<h1>{m.craft_title()}</h1>
		<p class="sub">{m.craft_subtitle()}</p>

		<div class="picker">
			<SearchPill bind:value={search} placeholder={m.craft_search()} />
			{#if search.trim()}
				<ul class="results">
					{#each results as it (it.id)}
						<li>
							<button onclick={() => pick(it.id)}>
								{#if itemIcon(it.id)}<img src={itemIcon(it.id)} alt="" loading="lazy" />{/if}
								<span class="rname">{gameName(`item:${it.id}`)}</span>
							</button>
						</li>
					{:else}
						<li class="none">{m.craft_none()}</li>
					{/each}
				</ul>
			{/if}
		</div>

		{#if selected}
			<!-- Teinte terre, comme la carte objet du dessin (3a l.310). -->
			<div class="target" style="--el:{elVar('Earth')}">
				<div class="thead">
					<div class="ticon">
						{#if itemIcon(selected.id)}<img src={itemIcon(selected.id)} alt="" />{/if}
					</div>
					<div class="tid">
						<div class="tname">{gameName(`item:${selected.id}`)}</div>
						<div class="tmeta">
							{(CAT_LABELS[selected.typeA]?.[locale] ?? selected.typeA ?? '').toUpperCase()}
							{#if tech}· {m.craft_tech({ level: tech.level }).toUpperCase()}{/if}
						</div>
					</div>
				</div>
				<div class="qrow">
					<span class="qlabel">{m.craft_qty()}</span>
					<div class="stepper">
						<button onclick={() => bump(-1)} aria-label="−">−</button>
						<span class="qnum tnum">{qty}</span>
						<button onclick={() => bump(1)} aria-label="+">+</button>
					</div>
				</div>
			</div>

			<div class="totals">
				<div class="tlabel">
					{m.craft_total_raw({ qty, name: gameName(`item:${selected.id}`) })}
				</div>
				<div class="tgrid">
					{#each totals as [id, n] (id)}
						<div class="trow">
							{#if itemIcon(id)}<img src={itemIcon(id)} alt="" loading="lazy" />{/if}
							<span class="tn">{gameName(`item:${id}`)}</span>
							<span class="tq tnum">{n}</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	<div class="main">
		{#if tree}
			<div class="treelabel">{m.craft_tree()}</div>
			<CraftNodeView node={tree} goal />
			<button class="change" onclick={() => { target = ''; syncUrl(); }}>
				{m.craft_change_item()}
			</button>
		{:else}
			<!-- Catalogue par défaut : sans lui, l'écran s'ouvrait vide et rien
			     n'indiquait comment choisir un objet. -->
			<div class="browselabel">{m.craft_pick()}</div>
			<div class="cats">
				<FilterPill active={cat === ''} onclick={() => (cat = '')}>
					{m.items_filter_all()}
				</FilterPill>
				{#each CATS as c (c)}
					<FilterPill active={cat === c} onclick={() => (cat = cat === c ? '' : c)}>
						{CAT_LABELS[c]?.[locale] ?? c}
					</FilterPill>
				{/each}
			</div>
			<div class="browse">
				{#each browse as it, i (it.id)}
					<button class="btile lift-sm" onclick={() => pick(it.id)} in:fly={reveal(i)}>
						{#if itemIcon(it.id)}
							<img src={itemIcon(it.id)} alt="" loading="lazy" />
						{:else}
							<span class="no-icon" aria-hidden="true">·</span>
						{/if}
						<span class="bname">{gameName(`item:${it.id}`)}</span>
						<span class="btech">
							{#if TECH_OF.get(it.id)}{m.craft_tech({ level: TECH_OF.get(it.id)! })}
							{:else}{m.craft_no_tech()}{/if}
						</span>
					</button>
				{:else}
					<p class="hint">{m.craft_none()}</p>
				{/each}
			</div>
			{#if matching.length > browse.length}
				<p class="more">… {matching.length - browse.length}+</p>
			{/if}
		{/if}
	</div>
</div>

<style>
	.layout {
		display: grid;
		grid-template-columns: 380px 1fr;
		gap: 32px;
		align-items: start;
	}
	h1 {
		margin: 0 0 4px;
		font-size: 40px;
		letter-spacing: -0.03em;
	}
	.sub {
		margin: 0 0 20px;
		font-size: 13px;
		color: var(--color-muted);
	}

	.picker {
		position: relative;
		margin-bottom: 16px;
	}
	.results {
		list-style: none;
		margin: 8px 0 0;
		padding: 6px;
		max-height: 320px;
		overflow-y: auto;
		background: var(--color-raised);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
	}
	.results button {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		text-align: left;
		background: none;
		border: none;
		border-radius: 10px;
		padding: 8px 10px;
		font-size: 13px;
		min-height: 44px;
	}
	.results button:hover {
		background: rgba(255, 255, 255, 0.06);
	}
	.results img {
		width: 24px;
		height: 24px;
		object-fit: contain;
	}
	.rname {
		flex: 1;
		min-width: 0;
	}
	.none {
		padding: 10px;
		font-size: 13px;
		color: var(--color-muted);
	}

	.target {
		border-radius: var(--radius-card);
		background:
			linear-gradient(
				160deg,
				color-mix(in srgb, var(--el) 22%, transparent),
				color-mix(in srgb, var(--el) 4%, transparent)
			),
			var(--color-surface);
		border: 1px solid color-mix(in srgb, var(--el) 25%, transparent);
		padding: 22px;
	}
	.thead {
		display: flex;
		align-items: center;
		gap: 16px;
	}
	.ticon {
		width: 74px;
		height: 74px;
		flex: none;
		border-radius: 16px;
		background: rgba(0, 0, 0, 0.3);
		display: grid;
		place-items: center;
	}
	.ticon img {
		width: 56px;
		height: 56px;
		object-fit: contain;
	}
	.tid {
		min-width: 0;
	}
	.tname {
		font-weight: 700;
		font-size: 19px;
	}
	.tmeta {
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.04em;
		margin-top: 3px;
		color: color-mix(in srgb, var(--el) 40%, white);
	}

	.qrow {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-top: 20px;
	}
	.qlabel {
		font-size: 13px;
		color: var(--color-muted);
	}
	.stepper {
		display: flex;
		align-items: center;
		gap: 14px;
		background: var(--color-bg);
		border-radius: 999px;
		padding: 7px 16px;
		font-weight: 700;
	}
	.stepper button {
		background: none;
		border: none;
		padding: 0;
		min-width: 24px;
		min-height: 24px;
		color: var(--color-muted);
		font-size: 15px;
	}
	.stepper button:hover {
		background: none;
		color: var(--color-text);
	}
	.qnum {
		font-family: var(--font-display);
		font-size: 17px;
		min-width: 24px;
		text-align: center;
	}

	.totals {
		margin-top: 16px;
		border-radius: var(--radius-card);
		background: var(--color-surface);
		padding: 20px 22px;
	}
	.tlabel {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.1em;
		color: var(--color-muted);
		margin-bottom: 12px;
	}
	.tgrid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	.trow {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
	}
	.trow img {
		width: 30px;
		height: 30px;
		object-fit: contain;
		flex: none;
	}
	.tn {
		flex: 1;
		min-width: 0;
		font-size: 13.5px;
		color: #c7ccd6;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.tq {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 16px;
	}

	.treelabel {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.1em;
		color: var(--color-muted);
		margin: 10px 0 14px;
	}
	.hint {
		margin: 60px 0;
		text-align: center;
		color: var(--color-muted);
		font-size: 13.5px;
	}

	/* Catalogue parcourable (état par défaut). */
	.browselabel {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-muted);
		margin: 10px 0 12px;
	}
	.cats {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		margin-bottom: 16px;
	}
	.browse {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 10px;
		min-width: 0;
	}
	.btile {
		display: flex;
		flex-direction: column;
		align-items: center;
		min-width: 0;
		gap: 0;
		padding: 14px 10px;
		border-radius: 16px;
		background: var(--color-surface);
		border: 1px solid var(--color-line);
		text-align: center;
	}
	.btile:hover {
		background: var(--color-raised);
		border-color: rgba(255, 122, 47, 0.35);
	}
	.btile img,
	.btile .no-icon {
		width: 40px;
		height: 40px;
		object-fit: contain;
	}
	.no-icon {
		display: grid;
		place-items: center;
		color: var(--color-muted);
	}
	.bname {
		margin-top: 8px;
		font-size: 12.5px;
		font-weight: 600;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.btech {
		margin-top: 3px;
		font-size: 10.5px;
		color: var(--color-muted);
	}
	.more {
		margin: 16px 0 0;
		text-align: center;
		font-size: 13px;
		color: var(--color-muted);
	}
	.change {
		margin-top: 18px;
		padding: 9px 18px;
		border-radius: 999px;
		border: 1px solid rgba(255, 255, 255, 0.14);
		background: none;
		font-size: 12.5px;
		font-weight: 600;
	}
	.change:hover {
		background: rgba(255, 255, 255, 0.08);
	}

	@media (max-width: 1023.98px) {
		.layout {
			grid-template-columns: 1fr;
			gap: 16px;
		}
		h1 {
			font-size: 34px;
		}
		.target {
			padding: 18px;
		}
		.ticon {
			width: 62px;
			height: 62px;
			border-radius: 14px;
		}
		.ticon img {
			width: 48px;
			height: 48px;
		}
		.tname {
			font-size: 16.5px;
		}
		.tmeta {
			font-size: 10.5px;
			letter-spacing: 0.06em;
		}
		.totals {
			padding: 16px 18px;
		}
		.tlabel {
			font-size: 11px;
		}
		.trow img {
			width: 28px;
			height: 28px;
		}
		.tn {
			font-size: 12.5px;
		}
		.tq {
			font-size: 15px;
		}
		.treelabel {
			font-size: 11px;
		}
	}
</style>
