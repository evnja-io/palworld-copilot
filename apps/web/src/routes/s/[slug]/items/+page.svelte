<script lang="ts">
	// Objets — écran 3b : catalogue en tuiles + fiche latérale 340 px.
	import { fly } from 'svelte/transition';
	import items from '@palworld-companion/game-data/items.json';
	import { m } from '$lib/paraglide/messages';
	import { gameName, gameDesc } from '$lib/game/names';
	import { itemIcon } from '$lib/game/icons';
	import { recipesByProduct, techUnlocking } from '$lib/game/indexes';
	import { rarityLabel, rarityTier, rarityToken } from '$lib/game/rarity';
	import { CAT_LABELS, type Locale } from '$lib/search/tokens';
	import { getLocale } from '$lib/paraglide/runtime';
	import { reveal } from '$lib/motion';
	import { appHref, isGuestContext } from '$lib/nav';
	import SearchPill from '$lib/components/atlas/SearchPill.svelte';
	import FilterPill from '$lib/components/atlas/FilterPill.svelte';
	import Seo from '$lib/components/Seo.svelte';

	const locale = getLocale() as Locale;
	const CATS = [...new Set(items.map((i) => i.typeA).filter(Boolean))].sort() as string[];
	const catLabel = (c: string) => CAT_LABELS[c]?.[locale] ?? c;

	let search = $state('');
	let cat = $state('');
	let picked = $state<string | null>(null);

	const visible = $derived(
		items.filter((i) => {
			if (cat && i.typeA !== cat) return false;
			if (search) {
				const q = search.toLowerCase();
				if (!gameName(`item:${i.id}`).toLowerCase().includes(q) && !i.id.toLowerCase().includes(q))
					return false;
			}
			return true;
		})
	);
	const shown = $derived(search || cat ? visible.slice(0, 240) : visible.slice(0, 120));

	const sel = $derived(picked ? (items.find((i) => i.id === picked) ?? null) : null);
	const selTier = $derived(sel ? rarityTier(sel.rarity) : null);
	const selRecipe = $derived(sel ? recipesByProduct.get(sel.id)?.[0] : undefined);
	const selTech = $derived(selRecipe ? techUnlocking.get(selRecipe.id) : undefined);

	/** Deux tuiles de stats. Le dessin affiche « ATTAQUE 880 » — cette donnée
	 *  n'existe pas : items.json ne porte que {rarity, price, weight, maxStack,
	 *  typeA, typeB, sortId, iconName}. On montre ce qui existe vraiment. */
	const selStats = $derived.by(() => {
		if (!sel) return [];
		const out: Array<{ label: string; value: number }> = [];
		if (selTech) out.push({ label: m.items_stat_tech(), value: selTech.level });
		if (sel.price) out.push({ label: m.items_stat_price(), value: sel.price });
		if (out.length < 2 && sel.weight) out.push({ label: m.items_stat_weight(), value: sel.weight });
		if (out.length < 2 && sel.maxStack) out.push({ label: m.items_stat_stack(), value: sel.maxStack });
		return out.slice(0, 2);
	});
</script>

<Seo
	title={m.items_title()}
	description={m.seo_items_desc()}
	path="/items"
	indexable={isGuestContext()}
/>

<div class="head">
	<h1>{m.items_title()}</h1>
	<div class="cats">
		<FilterPill active={cat === ''} onclick={() => (cat = '')}>{m.items_filter_all()}</FilterPill>
		{#each CATS as c (c)}
			<FilterPill active={cat === c} onclick={() => (cat = cat === c ? '' : c)}>
				{catLabel(c)}
			</FilterPill>
		{/each}
	</div>
	<div class="search">
		<SearchPill bind:value={search} placeholder={m.items_search()} width="220px" />
	</div>
</div>

<div class="body">
	<div class="grid">
		{#each shown as item, i (item.id)}
			{@const tier = rarityTier(item.rarity)}
			<button
				class="tile lift-sm"
				class:on={picked === item.id}
				style="--el:var(--color-el-{rarityToken(tier)})"
				class:tinted={tier === 'rare' || tier === 'epic' || tier === 'legendary'}
				onclick={() => (picked = item.id)}
				in:fly={reveal(i)}
			>
				{#if itemIcon(item.id)}
					<img src={itemIcon(item.id)} alt="" loading="lazy" />
				{:else}
					<span class="no-icon" aria-hidden="true">·</span>
				{/if}
				<span class="iname">{gameName(`item:${item.id}`)}</span>
				<span class="irare">{rarityLabel(tier, locale)}</span>
			</button>
		{/each}
	</div>

	<aside class="panel" class:empty={!sel}>
		{#if sel && selTier}
			<div class="phero" style="--el:var(--color-el-{rarityToken(selTier)})">
				<div class="picon">
					{#if itemIcon(sel.id)}
						<img class="pw-float" src={itemIcon(sel.id)} alt="" />
					{/if}
				</div>
				<div class="pkick">
					{catLabel(sel.typeA ?? '')}{sel.typeB && sel.typeB !== sel.typeA ? ` · ${sel.typeB}` : ''}
					· {rarityLabel(selTier, locale)}
				</div>
				<h3>{gameName(`item:${sel.id}`)}</h3>
				{#if selStats.length}
					<div class="pstats">
						{#each selStats as s (s.label)}
							<div class="pstat">
								<div class="pslabel">{s.label}</div>
								<div class="psvalue tnum">{s.value}</div>
							</div>
						{/each}
					</div>
				{/if}
				{#if gameDesc(`item:${sel.id}`)}
					<p class="pdesc">{gameDesc(`item:${sel.id}`)}</p>
				{/if}
				{#if selRecipe}
					<a class="pcta" href={appHref(`/craft?item=${sel.id}&qty=1`)}>{m.items_open_craft()}</a>
				{/if}
				<a class="plink" href={appHref(`/items/${sel.id}`)}>{m.items_fiche()}</a>
			</div>
		{:else}
			<p class="phint">{m.items_pick_hint()}</p>
		{/if}
	</aside>
</div>

{#if visible.length > shown.length}
	<p class="more">… {visible.length - shown.length}+</p>
{/if}
{#if visible.length === 0}
	<p class="more">{m.items_none()}</p>
{/if}

<style>
	.head {
		display: flex;
		align-items: end;
		gap: 20px;
		padding-bottom: 12px;
		flex-wrap: wrap;
	}
	h1 {
		margin: 0;
		font-size: 40px;
		letter-spacing: -0.03em;
		line-height: 1;
	}
	.cats {
		display: flex;
		gap: 8px;
		padding-bottom: 6px;
		flex-wrap: wrap;
	}
	.search {
		margin-left: auto;
		margin-bottom: 4px;
	}

	.body {
		display: grid;
		grid-template-columns: 1fr 340px;
		gap: 24px;
		padding-top: 14px;
		align-items: start;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 12px;
		align-content: start;
		/* Sans ça, `min-width: auto` sur les items laisse les noms longs
		   (« Plan de Marche-ciel Mk-EX ») élargir les pistes et déborder la
		   page horizontalement — l'ellipsis ne se déclenche jamais. */
		min-width: 0;
	}
	.tile {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0;
		min-width: 0;
		border-radius: 16px;
		background: var(--color-surface);
		border: 1px solid var(--color-line);
		padding: 16px 14px;
		text-align: center;
	}
	.tile:hover {
		background: var(--color-surface);
		border-color: var(--color-line);
	}
	/* Rareté : bordure teintée, et halo à partir d'épique (3b l.383). */
	.tile.tinted {
		border-color: color-mix(in srgb, var(--el) 45%, transparent);
	}
	.tile.tinted:hover {
		border-color: color-mix(in srgb, var(--el) 65%, transparent);
	}
	.tile.on {
		border-color: color-mix(in srgb, var(--el) 80%, transparent);
		box-shadow: 0 0 24px color-mix(in srgb, var(--el) 20%, transparent);
	}
	.tile img,
	.tile .no-icon {
		width: 52px;
		height: 52px;
		object-fit: contain;
		filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.4));
	}
	.no-icon {
		display: grid;
		place-items: center;
		color: var(--color-muted);
	}
	.iname {
		font-weight: 600;
		font-size: 13px;
		margin-top: 8px;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.irare {
		font-size: 10.5px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		margin-top: 4px;
		color: var(--color-muted);
	}
	.tile.tinted .irare {
		color: color-mix(in srgb, var(--el) 55%, white);
	}

	.panel {
		position: sticky;
		top: 90px;
		border-radius: 22px;
		overflow: hidden;
	}
	.panel.empty {
		background: var(--color-surface);
	}
	.phero {
		padding: 26px 26px 24px;
		background: linear-gradient(
			165deg,
			color-mix(in srgb, var(--el) 62%, black) 0%,
			color-mix(in srgb, var(--el) 30%, black) 55%,
			color-mix(in srgb, var(--el) 10%, black) 100%
		);
	}
	.picon {
		display: flex;
		justify-content: center;
		padding: 18px 0 10px;
	}
	.picon img {
		width: 110px;
		height: 110px;
		object-fit: contain;
		filter: drop-shadow(0 18px 30px rgba(0, 0, 0, 0.5));
	}
	.pkick {
		font-size: 10.5px;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		text-align: center;
		color: color-mix(in srgb, var(--el) 30%, white);
	}
	h3 {
		margin: 6px 0 14px;
		font-size: 26px;
		font-weight: 800;
		text-align: center;
		color: #fff;
	}
	.pstats {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}
	.pstat {
		background: rgba(0, 0, 0, 0.28);
		border-radius: 12px;
		padding: 10px 14px;
	}
	.pslabel {
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.1em;
		color: color-mix(in srgb, var(--el) 30%, white);
	}
	.psvalue {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 22px;
		color: #fff;
	}
	.pdesc {
		margin: 12px 0 0;
		font-size: 12.5px;
		line-height: 1.55;
		color: rgba(255, 255, 255, 0.78);
		text-wrap: pretty;
	}
	.pcta {
		display: block;
		text-align: center;
		margin-top: 14px;
		padding: 11px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.92);
		color: #1a1730;
		font-size: 13px;
		font-weight: 700;
		transition: transform var(--duration-hover) var(--ease-out-soft);
	}
	.pcta:hover {
		background: #fff;
		color: #1a1730;
		transform: translateY(-2px);
	}
	.plink {
		display: block;
		text-align: center;
		margin-top: 10px;
		font-size: 12.5px;
		color: rgba(255, 255, 255, 0.7);
	}
	.plink:hover {
		color: #fff;
	}
	.phint {
		margin: 0;
		padding: 40px 24px;
		text-align: center;
		font-size: 13px;
		color: var(--color-muted);
	}

	.more {
		margin: 20px 0 0;
		font-size: 13px;
		color: var(--color-muted);
		text-align: center;
	}

	@media (max-width: 1023.98px) {
		.head {
			display: block;
		}
		h1 {
			font-size: 34px;
		}
		.cats {
			flex-wrap: nowrap;
			overflow-x: auto;
			scrollbar-width: none;
			margin: 14px calc(-1 * var(--gutter, 20px)) 0;
			padding: 0 var(--gutter, 20px) 4px;
		}
		.cats::-webkit-scrollbar {
			display: none;
		}
		.search {
			margin: 12px 0 0;
		}
		/* La fiche passe sous la grille (pas de colonne de 340 px à 390 px). */
		.body {
			grid-template-columns: 1fr;
		}
		.panel {
			position: static;
			order: -1;
		}
		.panel.empty {
			display: none;
		}
		.grid {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
