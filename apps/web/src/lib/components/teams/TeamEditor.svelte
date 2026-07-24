<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { gameName } from '$lib/game/names';
	import { palIcon } from '$lib/game/icons';
	import ElementBadge from '$lib/components/ElementBadge.svelte';
	import TeamSlotCard from './TeamSlotCard.svelte';
	import TeamPicker from './TeamPicker.svelte';
	import pals from '@palworld-companion/game-data/pals.json';
	import type { TeamEditorStore } from '$lib/game/team-editor.svelte';
	import type { GroupUser } from '$lib/types';

	type PickerMode = 'pal' | 'active' | 'passive';

	let {
		store,
		readonly,
		caught,
		authorName
	}: {
		store: TeamEditorStore;
		readonly: boolean;
		caught: { mine: string[]; group: Record<string, GroupUser[]> };
		authorName?: string;
	} = $props();

	const ELEMENTS = new Map(
		(pals as Array<{ id: string; elements: string[] }>).map((p) => [p.id, p.elements])
	);

	const mine = $derived(new Set(caught.mine));

	let selected = $state(0);
	let notesOpen = $state(false);
	let picker = $state<{ mode: PickerMode; index: number } | null>(null);

	/** Ids masqués dans le picker : pals déjà placés ailleurs, ou ids déjà pris du slot. */
	const excludeIds = $derived.by(() => {
		const p = picker;
		if (!p) return [];
		if (p.mode === 'pal')
			return store.slots.flatMap((s, i) => (s !== null && i !== p.index ? [s.palId] : []));
		const slot = store.slots[p.index];
		if (!slot) return [];
		return p.mode === 'active' ? slot.actives : slot.passives;
	});

	function openPicker(mode: PickerMode, index: number) {
		selected = index;
		picker = { mode, index };
	}

	function handleSelect(id: string) {
		if (!picker) return;
		const { mode, index } = picker;
		const slot = store.slots[index];
		if (mode === 'pal') {
			// Remplacement : passifs ET actifs conservés (les fruits de compétence
			// autorisent n'importe quel skill sur n'importe quel pal).
			store.setSlot(index, slot ? { ...slot, palId: id } : { palId: id, passives: [], actives: [] });
		} else if (slot && mode === 'active' && slot.actives.length < 3 && !slot.actives.includes(id)) {
			store.setSlot(index, { ...slot, actives: [...slot.actives, id] });
		} else if (slot && mode === 'passive' && slot.passives.length < 4 && !slot.passives.includes(id)) {
			store.setSlot(index, { ...slot, passives: [...slot.passives, id] });
		}
		picker = null;
	}

	function removeId(kind: 'active' | 'passive', index: number, id: string) {
		const slot = store.slots[index];
		if (!slot) return;
		if (kind === 'active') store.setSlot(index, { ...slot, actives: slot.actives.filter((x) => x !== id) });
		else store.setSlot(index, { ...slot, passives: slot.passives.filter((x) => x !== id) });
	}

	/** Navigation clavier du banc (pattern tablist : flèches gauche/droite). */
	function onBenchKeydown(ev: KeyboardEvent) {
		if (ev.key === 'ArrowRight') {
			ev.preventDefault();
			selected = (selected + 1) % 5;
			focusSeat();
		} else if (ev.key === 'ArrowLeft') {
			ev.preventDefault();
			selected = (selected + 4) % 5;
			focusSeat();
		}
	}
	function focusSeat() {
		document.getElementById(`team-seat-${selected}`)?.focus();
	}

	const saveLabel = $derived(
		store.status === 'saving'
			? m.teams_saving()
			: store.status === 'saved'
				? m.teams_saved()
				: store.status === 'error'
					? m.teams_save_error()
					: m.teams_save()
	);
</script>

<div class="editor">
	<div class="topbar">
		{#if readonly}
			<h1 class="ro-name">{store.name}</h1>
		{:else}
			<input
				class="name"
				type="text"
				maxlength={80}
				placeholder={m.teams_name_placeholder()}
				aria-label={m.teams_name_label()}
				bind:value={store.name}
			/>
		{/if}
		<p class="meta">
			{#if readonly}
				{m.teams_readonly_hint({ name: authorName ?? '' })}
			{:else if authorName}
				{m.teams_by({ name: authorName })}
			{/if}
		</p>
		{#if !readonly}
			{#if store.dirty}
				<span class="dirty"><span class="dot" aria-hidden="true">●</span> {m.teams_unsaved()}</span>
			{/if}
			<button class="notes-toggle" aria-expanded={notesOpen} onclick={() => (notesOpen = !notesOpen)}>
				{m.teams_notes_label()}
			</button>
			<button
				class="save"
				disabled={!store.dirty || store.status === 'saving'}
				onclick={() => store.save()}
			>
				{saveLabel}
			</button>
		{/if}
	</div>

	{#if !readonly && notesOpen}
		<textarea
			class="notes"
			rows="3"
			maxlength={2000}
			aria-label={m.teams_notes_label()}
			placeholder={m.teams_notes_placeholder()}
			bind:value={store.notes}
		></textarea>
	{:else if readonly && store.notes}
		<p class="notes-ro">{store.notes}</p>
	{/if}

	<div class="bench" role="tablist" aria-label={m.teams_title()}>
		{#each store.slots as slot, i (i)}
			<button
				class="seat"
				class:active={i === selected}
				id="team-seat-{i}"
				role="tab"
				aria-selected={i === selected}
				aria-controls="team-slot-panel"
				tabindex={i === selected ? 0 : -1}
				onclick={() => (selected = i)}
				onkeydown={onBenchKeydown}
			>
				<span class="seat-num tnum">{i + 1}</span>
				{#if slot}
					{#if palIcon(slot.palId)}
						<img
							class:uncaught={!mine.has(slot.palId)}
							src={palIcon(slot.palId)}
							alt=""
							width="64"
							height="64"
							loading="lazy"
						/>
					{:else}
						<span class="no-icon" aria-hidden="true">?</span>
					{/if}
					<span class="seat-name">{gameName(`pal:${slot.palId}`)}</span>
					<span class="seat-els">
						{#each ELEMENTS.get(slot.palId) ?? [] as el (el)}<ElementBadge element={el} />{/each}
					</span>
				{:else}
					<span class="empty-circle" aria-hidden="true">+</span>
					<span class="seat-name empty">{m.teams_slot_empty()}</span>
				{/if}
			</button>
		{/each}
	</div>

	<div id="team-slot-panel" role="tabpanel" aria-labelledby="team-seat-{selected}">
		<TeamSlotCard
			slot={store.slots[selected]}
			index={selected}
			{readonly}
			{caught}
			onpick={openPicker}
			onclear={(i) => store.clearSlot(i)}
			onremoveid={removeId}
		/>
	</div>
</div>

{#if picker}
	<TeamPicker
		mode={picker.mode}
		palId={store.slots[picker.index]?.palId ?? null}
		{caught}
		exclude={excludeIds}
		onselect={handleSelect}
		onclose={() => (picker = null)}
	/>
{/if}

<style>
	.editor {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.topbar {
		position: sticky;
		top: 0;
		z-index: 10;
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
		padding: 10px 0;
		background: var(--bg);
		border-bottom: 1px solid var(--border);
	}
	.ro-name {
		margin: 0;
		font-size: 20px;
	}
	.name {
		flex: 1;
		min-width: 180px;
		font-family: var(--font-display);
		font-size: 18px;
		font-weight: 600;
		letter-spacing: -0.02em;
		background: none;
		border: 1px solid transparent;
		padding: 6px 8px;
	}
	.name:hover {
		border-color: var(--border);
	}
	.name:focus {
		background: var(--input-bg);
		border-color: var(--border-strong);
	}
	.meta {
		margin: 0;
		font-size: 12px;
		color: var(--text-3);
	}
	.dirty {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 12px;
		color: var(--el-electricity);
		white-space: nowrap;
	}
	.dot {
		font-size: 9px;
	}
	.notes-toggle[aria-expanded='true'] {
		background: var(--surface-3);
		border-color: var(--border-strong);
	}
	.save {
		background: var(--accent);
		color: var(--accent-ink);
		border-color: transparent;
		font-weight: 600;
		min-height: 40px;
		padding: 8px 18px;
	}
	.save:hover:not(:disabled) {
		background: color-mix(in srgb, var(--accent) 85%, white);
		border-color: transparent;
	}
	.save:disabled {
		background: var(--surface-3);
		color: var(--text-3);
		cursor: default;
	}
	.notes {
		font: inherit;
		color: var(--text-1);
		background: var(--input-bg);
		border: 1px solid var(--border);
		border-radius: var(--r-sm);
		padding: 8px 10px;
		resize: vertical;
	}
	.notes::placeholder {
		color: var(--text-3);
	}
	.notes:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 1px;
	}
	.notes-ro {
		margin: 0;
		font-size: 13px;
		color: var(--text-2);
		white-space: pre-wrap;
	}
	.bench {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 8px;
	}
	@media (max-width: 700px) {
		.bench {
			grid-template-columns: repeat(5, minmax(76px, 1fr));
			overflow-x: auto;
			padding-bottom: 4px;
		}
	}
	.seat {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		min-height: 44px;
		padding: 10px 6px;
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: var(--r-md);
	}
	.seat:hover {
		background: var(--surface-2);
		border-color: var(--border-strong);
	}
	.seat.active {
		background: color-mix(in srgb, var(--accent) 8%, var(--surface-1));
		border-color: color-mix(in srgb, var(--accent) 45%, transparent);
	}
	.seat-num {
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 600;
		color: var(--text-4);
	}
	.seat.active .seat-num {
		color: var(--accent);
	}
	.seat img {
		/* Signature Paldex : non capturé = désaturé. */
		transition: filter 200ms cubic-bezier(0.23, 1, 0.32, 1);
	}
	.seat img.uncaught {
		filter: grayscale(1) opacity(0.45);
	}
	.no-icon {
		width: 64px;
		height: 64px;
		display: grid;
		place-items: center;
		color: var(--text-4);
		background: var(--surface-2);
		border-radius: var(--r-sm);
	}
	.empty-circle {
		width: 64px;
		height: 64px;
		display: grid;
		place-items: center;
		font-size: 20px;
		color: var(--text-4);
		border: 1px dashed var(--border-strong);
		border-radius: 50%;
	}
	.seat-name {
		max-width: 100%;
		font-size: 12px;
		font-weight: 500;
		color: var(--text-2);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.seat-name.empty {
		color: var(--text-4);
	}
	.seat-els {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
		justify-content: center;
	}
	@media (max-width: 700px) {
		.seat-els {
			display: none;
		}
	}
</style>
