<script lang="ts">
	import posthog from 'posthog-js';
	import pals from '@palworld-companion/game-data/pals.json';
	import { m } from '$lib/paraglide/messages';
	import { gameDesc, gameName } from '$lib/game/names';
	import { palIcon } from '$lib/game/icons';
	import { appHref } from '$lib/nav';
	import { childOf, parentsOf, breedingPath, uniqueComboList } from '$lib/game/breeding';
	import { passiveUnion, pInheritSubset } from '$lib/game/passives';
	// Import de types uniquement : effacé à la compilation, aucun code serveur embarqué.
	import type { PalInstance, PalOwner } from '$lib/server/pals';

	let { data } = $props();

	const owners = $derived(data.owners as PalOwner[]);

	type Mode = 'calc' | 'parents' | 'path' | 'index';
	let mode = $state<Mode>('calc');
	const MODES: Array<{ id: Mode; label: () => string }> = [
		{ id: 'calc', label: m.breeding_tab_calc },
		{ id: 'parents', label: m.breeding_tab_parents },
		{ id: 'path', label: m.breeding_tab_path },
		{ id: 'index', label: m.breeding_tab_index }
	];

	// Tous les pals triés par nom localisé (sélecteurs cible / partenaires).
	const sortedPals = [...pals].sort((a, b) =>
		gameName(`pal:${a.id}`).localeCompare(gameName(`pal:${b.id}`))
	);

	// Portée de « possédé » pour les vues path/parents/index : mes Pals ou tout
	// le serveur (le mode calc a déjà ses sélecteurs de membre explicites).
	// myGuid vient du layout (membership) ; null tant que le GUID n'est pas revendiqué.
	const myGuid = $derived(data.membership?.palPlayerGuid ?? null);
	let scope = $state<'mine' | 'server'>('mine');
	const scopedSpecies = $derived(
		new Set(
			owners
				.filter((o) => scope === 'server' || o.guid === myGuid)
				.flatMap((o) => o.instances.map((i) => i.palId))
		)
	);

	// ---- Mode calc : deux instances parentes -> enfant + probabilités de passifs.
	let guidA = $state('');
	let instA = $state('');
	let guidB = $state('');
	let instB = $state('');

	function instanceOf(guid: string, instanceId: string): PalInstance | null {
		return (
			owners.find((o) => o.guid === guid)?.instances.find((i) => i.instanceId === instanceId) ??
			null
		);
	}
	const palA = $derived(instanceOf(guidA, instA));
	const palB = $derived(instanceOf(guidB, instB));
	const child = $derived(palA && palB ? childOf(palA.palId, palB.palId) : null);
	$effect(() => {
		if (child) {
			posthog.capture('breeding_calculated', { parent_a: palA?.palId, parent_b: palB?.palId, child_species: child });
		}
	});
	// Avertissement non bloquant : il faut exactement un mâle + une femelle.
	const genderOk = $derived(
		!!palA &&
			!!palB &&
			((palA.gender === 'male' && palB.gender === 'female') ||
				(palA.gender === 'female' && palB.gender === 'male'))
	);

	// Pool héritable = union dédupliquée des passifs des deux parents.
	const union = $derived(palA && palB ? passiveUnion(palA.passives, palB.passives) : []);
	let wanted = $state<string[]>([]);
	// Changer de parents change le pool : on réinitialise la sélection.
	$effect(() => {
		union;
		wanted = [];
	});
	const singleP = $derived(pInheritSubset(union.length, 1));
	const wantedP = $derived(pInheritSubset(union.length, wanted.length));

	const pct = (p: number) => `${(p * 100).toFixed(1)}%`;
	const genderSym = (g: PalInstance['gender']) => (g === 'male' ? '♂' : g === 'female' ? '♀' : '?');
	const genderLabel = (g: PalInstance['gender']) =>
		g === 'male' ? m.breeding_gender_male() : g === 'female' ? m.breeding_gender_female() : '';

	// Libellé d'option : espèce, genre, niveau, nb de passifs, surnom éventuel.
	function instLabel(i: PalInstance): string {
		const bits = [
			`${gameName(`pal:${i.palId}`)} ${genderSym(i.gender)}`,
			m.breeding_level_short({ level: i.level })
		];
		if (i.passives.length) bits.push(`✦${i.passives.length}`);
		if (i.nickname) bits.push(`« ${i.nickname} »`);
		return bits.join(' · ');
	}

	// ---- Mode parents : enfant cible -> paires de parents possibles.
	let parentsTarget = $state('');
	const pairs = $derived(parentsTarget ? parentsOf(parentsTarget, 60) : []);

	// ---- Mode path : chemin d'élevage depuis les espèces possédées.
	let pathTarget = $state('');
	const path = $derived(pathTarget ? breedingPath(scopedSpecies, pathTarget) : undefined);
	$effect(() => {
		if (pathTarget && path !== undefined) {
			posthog.capture('breeding_path_searched', { target_species: pathTarget, steps: path?.length ?? null });
		}
	});

	// ---- Mode index : combos uniques, filtrés sur les 3 noms localisés + 3 ids.
	let query = $state('');
	const combos = $derived(
		uniqueComboList.filter((c) => {
			const q = query.trim().toLowerCase();
			if (!q) return true;
			return [c.parentA, c.parentB, c.child].some(
				(id) => id.toLowerCase().includes(q) || gameName(`pal:${id}`).toLowerCase().includes(q)
			);
		})
	);
</script>

{#snippet palLink(id: string)}
	<a href={appHref(`/paldex/${id}`)} class="pal-link">
		{#if palIcon(id)}<img src={palIcon(id)} alt="" width="22" height="22" loading="lazy" />{/if}
		{gameName(`pal:${id}`)}
	</a>
{/snippet}

{#snippet palRef(id: string)}
	<span class="pal-ref">
		{@render palLink(id)}
		{#if scopedSpecies.has(id)}<span class="owned">{m.breeding_owned_badge()}</span>{/if}
	</span>
{/snippet}

{#snippet emptyBox()}
	<div class="empty">
		<p>{m.breeding_no_instances()}</p>
		<a href={appHref('/import')} class="import">{m.import_title()}</a>
	</div>
{/snippet}

{#snippet instCard(p: PalInstance)}
	<div class="inst">
		{#if palIcon(p.palId)}<img src={palIcon(p.palId)} alt="" width="48" height="48" />{/if}
		<div class="inst-info">
			<p class="inst-name">
				<a href={appHref(`/paldex/${p.palId}`)}>{gameName(`pal:${p.palId}`)}</a>
				{#if p.gender}<span class="gender">{genderSym(p.gender)} {genderLabel(p.gender)}</span>{/if}
				<span class="lvl tnum">{m.breeding_level_short({ level: p.level })}</span>
			</p>
			{#if p.nickname}<p class="nick">« {p.nickname} »</p>{/if}
			<p class="talents">
				{m.breeding_talents()}
				<span class="tnum">{p.talentHp ?? '-'} / {p.talentShot ?? '-'} / {p.talentDefense ?? '-'}</span>
			</p>
			{#if p.passives.length}
				<ul class="inst-passives">
					{#each p.passives as pv (pv)}
						<li title={gameDesc(`passive:${pv}`)}>{gameName(`passive:${pv}`)}</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
{/snippet}

<div class="head">
	<h1>{m.breeding_title()}</h1>
</div>

<div class="modes" role="group" aria-label={m.breeding_title()}>
	{#each MODES as t (t.id)}
		<button
			class="seg"
			class:on={mode === t.id}
			aria-pressed={mode === t.id}
			onclick={() => (mode = t.id)}
		>
			{t.label()}
		</button>
	{/each}
	{#if mode !== 'calc'}
		<div class="scope" role="group" aria-label={m.breeding_scope_mine()}>
			<button
				class="seg"
				class:on={scope === 'mine'}
				aria-pressed={scope === 'mine'}
				onclick={() => (scope = 'mine')}
			>
				{m.breeding_scope_mine()}
			</button>
			<button
				class="seg"
				class:on={scope === 'server'}
				aria-pressed={scope === 'server'}
				onclick={() => (scope = 'server')}
			>
				{m.breeding_scope_server()}
			</button>
		</div>
	{/if}
</div>

{#if mode !== 'calc' && scope === 'mine' && !myGuid}
	<p class="muted">
		{m.breeding_scope_unclaimed()}
		<a href={appHref('/import')} class="claim">{m.import_title()}</a>
	</p>
{/if}

{#if mode === 'calc'}
	{#if owners.length === 0}
		{@render emptyBox()}
	{:else}
		<div class="parents-grid">
			<section class="parent">
				<h2>{m.breeding_parent_a()}</h2>
				<select bind:value={guidA} onchange={() => (instA = '')}>
					<option value="">{m.breeding_member()}</option>
					{#each owners as o (o.guid)}<option value={o.guid}>{o.name}</option>{/each}
				</select>
				{#if guidA}
					<select bind:value={instA}>
						<option value="">{m.breeding_pick_pal()}</option>
						{#each owners.find((o) => o.guid === guidA)?.instances ?? [] as i (i.instanceId)}
							<option value={i.instanceId}>{instLabel(i)}</option>
						{/each}
					</select>
				{/if}
				{#if palA}
					{@render instCard(palA)}
				{/if}
			</section>
			<section class="parent">
				<h2>{m.breeding_parent_b()}</h2>
				<select bind:value={guidB} onchange={() => (instB = '')}>
					<option value="">{m.breeding_member()}</option>
					{#each owners as o (o.guid)}<option value={o.guid}>{o.name}</option>{/each}
				</select>
				{#if guidB}
					<select bind:value={instB}>
						<option value="">{m.breeding_pick_pal()}</option>
						{#each owners.find((o) => o.guid === guidB)?.instances ?? [] as i (i.instanceId)}
							<option value={i.instanceId}>{instLabel(i)}</option>
						{/each}
					</select>
				{/if}
				{#if palB}
					{@render instCard(palB)}
				{/if}
			</section>
		</div>
		{#if palA && palB}
			{#if !genderOk}
				<p class="warn">{m.breeding_gender_warning()}</p>
			{/if}
			{#if child}
				<div class="box">
					<h2>{m.pal_breeding_child()}</h2>
					<a href={appHref(`/paldex/${child}`)} class="child-link">
						{#if palIcon(child)}<img src={palIcon(child)} alt="" width="48" height="48" />{/if}
						{gameName(`pal:${child}`)}
					</a>
				</div>
			{/if}
			<div class="box">
				<h2>{m.breeding_passives()}</h2>
				{#if union.length === 0}
					<p class="muted">{m.breeding_passives_none()}</p>
				{:else}
					<p class="muted">{m.breeding_passives_help()}</p>
					<ul class="union">
						{#each union as pv (pv)}
							<li>
								<label>
									<input type="checkbox" bind:group={wanted} value={pv} />
									<span class="pv-text">
										<span>{gameName(`passive:${pv}`)}</span>
										{#if gameDesc(`passive:${pv}`)}<span class="pdesc">{gameDesc(`passive:${pv}`)}</span>{/if}
									</span>
									<span class="p tnum">{pct(singleP)}</span>
								</label>
							</li>
						{/each}
					</ul>
					<p class="big-p">
						<span class="label">{m.breeding_passives_chance()}</span>
						<span class="value tnum">{pct(wantedP)}</span>
					</p>
					<p class="source">{m.breeding_passives_source()}</p>
				{/if}
			</div>
		{/if}
	{/if}
{:else if mode === 'parents'}
	<div class="filters">
		<select bind:value={parentsTarget}>
			<option value="">{m.breeding_target()}</option>
			{#each sortedPals as p (p.id)}<option value={p.id}>{gameName(`pal:${p.id}`)}</option>{/each}
		</select>
		{#if parentsTarget}
			<span class="count tnum">{m.breeding_pairs_count({ count: pairs.length })}</span>
		{/if}
	</div>
	{#if parentsTarget}
		<ul class="pairs">
			{#each pairs as [a, b] (a + '|' + b)}
				<li>
					{@render palRef(a)}
					<span class="x">×</span>
					{@render palRef(b)}
				</li>
			{/each}
		</ul>
	{/if}
{:else if mode === 'path'}
	{#if owners.length === 0}
		{@render emptyBox()}
	{:else}
		<p class="muted tnum">
			{scope === 'mine'
				? m.breeding_path_from_mine({ count: scopedSpecies.size })
				: m.breeding_path_from({ count: scopedSpecies.size })}
		</p>
		<div class="filters">
			<select bind:value={pathTarget}>
				<option value="">{m.breeding_target()}</option>
				{#each sortedPals as p (p.id)}<option value={p.id}>{gameName(`pal:${p.id}`)}</option>{/each}
			</select>
			{#if pathTarget && path && path.length > 0}
				<span class="count tnum">{m.breeding_path_steps({ count: path.length })}</span>
			{/if}
		</div>
		{#if pathTarget}
			{#if path === null}
				<p class="muted">{m.breeding_path_none()}</p>
			{:else if path && path.length === 0}
				<p class="muted">{m.breeding_path_already()}</p>
			{:else if path}
				<ol class="steps">
					{#each path as s (s.child)}
						<li>
							<span class="depth tnum">{s.depth}</span>
							{@render palRef(s.parentA)}
							<span class="x">×</span>
							{@render palRef(s.parentB)}
							<span class="arrow">→</span>
							{@render palLink(s.child)}
						</li>
					{/each}
				</ol>
			{/if}
		{/if}
	{/if}
{:else}
	<div class="filters">
		<input type="search" placeholder={m.breeding_index_search()} bind:value={query} />
		<span class="count tnum">{m.breeding_index_count({ count: combos.length })}</span>
	</div>
	<ul class="combos">
		{#each combos as c ([c.parentA, c.parentB, c.child].join('|'))}
			<li>
				{@render palRef(c.parentA)}
				<span class="x">×</span>
				{@render palRef(c.parentB)}
				<span class="arrow">→</span>
				{@render palRef(c.child)}
			</li>
		{/each}
	</ul>
{/if}

<style>
	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
	}
	/* Boutons segmentés (pas de composant tab), style aligné sur .order de paldex */
	.modes {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		margin: 4px 0 20px;
	}
	.seg {
		font-size: 13px;
		color: var(--text-2);
		background: var(--input-bg);
		border: 1px solid var(--border);
		border-radius: var(--r-sm);
		padding: 6px 12px;
		white-space: nowrap;
	}
	.seg:hover {
		border-color: var(--border-strong);
		color: var(--text-1);
	}
	.seg.on {
		color: var(--accent);
		background: var(--accent-soft);
		border-color: var(--focus-ring);
	}
	/* Sélecteur de portée (Mes Pals / Tout le serveur), à droite de la rangée de modes */
	.scope {
		display: flex;
		gap: 6px;
		margin-left: auto;
	}
	.claim {
		color: var(--accent);
		font-weight: 500;
	}
	.filters {
		display: flex;
		gap: 8px;
		align-items: center;
		flex-wrap: wrap;
		margin: 0 0 16px;
	}
	.filters input[type='search'] {
		flex: 1;
		min-width: 180px;
	}
	.count,
	.muted {
		color: var(--text-3);
		font-size: 13px;
	}
	.muted {
		margin: 0 0 12px;
	}
	.empty {
		padding: 24px;
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: var(--r-lg);
	}
	.empty .import {
		color: var(--accent);
		font-weight: 500;
	}
	.parents-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
	}
	@media (max-width: 700px) {
		.parents-grid {
			grid-template-columns: 1fr;
		}
	}
	.parent {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 16px;
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: var(--r-lg);
	}
	.parent h2 {
		margin: 0;
	}
	.inst {
		display: flex;
		gap: 12px;
		padding: 10px 12px;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--r-md);
	}
	.inst > img {
		flex-shrink: 0;
	}
	.inst-name {
		margin: 0;
		display: flex;
		align-items: baseline;
		gap: 8px;
		flex-wrap: wrap;
		font-weight: 500;
	}
	.gender {
		color: var(--text-2);
		font-size: 12px;
	}
	.lvl {
		color: var(--accent);
		font-size: 12px;
		font-weight: 600;
	}
	.nick {
		margin: 2px 0 0;
		color: var(--text-3);
		font-size: 12px;
		font-style: italic;
	}
	.talents {
		margin: 4px 0 0;
		color: var(--text-3);
		font-size: 12px;
	}
	.inst-passives {
		list-style: none;
		margin: 6px 0 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 4px 10px;
		font-size: 12px;
		color: var(--text-2);
	}
	.warn {
		color: var(--el-electricity);
		font-size: 13px;
		margin: 16px 0 0;
	}
	.box {
		margin-top: 16px;
		padding: 16px;
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: var(--r-lg);
	}
	.box h2 {
		margin-top: 0;
	}
	.child-link {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		color: var(--accent);
		font-weight: 500;
		font-size: 15px;
	}
	.union {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
		max-width: 420px;
	}
	.union label {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		font-size: 13px;
		color: var(--text-2);
	}
	.pv-text {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}
	.pdesc {
		color: var(--text-3);
		font-size: 12px;
	}
	.union .p {
		margin-left: auto;
		color: var(--text-3);
		font-size: 12px;
	}
	.big-p {
		display: flex;
		align-items: baseline;
		gap: 12px;
		margin: 16px 0 0;
	}
	.big-p .label {
		color: var(--text-2);
		font-size: 13px;
	}
	.big-p .value {
		font-family: var(--font-display);
		font-size: 32px;
		font-weight: 600;
		color: var(--accent);
	}
	.source {
		color: var(--text-4);
		font-size: 12px;
		margin: 8px 0 0;
	}
	.pairs {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 6px;
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.combos {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
		gap: 6px;
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.steps {
		list-style: none;
		margin: 8px 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.pairs li,
	.combos li,
	.steps li {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
		padding: 6px 10px;
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: var(--r-sm);
		font-size: 13px;
	}
	.pal-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: var(--text-1);
	}
	.pal-link:hover {
		color: var(--accent);
	}
	.pal-ref {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.owned {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--accent);
		background: var(--accent-soft);
		border-radius: 4px;
		padding: 1px 5px;
	}
	.x,
	.arrow {
		color: var(--text-4);
	}
	.depth {
		font-size: 10px;
		color: var(--text-3);
		border: 1px solid var(--border);
		border-radius: 4px;
		padding: 1px 6px;
	}
</style>
