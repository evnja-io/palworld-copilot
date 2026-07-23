<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { gameName } from '$lib/game/names';
	import { recipes, techUnlocking, type Recipe } from '$lib/game/indexes';
	import RecipeCard from '$lib/components/RecipeCard.svelte';

	let search = $state('');

	const filtered = $derived(
		search
			? recipes.filter((r) => {
					const q = search.toLowerCase();
					return (
						gameName(`item:${r.productId}`).toLowerCase().includes(q) ||
						r.productId.toLowerCase().includes(q)
					);
				})
			: recipes
	);

	const byLevel = $derived.by(() => {
		const groups = new Map<number, Recipe[]>();
		for (const r of filtered) {
			const level = techUnlocking.get(r.id)?.level ?? -1;
			const list = groups.get(level);
			if (list) list.push(r);
			else groups.set(level, [r]);
		}
		return [...groups.entries()].sort((a, b) => a[0] - b[0]);
	});
	const shownLevels = $derived(search ? byLevel : byLevel.slice(0, 4));
</script>

<h1>{m.craft_title()}</h1>

<div class="filters">
	<input type="search" placeholder={m.craft_search()} bind:value={search} />
</div>

{#each shownLevels as [level, group] (level)}
	<section>
		<h2>
			{level < 0 ? m.craft_base() : m.craft_level({ level })}
			<span class="tnum h-count">({group.length})</span>
		</h2>
		<div class="recipes">
			{#each group as r (r.id)}
				<RecipeCard recipe={r} />
			{/each}
		</div>
	</section>
{/each}
{#if !search && byLevel.length > shownLevels.length}
	<p class="more">{m.craft_more({ count: byLevel.length - shownLevels.length })}</p>
{/if}

<style>
	.filters {
		margin: 12px 0 8px;
	}
	.filters input {
		width: 100%;
		max-width: 420px;
	}
	section h2 {
		margin-top: 24px;
	}
	.h-count {
		color: var(--text-4);
		font-weight: 400;
	}
	.recipes {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 8px;
	}
	.more {
		margin-top: 24px;
		color: var(--text-3);
		text-align: center;
	}
</style>
