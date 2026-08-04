<script lang="ts">
	// Paldex — écrans 2a (desktop, grille 4 colonnes) et 4a (mobile, 2 colonnes).
	import { fly } from 'svelte/transition';
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
	import { ELEMENT_IDS, elLabel } from '$lib/game/elements';
	import { reveal } from '$lib/motion';
	import PalCard from '$lib/components/PalCard.svelte';
	import SearchPill from '$lib/components/atlas/SearchPill.svelte';
	import FilterPill from '$lib/components/atlas/FilterPill.svelte';
	import type { Locale } from '$lib/search/tokens';
	import { isGuestContext } from '$lib/nav';
	import Seo from '$lib/components/Seo.svelte';

	let { data } = $props();

	const locale = getLocale() as Locale;
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
	// Les filtres secondaires (aptitude, tri, masquage) n'existent pas dans la
	// maquette mais restent des fonctionnalités livrées : repliés par défaut
	// pour que la vue au repos soit celle du dessin.
	const moreOpen = $derived(!!work || hideCaught);
</script>

<Seo
	title={m.paldex_title()}
	description={m.seo_paldex_desc()}
	path="/paldex"
	indexable={isGuestContext()}
/>

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
	<div class="search">
		<SearchPill bind:value={search} placeholder={m.paldex_search()} width="240px" />
	</div>
</div>

<div class="filters">
	<FilterPill active={element === ''} onclick={() => (element = '')}>
		{m.paldex_filter_all()}
	</FilterPill>
	{#each ELEMENT_IDS as e (e)}
		<FilterPill
			tone="element"
			element={e}
			active={element === e}
			onclick={() => (element = element === e ? '' : e)}
		>
			{elLabel(e)}
		</FilterPill>
	{/each}
</div>

<details class="more" open={moreOpen}>
	<summary>{m.paldex_more_filters()}</summary>
	<div class="more-row">
		<select bind:value={work} aria-label={m.paldex_filter_work()}>
			<option value="">{m.paldex_filter_work()}</option>
			{#each WORKS as w (w)}<option value={w}>{workLabel(w, locale)}</option>{/each}
		</select>
		{#if work}
			<button
				class="order"
				onclick={() => (order = order === 'desc' ? 'asc' : 'desc')}
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
</details>

<div class="grid">
	{#each visible as pal, i (pal.id)}
		<div in:fly={reveal(i)}>
			<PalCard
				{pal}
				caught={store.mine.has(pal.id)}
				groupCount={store.group[pal.id]?.length ?? 0}
				highlightWork={work}
				ontoggle={() => store.toggle(pal.id)}
			/>
		</div>
	{/each}
</div>

{#if visible.length === 0}
	<p class="empty">{m.paldex_empty()}</p>
{/if}

<style>
	.head {
		display: flex;
		align-items: end;
		gap: 20px;
		padding-bottom: 8px;
	}
	h1 {
		margin: 0;
		font-size: 56px;
		letter-spacing: -0.03em;
		line-height: 1;
	}
	.counts {
		margin: 0;
		padding-bottom: 8px;
		font-size: 13.5px;
		color: var(--color-muted);
	}
	.counts .me {
		color: #ff9450;
		font-weight: 700;
	}
	.sep {
		margin: 0 4px;
	}
	.search {
		margin-left: auto;
		margin-bottom: 6px;
	}

	.filters {
		display: flex;
		gap: 8px;
		padding: 14px 0 6px;
		flex-wrap: wrap;
	}

	.more {
		margin-top: 8px;
	}
	.more summary {
		display: inline-block;
		font-size: 12.5px;
		color: var(--color-muted);
		cursor: pointer;
	}
	.more summary:hover {
		color: var(--color-text);
	}
	.more-row {
		display: flex;
		gap: 8px;
		align-items: center;
		flex-wrap: wrap;
		margin-top: 10px;
	}
	.order {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 13px;
		color: var(--color-muted);
	}
	.hide {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--color-muted);
		font-size: 13px;
		white-space: nowrap;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 16px;
		padding: 20px 0 0;
	}

	.empty {
		padding: 40px 0;
		text-align: center;
		color: var(--color-muted);
	}

	@media (max-width: 1023.98px) {
		.head {
			display: block;
			padding-bottom: 0;
		}
		h1 {
			font-size: 34px;
		}
		.counts {
			padding-bottom: 0;
			margin-top: 2px;
			font-size: 12.5px;
		}
		.search {
			margin: 14px 0 0;
		}
		/* Rangée de filtres défilante (4a l.165) : la barre est masquée, le
		   geste reste naturel au doigt. */
		.filters {
			flex-wrap: nowrap;
			overflow-x: auto;
			scrollbar-width: none;
			padding: 14px 0 4px;
			/* Les pilules touchent les bords de l'écran en défilant. */
			margin-left: calc(-1 * var(--gutter, 20px));
			margin-right: calc(-1 * var(--gutter, 20px));
			padding-left: var(--gutter, 20px);
			padding-right: var(--gutter, 20px);
		}
		.filters::-webkit-scrollbar {
			display: none;
		}
		.grid {
			grid-template-columns: 1fr 1fr;
			gap: 12px;
			padding-top: 16px;
		}
	}
</style>
