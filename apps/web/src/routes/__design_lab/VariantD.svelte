<script lang="ts">
	import { gameName } from '$lib/game/names';
	import { palIcon } from '$lib/game/icons';
	import ElementBadge from '$lib/components/ElementBadge.svelte';
	import { TEAM, palElements, skillInfo, passiveRank, type FixtureSlot } from './fixtures';

	let selected = $state(0);
	const active = $derived(TEAM.slots[selected]);
</script>

{#snippet editor(slot: FixtureSlot, index: number)}
	{#if slot.palId}
		<div class="ed">
			<div class="ed-head">
				{#if palIcon(slot.palId)}
					<img src={palIcon(slot.palId)} alt="" width="56" height="56" loading="lazy" />
				{/if}
				<div class="ed-ident">
					<span class="ed-name">{gameName(`pal:${slot.palId}`)}</span>
					<span class="ed-els">
						{#each palElements(slot.palId) as el (el)}<ElementBadge element={el} />{/each}
					</span>
				</div>
				<button type="button">Changer de Pal…</button>
			</div>
			<p class="ed-partner">
				<span class="cap">Compétence partenaire</span>
				{gameName(`partnerskill:${slot.palId}`)}
			</p>
			<section>
				<h4 class="cap">Passifs · {slot.passives.length}/4</h4>
				<div class="chips">
					{#each slot.passives as p (p)}
						<span class="chip" class:r4={passiveRank(p) >= 4}>
							{gameName(`passive:${p}`)}
							<button class="x" type="button" aria-label="Retirer {gameName(`passive:${p}`)}">×</button>
						</span>
					{/each}
				</div>
			</section>
			<section>
				<h4 class="cap">Actifs · {slot.actives.length}/3</h4>
				<ul class="arows">
					{#each slot.actives as a (a)}
						{@const sk = skillInfo(a)}
						<li>
							<span class="a-name">{gameName(`skill:${a}`)}</span>
							{#if sk.element}<ElementBadge element={sk.element} />{/if}
							{#if sk.power}<span class="a-pw tnum">{sk.power}</span>{/if}
							<button class="swap" type="button">Changer</button>
						</li>
					{/each}
				</ul>
			</section>
		</div>
	{:else}
		<div class="ed ed-empty">
			<p class="e-title">Slot {index + 1} vide</p>
			<p class="e-sub">Choisis un Pal, ses 4 passifs et ses 3 actifs.</p>
			<button class="primary" type="button">Choisir un Pal…</button>
		</div>
	{/if}
{/snippet}

<div class="wrap">
	<header class="head">
		<input class="tname" type="text" value={TEAM.name} spellcheck="false" aria-label="Nom de l'équipe" />
		<textarea class="tnotes" rows="1" spellcheck="false" aria-label="Notes">{TEAM.notes}</textarea>
	</header>

	<div class="split">
		<nav class="list" aria-label="Slots">
			{#each TEAM.slots as s, i (i)}
				<button
					class="item"
					class:on={i === selected}
					onclick={() => (selected = i)}
					aria-current={i === selected}
				>
					<span class="i-num tnum">{i + 1}</span>
					{#if s.palId}
						{#if palIcon(s.palId)}
							<img src={palIcon(s.palId)} alt="" width="40" height="40" loading="lazy" />
						{/if}
						<span class="i-body">
							<span class="i-name">{gameName(`pal:${s.palId}`)}</span>
							<span class="i-dots">
								{#each palElements(s.palId) as el (el)}
									<span class="dot" style="--el: var(--el-{el.toLowerCase()}, var(--el-normal))"></span>
								{/each}
							</span>
						</span>
					{:else}
						<span class="i-plus" aria-hidden="true">+</span>
						<span class="i-body"><span class="i-name muted">Slot vide</span></span>
					{/if}
				</button>
				<!-- Accordéon mobile : l'éditeur s'ouvre sous le slot actif -->
				{#if i === selected}
					<div class="inline-ed">{@render editor(s, i)}</div>
				{/if}
			{/each}
		</nav>
		<div class="panel">
			{@render editor(active, selected)}
		</div>
	</div>

	<footer class="savebar">
		<span class="dirty">● Modifications non enregistrées</span>
		<span class="ro">Partagée en lecture seule avec le serveur</span>
		<button class="primary" type="button">Enregistrer l'équipe</button>
	</footer>
</div>

<style>
	.wrap {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.head {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.tname {
		font-family: var(--font-display);
		font-size: 18px;
		font-weight: 600;
	}
	.tnotes {
		font: inherit;
		font-size: 12px;
		color: var(--text-2);
		background: var(--input-bg);
		border: 1px solid var(--border);
		border-radius: var(--r-sm);
		padding: 6px 10px;
		resize: vertical;
	}
	.split {
		display: grid;
		grid-template-columns: 220px minmax(0, 1fr);
		gap: 10px;
		align-items: start;
	}
	.list {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.item {
		display: flex;
		align-items: center;
		gap: 8px;
		text-align: left;
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		padding: 8px 10px;
		min-height: 52px;
		transition: border-color 140ms, background 140ms;
	}
	.item:hover {
		background: var(--surface-2);
	}
	.item.on {
		border-color: color-mix(in srgb, var(--accent) 55%, transparent);
		background: color-mix(in srgb, var(--accent) 8%, var(--surface-1));
	}
	.i-num {
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 600;
		color: var(--text-4);
		width: 14px;
	}
	.item.on .i-num {
		color: var(--accent);
	}
	.i-plus {
		width: 40px;
		height: 40px;
		display: grid;
		place-items: center;
		color: var(--text-4);
		border: 1px dashed var(--border-strong);
		border-radius: 50%;
	}
	.i-body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.i-name {
		font-size: 13px;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.muted {
		color: var(--text-4);
	}
	.i-dots {
		display: flex;
		gap: 3px;
	}
	.dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--el);
	}
	.panel,
	.inline-ed {
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: var(--r-lg);
		padding: 14px;
	}
	.inline-ed {
		display: none;
	}
	.ed {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.ed-head {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}
	.ed-ident {
		flex: 1;
		min-width: 120px;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.ed-name {
		font-family: var(--font-display);
		font-size: 17px;
		font-weight: 600;
	}
	.ed-els {
		display: flex;
		gap: 4px;
	}
	.ed-partner {
		margin: 0;
		font-size: 13px;
		color: var(--text-2);
		display: flex;
		gap: 8px;
		align-items: baseline;
		border-left: 2px solid color-mix(in srgb, var(--accent) 55%, transparent);
		padding-left: 8px;
	}
	.cap {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-4);
		margin: 0;
		white-space: nowrap;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-top: 6px;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		font-size: 12px;
		color: var(--text-2);
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 999px;
		padding: 3px 4px 3px 10px;
	}
	.chip.r4 {
		color: var(--el-electricity);
		border-color: color-mix(in srgb, var(--el-electricity) 35%, transparent);
	}
	.x {
		background: none;
		border: none;
		color: var(--text-4);
		padding: 0 5px;
		font-size: 12px;
	}
	.x:hover {
		color: var(--text-1);
		background: var(--surface-3);
	}
	.arows {
		list-style: none;
		margin: 6px 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.arows li {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--r-sm);
		padding: 5px 6px 5px 10px;
	}
	.a-name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.a-pw {
		font-weight: 600;
		color: var(--text-2);
		font-size: 12px;
	}
	.swap {
		font-size: 11px;
		padding: 3px 8px;
	}
	.ed-empty {
		align-items: center;
		text-align: center;
		padding: 16px 0;
	}
	.e-title {
		margin: 0;
		font-family: var(--font-display);
		font-size: 15px;
		font-weight: 600;
	}
	.e-sub {
		margin: 0;
		color: var(--text-3);
		font-size: 12px;
	}
	.primary {
		background: var(--accent);
		color: var(--accent-ink);
		border-color: transparent;
		font-weight: 600;
		min-height: 36px;
	}
	.primary:hover {
		background: color-mix(in srgb, var(--accent) 85%, white);
	}
	.savebar {
		position: sticky;
		bottom: 8px;
		display: flex;
		align-items: center;
		gap: 10px;
		background: var(--surface-2);
		border: 1px solid var(--border-strong);
		border-radius: var(--r-md);
		padding: 8px 12px;
	}
	.dirty {
		font-size: 11px;
		color: var(--el-electricity);
	}
	.ro {
		flex: 1;
		font-size: 11px;
		color: var(--text-4);
		text-align: right;
	}
	@media (max-width: 700px) {
		.split {
			grid-template-columns: 1fr;
		}
		.panel {
			display: none;
		}
		.inline-ed {
			display: block;
			margin: -2px 0 4px;
		}
		.savebar {
			flex-wrap: wrap;
		}
		.ro {
			order: 3;
			text-align: left;
			width: 100%;
		}
	}
</style>
