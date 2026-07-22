<script lang="ts">
	import pals from '@palworld-companion/game-data/pals.json';
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages';
	import { gameName } from '$lib/game/names';
	import { ProgressStore } from '$lib/game/progress.svelte';
	import PalCard from '$lib/components/PalCard.svelte';

	let { data } = $props();

	const ELEMENTS = [...new Set(pals.flatMap((p) => p.elements))].sort();
	const WORKS = [...new Set(pals.flatMap((p) => Object.keys(p.work)))].sort();

	const store = new ProgressStore();
	$effect(() => {
		store.init('pal_caught', page.params.slug!, data.progress.mine, data.progress.group);
		store.startSync();
		return () => store.stopSync();
	});

	let search = $state('');
	let element = $state('');
	let work = $state('');
	let hideCaught = $state(false);

	const visible = $derived(
		pals.filter((p) => {
			if (element && !p.elements.includes(element)) return false;
			if (work && !(work in p.work)) return false;
			if (hideCaught && store.mine.has(p.id)) return false;
			if (search) {
				const q = search.toLowerCase();
				if (!gameName(`pal:${p.id}`).toLowerCase().includes(q) && !p.id.toLowerCase().includes(q))
					return false;
			}
			return true;
		})
	);
	const groupCaught = $derived(Object.keys(store.group).length);
</script>

<div class="head">
	<h1>{m.paldex_title()}</h1>
	<p class="counts tnum">
		<span class="me">{m.paldex_caught_me({ count: store.mine.size, total: pals.length })}</span>
		<span class="sep">·</span>
		<span>{m.paldex_caught_group({ count: groupCaught, total: pals.length })}</span>
	</p>
</div>

<div class="filters">
	<input type="search" placeholder={m.paldex_search()} bind:value={search} />
	<select bind:value={element}>
		<option value="">{m.paldex_filter_element()}</option>
		{#each ELEMENTS as e (e)}<option value={e}>{e}</option>{/each}
	</select>
	<select bind:value={work}>
		<option value="">{m.paldex_filter_work()}</option>
		{#each WORKS as w (w)}<option value={w}>{w}</option>{/each}
	</select>
	<label class="hide">
		<input type="checkbox" bind:checked={hideCaught} />
		{m.paldex_hide_caught()}
	</label>
</div>

<div class="grid">
	{#each visible as pal (pal.id)}
		<PalCard
			{pal}
			caught={store.mine.has(pal.id)}
			groupCount={store.group[pal.id]?.length ?? 0}
			ontoggle={() => store.toggle(pal.id)}
		/>
	{/each}
</div>

<style>
	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
	}
	.counts {
		color: var(--text-3);
		font-size: 13px;
		margin: 0;
	}
	.counts .me {
		color: var(--accent);
		font-weight: 500;
	}
	.sep {
		margin: 0 4px;
	}
	.filters {
		display: flex;
		gap: 8px;
		align-items: center;
		flex-wrap: wrap;
		margin: 12px 0 20px;
	}
	.filters input[type='search'] {
		flex: 1;
		min-width: 180px;
	}
	.hide {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--text-2);
		font-size: 13px;
		white-space: nowrap;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
		gap: 8px;
	}
</style>
