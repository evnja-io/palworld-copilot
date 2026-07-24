<script lang="ts">
	import { gameName } from '$lib/game/names';
	import { palIcon } from '$lib/game/icons';
	import ElementBadge from '$lib/components/ElementBadge.svelte';
	import { TEAM, palElements, skillInfo, passiveRank } from './fixtures';
</script>

<div class="wrap">
	<!-- Bandeau d'équipe -->
	<header class="band">
		<div class="ident">
			<label class="field">
				<span class="lbl">Nom de l'équipe</span>
				<input type="text" value={TEAM.name} spellcheck="false" />
			</label>
			<label class="field">
				<span class="lbl">Notes</span>
				<textarea rows="2" spellcheck="false">{TEAM.notes}</textarea>
			</label>
			<p class="meta">
				Par <strong>{TEAM.author}</strong> · modifiée {TEAM.updatedAt} ·
				<span class="ro-hint">visible en lecture seule par le serveur</span>
			</p>
		</div>
		<div class="actions">
			<span class="dirty">● Modifications non enregistrées</span>
			<button class="save" type="button">Enregistrer l'équipe</button>
		</div>
	</header>

	<!-- 5 cartes de slot en colonne -->
	<ol class="slots">
		{#each TEAM.slots as slot, i (i)}
			<li>
				{#if slot.palId}
					<article class="slot">
						<div class="portrait">
							{#if palIcon(slot.palId)}
								<img src={palIcon(slot.palId)} alt="" width="72" height="72" loading="lazy" />
							{/if}
						</div>
						<div class="body">
							<div class="head">
								<span class="num tnum">Slot {i + 1}</span>
								<span class="name">{gameName(`pal:${slot.palId}`)}</span>
								{#each palElements(slot.palId) as el (el)}<ElementBadge element={el} />{/each}
							</div>
							<p class="partner">
								<span class="partner-lbl">Compétence partenaire</span>
								{gameName(`partnerskill:${slot.palId}`)}
							</p>
							<div class="group">
								<span class="glbl">Passifs</span>
								<span class="chips">
									{#each slot.passives as p (p)}
										<span class="chip" class:r4={passiveRank(p) >= 4}>{gameName(`passive:${p}`)}</span>
									{/each}
								</span>
							</div>
							<div class="group">
								<span class="glbl">Actifs</span>
								<span class="chips">
									{#each slot.actives as a (a)}
										{@const sk = skillInfo(a)}
										<span class="chip active-chip">
											{gameName(`skill:${a}`)}
											{#if sk.element}<ElementBadge element={sk.element} />{/if}
											{#if sk.power}<span class="pw tnum">{sk.power}</span>{/if}
										</span>
									{/each}
								</span>
							</div>
						</div>
					</article>
				{:else}
					<button class="slot empty" type="button">
						<span class="plus" aria-hidden="true">+</span>
						<span>
							<span class="empty-title">Slot {i + 1} — vide</span>
							<span class="empty-sub">Choisir un Pal (⌘K pour la palette)</span>
						</span>
					</button>
				{/if}
			</li>
		{/each}
	</ol>
</div>

<style>
	.wrap {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.band {
		display: flex;
		gap: 16px;
		align-items: flex-start;
		flex-wrap: wrap;
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: var(--r-lg);
		padding: 16px;
	}
	.ident {
		flex: 1;
		min-width: 240px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.lbl {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-3);
	}
	.field input {
		font-family: var(--font-display);
		font-size: 18px;
		font-weight: 600;
	}
	.field textarea {
		font: inherit;
		font-size: 13px;
		color: var(--text-2);
		background: var(--input-bg);
		border: 1px solid var(--border);
		border-radius: var(--r-sm);
		padding: 6px 10px;
		resize: vertical;
	}
	.meta {
		margin: 0;
		font-size: 12px;
		color: var(--text-3);
	}
	.ro-hint {
		color: var(--text-4);
	}
	.actions {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 8px;
	}
	.dirty {
		font-size: 11px;
		color: var(--el-electricity);
	}
	.save {
		background: var(--accent);
		color: var(--accent-ink);
		border-color: transparent;
		font-weight: 600;
		padding: 8px 16px;
		min-height: 36px;
	}
	.save:hover {
		background: color-mix(in srgb, var(--accent) 85%, white);
	}
	.slots {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.slot {
		display: flex;
		gap: 14px;
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		padding: 12px 14px;
		transition: border-color 140ms;
	}
	.slot:hover {
		border-color: var(--border-strong);
	}
	.portrait {
		flex-shrink: 0;
		width: 72px;
		height: 72px;
		display: grid;
		place-items: center;
		background: var(--surface-2);
		border-radius: var(--r-sm);
	}
	.body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.head {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}
	.num {
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-4);
	}
	.name {
		font-family: var(--font-display);
		font-size: 16px;
		font-weight: 600;
	}
	.partner {
		margin: 0;
		font-size: 12px;
		color: var(--text-2);
		display: flex;
		align-items: baseline;
		gap: 8px;
		border-left: 2px solid color-mix(in srgb, var(--accent) 55%, transparent);
		padding-left: 8px;
	}
	.partner-lbl {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-4);
		white-space: nowrap;
	}
	.group {
		display: flex;
		align-items: baseline;
		gap: 10px;
	}
	.glbl {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-4);
		width: 46px;
		flex-shrink: 0;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--text-2);
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 999px;
		padding: 2px 9px;
	}
	.chip.r4 {
		color: var(--el-electricity);
		border-color: color-mix(in srgb, var(--el-electricity) 35%, transparent);
	}
	.pw {
		color: var(--text-3);
		font-size: 11px;
		font-weight: 600;
	}
	.slot.empty {
		align-items: center;
		justify-content: flex-start;
		border-style: dashed;
		background: none;
		color: var(--text-3);
		cursor: pointer;
		min-height: 72px;
		text-align: left;
	}
	.slot.empty:hover {
		border-color: color-mix(in srgb, var(--accent) 45%, transparent);
		color: var(--text-2);
	}
	.plus {
		width: 40px;
		height: 40px;
		display: grid;
		place-items: center;
		font-size: 20px;
		border: 1px dashed var(--border-strong);
		border-radius: 50%;
	}
	.empty-title {
		display: block;
		font-weight: 500;
		font-size: 13px;
	}
	.empty-sub {
		display: block;
		font-size: 11px;
		color: var(--text-4);
	}
	@media (max-width: 700px) {
		.actions {
			flex-direction: row;
			align-items: center;
			width: 100%;
			justify-content: space-between;
		}
		.slot {
			flex-direction: column;
			gap: 10px;
		}
		.group {
			flex-direction: column;
			gap: 3px;
		}
		.glbl {
			width: auto;
		}
	}
</style>
