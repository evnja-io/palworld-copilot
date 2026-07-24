<script lang="ts">
	import { gameName } from '$lib/game/names';
	import { palIcon } from '$lib/game/icons';
	import ElementBadge from '$lib/components/ElementBadge.svelte';
	import { TEAM, palElements, skillInfo, passiveRank } from './fixtures';

	// Couverture élémentaire agrégée (offensive : éléments des actifs).
	const coverage = $derived.by(() => {
		const els: Record<string, number> = {};
		for (const s of TEAM.slots) {
			for (const a of s.actives) {
				const el = skillInfo(a).element;
				if (el) els[el] = (els[el] ?? 0) + 1;
			}
		}
		return Object.entries(els).sort((x, y) => y[1] - x[1]);
	});

	const totalPower = $derived(
		TEAM.slots.flatMap((s) => s.actives).reduce((sum, a) => sum + (skillInfo(a).power ?? 0), 0)
	);
</script>

<div class="wrap">
	<header class="bar">
		<div class="left">
			<h3 class="tname">{TEAM.name}</h3>
			<div class="cov">
				<span class="cap">Couverture</span>
				{#each coverage as [el, n] (el)}
					<span class="cov-item"><ElementBadge element={el} /><span class="tnum">×{n}</span></span>
				{/each}
				<span class="cap sep">Σ puissance</span>
				<span class="tnum total">{totalPower}</span>
			</div>
		</div>
		<div class="right">
			<span class="dirty">● Modifications non enregistrées</span>
			<button class="save" type="button">Enregistrer</button>
		</div>
	</header>

	<div class="grid">
		{#each TEAM.slots as slot, i (i)}
			{#if slot.palId}
				<article class="cell">
					<div class="c-head">
						{#if palIcon(slot.palId)}
							<img src={palIcon(slot.palId)} alt="" width="40" height="40" loading="lazy" />
						{/if}
						<div class="c-ident">
							<span class="c-name">{gameName(`pal:${slot.palId}`)}</span>
							<span class="c-els">
								{#each palElements(slot.palId) as el (el)}<ElementBadge element={el} />{/each}
							</span>
						</div>
						<span class="c-num tnum">{i + 1}</span>
					</div>
					<p class="c-partner">{gameName(`partnerskill:${slot.palId}`)}</p>
					<table class="atable">
						<tbody>
							{#each slot.actives as a (a)}
								{@const sk = skillInfo(a)}
								<tr>
									<td class="t-name">{gameName(`skill:${a}`)}</td>
									<td class="t-el">
										{#if sk.element}<ElementBadge element={sk.element} />{/if}
									</td>
									<td class="t-pw tnum">{sk.power ?? '—'}</td>
									<td class="t-ct tnum">{sk.ct ? `${sk.ct}s` : '—'}</td>
								</tr>
							{/each}
						</tbody>
					</table>
					<p class="c-passives">
						{#each slot.passives as p, j (p)}
							{#if j > 0}<span class="dot">·</span>{/if}
							<span class:r4={passiveRank(p) >= 4}>{gameName(`passive:${p}`)}</span>
						{/each}
					</p>
				</article>
			{:else}
				<button class="cell empty" type="button">
					<span class="plus" aria-hidden="true">+</span>
					<span class="e-lbl">Slot {i + 1} vide — ajouter un Pal</span>
				</button>
			{/if}
		{/each}
		<aside class="cell note">
			<span class="cap">Note</span>
			<p>{TEAM.notes}</p>
			<p class="ro">Les membres du serveur voient cette planche en lecture seule.</p>
		</aside>
	</div>
</div>

<style>
	.wrap {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.bar {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}
	.tname {
		margin: 0 0 4px;
		font-size: 16px;
		color: var(--text-1);
	}
	.cov {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
	}
	.cap {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-4);
	}
	.sep {
		margin-left: 8px;
	}
	.cov-item {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		font-size: 11px;
		color: var(--text-3);
	}
	.total {
		font-family: var(--font-display);
		font-weight: 600;
		color: var(--text-1);
		font-size: 14px;
	}
	.right {
		display: flex;
		align-items: center;
		gap: 10px;
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
		min-height: 36px;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 8px;
	}
	.cell {
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: var(--r-sm);
		padding: 10px 12px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
	}
	.c-head {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.c-ident {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.c-name {
		font-family: var(--font-display);
		font-size: 13px;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.c-els {
		display: flex;
		gap: 3px;
	}
	.c-num {
		font-family: var(--font-display);
		font-size: 12px;
		font-weight: 600;
		color: var(--text-4);
		align-self: flex-start;
	}
	.c-partner {
		margin: 0;
		font-size: 11px;
		color: var(--text-3);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.atable {
		width: 100%;
		border-collapse: collapse;
		font-size: 12px;
	}
	.atable td {
		padding: 3px 0;
		border-top: 1px solid var(--border);
	}
	.t-name {
		color: var(--text-1);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 0;
		width: 60%;
		padding-right: 6px;
	}
	.t-el {
		width: 20%;
	}
	.t-pw {
		text-align: right;
		font-weight: 600;
		color: var(--text-2);
		width: 12%;
	}
	.t-ct {
		text-align: right;
		color: var(--text-4);
		font-size: 11px;
		width: 8%;
		padding-left: 6px;
	}
	.c-passives {
		margin: 0;
		font-size: 11px;
		color: var(--text-3);
		border-top: 1px solid var(--border);
		padding-top: 5px;
	}
	.dot {
		color: var(--text-4);
		margin: 0 3px;
	}
	.r4 {
		color: var(--el-electricity);
	}
	.cell.empty {
		align-items: center;
		justify-content: center;
		border-style: dashed;
		background: none;
		color: var(--text-3);
		cursor: pointer;
		min-height: 120px;
		gap: 6px;
	}
	.cell.empty:hover {
		border-color: color-mix(in srgb, var(--accent) 45%, transparent);
		color: var(--text-2);
	}
	.plus {
		font-size: 20px;
	}
	.e-lbl {
		font-size: 12px;
	}
	.note p {
		margin: 0;
		font-size: 12px;
		color: var(--text-2);
		text-wrap: pretty;
	}
	.ro {
		color: var(--text-4);
		font-size: 11px;
	}
	@media (max-width: 900px) {
		.grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (max-width: 560px) {
		.grid {
			grid-template-columns: 1fr;
		}
	}
</style>
