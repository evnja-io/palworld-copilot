<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { gameName } from '$lib/game/names';
	import { palIcon } from '$lib/game/icons';
	import ElementBadge from '$lib/components/ElementBadge.svelte';
	import TeamSlotCard from './TeamSlotCard.svelte';
	import TeamPicker from './TeamPicker.svelte';
	import { defaultSlotFor } from '$lib/game/team-data';
	import { elVars } from '$lib/game/elements';
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
			// Slot vide : pré-remplissage des passifs innés + actifs par défaut du Pal
			// (données connues par espèce). Remplacement : passifs ET actifs conservés
			// (les fruits de compétence autorisent n'importe quel skill sur tout pal).
			store.setSlot(index, slot ? { ...slot, palId: id } : defaultSlotFor(id));
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
				class:filled={!!slot}
				style={slot ? elVars(ELEMENTS.get(slot.palId) ?? []) : ''}
				id="team-seat-{i}"
				role="tab"
				aria-selected={i === selected}
				aria-controls="team-slot-panel"
				tabindex={i === selected ? 0 : -1}
				onclick={() => (selected = i)}
				onkeydown={onBenchKeydown}
			>
				<span class="seat-num tnum">{m.teams_slot_n({ n: i + 1 })}</span>
				{#if slot}
					<span class="portrait">
						{#if palIcon(slot.palId)}
							<img
								class:uncaught={!mine.has(slot.palId)}
								src={palIcon(slot.palId)}
								alt=""
								loading="lazy"
							/>
						{:else}
							<span class="no-icon" aria-hidden="true">?</span>
						{/if}
					</span>
					<span class="seat-name">{gameName(`pal:${slot.palId}`)}</span>
					<span class="seat-els">
						{#each ELEMENTS.get(slot.palId) ?? [] as el (el)}
							<ElementBadge element={el} size="sm" />
						{/each}
					</span>
				{:else}
					<span class="empty-plus" aria-hidden="true">+</span>
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

	/* En-tête de l'équipe — 2b l.566. */
	.topbar {
		position: sticky;
		top: 0;
		z-index: 10;
		display: flex;
		align-items: center;
		gap: 16px;
		flex-wrap: wrap;
		padding: 10px 0;
		background: var(--color-bg);
	}
	.ro-name,
	.name {
		margin: 0;
		flex: 1;
		min-width: 180px;
		font-family: var(--font-display);
		font-size: 40px;
		font-weight: 800;
		letter-spacing: -0.03em;
		line-height: 1.1;
	}
	/* Le nom reste éditable en place : c'est une fonctionnalité livrée que la
	   maquette ne montre pas (elle affiche un titre figé). */
	.name {
		background: none;
		border: 1px solid transparent;
		border-radius: var(--radius-panel);
		padding: 2px 8px;
		margin-left: -8px;
	}
	.name:hover {
		border-color: var(--color-line);
	}
	.name:focus {
		background: var(--color-surface);
		border-color: rgba(255, 122, 47, 0.6);
		box-shadow: 0 0 0 4px rgba(255, 122, 47, 0.12);
		outline: none;
	}
	.meta {
		margin: 0;
		font-size: 12.5px;
		color: var(--color-muted);
	}
	.dirty {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 12px;
		color: var(--color-el-elec);
		white-space: nowrap;
	}
	.dot {
		font-size: 9px;
	}

	.notes-toggle,
	.save {
		padding: 10px 20px;
		border-radius: 999px;
		font-size: 13px;
		min-height: 40px;
	}
	.notes-toggle {
		background: none;
		border: 1px solid rgba(255, 255, 255, 0.14);
		font-weight: 600;
	}
	.notes-toggle:hover {
		background: rgba(255, 255, 255, 0.08);
	}
	.notes-toggle[aria-expanded='true'] {
		background: rgba(255, 255, 255, 0.08);
		border-color: var(--color-line);
	}
	.save {
		background: #fff;
		color: var(--color-bg);
		border-color: transparent;
		font-weight: 700;
		transition: transform var(--duration-hover) var(--ease-out-soft);
	}
	.save:hover:not(:disabled) {
		background: #fff;
		border-color: transparent;
		transform: translateY(-2px);
	}
	.save:disabled {
		background: var(--color-surface);
		color: var(--color-muted);
		cursor: default;
		transform: none;
	}

	.notes {
		font: inherit;
		color: var(--color-text);
		background: var(--color-surface);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		padding: 12px 14px;
		resize: vertical;
	}
	.notes::placeholder {
		color: var(--color-muted);
	}
	.notes:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 1px;
	}
	.notes-ro {
		margin: 0;
		font-size: 13px;
		color: var(--color-muted);
		white-space: pre-wrap;
	}

	/* Les 5 slots — 2b l.574. */
	.bench {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 14px;
	}
	.seat {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		min-height: 190px;
		padding: 16px 14px;
		text-align: center;
		background: #121318;
		border: 1.5px dashed rgba(255, 255, 255, 0.12);
		border-radius: 18px;
		justify-content: center;
		transition:
			border-color var(--duration-hover) var(--ease-out-soft),
			transform var(--duration-hover) var(--ease-out-soft);
	}
	.seat:hover {
		background: #121318;
		border-color: rgba(255, 255, 255, 0.3);
	}
	/* Slot occupé : teinte de l'élément (bi-type = mélange des deux). */
	.seat.filled {
		justify-content: flex-start;
		background:
			linear-gradient(
				170deg,
				color-mix(in srgb, var(--el) var(--el-a, 24%), transparent),
				color-mix(in srgb, var(--el2, var(--el)) var(--el2-a, 4%), transparent)
			),
			var(--color-surface);
		border: 1px solid rgba(255, 255, 255, 0.06);
	}
	.seat.filled:hover {
		border-color: color-mix(in srgb, var(--el) 40%, transparent);
		transform: translateY(-4px);
	}
	.seat.filled.active {
		--el-a: 30%;
		--el2-a: 5%;
		border: 1.5px solid color-mix(in srgb, var(--el) 55%, transparent);
		box-shadow: 0 0 30px color-mix(in srgb, var(--el) 18%, transparent);
	}
	.seat.active:not(.filled) {
		border-color: rgba(255, 255, 255, 0.3);
	}

	.seat-num {
		font: 10.5px ui-monospace, Menlo, monospace;
		color: rgba(255, 255, 255, 0.4);
	}

	.portrait {
		display: grid;
		place-items: center;
		width: 100%;
		aspect-ratio: 1;
		margin: 10px 0;
		border-radius: 14px;
		background: repeating-linear-gradient(
			45deg,
			rgba(255, 255, 255, 0.06) 0 12px,
			transparent 12px 24px
		);
	}
	.portrait img {
		width: 72%;
		height: 72%;
		object-fit: contain;
		filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.45));
		/* Signature Paldex : non capturé = désaturé. */
		transition: filter 200ms var(--ease-out-soft);
	}
	.portrait img.uncaught {
		filter: grayscale(1) opacity(0.45);
	}
	.no-icon {
		font-family: var(--font-display);
		font-size: 28px;
		font-weight: 800;
		color: rgba(255, 255, 255, 0.18);
	}
	.empty-plus {
		font-size: 26px;
		line-height: 1;
		color: #5c636e;
	}

	.seat-name {
		max-width: 100%;
		font-size: 14px;
		font-weight: 700;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.seat-name.empty {
		font-size: 12px;
		font-weight: 400;
		color: #5c636e;
		margin-top: 6px;
	}
	.seat-els {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
		justify-content: center;
		margin-top: 6px;
	}

	/* Carrousel horizontal de vignettes 88 px — 4c l.247. */
	@media (max-width: 1023.98px) {
		.ro-name,
		.name {
			font-size: 28px;
			letter-spacing: -0.02em;
		}
		.bench {
			display: flex;
			gap: 10px;
			overflow-x: auto;
			scrollbar-width: none;
			margin-left: calc(-1 * var(--gutter, 20px));
			margin-right: calc(-1 * var(--gutter, 20px));
			padding: 0 var(--gutter, 20px) 4px;
		}
		.bench::-webkit-scrollbar {
			display: none;
		}
		.seat {
			flex: none;
			width: 88px;
			min-height: 118px;
			padding: 10px 8px;
			border-radius: 16px;
		}
		.portrait {
			margin: 0;
			border-radius: 11px;
			background: none;
		}
		.portrait img {
			width: 82%;
			height: 82%;
		}
		.seat-name {
			font-size: 11.5px;
			margin-top: 5px;
		}
		.seat-num,
		.seat-els {
			display: none;
		}
		.empty-plus {
			font-size: 20px;
		}
		.seat-name.empty {
			font-size: 10px;
			margin-top: 4px;
		}
	}
</style>
