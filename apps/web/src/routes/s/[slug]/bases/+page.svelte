<script lang="ts">
	import posthog from 'posthog-js';
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import type { Locale } from '$lib/search/tokens';
	import { gameName } from '$lib/game/names';
	import { palIcon } from '$lib/game/icons';
	import { workIcon, workLabel } from '$lib/game/work';
	import { appHref } from '$lib/nav';
	import {
		WORK_KEYS,
		DEFAULT_SLOT_COUNT,
		effectiveWork,
		supplyVector,
		normalizeDemands,
		baseStatus,
		recommend,
		type Candidate,
		type WorkKey,
		type WorkStatusKind
	} from '$lib/game/basework';
	// Import de types uniquement : effacé à la compilation, aucun code serveur embarqué.
	import type { GuildView, AssignedPal } from '$lib/server/bases';
	import type { PalOwner } from '$lib/server/pals';
	import Seo from '$lib/components/Seo.svelte';

	let { data } = $props();

	const guilds = $derived(data.guilds as GuildView[]);
	const owners = $derived(data.owners as PalOwner[]);
	const locale = getLocale() as Locale;

	// --- Sélection de guilde : « ma guilde » (GUID revendiqué) par défaut.
	const myGuid = $derived(data.membership?.palPlayerGuid ?? null);
	const myGuild = $derived(
		myGuid ? (guilds.find((g) => g.members.some((mb) => mb.playerGuid === myGuid)) ?? null) : null
	);
	let guildPick = $state<string | null>(null);
	const guild = $derived(guilds.find((g) => g.guildId === guildPick) ?? myGuild ?? guilds[0] ?? null);

	// --- Sélection de base dans la guilde courante (repli : première base).
	let basePick = $state<string | null>(null);
	const base = $derived(guild?.bases.find((b) => b.baseId === basePick) ?? guild?.bases[0] ?? null);

	// --- Poids de demande : lignes serveur + surcharges optimistes locales.
	// La surcharge est posée AVANT le POST ; en cas d'échec on remet la valeur
	// précédente et on affiche l'erreur.
	let overrides = $state<Record<string, number>>({}); // clé `${baseId}:${work}`
	let demandError = $state(false);
	const demands = $derived.by(() => {
		const d = normalizeDemands(base?.demands ?? []);
		if (base) {
			for (const k of WORK_KEYS) {
				const o = overrides[`${base.baseId}:${k}`];
				if (o !== undefined) d[k] = o;
			}
		}
		return d;
	});

	// Numéro de requête par (base, travail) : un retour arrière ne doit jamais
	// écraser une mise à jour plus récente déjà partie (clics rapides 2 puis 3 :
	// l'échec du 2 ne doit pas annuler le 3 en vol ou déjà enregistré).
	const demandSeq = new Map<string, number>();

	async function setWeight(work: WorkKey, weight: number) {
		if (!base) return;
		const key = `${base.baseId}:${work}`;
		const prev = demands[work];
		if (prev === weight) return;
		const seq = (demandSeq.get(key) ?? 0) + 1;
		demandSeq.set(key, seq);
		overrides[key] = weight; // mise à jour optimiste
		demandError = false;
		try {
			const res = await fetch(`/api/servers/${page.params.slug}/bases/demands`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ baseId: base.baseId, workType: work, weight })
			});
			if (!res.ok) throw new Error(String(res.status));
			posthog.capture('base_demand_saved', { work_type: work, weight });
		} catch {
			// Retour arrière seulement si aucune requête plus récente n'a pris la main.
			if (demandSeq.get(key) === seq) {
				overrides[key] = prev;
				demandError = true;
			}
		}
	}

	// --- Offre effective et statut par type de travail (tout côté client).
	const assigned = $derived(base?.assigned ?? []);
	const supply = $derived(supplyVector(assigned));
	const statuses = $derived(baseStatus(supply, demands));

	// --- Recommandations : pool = instances du serveur MOINS celles déjà
	// affectées à n'importe quelle base, filtré par portée.
	let scope = $state<'mine' | 'guild' | 'server'>('guild');
	const assignedAnywhere = $derived(
		new Set(guilds.flatMap((g) => g.bases.flatMap((b) => b.assigned.map((a) => a.instanceId))))
	);
	const guildGuids = $derived(new Set(guild?.members.map((mb) => mb.playerGuid) ?? []));
	const pool = $derived(
		owners
			.filter(
				(o) => scope === 'server' || (scope === 'mine' ? o.guid === myGuid : guildGuids.has(o.guid))
			)
			.flatMap((o) =>
				o.instances
					.filter((i) => !assignedAnywhere.has(i.instanceId))
					.map(
						(i) =>
							({
								instanceId: i.instanceId,
								palId: i.palId,
								passives: i.passives,
								ownerGuid: o.guid,
								level: i.level,
								nickname: i.nickname
							}) satisfies Candidate
					)
			)
	);
	const reco = $derived(
		base ? recommend({ assigned, slotCount: base.slotCount, demands, pool }) : null
	);

	// --- Aides d'affichage.
	const ownerNames = $derived(new Map(owners.map((o) => [o.guid, o.name])));
	const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
	const candName = (c: Candidate) => c.nickname ?? gameName(`pal:${c.palId}`);
	const gainsText = (gains: Partial<Record<string, number>>) =>
		Object.entries(gains)
			.map(([k, v]) => `${workLabel(k, locale)} +${fmt(v ?? 0)}`)
			.join(', ');

	/** Meilleures aptitudes effectives d'un pal assigné (3 max, puissance desc). */
	function topWorks(p: AssignedPal): Array<{ work: WorkKey; power: number }> {
		const v = effectiveWork(p.palId, p.passives);
		return WORK_KEYS.filter((k) => v[k] > 0)
			.map((k) => ({ work: k, power: v[k] }))
			.sort((a, b) => b.power - a.power)
			.slice(0, 3);
	}

	const WEIGHTS = [0, 1, 2, 3] as const;
	const WEIGHT_LABELS = [m.bases_weight_0, m.bases_weight_1, m.bases_weight_2, m.bases_weight_3];
	const STATUS_LABELS: Record<WorkStatusKind, () => string> = {
		ok: m.bases_status_ok,
		bottleneck: m.bases_status_bottleneck,
		oversupply: m.bases_status_oversupply,
		idle: m.bases_status_idle
	};
</script>

<Seo title={m.bases_title()} description={m.seo_bases_desc()} path="/bases" indexable={false} />

<div class="head">
	<h1>{m.bases_title()}</h1>
</div>

{#if guilds.length === 0}
	<div class="empty">
		<h2>{m.bases_empty_title()}</h2>
		<p>{m.bases_empty_body()}</p>
		<a href={appHref('/import')} class="import">{m.import_title()}</a>
	</div>
{:else}
	{#if !myGuid}
		<p class="muted">
			{m.bases_unclaimed()}
			<a href={appHref('/import')} class="claim">{m.import_title()}</a>
		</p>
	{:else if !myGuild}
		<p class="muted">{m.bases_no_my_guild()}</p>
	{/if}

	<!-- Sélecteur de guilde : select seulement quand il y a un choix à faire. -->
	<div class="guild-head">
		{#if guilds.length > 1}
			<label class="guild-pick">
				<span class="glabel">{m.bases_guild_label()}</span>
				<select
					value={guild?.guildId}
					onchange={(e) => {
						guildPick = e.currentTarget.value;
						basePick = null;
					}}
				>
					{#each guilds as g (g.guildId)}
						<option value={g.guildId}>
							{g.name ?? m.bases_guild_unnamed()}{myGuild?.guildId === g.guildId
								? ` · ${m.bases_my_guild_badge()}`
								: ''}
						</option>
					{/each}
				</select>
			</label>
		{:else if guild}
			<p class="guild-name">
				{guild.name ?? m.bases_guild_unnamed()}
				{#if myGuild?.guildId === guild.guildId}
					<span class="mine-badge">{m.bases_my_guild_badge()}</span>
				{/if}
			</p>
		{/if}
		{#if guild}
			<p class="guild-meta tnum">
				{m.bases_guild_level({ level: guild.baseCampLevel })} · {m.bases_members_count({
					count: guild.members.length
				})}
			</p>
		{/if}
	</div>

	{#if guild}
		{#if guild.bases.length === 0}
			<div class="empty">
				<h2>{m.bases_empty_title()}</h2>
				<p>{m.bases_empty_body()}</p>
			</div>
		{:else}
			<!-- Cartes de sélection de base : nom + occupation. -->
			<div class="bases-row" role="group" aria-label={m.bases_title()}>
				{#each guild.bases as b (b.baseId)}
					<button
						class="base-card"
						class:on={b.baseId === base?.baseId}
						aria-pressed={b.baseId === base?.baseId}
						onclick={() => (basePick = b.baseId)}
					>
						<span class="base-name">{b.name ?? m.bases_base_unnamed()}</span>
						<span class="base-cap tnum">
							{m.bases_assigned_count({
								count: b.assigned.length,
								slots: b.slotCount ?? DEFAULT_SLOT_COUNT
							})}
						</span>
					</button>
				{/each}
			</div>

			{#if base}
				<!-- Pals assignés à la base sélectionnée. -->
				<section class="box">
					<div class="box-head">
						<h2>{m.bases_assigned_title()}</h2>
						<span class="count tnum">
							{m.bases_assigned_count({
								count: assigned.length,
								slots: base.slotCount ?? DEFAULT_SLOT_COUNT
							})}
						</span>
					</div>
					{#if base.unresolvedCount > 0}
						<p class="muted">{m.bases_unresolved_count({ count: base.unresolvedCount })}</p>
					{/if}
					{#if assigned.length === 0}
						<p class="muted">{m.bases_assigned_empty()}</p>
					{:else}
						<div class="table-wrap">
							<table>
								<thead>
									<tr>
										<th></th>
										<th>{m.bases_col_owner()}</th>
										<th>{m.bases_col_works()}</th>
									</tr>
								</thead>
								<tbody>
									{#each assigned as p (p.instanceId)}
										<tr>
											<td class="pal-cell">
												{#if palIcon(p.palId)}
													<img src={palIcon(p.palId)} alt="" width="28" height="28" loading="lazy" />
												{/if}
												<span class="pal-id">
													<a href={appHref(`/paldex/${p.palId}`)}>{gameName(`pal:${p.palId}`)}</a>
													{#if p.nickname}<span class="nick">« {p.nickname} »</span>{/if}
													<span class="lvl tnum">{m.breeding_level_short({ level: p.level })}</span>
													{#if p.passives.length}
														<span class="pcount tnum">✦{p.passives.length}</span>
													{/if}
												</span>
											</td>
											<td class="owner-cell">
												{ownerNames.get(p.ownerGuid) ?? `${p.ownerGuid.slice(0, 8)}…`}
											</td>
											<td>
												<span class="works">
													{#each topWorks(p) as w (w.work)}
														<span class="chip" title={workLabel(w.work, locale)}>
															{#if workIcon(w.work)}
																<img
																	src={workIcon(w.work)}
																	alt={workLabel(w.work, locale)}
																	width="14"
																	height="14"
																	loading="lazy"
																/>
															{/if}
															<span class="tnum">{fmt(w.power)}</span>
														</span>
													{/each}
												</span>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</section>

				<!-- Offre vs demande : 12 types de travail, poids éditable. -->
				<section class="box">
					<h2>{m.bases_supply_title()}</h2>
					<p class="muted">{m.bases_supply_help()}</p>
					{#if demandError}
						<p class="err" role="alert">{m.bases_demand_saved_error()}</p>
					{/if}
					<div class="supply">
						{#each statuses as s (s.work)}
							<div class="srow">
								<span class="swork">
									{#if workIcon(s.work)}
										<img src={workIcon(s.work)} alt="" width="16" height="16" loading="lazy" />
									{/if}
									{workLabel(s.work, locale)}
								</span>
								<span class="sbar">
									<span class="fill {s.kind}" style="width: {(s.coverage ?? 0) * 100}%"></span>
									{#if s.weight > 0 && s.supply > s.target}
										<span class="over" aria-hidden="true"></span>
									{/if}
								</span>
								<span class="snum tnum">{fmt(s.supply)} / {s.target}</span>
								<span class="badge {s.kind}">{STATUS_LABELS[s.kind]()}</span>
								<span class="wedit" role="group" aria-label={m.bases_weight_label()}>
									{#each WEIGHTS as w (w)}
										<button
											class="seg wseg"
											class:on={s.weight === w}
											aria-pressed={s.weight === w}
											title={WEIGHT_LABELS[w]()}
											onclick={() => setWeight(s.work, w)}
										>
											{w}
										</button>
									{/each}
								</span>
							</div>
						{/each}
					</div>
				</section>

				<!-- Recommandations d'affectation (glouton, côté client). -->
				<section class="box">
					<div class="box-head">
						<h2>{m.bases_reco_title()}</h2>
						<div class="scope" role="group" aria-label={m.bases_reco_title()}>
							<button
								class="seg"
								class:on={scope === 'mine'}
								aria-pressed={scope === 'mine'}
								onclick={() => (scope = 'mine')}
							>
								{m.bases_reco_scope_mine()}
							</button>
							<button
								class="seg"
								class:on={scope === 'guild'}
								aria-pressed={scope === 'guild'}
								onclick={() => (scope = 'guild')}
							>
								{m.bases_reco_scope_guild()}
							</button>
							<button
								class="seg"
								class:on={scope === 'server'}
								aria-pressed={scope === 'server'}
								onclick={() => (scope = 'server')}
							>
								{m.bases_reco_scope_server()}
							</button>
						</div>
					</div>
					{#if reco && (reco.adds.length > 0 || reco.swaps.length > 0)}
						<ul class="reco">
							{#each reco.adds as a (a.pal.instanceId)}
								<li title={m.bases_reco_covers({ works: gainsText(a.gains) })}>
									{#if palIcon(a.pal.palId)}
										<img src={palIcon(a.pal.palId)} alt="" width="24" height="24" loading="lazy" />
									{/if}
									<span class="reco-text">{m.bases_reco_add({ name: candName(a.pal) })}</span>
									<span class="gains">
										{#each Object.entries(a.gains) as [w, g] (w)}
											<span class="chip">
												{#if workIcon(w)}
													<img
														src={workIcon(w)}
														alt={workLabel(w, locale)}
														width="14"
														height="14"
														loading="lazy"
													/>
												{/if}
												<span class="tnum">+{fmt(g ?? 0)}</span>
											</span>
										{/each}
									</span>
								</li>
							{/each}
							{#each reco.swaps as sw (sw.in.instanceId)}
								<li>
									{#if palIcon(sw.in.palId)}
										<img src={palIcon(sw.in.palId)} alt="" width="24" height="24" loading="lazy" />
									{/if}
									<span class="reco-text">
										{m.bases_reco_swap({ out: candName(sw.out), in: candName(sw.in) })}
									</span>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="muted">{m.bases_reco_none()}</p>
					{/if}
				</section>
			{/if}
		{/if}
	{/if}
{/if}

<style>
	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
	}
	/* Boutons segmentés : même primitive que breeding (.seg / .on). */
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
	.scope {
		display: flex;
		gap: 6px;
		margin-left: auto;
	}
	.muted {
		color: var(--text-3);
		font-size: 13px;
		margin: 0 0 12px;
	}
	.claim {
		color: var(--accent);
		font-weight: 500;
	}
	.err {
		color: var(--el-fire);
		font-size: 13px;
		margin: 0 0 12px;
	}
	.empty {
		padding: 24px;
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: var(--r-lg);
	}
	.empty h2 {
		margin-top: 0;
	}
	.empty .import {
		color: var(--accent);
		font-weight: 500;
	}

	/* --- En-tête de guilde --- */
	.guild-head {
		display: flex;
		align-items: baseline;
		gap: 12px;
		flex-wrap: wrap;
		margin: 0 0 16px;
	}
	.guild-pick {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.glabel {
		color: var(--text-3);
		font-size: 13px;
	}
	.guild-name {
		margin: 0;
		font-weight: 500;
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.mine-badge {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--accent);
		background: var(--accent-soft);
		border-radius: 4px;
		padding: 1px 5px;
	}
	.guild-meta {
		margin: 0;
		color: var(--text-3);
		font-size: 13px;
	}

	/* --- Cartes de base --- */
	.bases-row {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		margin: 0 0 16px;
	}
	.base-card {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		padding: 10px 14px;
		background: var(--input-bg);
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		text-align: left;
	}
	.base-card:hover {
		border-color: var(--border-strong);
	}
	.base-card.on {
		background: var(--accent-soft);
		border-color: var(--focus-ring);
	}
	.base-name {
		font-weight: 500;
		color: var(--text-1);
		font-size: 14px;
	}
	.base-card.on .base-name {
		color: var(--accent);
	}
	.base-cap {
		color: var(--text-3);
		font-size: 12px;
	}

	/* --- Sections --- */
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
	.box-head {
		display: flex;
		align-items: baseline;
		gap: 12px;
		flex-wrap: wrap;
	}
	.box-head h2 {
		margin: 0 auto 12px 0;
	}
	.count {
		color: var(--text-3);
		font-size: 13px;
	}

	/* --- Tableau des pals assignés --- */
	.table-wrap {
		overflow-x: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 13px;
	}
	th {
		text-align: left;
		color: var(--text-3);
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-weight: 500;
		padding: 6px 10px;
		border-bottom: 1px solid var(--border);
	}
	td {
		padding: 6px 10px;
		border-bottom: 1px solid var(--border);
		color: var(--text-2);
		vertical-align: middle;
	}
	tbody tr:last-child td {
		border-bottom: none;
	}
	.pal-cell {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.pal-id {
		display: flex;
		align-items: baseline;
		gap: 8px;
		flex-wrap: wrap;
	}
	.pal-id a {
		color: var(--text-1);
		font-weight: 500;
	}
	.pal-id a:hover {
		color: var(--accent);
	}
	.nick {
		color: var(--text-3);
		font-size: 12px;
		font-style: italic;
	}
	.lvl {
		color: var(--accent);
		font-size: 12px;
		font-weight: 600;
	}
	.pcount {
		color: var(--text-3);
		font-size: 12px;
	}
	.owner-cell {
		white-space: nowrap;
	}
	.works {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 12px;
		color: var(--text-2);
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--r-sm);
		padding: 2px 7px;
	}

	/* --- Offre vs demande --- */
	.supply {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.srow {
		display: grid;
		grid-template-columns: 170px minmax(80px, 1fr) 80px 90px auto;
		align-items: center;
		gap: 10px;
	}
	@media (max-width: 760px) {
		.srow {
			grid-template-columns: 1fr 80px 90px;
		}
		.sbar {
			grid-column: 1 / -1;
		}
		.wedit {
			grid-column: 1 / -1;
		}
	}
	.swork {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		color: var(--text-1);
	}
	.sbar {
		position: relative;
		height: 8px;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 4px;
		overflow: hidden;
	}
	.fill {
		position: absolute;
		inset: 0 auto 0 0;
		background: var(--accent);
		border-radius: 3px;
	}
	.fill.bottleneck {
		background: var(--el-fire);
	}
	.fill.oversupply,
	.fill.idle {
		background: var(--el-electricity);
	}
	/* Marqueur de dépassement : l'offre excède la cible (barre déjà pleine). */
	.over {
		position: absolute;
		inset: 0 0 0 auto;
		width: 3px;
		background: var(--el-electricity);
	}
	.snum {
		color: var(--text-3);
		font-size: 12px;
		text-align: right;
	}
	.badge {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		border-radius: 4px;
		padding: 2px 6px;
		text-align: center;
		color: var(--text-3);
		background: var(--surface-2);
		border: 1px solid var(--border);
	}
	.badge.ok {
		color: var(--accent);
		background: var(--accent-soft);
		border-color: var(--focus-ring);
	}
	.badge.bottleneck {
		color: var(--el-fire);
		border-color: var(--el-fire);
		background: none;
	}
	.badge.oversupply,
	.badge.idle {
		color: var(--el-electricity);
		border-color: var(--el-electricity);
		background: none;
	}
	.wedit {
		display: flex;
		gap: 4px;
	}
	.wseg {
		padding: 3px 9px;
		font-size: 12px;
	}

	/* --- Recommandations --- */
	.reco {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.reco li {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
		padding: 8px 10px;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--r-sm);
		font-size: 13px;
	}
	.reco-text {
		color: var(--text-1);
	}
	.gains {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}
</style>
