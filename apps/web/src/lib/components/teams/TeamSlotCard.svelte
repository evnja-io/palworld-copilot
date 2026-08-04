<script lang="ts">
	// Héros du slot sélectionné — 2b l.596 (desktop) et 4c l.262 (mobile).
	//
	// Le dessin ne montre que le nom, la compétence de partenaire et les
	// attaques. Les passifs, eux, sont une fonctionnalité livrée (4 par slot) :
	// ils descendent sous les attaques plutôt que de disparaître.
	import { m } from '$lib/paraglide/messages';
	import { gameName } from '$lib/game/names';
	import { palIcon } from '$lib/game/icons';
	import { partnerSkillNsId, passiveRank } from '$lib/game/team-data';
	import { elVars } from '$lib/game/elements';
	import ElementHero from '$lib/components/atlas/ElementHero.svelte';
	import AttackRow from '$lib/components/atlas/AttackRow.svelte';
	import GroupAvatars from '$lib/components/GroupAvatars.svelte';
	import pals from '@palworld-companion/game-data/pals.json';
	import skills from '@palworld-companion/game-data/skills.json';
	import type { GroupUser, TeamSlot } from '$lib/types';

	let {
		slot,
		index,
		readonly,
		caught,
		onpick,
		onclear,
		onremoveid
	}: {
		slot: TeamSlot;
		index: number;
		readonly: boolean;
		caught: { mine: string[]; group: Record<string, GroupUser[]> };
		onpick: (mode: 'pal' | 'active' | 'passive', index: number) => void;
		onclear: (index: number) => void;
		onremoveid: (kind: 'active' | 'passive', index: number, id: string) => void;
	} = $props();

	const SKILLS = skills as Record<string, { element?: string; power?: number; ct?: number }>;
	const ELEMENTS = new Map(
		(pals as Array<{ id: string; elements: string[] }>).map((p) => [p.id, p.elements])
	);

	const elements = $derived(slot ? (ELEMENTS.get(slot.palId) ?? []) : []);
	const mine = $derived(new Set(caught.mine));
</script>

{#if slot === null}
	<div class="empty">
		<p class="slot-num">{m.teams_slot_n({ n: index + 1 })}</p>
		<p class="empty-label">{m.teams_slot_empty()}</p>
		{#if !readonly}
			<button class="cta-white" onclick={() => onpick('pal', index)}>{m.teams_add_pal()}</button>
		{/if}
	</div>
{:else}
	<ElementHero {elements} variant="team" stripes={false}>
		{#snippet media()}
			<span class="portrait">
				{#if palIcon(slot.palId)}
					<img class:uncaught={!mine.has(slot.palId)} src={palIcon(slot.palId)} alt="" />
				{:else}
					<span class="no-icon" aria-hidden="true">?</span>
				{/if}
			</span>
		{/snippet}

		<div class="eyebrow" style={elVars(elements)}>
			{m.teams_slot_n({ n: index + 1 })} · {m.teams_partner_skill()} —
			<span class="ps">{gameName(partnerSkillNsId(slot.palId))}</span>
		</div>
		<h2>{gameName(`pal:${slot.palId}`)}</h2>
		<!-- Enveloppé : en `display: contents`, la racine du composant prendrait
		     sa propre cellule de grille et retomberait en colonne 1. -->
		<span class="avatars"><GroupAvatars users={caught.group[slot.palId] ?? []} /></span>

		<div class="rows">
			{#each slot.actives as sid (sid)}
				{@const sk = SKILLS[sid]}
				<div class="rowwrap">
					<AttackRow
						variant="hero"
						name={gameName(`skill:${sid}`)}
						power={sk?.power ?? 0}
						cooldown={sk?.ct}
						element={sk?.element ?? elements[0]}
					/>
					{#if !readonly}
						<button
							class="x"
							onclick={() => onremoveid('active', index, sid)}
							aria-label="{m.teams_delete()} — {gameName(`skill:${sid}`)}"
						>
							×
						</button>
					{/if}
				</div>
			{/each}
			{#if !readonly && slot.actives.length < 3}
				<button class="add" onclick={() => onpick('active', index)}>
					+ {m.teams_add_active()} <span class="count tnum">{slot.actives.length}/3</span>
				</button>
			{/if}
		</div>

		<div class="passives">
			<span class="plabel">
				{m.teams_passive_skills()}
				<span class="count tnum">{slot.passives.length}/4</span>
			</span>
			{#each slot.passives as pid (pid)}
				<span class="chip" class:high={passiveRank(pid) >= 4}>
					{gameName(`passive:${pid}`)}
					{#if !readonly}
						<button
							class="x"
							onclick={() => onremoveid('passive', index, pid)}
							aria-label="{m.teams_delete()} — {gameName(`passive:${pid}`)}"
						>
							×
						</button>
					{/if}
				</span>
			{/each}
			{#if !readonly && slot.passives.length < 4}
				<button class="add small" onclick={() => onpick('passive', index)}>
					+ {m.teams_add_passive()}
				</button>
			{/if}
		</div>

		{#if !readonly}
			<div class="actions">
				<button class="cta-white" onclick={() => onpick('pal', index)}>
					{m.teams_change_pal()}
				</button>
				<button class="cta-ghost" onclick={() => onclear(index)}>{m.teams_remove_pal()}</button>
			</div>
		{/if}
	</ElementHero>
{/if}

<style>
	.empty {
		display: grid;
		place-items: center;
		gap: 8px;
		padding: 48px 20px;
		text-align: center;
		background: #121318;
		border: 1.5px dashed rgba(255, 255, 255, 0.12);
		border-radius: 22px;
	}
	.slot-num {
		margin: 0;
		font: 10.5px ui-monospace, Menlo, monospace;
		color: rgba(255, 255, 255, 0.4);
	}
	.empty-label {
		margin: 0;
		color: #5c636e;
		font-size: 13px;
	}

	.portrait {
		display: grid;
		place-items: center;
		width: 100%;
		aspect-ratio: 1;
		border-radius: 18px;
		background: repeating-linear-gradient(
			45deg,
			rgba(255, 255, 255, 0.08) 0 14px,
			rgba(255, 255, 255, 0.02) 14px 28px
		);
	}
	.portrait img {
		width: 78%;
		height: 78%;
		object-fit: contain;
		filter: drop-shadow(0 16px 32px rgba(0, 0, 0, 0.5));
	}
	.portrait img.uncaught {
		filter: grayscale(1) opacity(0.45);
	}
	.no-icon {
		font-family: var(--font-display);
		font-size: 34px;
		font-weight: 800;
		color: rgba(255, 255, 255, 0.2);
	}

	.eyebrow {
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--el) 35%, white);
	}
	.ps {
		white-space: nowrap;
	}
	h2 {
		margin: 6px 0 14px;
		font-size: 40px;
		font-weight: 800;
		letter-spacing: -0.02em;
		color: #fff;
	}

	.rows {
		display: flex;
		flex-direction: column;
		gap: 7px;
		max-width: 440px;
	}
	/* La croix de retrait se superpose à la rangée : AttackRow ne connaît pas
	   l'édition, et lui passer un slot juste pour ça l'alourdirait. */
	.rowwrap {
		position: relative;
	}
	.rowwrap .x {
		position: absolute;
		right: 6px;
		top: 50%;
		transform: translateY(-50%);
		opacity: 0;
	}
	.rowwrap:hover .x,
	.rowwrap:focus-within .x {
		opacity: 1;
	}

	.x {
		width: 22px;
		height: 22px;
		padding: 0;
		display: grid;
		place-items: center;
		border-radius: 50%;
		border: none;
		background: rgba(0, 0, 0, 0.45);
		color: #fff;
		font-size: 14px;
		line-height: 1;
	}
	.x:hover {
		background: rgba(0, 0, 0, 0.7);
	}

	.add {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 9px 16px;
		border-radius: 999px;
		border: 1px dashed rgba(255, 255, 255, 0.28);
		background: rgba(0, 0, 0, 0.2);
		color: rgba(255, 255, 255, 0.85);
		font-size: 12.5px;
		font-weight: 600;
	}
	.add:hover {
		background: rgba(0, 0, 0, 0.35);
		border-color: rgba(255, 255, 255, 0.45);
	}
	.add.small {
		padding: 6px 12px;
		font-size: 11.5px;
	}
	.count {
		opacity: 0.6;
	}

	.passives {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 7px;
		margin-top: 16px;
		max-width: 440px;
	}
	.plabel {
		font-size: 10.5px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.55);
		width: 100%;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		background: rgba(0, 0, 0, 0.28);
		border-radius: 999px;
		padding: 6px 8px 6px 14px;
		font-size: 12px;
		color: #f1ecff;
	}
	.chip.high {
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.28);
	}
	.chip .x {
		width: 18px;
		height: 18px;
		font-size: 12px;
	}

	/* Colonne d'actions en haut à droite du héros (2b l.608). Détachée du flux :
	   côté balisage elle suit le texte, mais le dessin la veut en troisième
	   colonne. Le héros est `position: relative`. */
	.actions {
		position: absolute;
		top: 28px;
		right: 32px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		z-index: 1;
	}
	.cta-white,
	.cta-ghost {
		padding: 10px 20px;
		border-radius: 999px;
		font-size: 13px;
		text-align: center;
		white-space: nowrap;
		transition: transform var(--duration-hover) var(--ease-out-soft);
	}
	.cta-white {
		background: rgba(255, 255, 255, 0.92);
		color: #1a1024;
		border: none;
		font-weight: 700;
	}
	.cta-white:hover {
		background: #fff;
		transform: translateY(-2px);
	}
	.cta-ghost {
		background: none;
		border: 1px solid rgba(255, 255, 255, 0.35);
		color: #fff;
		font-weight: 600;
	}
	.cta-ghost:hover {
		background: rgba(255, 255, 255, 0.12);
	}

	@media (max-width: 1023.98px) {
		h2 {
			font-size: 27px;
			margin: 3px 0 0;
		}
		.eyebrow {
			font-size: 9.5px;
			letter-spacing: 0.13em;
		}
		.rows {
			margin-top: 16px;
			max-width: none;
		}
		.passives {
			max-width: none;
		}
		/* Actions en duo pleine largeur, remises dans le flux (4c l.273). */
		.actions {
			position: static;
			flex-direction: row;
			margin-top: 16px;
		}
		.cta-white,
		.cta-ghost {
			flex: 1;
			padding: 12px;
			font-size: 12.5px;
		}
		/* La croix reste visible : pas de survol au doigt. */
		.rowwrap .x {
			opacity: 1;
		}
	}
</style>
