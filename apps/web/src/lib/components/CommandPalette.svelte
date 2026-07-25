<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { appHref } from '$lib/nav';
	import { GUEST_SLUG } from '$lib/guest';
	import { readLocalProgress } from '$lib/game/localProgress';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import ElementBadge from '$lib/components/ElementBadge.svelte';
	import {
		suggestTokens,
		tokenLabel,
		tokenKey,
		NS_LABELS,
		CAT_LABELS,
		WORK_LABELS,
		MARKER_LABELS,
		type Locale,
		type Token
	} from '$lib/search/tokens';
	import {
		runSearch,
		entryNs,
		rawId,
		type ResultItem,
		type SearchEntry
	} from '$lib/search/engine';

	type Data = typeof import('$lib/search/data');
	type Row =
		| { kind: 'token'; token: Token }
		| { kind: 'result'; item: ResultItem; href?: string; icon?: string };

	const NS_EMOJI: Record<string, string> = {
		pal: '🐾',
		item: '🎒',
		skill: '💥',
		passive: '✨',
		tech: '🔬',
		building: '🏗️'
	};
	const MK_GLYPH: Record<string, string> = { relic: '✦', alpha: '▲', ft: '◆' };

	let open = $state(false);
	let text = $state('');
	let tokens = $state<Token[]>([]);
	let inputEl = $state<HTMLInputElement>();
	let data = $state<Data | null>(null);
	let checked = $state<ReadonlySet<string>>(new Set());

	const locale = getLocale() as Locale;

	export function show() {
		open = true;
	}

	function close() {
		open = false;
		text = '';
		tokens = [];
		selected = 0;
	}

	$effect(() => {
		if (!open) return;
		inputEl?.focus();
		if (!data) import('$lib/search/data').then((mod) => (data = mod));
		if (page.params.slug === GUEST_SLUG) {
			// Invité : pas d'API serveur à interroger (elle répondrait 401 à chaque
			// ouverture de la palette). Les effigies cochées viennent du local.
			checked = new Set(readLocalProgress('marker'));
		} else {
			fetch(`/api/servers/${page.params.slug}/progress?kind=marker`)
				.then((r) => (r.ok ? r.json() : null))
				.then((p) => {
					if (p) checked = new Set(p.mine as string[]);
				})
				.catch(() => {});
		}
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = '';
		};
	});

	const suggestions = $derived(data ? suggestTokens(text, tokens) : []);
	const groups = $derived(
		data
			? runSearch(data.index, tokens, text, {
					locale,
					learners: data.learners,
					passiveHolders: data.passiveHolders,
					checked
				})
			: []
	);

	/** Vue aplatie pour la navigation clavier : suggestions puis résultats groupés. */
	const view = $derived.by(() => {
		const rows: Row[] = suggestions.map((token) => ({ kind: 'token' as const, token }));
		const gs: Array<{ ns: string; start: number; rows: Row[] }> = [];
		for (const g of groups) {
			const groupRows: Row[] = [];
			for (const item of g.items) {
				const res = data!.resolve(item.entry);
				if (!res) continue;
				groupRows.push({ kind: 'result', item, href: res.href, icon: res.icon });
			}
			if (groupRows.length) {
				gs.push({ ns: g.ns, start: rows.length, rows: groupRows });
				rows.push(...groupRows);
			}
		}
		return { rows, gs };
	});

	// Dérivé réassignable : revient à 0 à chaque changement de la vue.
	let selected = $derived.by(() => {
		void view;
		return 0;
	});

	$effect(() => {
		document.getElementById(`cp-opt-${selected}`)?.scrollIntoView({ block: 'nearest' });
	});

	function displayName(item: ResultItem): { name: string; indexes?: readonly number[] } {
		const e = item.entry;
		if (item.matchLocale) return { name: e[item.matchLocale], indexes: item.indexes };
		return { name: e[locale] ?? e.en };
	}

	/** Segments [texte, surligné] pour le rendu du match fuzzy. */
	function segments(name: string, indexes?: readonly number[]): Array<[string, boolean]> {
		if (!indexes?.length) return [[name, false]];
		const hit = new Set(indexes);
		const out: Array<[string, boolean]> = [];
		for (let i = 0; i < name.length; i++) {
			const h = hit.has(i);
			const last = out[out.length - 1];
			if (last && last[1] === h) last[0] += name[i];
			else out.push([name[i], h]);
		}
		return out;
	}

	function addToken(token: Token) {
		if (tokens.some((t) => tokenKey(t) === tokenKey(token))) return;
		tokens = [...tokens, token];
		text = '';
		selected = 0;
		inputEl?.focus();
	}

	function removeToken(i: number) {
		tokens = tokens.filter((_, idx) => idx !== i);
		inputEl?.focus();
	}

	function activate(row: Row) {
		if (row.kind === 'token') {
			addToken(row.token);
			return;
		}
		const e = row.item.entry;
		if (entryNs(e) === 'skill') {
			addToken({ kind: 'skill', value: rawId(e), label: e[locale] ?? e.en });
			return;
		}
		if (entryNs(e) === 'passive') {
			addToken({ kind: 'passive', value: rawId(e), label: e[locale] ?? e.en });
			return;
		}
		if (row.href) {
			const href = row.href;
			close();
			goto(appHref(href));
		}
	}

	function onKeydownGlobal(ev: KeyboardEvent) {
		if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'k') {
			ev.preventDefault();
			if (open) close();
			else show();
			return;
		}
		if (open) return;
		const t = ev.target as HTMLElement | null;
		const typing =
			t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
		if (ev.key === '/' && !typing) {
			ev.preventDefault();
			show();
		}
	}

	function onKeydown(ev: KeyboardEvent) {
		if (ev.key === 'Escape') {
			ev.preventDefault();
			close();
		} else if (ev.key === 'ArrowDown') {
			ev.preventDefault();
			if (view.rows.length) selected = (selected + 1) % view.rows.length;
		} else if (ev.key === 'ArrowUp') {
			ev.preventDefault();
			if (view.rows.length) selected = (selected - 1 + view.rows.length) % view.rows.length;
		} else if (ev.key === 'Enter') {
			ev.preventDefault();
			const row = view.rows[selected];
			if (row) activate(row);
		} else if (ev.key === 'Tab') {
			ev.preventDefault();
			const sel = view.rows[selected];
			const row = sel?.kind === 'token' ? sel : view.rows.find((r) => r.kind === 'token');
			if (row) activate(row);
		} else if (ev.key === 'Backspace' && text === '' && tokens.length) {
			removeToken(tokens.length - 1);
		}
	}

	/** Le token d'aptitude actif, pour afficher le niveau correspondant sur les pals. */
	const workToken = $derived(tokens.find((t) => t.kind === 'work'));

	function workLevelBadge(e: SearchEntry): string | null {
		if (!workToken || !e.wk) return null;
		const lvl = e.wk[workToken.value];
		return lvl ? `${WORK_LABELS[workToken.value]?.[locale] ?? workToken.value} ${lvl}` : null;
	}
</script>

<svelte:window onkeydown={onKeydownGlobal} />

{#if open}
	<div
		class="overlay"
		onclick={(ev) => {
			if (ev.target === ev.currentTarget) close();
		}}
		role="presentation"
	>
		<div class="panel" role="dialog" aria-modal="true" aria-label={m.search_button()}>
			<div class="inputbar">
				<span class="lens" aria-hidden="true">🔍</span>
				{#each tokens as token, i (tokenKey(token))}
					<button
						class="chip"
						onclick={() => removeToken(i)}
						title={m.search_remove_filter({ label: tokenLabel(token, locale) })}
					>
						{tokenLabel(token, locale)}
						<span aria-hidden="true">×</span>
					</button>
				{/each}
				<input
					bind:this={inputEl}
					bind:value={text}
					type="text"
					role="combobox"
					aria-expanded={view.rows.length > 0}
					aria-controls="cp-list"
					aria-activedescendant={view.rows.length ? `cp-opt-${selected}` : undefined}
					aria-autocomplete="list"
					autocomplete="off"
					spellcheck="false"
					placeholder={tokens.length ? '' : m.search_palette_placeholder()}
					onkeydown={onKeydown}
				/>
			</div>

			<div class="body" id="cp-list" role="listbox">
				{#if !data}
					<p class="state">{m.search_loading()}</p>
				{:else}
					{#if suggestions.length}
						<p class="group-title">{m.search_filters()}</p>
						{#each suggestions as token, i (tokenKey(token))}
							<button
								class="row"
								class:selected={i === selected}
								id="cp-opt-{i}"
								role="option"
								aria-selected={i === selected}
								onclick={() => activate({ kind: 'token', token })}
							>
								<span class="row-icon" aria-hidden="true">◈</span>
								<span class="row-name">{tokenLabel(token, locale)}</span>
								<kbd class="tab-hint">Tab</kbd>
							</button>
						{/each}
					{/if}

					{#each view.gs as g (g.ns)}
						<p class="group-title">{NS_LABELS[g.ns as keyof typeof NS_LABELS][locale]}</p>
						{#each g.rows as row, j (row.kind === 'result' ? row.item.entry.id : j)}
							{#if row.kind === 'result'}
								{@const e = row.item.entry}
								{@const dn = displayName(row.item)}
								{@const idx = g.start + j}
								<button
									class="row"
									class:selected={idx === selected}
									id="cp-opt-{idx}"
									role="option"
									aria-selected={idx === selected}
									onclick={() => activate(row)}
								>
									{#if row.icon}
										<img class="row-icon" src={row.icon} alt="" width="22" height="22" />
									{:else if e.mk}
										<span class="row-icon mk mk-{e.mk}" aria-hidden="true">{MK_GLYPH[e.mk]}</span>
									{:else}
										<span class="row-icon" aria-hidden="true">{NS_EMOJI[g.ns]}</span>
									{/if}
									<span class="row-name">
										{#each segments(dn.name, dn.indexes) as [part, hit], k (k)}
											{#if hit}<mark>{part}</mark>{:else}{part}{/if}
										{/each}
									</span>
									<span class="badges">
										{#if e.mk === 'relic'}
											<span class="check" class:on={checked.has(rawId(e))} aria-hidden="true">
												{checked.has(rawId(e)) ? '✓' : '○'}
											</span>
										{:else if e.mk === 'alpha' && e.lvl}
											<span class="muted tnum">{m.map_level({ level: e.lvl })}</span>
										{:else if e.mk === 'ft'}
											<span class="muted">{MARKER_LABELS.ft[locale]}</span>
										{/if}
										{#if entryNs(e) === 'skill'}
											{#if e.pw}<span class="muted tnum">💥 {e.pw}</span>{/if}
											{#if e.ct}<span class="muted tnum">⏱ {e.ct}s</span>{/if}
										{/if}
										{#if entryNs(e) === 'tech' && e.lvl}
											<span class="muted tnum">{m.craft_level({ level: e.lvl })}</span>
										{/if}
										{#if e.cat}
											<span class="muted">{CAT_LABELS[e.cat]?.[locale] ?? e.cat}</span>
										{/if}
										{#if workLevelBadge(e)}
											<span class="muted tnum">{workLevelBadge(e)}</span>
										{/if}
										{#each e.el ?? [] as el (el)}
											<ElementBadge element={el} />
										{/each}
									</span>
								</button>
							{/if}
						{/each}
					{/each}

					{#if !view.rows.length && (tokens.length || text.trim().length >= 2)}
						<p class="state">{m.search_empty()}</p>
					{/if}
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		/* Au-dessus des panes Leaflet (z-index <= 1000) sur la page carte. */
		z-index: 1100;
		background: hsl(222 40% 4% / 0.6);
		backdrop-filter: blur(3px);
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: 12vh 16px 16px;
	}
	.panel {
		width: min(640px, 100%);
		max-height: 70vh;
		display: flex;
		flex-direction: column;
		background: var(--surface-1);
		border: 1px solid var(--border-strong);
		border-radius: var(--r-lg);
		overflow: hidden;
		box-shadow: 0 24px 64px hsl(222 40% 2% / 0.6);
	}
	.inputbar {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
		padding: 12px 14px;
		border-bottom: 1px solid var(--border);
	}
	.lens {
		font-size: 14px;
	}
	.inputbar input {
		flex: 1;
		min-width: 120px;
		background: none;
		border: none;
		outline: none;
		color: var(--text-1);
		font-size: 15px;
		padding: 4px 0;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		background: var(--accent-soft);
		color: var(--accent);
		border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
		border-radius: 999px;
		padding: 3px 10px;
		font-size: 12px;
		font-weight: 500;
		white-space: nowrap;
	}
	.chip span {
		opacity: 0.7;
	}
	.chip:hover span {
		opacity: 1;
	}
	.body {
		overflow-y: auto;
		padding: 6px;
	}
	.state {
		color: var(--text-3);
		font-size: 13px;
		text-align: center;
		padding: 24px 0;
		margin: 0;
	}
	.group-title {
		color: var(--text-4);
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		margin: 10px 8px 4px;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		text-align: left;
		background: none;
		border: none;
		border-radius: var(--r-sm);
		padding: 7px 8px;
		font-size: 13px;
		color: var(--text-1);
	}
	.row:hover,
	.row.selected {
		background: var(--surface-3);
	}
	.row-icon {
		width: 22px;
		height: 22px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 13px;
		flex-shrink: 0;
	}
	.mk-relic {
		color: var(--el-electricity);
	}
	.mk-alpha {
		color: var(--el-fire);
	}
	.mk-ft {
		color: var(--accent);
	}
	.row-name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.row-name mark {
		background: none;
		color: var(--accent);
		font-weight: 600;
	}
	.badges {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}
	.muted {
		color: var(--text-3);
		font-size: 11px;
		white-space: nowrap;
	}
	.check {
		font-size: 12px;
		color: var(--text-4);
	}
	.check.on {
		color: var(--accent);
	}
	.tab-hint {
		font-size: 10px;
		color: var(--text-4);
		border: 1px solid var(--border-strong);
		border-radius: 4px;
		padding: 1px 5px;
	}
	@media (max-width: 480px) {
		.overlay {
			padding: 0;
		}
		.panel {
			width: 100%;
			height: 100dvh;
			max-height: none;
			border-radius: 0;
			border: none;
		}
	}
</style>
