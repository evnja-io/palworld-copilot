<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { gameName } from '$lib/game/names';
	import { buildings, type Building } from '$lib/game/indexes';
	import { appHref, isGuestContext } from '$lib/nav';
	import Seo from '$lib/components/Seo.svelte';

	let search = $state('');

	const filtered = $derived(
		search
			? buildings.filter((b) => {
					const q = search.toLowerCase();
					return (
						gameName(`building:${b.mapObjectId}`).toLowerCase().includes(q) ||
						b.id.toLowerCase().includes(q)
					);
				})
			: buildings
	);

	const byCategory = $derived.by(() => {
		const groups = new Map<string, Building[]>();
		for (const b of filtered) {
			const cat = b.category ?? '-';
			const list = groups.get(cat);
			if (list) list.push(b);
			else groups.set(cat, [b]);
		}
		return [...groups.entries()].sort((a, b) =>
			a[0] === '-' ? 1 : b[0] === '-' ? -1 : a[0].localeCompare(b[0])
		);
	});
</script>
<Seo
	title={m.buildings_title()}
	description={m.seo_buildings_desc()}
	path="/buildings"
	indexable={isGuestContext()}
/>

<h1>{m.buildings_title()}</h1>

<div class="filters">
	<input type="search" placeholder={m.buildings_search()} bind:value={search} />
</div>

{#each byCategory as [cat, group] (cat)}
	<section>
		<h2>{cat} <span class="tnum h-count">({group.length})</span></h2>
		<div class="grid">
			{#each group as b (b.id)}
				<a href={appHref(`/buildings/${b.id}`)} class="card">
					<span class="name">{gameName(`building:${b.mapObjectId}`)}</span>
					{#if b.rank > 1}<span class="rank tnum">R{b.rank}</span>{/if}
				</a>
			{/each}
		</div>
	</section>
{/each}

<style>
	.filters {
		margin: 12px 0 8px;
	}
	.filters input {
		width: 100%;
		max-width: 420px;
	}
	section h2 {
		margin-top: 20px;
	}
	.h-count {
		color: var(--text-4);
		font-weight: 400;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 6px;
	}
	.card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		padding: 8px 12px;
		font-size: 13px;
		color: var(--text-1);
		transition: border-color 140ms, background 140ms;
	}
	.card:hover {
		border-color: var(--border-strong);
		background: var(--surface-2);
		color: inherit;
	}
	.rank {
		color: var(--text-4);
		font-size: 11px;
	}
</style>
