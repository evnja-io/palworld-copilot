<script lang="ts">
	import items from '@palworld-companion/game-data/items.json';
	import { m } from '$lib/paraglide/messages';
	import { gameName, gameDesc } from '$lib/game/names';
	import { itemIcon, palIcon } from '$lib/game/icons';
	import { palsDropping, recipesByProduct, recipesUsingItem } from '$lib/game/indexes';
	import { appHref } from '$lib/nav';
	import RecipeCard from '$lib/components/RecipeCard.svelte';

	let { data } = $props();

	const item = $derived(items.find((i) => i.id === data.itemId)!);
	const craftRecipes = $derived(recipesByProduct.get(data.itemId) ?? []);
	const droppers = $derived(palsDropping.get(data.itemId) ?? []);
	const usedIn = $derived(recipesUsingItem.get(data.itemId) ?? []);
	const usedInShown = $derived(usedIn.slice(0, 40));
</script>

<a href={appHref('/items')} class="back">← {m.items_title()}</a>

<header class="hero">
	{#if itemIcon(item.id)}
		<img src={itemIcon(item.id)} alt="" width="64" height="64" />
	{/if}
	<div class="identity">
		<h1>{gameName(`item:${item.id}`)}</h1>
		<span class="meta">
			{item.typeA ?? ''}{item.typeB ? ` · ${item.typeB}` : ''}
			{item.rarity > 0 ? ` · R${item.rarity}` : ''}
			· <span class="tnum">{item.price}</span> 🪙
			· <span class="tnum">{item.weight}</span> kg
		</span>
	</div>
</header>

{#if gameDesc(`item:${item.id}`)}
	<p class="desc">{gameDesc(`item:${item.id}`)}</p>
{/if}

<section>
	<h2>{m.item_obtain()}</h2>
	{#if craftRecipes.length === 0 && droppers.length === 0}
		<p class="none">{m.item_no_source()}</p>
	{/if}
	<div class="recipes">
		{#each craftRecipes as r (r.id)}
			<RecipeCard recipe={r} />
		{/each}
	</div>
	{#if droppers.length}
		<h3>{m.item_dropped_by()}</h3>
		<ul class="droppers">
			{#each droppers as d (d.palId)}
				<li>
					<a href={appHref(`/paldex/${d.palId}`)}>
						{#if palIcon(d.palId)}<img src={palIcon(d.palId)} alt="" width="26" height="26" />{/if}
						{gameName(`pal:${d.palId}`)}
						<span class="qty tnum"
							>×{d.min}{d.max !== d.min ? `–${d.max}` : ''}{d.rate < 100 ? ` (${d.rate}%)` : ''}</span
						>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>

{#if usedIn.length}
	<section>
		<h2>{m.item_used_in()} <span class="tnum h-count">({usedIn.length})</span></h2>
		<ul class="used">
			{#each usedInShown as r (r.id)}
				<li>
					<a href={appHref(`/items/${r.productId}`)}>
						{#if itemIcon(r.productId)}<img src={itemIcon(r.productId)} alt="" width="20" height="20" />{/if}
						{gameName(`item:${r.productId}`)}
					</a>
				</li>
			{/each}
			{#if usedIn.length > usedInShown.length}
				<li class="more">… +{usedIn.length - usedInShown.length}</li>
			{/if}
		</ul>
	</section>
{/if}

<style>
	.back {
		color: var(--text-3);
		font-size: 13px;
	}
	.hero {
		display: flex;
		align-items: center;
		gap: 14px;
		margin: 12px 0 4px;
		padding: 14px 16px;
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: var(--r-lg);
	}
	.identity h1 {
		margin: 0 0 2px;
	}
	.meta {
		color: var(--text-3);
		font-size: 13px;
	}
	.desc {
		color: var(--text-2);
		max-width: 70ch;
		text-wrap: pretty;
	}
	section h2 {
		margin-top: 20px;
	}
	.h-count {
		color: var(--text-4);
		font-weight: 400;
	}
	.none {
		color: var(--text-3);
	}
	.recipes {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 8px;
	}
	.droppers,
	.used {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.droppers a,
	.used a {
		display: flex;
		align-items: center;
		gap: 7px;
		font-size: 13px;
		color: var(--text-2);
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: var(--r-sm);
		padding: 4px 10px;
	}
	.droppers a:hover,
	.used a:hover {
		color: var(--text-1);
		border-color: var(--border-strong);
	}
	.qty {
		color: var(--text-3);
		font-size: 12px;
	}
	.more {
		color: var(--text-4);
		font-size: 13px;
		align-self: center;
	}
</style>
