<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import { gameName, gameDesc } from '$lib/game/names';
	import { palIcon } from '$lib/game/icons';
	import {
		ACTIVE_SKILL_IDS,
		PAL_IDS,
		PASSIVE_IDS,
		learnsetFor,
		passiveRank
	} from '$lib/game/team-data';
	import ElementBadge from '$lib/components/ElementBadge.svelte';
	import GroupAvatars from '$lib/components/GroupAvatars.svelte';
	import skills from '@palworld-companion/game-data/skills.json';
	import type { GroupUser } from '$lib/types';

	type Mode = 'pal' | 'active' | 'passive';
	type Row = { id: string; name: string; level?: number };

	let {
		mode,
		palId,
		caught,
		exclude,
		onselect,
		onclose
	}: {
		mode: Mode;
		palId: string | null;
		caught: { mine: string[]; group: Record<string, GroupUser[]> };
		exclude: string[];
		onselect: (id: string) => void;
		onclose: () => void;
	} = $props();

	const SKILLS = skills as Record<string, { element?: string; power?: number; ct?: number }>;
	const collator = new Intl.Collator(getLocale());

	// Learnset du pal courant (mode actif).
	const learnset = $derived(mode === 'active' && palId !== null ? learnsetFor(palId) : []);

	let text = $state('');
	let inputEl = $state<HTMLInputElement>();
	let onlyCaught = $state(false);
	let fruits = $state(false);
	// Fruits de compétence : auto-ON quand le learnset est vide (hint affiché).
	const showAllSkills = $derived(fruits || (mode === 'active' && learnset.length === 0));

	const mine = $derived(new Set(caught.mine));

	/** Normalisation insensible aux accents/à la casse (cf. CommandPalette). */
	function norm(s: string): string {
		return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
	}

	const title = $derived(
		mode === 'pal'
			? m.teams_pick_pal()
			: mode === 'active'
				? m.teams_pick_active()
				: m.teams_pick_passive()
	);

	const baseRows = $derived.by((): Row[] => {
		const ex = new Set(exclude);
		if (mode === 'pal') {
			let ids = [...PAL_IDS].filter((id) => !ex.has(id));
			if (onlyCaught) ids = ids.filter((id) => mine.has(id));
			return ids
				.map((id) => ({ id, name: gameName(`pal:${id}`) }))
				.sort((a, b) => collator.compare(a.name, b.name));
		}
		if (mode === 'active') {
			if (!showAllSkills)
				return learnset
					.filter((e) => !ex.has(e.skillId))
					.map((e) => ({ id: e.skillId, name: gameName(`skill:${e.skillId}`), level: e.level }));
			return [...ACTIVE_SKILL_IDS]
				.filter((id) => !ex.has(id))
				.map((id) => ({ id, name: gameName(`skill:${id}`) }))
				.sort((a, b) => collator.compare(a.name, b.name));
		}
		return [...PASSIVE_IDS]
			.filter((id) => !ex.has(id))
			.map((id) => ({ id, name: gameName(`passive:${id}`) }))
			.sort((a, b) => collator.compare(a.name, b.name));
	});

	const rows = $derived.by(() => {
		const q = norm(text.trim());
		if (!q) return baseRows;
		return baseRows.filter((r) => norm(r.name).includes(q));
	});

	// Dérivé réassignable : revient à 0 dès que la liste change.
	let selected = $derived.by(() => {
		void rows;
		return 0;
	});

	$effect(() => {
		inputEl?.focus();
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = '';
		};
	});

	$effect(() => {
		document.getElementById(`tp-opt-${selected}`)?.scrollIntoView({ block: 'nearest' });
	});

	function onWindowKeydown(ev: KeyboardEvent) {
		if (ev.key === 'Escape') {
			ev.preventDefault();
			onclose();
		}
	}

	function onKeydown(ev: KeyboardEvent) {
		if (ev.key === 'ArrowDown') {
			ev.preventDefault();
			if (rows.length) selected = (selected + 1) % rows.length;
		} else if (ev.key === 'ArrowUp') {
			ev.preventDefault();
			if (rows.length) selected = (selected - 1 + rows.length) % rows.length;
		} else if (ev.key === 'Enter') {
			ev.preventDefault();
			const row = rows[selected];
			if (row) onselect(row.id);
		}
	}

	/** Rang signé d'un passif, ex. « +4 » / « -1 ». */
	function rankLabel(id: string): string {
		const r = passiveRank(id);
		return r > 0 ? `+${r}` : String(r);
	}
</script>

<svelte:window onkeydown={onWindowKeydown} />

<div
	class="overlay"
	onclick={(ev) => {
		if (ev.target === ev.currentTarget) onclose();
	}}
	role="presentation"
>
	<div class="panel" role="dialog" aria-modal="true" aria-label={title}>
		<div class="head">
			<p class="title">{title}</p>
			{#if mode === 'pal'}
				<label class="toggle">
					<input type="checkbox" bind:checked={onlyCaught} />
					{m.teams_caught_by_me()}
				</label>
			{:else if mode === 'active' && learnset.length > 0}
				<label class="toggle">
					<input type="checkbox" bind:checked={fruits} />
					{m.teams_fruits_toggle()}
				</label>
			{/if}
		</div>
		{#if mode === 'active' && learnset.length === 0}
			<p class="hint">{m.teams_learnset_empty()}</p>
		{/if}
		<div class="inputbar">
			<span class="lens" aria-hidden="true">🔍</span>
			<input
				bind:this={inputEl}
				bind:value={text}
				type="text"
				role="combobox"
				aria-expanded={rows.length > 0}
				aria-controls="tp-list"
				aria-activedescendant={rows.length ? `tp-opt-${selected}` : undefined}
				aria-autocomplete="list"
				autocomplete="off"
				spellcheck="false"
				placeholder={m.teams_picker_placeholder()}
				onkeydown={onKeydown}
			/>
		</div>

		<div class="body" class:grid={mode === 'pal'} id="tp-list" role="listbox">
			{#each rows as row, i (row.id)}
				{#if mode === 'pal'}
					<button
						class="opt pal"
						class:selected={i === selected}
						id="tp-opt-{i}"
						role="option"
						aria-selected={i === selected}
						onclick={() => onselect(row.id)}
					>
						{#if palIcon(row.id)}
							<img
								class="portrait"
								class:uncaught={!mine.has(row.id)}
								src={palIcon(row.id)}
								alt=""
								width="40"
								height="40"
								loading="lazy"
							/>
						{:else}
							<span class="no-icon" aria-hidden="true">?</span>
						{/if}
						<span class="opt-name">{row.name}</span>
						<GroupAvatars users={caught.group[row.id] ?? []} />
					</button>
				{:else if mode === 'active'}
					{@const sk = SKILLS[row.id]}
					<button
						class="opt"
						class:selected={i === selected}
						id="tp-opt-{i}"
						role="option"
						aria-selected={i === selected}
						onclick={() => onselect(row.id)}
					>
						{#if row.level !== undefined}
							<span class="lvl tnum">{m.teams_level_badge({ level: row.level })}</span>
						{/if}
						<span class="opt-name">{row.name}</span>
						<span class="badges">
							{#if sk?.element}<ElementBadge element={sk.element} />{/if}
							{#if sk?.power}<span class="muted tnum">💥 {sk.power}</span>{/if}
							{#if sk?.ct}<span class="muted tnum">⏱ {sk.ct}s</span>{/if}
						</span>
					</button>
				{:else}
					<button
						class="opt passive"
						class:selected={i === selected}
						id="tp-opt-{i}"
						role="option"
						aria-selected={i === selected}
						onclick={() => onselect(row.id)}
					>
						<span class="passive-head">
							<span class="opt-name">{row.name}</span>
							<span class="rank tnum" class:high={passiveRank(row.id) >= 4} class:neg={passiveRank(row.id) < 0}>
								{rankLabel(row.id)}
							</span>
						</span>
						{#if gameDesc(`passive:${row.id}`)}
							<span class="desc">{gameDesc(`passive:${row.id}`)}</span>
						{/if}
					</button>
				{/if}
			{/each}
			{#if !rows.length}
				<p class="state">{m.teams_picker_empty()}</p>
			{/if}
		</div>
	</div>
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		z-index: 1100;
		background: rgba(6, 7, 10, 0.6);
		backdrop-filter: blur(3px);
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: 10vh 16px 16px;
	}
	.panel {
		width: min(680px, 100%);
		max-height: 74vh;
		display: flex;
		flex-direction: column;
		background: var(--surface-1);
		border: 1px solid var(--border-strong);
		border-radius: var(--r-lg);
		overflow: hidden;
		/* Seule ombre autorisée du design system : l'overlay. */
		box-shadow: 0 24px 64px rgba(3, 4, 6, 0.6);
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
		padding: 12px 14px 0;
	}
	.title {
		margin: 0;
		font-family: var(--font-display);
		font-size: 15px;
		font-weight: 600;
	}
	.toggle {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--text-2);
		cursor: pointer;
	}
	.toggle input {
		accent-color: var(--accent);
	}
	.hint {
		margin: 6px 14px 0;
		font-size: 12px;
		color: var(--text-3);
	}
	.inputbar {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 14px;
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
	.body {
		overflow-y: auto;
		padding: 6px;
	}
	.body.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
		gap: 2px;
		align-content: start;
	}
	.state {
		color: var(--text-3);
		font-size: 13px;
		text-align: center;
		padding: 24px 0;
		margin: 0;
		grid-column: 1 / -1;
	}
	.opt {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		min-height: 44px;
		text-align: left;
		background: none;
		border: none;
		border-radius: var(--r-sm);
		padding: 7px 8px;
		font-size: 13px;
		color: var(--text-1);
	}
	.opt:hover,
	.opt.selected {
		background: var(--surface-3);
	}
	.opt.passive {
		flex-direction: column;
		align-items: stretch;
		gap: 2px;
	}
	.passive-head {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.portrait {
		flex-shrink: 0;
		/* Signature Paldex : non capturé = désaturé. */
		filter: grayscale(1) opacity(0.45);
	}
	.portrait:not(.uncaught) {
		filter: none;
	}
	.no-icon {
		width: 40px;
		height: 40px;
		flex-shrink: 0;
		display: grid;
		place-items: center;
		color: var(--text-4);
		background: var(--surface-2);
		border-radius: var(--r-sm);
	}
	.opt-name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.lvl {
		flex-shrink: 0;
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 500;
		color: var(--text-3);
		border: 1px solid var(--border-strong);
		border-radius: var(--r-sm);
		padding: 1px 6px;
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
	.rank {
		flex-shrink: 0;
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 600;
		color: var(--text-3);
	}
	.rank.high {
		color: var(--el-electricity);
	}
	.rank.neg {
		color: var(--el-fire);
	}
	.desc {
		font-size: 11px;
		color: var(--text-3);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
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
		.body.grid {
			grid-template-columns: 1fr;
		}
	}
</style>
