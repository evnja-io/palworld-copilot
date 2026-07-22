<script lang="ts">
	import items from '@palworld-companion/game-data/items.json';
	import { m } from '$lib/paraglide/messages';
	import { gameName } from '$lib/game/names';
	import { itemIcon } from '$lib/game/icons';
	import { appHref } from '$lib/nav';

	const CATS = [...new Set(items.map((i) => i.typeA).filter(Boolean))].sort() as string[];

	let search = $state('');
	let cat = $state('');

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
	const shown = $derived(search || cat ? visible : visible.slice(0, 120));
</script>

<div class="head">
	<h1>{m.items_title()}</h1>
	<span class="count tnum">{visible.length}</span>
</div>

<div class="filters">
	<input type="search" placeholder={m.items_search()} bind:value={search} />
	<select bind:value={cat}>
		<option value="">{m.items_filter_cat()}</option>
		{#each CATS as c (c)}<option value={c}>{c}</option>{/each}
	</select>
</div>

<div class="grid">
	{#each shown as item (item.id)}
		<a href={appHref(`/items/${item.id}`)} class="card">
			{#if itemIcon(item.id)}
				<img src={itemIcon(item.id)} alt="" loading="lazy" width="36" height="36" />
			{:else}
				<span class="no-icon" aria-hidden="true">·</span>
			{/if}
			<span class="text">
				<span class="name">{gameName(`item:${item.id}`)}</span>
				<span class="meta">{item.typeA ?? ''}{item.rarity > 0 ? ` · R${item.rarity}` : ''}</span>
			</span>
		</a>
	{/each}
</div>
{#if !search && !cat && visible.length > shown.length}
	<p class="more">… {visible.length - shown.length}+</p>
{/if}

<style>
	.head {
		display: flex;
		align-items: baseline;
		gap: 10px;
	}
	.count {
		color: var(--text-3);
		font-size: 13px;
	}
	.filters {
		display: flex;
		gap: 8px;
		margin: 12px 0 20px;
		flex-wrap: wrap;
	}
	.filters input[type='search'] {
		flex: 1;
		min-width: 180px;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
		gap: 6px;
	}
	.card {
		display: flex;
		align-items: center;
		gap: 10px;
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		padding: 8px 10px;
		transition: border-color 140ms, background 140ms;
	}
	.card:hover {
		border-color: var(--border-strong);
		background: var(--surface-2);
		color: inherit;
	}
	.no-icon {
		width: 36px;
		height: 36px;
		display: grid;
		place-items: center;
		color: var(--text-4);
		background: var(--surface-2);
		border-radius: var(--r-sm);
	}
	.text {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.name {
		font-size: 13px;
		font-weight: 500;
		color: var(--text-1);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.meta {
		font-size: 11px;
		color: var(--text-3);
	}
	.more {
		text-align: center;
		color: var(--text-4);
	}
</style>
