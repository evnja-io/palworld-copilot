<script lang="ts">
	import pals from '@palworld-companion/game-data/pals.json';
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import { gameName } from '$lib/game/names';
	import { sortByWorkLevel, workLabel, type WorkOrder } from '$lib/game/work';
	// PAL_IDS : garde-fou contre un id périmé en localStorage (game-data régénéré),
	// qui gonflerait sinon le compteur « capturés ».
	import { PAL_IDS } from '$lib/game/team-data';
	import { ProgressStore } from '$lib/game/progress.svelte';
	import PalCard from '$lib/components/PalCard.svelte';
	import type { Locale } from '$lib/search/tokens';

	let { data } = $props();

	const locale = getLocale() as Locale;
	const ELEMENTS = [...new Set(pals.flatMap((p) => p.elements))].sort();
	const WORKS = [...new Set(pals.flatMap((p) => Object.keys(p.work)))].sort((a, b) =>
		workLabel(a, locale).localeCompare(workLabel(b, locale), locale)
	);

	const guest = $derived(data.mode === 'guest');

	const store = new ProgressStore();
	$effect(() => {
		store.init('pal_caught', page.params.slug!, data.progress.mine, data.progress.group, PAL_IDS);
		store.startSync();
		return () => store.stopSync();
	});

	let search = $state('');
	let element = $state('');
	let work = $state('');
	let order = $state<WorkOrder>('desc');
	let hideCaught = $state(false);

	// Une aptitude sélectionnée filtre ET trie (meilleur niveau d'abord par défaut).
	const visible = $derived(
		sortByWorkLevel(
			pals.filter((p) => {
				if (element && !p.elements.includes(element)) return false;
				if (work && !(work in p.work)) return false;
				if (hideCaught && store.mine.has(p.id)) return false;
				if (search) {
					const q = search.toLowerCase();
					if (
						!gameName(`pal:${p.id}`).toLowerCase().includes(q) &&
						!p.id.toLowerCase().includes(q) &&
						!p.passives.some((pv) => gameName(`passive:${pv}`).toLowerCase().includes(q))
					)
						return false;
				}
				return true;
			}),
			work,
			order
		)
	);
	const groupCaught = $derived(Object.keys(store.group).length);
</script>

<div class="head">
	<h1>{m.paldex_title()}</h1>
	<p class="counts tnum">
		<span class="me">{m.paldex_caught_me({ count: store.mine.size, total: pals.length })}</span>
		<!-- Un invité est seul : « 0/288 pour le groupe » ne serait que du bruit. -->
		{#if !guest}
			<span class="sep">·</span>
			<span>{m.paldex_caught_group({ count: groupCaught, total: pals.length })}</span>
		{/if}
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
		{#each WORKS as w (w)}<option value={w}>{workLabel(w, locale)}</option>{/each}
	</select>
	{#if work}
		<button
			class="order"
			onclick={() => (order = order === 'desc' ? 'asc' : 'desc')}
			title={order === 'desc' ? m.paldex_sort_desc() : m.paldex_sort_asc()}
			aria-label={order === 'desc' ? m.paldex_sort_desc() : m.paldex_sort_asc()}
		>
			{order === 'desc' ? '↓' : '↑'}
			<span class="tnum">{order === 'desc' ? '4→1' : '1→4'}</span>
		</button>
	{/if}
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
			highlightWork={work}
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
	/* Aligné sur le style global des <select> (app.css) */
	.order {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font: inherit;
		font-size: 13px;
		color: var(--text-2);
		background: var(--input-bg);
		border: 1px solid var(--border);
		border-radius: var(--r-sm);
		padding: 6px 10px;
		white-space: nowrap;
	}
	.order:hover {
		border-color: var(--border-strong);
		color: var(--text-1);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
		gap: 8px;
	}
</style>
