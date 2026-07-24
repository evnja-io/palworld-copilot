<script lang="ts">
	import { gameName } from '$lib/game/names';
	import { palIcon } from '$lib/game/icons';
	import ElementBadge from '$lib/components/ElementBadge.svelte';
	import { TEAM, palElements, skillInfo, passiveRank } from './fixtures';

	let selected = $state(0);
	const slot = $derived(TEAM.slots[selected]);
</script>

<div class="wrap">
	<header class="topbar">
		<div class="title">
			<h3 class="tname">{TEAM.name}</h3>
			<span class="meta">par {TEAM.author} · lecture seule pour les autres membres</span>
		</div>
		<span class="dirty">● Modifications non enregistrées</span>
		<button class="save" type="button">Enregistrer</button>
	</header>

	<!-- Banc : 5 portraits en vedette -->
	<div class="bench" role="tablist" aria-label="Slots de l'équipe">
		{#each TEAM.slots as s, i (i)}
			<button
				class="seat"
				class:on={i === selected}
				role="tab"
				aria-selected={i === selected}
				onclick={() => (selected = i)}
			>
				<span class="seat-num tnum">{i + 1}</span>
				{#if s.palId}
					<span class="seat-portrait">
						{#if palIcon(s.palId)}
							<img src={palIcon(s.palId)} alt="" width="64" height="64" loading="lazy" />
						{/if}
					</span>
					<span class="seat-name">{gameName(`pal:${s.palId}`)}</span>
					<span class="seat-els">
						{#each palElements(s.palId) as el (el)}<ElementBadge element={el} />{/each}
					</span>
				{:else}
					<span class="seat-portrait empty-p" aria-hidden="true">+</span>
					<span class="seat-name muted">Vide</span>
					<span class="seat-els"><span class="ghost">choisir</span></span>
				{/if}
			</button>
		{/each}
	</div>

	<!-- Panneau du slot sélectionné -->
	<div class="detail" role="tabpanel">
		{#if slot.palId}
			<div class="d-head">
				<div class="d-portrait">
					{#if palIcon(slot.palId)}
						<img src={palIcon(slot.palId)} alt="" width="88" height="88" loading="lazy" />
					{/if}
				</div>
				<div class="d-ident">
					<span class="d-slot tnum">Slot {selected + 1}</span>
					<span class="d-name">{gameName(`pal:${slot.palId}`)}</span>
					<div class="d-els">
						{#each palElements(slot.palId) as el (el)}<ElementBadge element={el} />{/each}
					</div>
					<p class="d-partner">
						<span class="cap">Partenaire</span>
						{gameName(`partnerskill:${slot.palId}`)}
					</p>
				</div>
				<div class="d-actions">
					<button type="button">Remplacer</button>
					<button type="button" class="danger">Retirer</button>
				</div>
			</div>
			<div class="d-cols">
				<section>
					<h4 class="cap">Passifs · {slot.passives.length}/4</h4>
					<ul class="plist">
						{#each slot.passives as p (p)}
							<li class:r4={passiveRank(p) >= 4}>
								{gameName(`passive:${p}`)}
								<button class="mini" type="button" aria-label="Retirer le passif">×</button>
							</li>
						{/each}
					</ul>
				</section>
				<section>
					<h4 class="cap">Actifs · {slot.actives.length}/3</h4>
					<ul class="alist">
						{#each slot.actives as a (a)}
							{@const sk = skillInfo(a)}
							<li>
								<span class="a-name">{gameName(`skill:${a}`)}</span>
								{#if sk.element}<ElementBadge element={sk.element} />{/if}
								{#if sk.power}<span class="a-pw tnum">{sk.power}</span>{/if}
								{#if sk.ct}<span class="a-ct tnum">{sk.ct}s</span>{/if}
							</li>
						{/each}
					</ul>
				</section>
			</div>
		{:else}
			<div class="d-empty">
				<p class="d-empty-title">Slot {selected + 1} vide</p>
				<p class="d-empty-sub">Ajoute un Pal pour compléter l'équipe.</p>
				<button class="save" type="button">Choisir un Pal…</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.wrap {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.topbar {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}
	.title {
		flex: 1;
		min-width: 180px;
	}
	.tname {
		margin: 0;
		font-size: 17px;
		color: var(--text-1);
	}
	.meta {
		font-size: 11px;
		color: var(--text-4);
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
	.save:hover {
		background: color-mix(in srgb, var(--accent) 85%, white);
	}
	.bench {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 8px;
	}
	.seat {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 14px 6px 10px;
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		min-height: 132px;
		transition: border-color 140ms, background 140ms;
	}
	.seat:hover {
		background: var(--surface-2);
	}
	.seat.on {
		border-color: color-mix(in srgb, var(--accent) 55%, transparent);
		background: color-mix(in srgb, var(--accent) 8%, var(--surface-1));
	}
	.seat-num {
		position: absolute;
		top: 6px;
		left: 8px;
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 600;
		color: var(--text-4);
	}
	.seat.on .seat-num {
		color: var(--accent);
	}
	.seat-portrait {
		width: 64px;
		height: 64px;
		display: grid;
		place-items: center;
	}
	.empty-p {
		font-size: 22px;
		color: var(--text-4);
		border: 1px dashed var(--border-strong);
		border-radius: 50%;
	}
	.seat-name {
		font-size: 12px;
		font-weight: 500;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.muted {
		color: var(--text-4);
	}
	.ghost {
		font-size: 10px;
		color: var(--text-4);
	}
	.seat-els {
		display: flex;
		gap: 3px;
	}
	.detail {
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: var(--r-lg);
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.d-head {
		display: flex;
		gap: 14px;
		align-items: flex-start;
		flex-wrap: wrap;
	}
	.d-portrait {
		width: 88px;
		height: 88px;
		display: grid;
		place-items: center;
		background: var(--surface-2);
		border-radius: var(--r-md);
		flex-shrink: 0;
	}
	.d-ident {
		flex: 1;
		min-width: 160px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.d-slot {
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-4);
	}
	.d-name {
		font-family: var(--font-display);
		font-size: 20px;
		font-weight: 600;
	}
	.d-els {
		display: flex;
		gap: 4px;
	}
	.d-partner {
		margin: 4px 0 0;
		font-size: 13px;
		color: var(--text-2);
		display: flex;
		gap: 8px;
		align-items: baseline;
	}
	.cap {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-4);
		margin: 0;
	}
	.d-actions {
		display: flex;
		gap: 6px;
	}
	.danger {
		color: var(--el-fire);
		border-color: color-mix(in srgb, var(--el-fire) 30%, transparent);
	}
	.d-cols {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
	}
	.plist,
	.alist {
		list-style: none;
		margin: 6px 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.plist li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		font-size: 13px;
		color: var(--text-2);
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--r-sm);
		padding: 6px 10px;
	}
	.plist li.r4 {
		color: var(--el-electricity);
	}
	.mini {
		background: none;
		border: none;
		color: var(--text-4);
		padding: 2px 6px;
		font-size: 13px;
	}
	.mini:hover {
		color: var(--text-1);
		background: var(--surface-3);
	}
	.alist li {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--r-sm);
		padding: 6px 10px;
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
	.a-ct {
		color: var(--text-4);
		font-size: 11px;
	}
	.d-empty {
		text-align: center;
		padding: 24px 0;
	}
	.d-empty-title {
		margin: 0;
		font-family: var(--font-display);
		font-size: 16px;
		font-weight: 600;
	}
	.d-empty-sub {
		margin: 4px 0 12px;
		color: var(--text-3);
		font-size: 13px;
	}
	@media (max-width: 700px) {
		.bench {
			grid-template-columns: repeat(5, minmax(76px, 1fr));
			overflow-x: auto;
			padding-bottom: 4px;
		}
		.seat-name {
			font-size: 10px;
		}
		.d-cols {
			grid-template-columns: 1fr;
		}
	}
</style>
