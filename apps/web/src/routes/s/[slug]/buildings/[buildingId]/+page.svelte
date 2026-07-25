<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { gameName, gameDesc } from '$lib/game/names';
	import { itemIcon } from '$lib/game/icons';
	import { buildings, techUnlocking } from '$lib/game/indexes';
	import { appHref, isGuestContext } from '$lib/nav';
	import { buildingSeoDescription } from '$lib/game/seoText';
	import Seo from '$lib/components/Seo.svelte';

	let { data } = $props();

	const building = $derived(buildings.find((b) => b.id === data.buildingId)!);
	const tech = $derived(techUnlocking.get(data.buildingId));
</script>

<Seo
	title={gameName(`building:${building.mapObjectId}`)}
	description={buildingSeoDescription(building.id)}
	path={`/buildings/${building.id}`}
	indexable={isGuestContext()}
/>

<a href={appHref('/buildings')} class="back">← {m.buildings_title()}</a>

<header class="hero">
	<div class="identity">
		<h1>{gameName(`building:${building.mapObjectId}`)}</h1>
		<span class="meta">
			{building.category ?? ''}
			{building.rank > 1 ? ` · R${building.rank}` : ''}
			{#if building.energyType}
				· {m.building_energy()} : {building.energyType}
			{/if}
			{#if building.workAmount}
				· {m.building_work()} : <span class="tnum">{building.workAmount}</span>
			{/if}
		</span>
	</div>
</header>

{#if gameDesc(`building:${building.mapObjectId}`)}
	<p class="desc">{gameDesc(`building:${building.mapObjectId}`)}</p>
{/if}

{#if building.materials.length}
	<section>
		<h2>{m.building_materials()}</h2>
		<ul class="mats">
			{#each building.materials as mat (mat.id)}
				<li>
					<a href={appHref(`/items/${mat.id}`)}>
						{#if itemIcon(mat.id)}<img src={itemIcon(mat.id)} alt="" width="22" height="22" />{/if}
						{gameName(`item:${mat.id}`)}
					</a>
					<span class="tnum">×{mat.count}</span>
				</li>
			{/each}
		</ul>
	</section>
{/if}

{#if tech}
	<section>
		<h2>{m.item_tech_required()}</h2>
		<a class="tech" href={`${appHref('/tech')}#${tech.id}`}>
			{gameName(`tech:${tech.nameId}`)} · {m.craft_level({ level: tech.level })} ·
			{m.tech_cost({ cost: tech.cost })}
		</a>
	</section>
{/if}

<style>
	.back {
		color: var(--text-3);
		font-size: 13px;
	}
	.hero {
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
	.mats {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
		max-width: 420px;
	}
	.mats li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 6px 10px;
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: var(--r-sm);
	}
	.mats a {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: var(--text-1);
	}
	.tech {
		color: var(--accent);
		font-size: 13px;
	}
</style>
