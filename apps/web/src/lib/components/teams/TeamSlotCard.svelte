<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { gameName } from '$lib/game/names';
	import { palIcon } from '$lib/game/icons';
	import { partnerSkillNsId, passiveRank } from '$lib/game/team-data';
	import ElementBadge from '$lib/components/ElementBadge.svelte';
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

<div class="detail">
	{#if slot === null}
		<div class="empty">
			<p class="slot-num">#<span class="tnum">{index + 1}</span></p>
			<p class="empty-label">{m.teams_slot_empty()}</p>
			{#if !readonly}
				<button class="primary" onclick={() => onpick('pal', index)}>{m.teams_add_pal()}</button>
			{/if}
		</div>
	{:else}
		<header class="head">
			{#if palIcon(slot.palId)}
				<img
					class="portrait"
					class:uncaught={!mine.has(slot.palId)}
					src={palIcon(slot.palId)}
					alt=""
					width="88"
					height="88"
				/>
			{:else}
				<span class="no-icon" aria-hidden="true">?</span>
			{/if}
			<div class="id">
				<p class="slot-num">#<span class="tnum">{index + 1}</span></p>
				<p class="name">{gameName(`pal:${slot.palId}`)}</p>
				<div class="tags">
					{#each elements as el (el)}<ElementBadge element={el} />{/each}
					<GroupAvatars users={caught.group[slot.palId] ?? []} />
				</div>
			</div>
			{#if !readonly}
				<div class="actions">
					<button onclick={() => onpick('pal', index)}>{m.teams_change_pal()}</button>
					<button class="danger" onclick={() => onclear(index)}>{m.teams_remove_pal()}</button>
				</div>
			{/if}
		</header>

		<p class="partner">
			<span class="partner-label">{m.teams_partner_skill()}</span>
			<span class="partner-name">{gameName(partnerSkillNsId(slot.palId))}</span>
		</p>

		<div class="cols">
			<section>
				<h3 class="col-title">
					{m.teams_passive_skills()}
					<span class="count tnum">{slot.passives.length}/4</span>
				</h3>
				{#if slot.passives.length}
					<ul class="chips">
						{#each slot.passives as pid (pid)}
							<li class="chip" class:high={passiveRank(pid) >= 4}>
								<span class="chip-name">{gameName(`passive:${pid}`)}</span>
								{#if !readonly}
									<button
										class="x"
										onclick={() => onremoveid('passive', index, pid)}
										aria-label="{m.teams_delete()} — {gameName(`passive:${pid}`)}"
									>
										×
									</button>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
				{#if !readonly && slot.passives.length < 4}
					<button class="add" onclick={() => onpick('passive', index)}>
						+ {m.teams_add_passive()}
					</button>
				{/if}
			</section>

			<section>
				<h3 class="col-title">
					{m.teams_active_skills()}
					<span class="count tnum">{slot.actives.length}/3</span>
				</h3>
				{#if slot.actives.length}
					<ul class="moves">
						{#each slot.actives as sid (sid)}
							{@const sk = SKILLS[sid]}
							<li class="move">
								<span class="move-name">{gameName(`skill:${sid}`)}</span>
								{#if sk?.element}<ElementBadge element={sk.element} />{/if}
								{#if sk?.power}<span class="muted tnum">💥 {sk.power}</span>{/if}
								{#if sk?.ct}<span class="muted tnum">⏱ {sk.ct}s</span>{/if}
								{#if !readonly}
									<button
										class="x"
										onclick={() => onremoveid('active', index, sid)}
										aria-label="{m.teams_delete()} — {gameName(`skill:${sid}`)}"
									>
										×
									</button>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
				{#if !readonly && slot.actives.length < 3}
					<button class="add" onclick={() => onpick('active', index)}>
						+ {m.teams_add_active()}
					</button>
				{/if}
			</section>
		</div>
	{/if}
</div>

<style>
	.detail {
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: var(--r-lg);
		padding: 16px;
	}
	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 28px 0;
	}
	.slot-num {
		margin: 0;
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.08em;
		color: var(--text-4);
		text-transform: uppercase;
	}
	.empty-label {
		margin: 0;
		color: var(--text-3);
	}
	.primary {
		background: var(--accent);
		color: var(--accent-ink);
		border-color: transparent;
		font-weight: 600;
		min-height: 44px;
		padding: 8px 18px;
	}
	.primary:hover {
		background: color-mix(in srgb, var(--accent) 85%, white);
		border-color: transparent;
	}
	.head {
		display: flex;
		align-items: flex-start;
		gap: 14px;
		flex-wrap: wrap;
	}
	.portrait {
		border-radius: var(--r-md);
		background: var(--surface-2);
		/* Signature Paldex : non capturé = désaturé. */
		flex-shrink: 0;
	}
	.portrait.uncaught {
		filter: grayscale(1) opacity(0.45);
	}
	.no-icon {
		width: 88px;
		height: 88px;
		flex-shrink: 0;
		display: grid;
		place-items: center;
		font-size: 24px;
		color: var(--text-4);
		background: var(--surface-2);
		border-radius: var(--r-md);
	}
	.id {
		flex: 1;
		min-width: 140px;
	}
	.name {
		margin: 2px 0 6px;
		font-family: var(--font-display);
		font-size: 20px;
		font-weight: 600;
		letter-spacing: -0.02em;
	}
	.tags {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
	}
	.actions {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	.actions button {
		min-height: 44px;
	}
	.danger {
		color: var(--el-fire);
		border-color: color-mix(in srgb, var(--el-fire) 30%, transparent);
	}
	.danger:hover {
		background: color-mix(in srgb, var(--el-fire) 12%, var(--surface-2));
		border-color: color-mix(in srgb, var(--el-fire) 45%, transparent);
	}
	.partner {
		display: flex;
		align-items: baseline;
		gap: 10px;
		flex-wrap: wrap;
		margin: 14px 0 0;
		padding: 8px 12px;
		background: color-mix(in srgb, var(--accent) 6%, var(--surface-2));
		border: 1px solid color-mix(in srgb, var(--accent) 20%, transparent);
		border-radius: var(--r-md);
	}
	.partner-label {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--accent);
	}
	.partner-name {
		font-size: 13px;
		color: var(--text-1);
	}
	.cols {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
		margin-top: 16px;
	}
	@media (max-width: 700px) {
		.cols {
			grid-template-columns: 1fr;
		}
	}
	.col-title {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
		margin: 0 0 8px;
	}
	.count {
		font-size: 11px;
		color: var(--text-4);
	}
	.chips {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 999px;
		padding: 4px 10px;
		font-size: 12px;
		color: var(--text-2);
	}
	.chip.high {
		color: var(--el-electricity);
		border-color: color-mix(in srgb, var(--el-electricity) 35%, transparent);
		background: color-mix(in srgb, var(--el-electricity) 10%, var(--surface-2));
	}
	.x {
		background: none;
		border: none;
		padding: 2px 4px;
		margin: -2px -4px -2px 0;
		font-size: 13px;
		line-height: 1;
		color: var(--text-3);
	}
	.x:hover {
		background: none;
		color: var(--el-fire);
		border: none;
	}
	.moves {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.move {
		display: flex;
		align-items: center;
		gap: 8px;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		padding: 7px 10px;
		font-size: 13px;
	}
	.move-name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.muted {
		color: var(--text-3);
		font-size: 11px;
		white-space: nowrap;
	}
	.add {
		margin-top: 8px;
		width: 100%;
		min-height: 44px;
		background: none;
		border: 1px dashed var(--border-strong);
		color: var(--text-3);
	}
	.add:hover {
		background: var(--surface-2);
		color: var(--text-2);
		border-color: color-mix(in srgb, var(--accent) 40%, transparent);
		border-style: dashed;
	}
</style>
