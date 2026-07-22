<script lang="ts">
	import { goto } from '$app/navigation';
	import searchIndex from '@palworld-companion/game-data/search-index.json';
	import { m } from '$lib/paraglide/messages';
	import { buildingByMapObjectId, tech } from '$lib/game/indexes';
	import { palIcon, itemIcon } from '$lib/game/icons';

	type Entry = { id: string; fr: string; en: string };
	type Result = { href: string; label: string; ns: string; icon?: string };

	const techByNameId = new Map(tech.map((t) => [t.nameId, t]));

	function resolve(e: Entry): Result | null {
		const [ns, id] = [e.id.slice(0, e.id.indexOf(':')), e.id.slice(e.id.indexOf(':') + 1)];
		switch (ns) {
			case 'pal':
				return { href: `/paldex/${id}`, label: e.fr, ns, icon: palIcon(id) };
			case 'item':
				return { href: `/items/${id}`, label: e.fr, ns, icon: itemIcon(id) };
			case 'tech': {
				const t = techByNameId.get(id);
				return t ? { href: `/tech#${t.id}`, label: e.fr, ns } : null;
			}
			case 'building': {
				const b = buildingByMapObjectId.get(id);
				return b ? { href: `/buildings/${b.id}`, label: e.fr, ns } : null;
			}
			default:
				return null;
		}
	}

	const NS_ICON: Record<string, string> = { pal: '🐾', item: '🎒', tech: '🔬', building: '🏗️' };

	let query = $state('');
	let open = $state(false);
	let selected = $state(0);
	let inputEl: HTMLInputElement | undefined = $state();

	/** Minuscules + suppression des diacritiques ("sphère" trouvable via "sphere"). */
	function fold(s: string): string {
		return s
			.toLowerCase()
			.normalize('NFD')
			.replace(/\p{Diacritic}/gu, '');
	}

	const results = $derived.by(() => {
		if (query.length < 2) return [] as Result[];
		const q = fold(query);
		const scored: Array<[number, Result]> = [];
		for (const e of searchIndex as Entry[]) {
			const fr = fold(e.fr ?? '');
			const en = fold(e.en ?? '');
			let score = -1;
			if (fr.startsWith(q) || en.startsWith(q)) score = 0;
			else if (fr.includes(q) || en.includes(q)) score = 1;
			if (score < 0) continue;
			const r = resolve(e);
			if (r) scored.push([score, r]);
			if (scored.length > 60) break;
		}
		return scored
			.sort((a, b) => a[0] - b[0] || a[1].label.localeCompare(b[1].label))
			.slice(0, 12)
			.map(([, r]) => r);
	});

	$effect(() => {
		query;
		selected = 0;
	});

	function onKeydownGlobal(ev: KeyboardEvent) {
		if (ev.key === '/' && document.activeElement?.tagName !== 'INPUT') {
			ev.preventDefault();
			inputEl?.focus();
		}
	}

	function onKeydown(ev: KeyboardEvent) {
		if (ev.key === 'Escape') {
			open = false;
			inputEl?.blur();
		} else if (ev.key === 'ArrowDown') {
			ev.preventDefault();
			selected = Math.min(selected + 1, results.length - 1);
		} else if (ev.key === 'ArrowUp') {
			ev.preventDefault();
			selected = Math.max(selected - 1, 0);
		} else if (ev.key === 'Enter' && results[selected]) {
			pick(results[selected]);
		}
	}

	function pick(r: Result) {
		open = false;
		query = '';
		goto(r.href);
	}
</script>

<svelte:window onkeydown={onKeydownGlobal} />

<div class="search">
	<input
		bind:this={inputEl}
		type="search"
		role="combobox"
		aria-expanded={open && results.length > 0}
		aria-controls="global-search-results"
		placeholder={m.search_placeholder()}
		bind:value={query}
		onfocus={() => (open = true)}
		onblur={() => setTimeout(() => (open = false), 150)}
		onkeydown={onKeydown}
	/>
	{#if open && results.length}
		<ul class="results" id="global-search-results" role="listbox">
			{#each results as r, i (r.href)}
				<li role="option" aria-selected={i === selected}>
					<button class="result" class:selected={i === selected} onclick={() => pick(r)}>
						{#if r.icon}
							<img src={r.icon} alt="" width="20" height="20" />
						{:else}
							<span class="ns">{NS_ICON[r.ns]}</span>
						{/if}
						{r.label}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.search {
		position: relative;
		max-width: 260px;
		flex: 1;
	}
	.search input {
		width: 100%;
		font-size: 13px;
	}
	.results {
		position: absolute;
		top: calc(100% + 6px);
		left: 0;
		right: 0;
		list-style: none;
		margin: 0;
		padding: 4px;
		background: var(--surface-2);
		border: 1px solid var(--border-strong);
		border-radius: var(--r-md);
		z-index: 50;
		max-height: 60vh;
		overflow-y: auto;
	}
	.result {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		text-align: left;
		background: none;
		border: none;
		border-radius: var(--r-sm);
		padding: 6px 8px;
		font-size: 13px;
	}
	.result:hover,
	.result.selected {
		background: var(--surface-3);
	}
	.ns {
		width: 20px;
		text-align: center;
		font-size: 12px;
	}
	@media (max-width: 480px) {
		.search {
			display: none;
		}
	}
</style>
