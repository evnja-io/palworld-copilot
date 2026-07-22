<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { gameName } from '$lib/game/names';
	import { itemIcon } from '$lib/game/icons';
	import { techUnlocking, type Recipe } from '$lib/game/indexes';

	let { recipe }: { recipe: Recipe } = $props();

	const tech = $derived(techUnlocking.get(recipe.id));
</script>

<div class="recipe">
	<a class="product" href="/items/{recipe.productId}">
		{#if itemIcon(recipe.productId)}<img src={itemIcon(recipe.productId)} alt="" width="26" height="26" />{/if}
		{gameName(`item:${recipe.productId}`)}
		{#if recipe.count > 1}<span class="tnum count">×{recipe.count}</span>{/if}
	</a>
	<ul class="mats">
		{#each recipe.materials as mat (mat.id)}
			<li>
				<a href="/items/{mat.id}">
					{#if itemIcon(mat.id)}<img src={itemIcon(mat.id)} alt="" width="18" height="18" />{/if}
					{gameName(`item:${mat.id}`)}
				</a>
				<span class="tnum">×{mat.count}</span>
			</li>
		{/each}
	</ul>
	{#if tech}
		<a class="tech" href="/tech#{tech.id}">
			{m.item_tech_required()} : {gameName(`tech:${tech.nameId}`)} · Niv. {tech.level}
		</a>
	{/if}
</div>

<style>
	.recipe {
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		padding: 10px 12px;
	}
	.product {
		display: flex;
		align-items: center;
		gap: 8px;
		font-weight: 500;
		color: var(--text-1);
	}
	.count {
		color: var(--text-3);
	}
	.mats {
		list-style: none;
		margin: 8px 0 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 4px 14px;
	}
	.mats li {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		color: var(--text-3);
	}
	.mats a {
		display: flex;
		align-items: center;
		gap: 5px;
		color: var(--text-2);
	}
	.tech {
		display: block;
		margin-top: 8px;
		font-size: 12px;
		color: var(--accent);
	}
</style>
