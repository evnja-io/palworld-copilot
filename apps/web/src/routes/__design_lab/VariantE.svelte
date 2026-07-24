<script lang="ts">
	import { gameName } from '$lib/game/names';
	import { palIcon } from '$lib/game/icons';
	import ElementBadge from '$lib/components/ElementBadge.svelte';
	import { TEAM, palElements, skillInfo, passiveRank } from './fixtures';

	function halo(palId: string): string {
		const el = palElements(palId)[0]?.toLowerCase() ?? 'normal';
		return `--halo: var(--el-${el}, var(--el-normal))`;
	}
</script>

<div class="wrap">
	<header class="expedition">
		<div class="e-title">
			<span class="e-cap">Expédition · équipe du serveur</span>
			<h3 class="e-name">{TEAM.name}</h3>
			<p class="e-notes">{TEAM.notes}</p>
		</div>
		<div class="e-actions">
			<span class="dirty">● Modifications non enregistrées</span>
			<button class="save" type="button">Sceller l'équipe</button>
			<span class="ro">Les membres consultent en lecture seule</span>
		</div>
	</header>

	<div class="cards">
		{#each TEAM.slots as slot, i (i)}
			{#if slot.palId}
				<article class="card" style={halo(slot.palId)}>
					<span class="bignum" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
					<div class="stage">
						<span class="glow" aria-hidden="true"></span>
						{#if palIcon(slot.palId)}
							<img src={palIcon(slot.palId)} alt="" width="84" height="84" loading="lazy" />
						{/if}
					</div>
					<div class="ident">
						<span class="name">{gameName(`pal:${slot.palId}`)}</span>
						<span class="els">
							{#each palElements(slot.palId) as el (el)}<ElementBadge element={el} />{/each}
						</span>
					</div>
					<!-- Ruban partenaire : artefact du jeu -->
					<div class="ribbon">
						<span class="ribbon-cap">Partenaire</span>
						<span class="ribbon-name">{gameName(`partnerskill:${slot.palId}`)}</span>
					</div>
					<ul class="actives">
						{#each slot.actives as a (a)}
							{@const sk = skillInfo(a)}
							<li>
								<span class="a-name">{gameName(`skill:${a}`)}</span>
								{#if sk.element}<ElementBadge element={sk.element} />{/if}
								{#if sk.power}<span class="a-pw tnum">{sk.power}</span>{/if}
							</li>
						{/each}
					</ul>
					<p class="passives">
						{#each slot.passives as p, j (p)}
							{#if j > 0}<span class="sep">·</span>{/if}
							<span class:r4={passiveRank(p) >= 4}>{gameName(`passive:${p}`)}</span>
						{/each}
					</p>
				</article>
			{:else}
				<button class="card empty" type="button">
					<span class="bignum" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
					<span class="stage">
						<span class="empty-ring" aria-hidden="true">+</span>
					</span>
					<span class="name muted">Place libre</span>
					<span class="e-hint">Recruter un Pal pour l'expédition</span>
				</button>
			{/if}
		{/each}
	</div>
</div>

<style>
	.wrap {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.expedition {
		display: flex;
		gap: 16px;
		align-items: flex-start;
		justify-content: space-between;
		flex-wrap: wrap;
		background: linear-gradient(
			to bottom,
			color-mix(in srgb, var(--accent) 6%, var(--surface-1)),
			var(--surface-1)
		);
		border: 1px solid var(--border);
		border-radius: var(--r-lg);
		padding: 16px 18px;
	}
	.e-cap {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--accent);
	}
	.e-name {
		margin: 2px 0 4px;
		font-size: 22px;
		color: var(--text-1);
	}
	.e-notes {
		margin: 0;
		font-size: 12px;
		color: var(--text-3);
		max-width: 52ch;
		text-wrap: pretty;
	}
	.e-actions {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 6px;
	}
	.dirty {
		font-size: 11px;
		color: var(--el-electricity);
	}
	.save {
		background: var(--accent);
		color: var(--accent-ink);
		border-color: transparent;
		font-family: var(--font-display);
		font-weight: 600;
		padding: 8px 18px;
		min-height: 36px;
	}
	.save:hover {
		background: color-mix(in srgb, var(--accent) 85%, white);
	}
	.ro {
		font-size: 10px;
		color: var(--text-4);
	}
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 10px;
	}
	.card {
		position: relative;
		overflow: clip;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: var(--r-lg);
		padding: 18px 14px 14px;
		transition: border-color 140ms cubic-bezier(0.23, 1, 0.32, 1);
	}
	.card:hover {
		border-color: color-mix(in srgb, var(--halo, var(--accent)) 40%, transparent);
	}
	.bignum {
		position: absolute;
		top: 6px;
		right: 12px;
		font-family: var(--font-display);
		font-size: 34px;
		font-weight: 700;
		letter-spacing: -0.04em;
		color: color-mix(in srgb, var(--text-4) 45%, transparent);
	}
	.stage {
		position: relative;
		width: 108px;
		height: 96px;
		display: grid;
		place-items: center;
	}
	.glow {
		position: absolute;
		inset: 0;
		border-radius: 50%;
		background: radial-gradient(
			closest-side,
			color-mix(in srgb, var(--halo, var(--accent)) 26%, transparent),
			transparent
		);
	}
	.stage img {
		position: relative;
	}
	.ident {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
	}
	.name {
		font-family: var(--font-display);
		font-size: 17px;
		font-weight: 600;
	}
	.muted {
		color: var(--text-4);
	}
	.els {
		display: flex;
		gap: 4px;
	}
	.ribbon {
		align-self: stretch;
		display: flex;
		align-items: baseline;
		gap: 8px;
		background: color-mix(in srgb, var(--halo, var(--accent)) 9%, var(--surface-2));
		border: 1px solid color-mix(in srgb, var(--halo, var(--accent)) 28%, transparent);
		border-radius: var(--r-sm);
		padding: 6px 10px;
		font-size: 12px;
		color: var(--text-1);
	}
	.ribbon-cap {
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--halo, var(--accent)) 80%, var(--text-2));
		white-space: nowrap;
	}
	.ribbon-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.actives {
		list-style: none;
		margin: 0;
		padding: 0;
		align-self: stretch;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.actives li {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		padding: 3px 2px;
		border-top: 1px solid var(--border);
	}
	.a-name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.a-pw {
		font-family: var(--font-display);
		font-weight: 600;
		color: var(--text-2);
	}
	.passives {
		margin: 0;
		align-self: stretch;
		font-size: 11px;
		color: var(--text-3);
		border-top: 1px solid var(--border);
		padding-top: 6px;
		text-align: center;
		text-wrap: balance;
	}
	.sep {
		color: var(--text-4);
		margin: 0 3px;
	}
	.r4 {
		color: var(--el-electricity);
	}
	.card.empty {
		cursor: pointer;
		border-style: dashed;
		background: none;
		color: var(--text-3);
		min-height: 220px;
		justify-content: center;
	}
	.card.empty:hover {
		border-color: color-mix(in srgb, var(--accent) 45%, transparent);
		color: var(--text-2);
	}
	.empty-ring {
		width: 64px;
		height: 64px;
		display: grid;
		place-items: center;
		font-size: 24px;
		color: var(--text-4);
		border: 1px dashed var(--border-strong);
		border-radius: 50%;
	}
	.e-hint {
		font-size: 11px;
		color: var(--text-4);
	}
	@media (max-width: 560px) {
		.cards {
			grid-template-columns: 1fr;
		}
		.e-actions {
			align-items: flex-start;
		}
	}
</style>
