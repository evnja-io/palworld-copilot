<script lang="ts">
	// Fiche Pal — écrans 1c (desktop) et 4b (mobile, héros plein écran + feuille).
	import pals from '@palworld-companion/game-data/pals.json';
	import skills from '@palworld-companion/game-data/skills.json';
	import { spawnCounts, defaultPhase, hasSpawns } from '$lib/game/spawns';
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages';
	import { gameName, gameDesc } from '$lib/game/names';
	import { getLocale } from '$lib/paraglide/runtime';
	import { palIcon, itemIcon } from '$lib/game/icons';
	import { workIcon, workLabel } from '$lib/game/work';
	import type { Locale } from '$lib/search/tokens';
	import { childOf, parentsOf } from '$lib/game/breeding';
	import { markersByPal } from '$lib/game/indexes';
	import { ProgressStore } from '$lib/game/progress.svelte';
	// learnsetFor plutôt qu'un accès direct à pal-moves.json : la casse des
	// clés diverge de pals.json pour 4 ids, et ce helper est insensible.
	import { learnsetFor, partnerSkillNsId } from '$lib/game/team-data';
	import { appHref, isGuestContext } from '$lib/nav';
	import { palSeoDescription } from '$lib/game/seoText';
	import { elLabel } from '$lib/game/elements';
	import ElementHero from '$lib/components/atlas/ElementHero.svelte';
	import StatCard from '$lib/components/atlas/StatCard.svelte';
	import AttackRow from '$lib/components/atlas/AttackRow.svelte';
	import ElementBadge from '$lib/components/ElementBadge.svelte';
	import GroupAvatars from '$lib/components/GroupAvatars.svelte';
	import Seo from '$lib/components/Seo.svelte';

	let { data } = $props();

	const locale = getLocale() as Locale;
	const SK = skills as Record<string, { element?: string; power?: number; ct?: number }>;

	const pal = $derived(pals.find((p) => p.id === data.palId)!);
	const palMoves = $derived(learnsetFor(data.palId).filter((mv) => SK[mv.skillId]?.power));
	const pairs = $derived(parentsOf(data.palId, 30));
	const sortedPals = $derived(
		[...pals].sort((a, b) => gameName(`pal:${a.id}`).localeCompare(gameName(`pal:${b.id}`)))
	);

	const store = new ProgressStore();
	$effect(() => {
		store.init('pal_caught', page.params.slug!, data.progress.mine, data.progress.group);
		store.startSync();
		return () => store.stopSync();
	});

	let partner = $state('');
	const child = $derived(partner ? childOf(pal.id, partner) : null);
	const caught = $derived(store.mine.has(pal.id));
	const groupCount = $derived(store.group[pal.id]?.length ?? 0);
	const guest = $derived(data.mode === 'guest');
	const alphaMarker = $derived(markersByPal.get(pal.id)?.[0]);

	const name = $derived(gameName(`pal:${pal.id}`));
	const num = $derived(`#${String(pal.zukanIndex).padStart(3, '0')}${pal.zukanSuffix ?? ''}`);
	const partnerSkill = $derived(gameName(partnerSkillNsId(pal.id)));

	const spawnCount = $derived(spawnCounts[pal.id]);
	// Le compteur doit annoncer la phase que la carte ouvrira réellement,
	// sinon un Pal sans zone de jour afficherait « 0 zones » avant d'ouvrir
	// une carte pleine de cercles.
	const spawnZones = $derived(
		spawnCount ? spawnCount[defaultPhase(spawnCount, !!pal.nocturnal)] : 0
	);

	// Les 4 stat-cards du dessin. `shot` est la stat clé (celle que le jeu
	// affiche comme « attaque ») ; `melee` et `craftSpeed` n'ont pas de case et
	// redescendent dans la colonne secondaire.
	const STATS = $derived([
		{ label: m.stat_hp(), value: pal.stats.hp },
		{ label: m.stat_attack(), value: pal.stats.shot, accent: true },
		{ label: m.stat_defense(), value: pal.stats.defense },
		{ label: m.stat_support(), value: pal.stats.support }
	]);
	const STAT_LABELS: Record<string, string> = $derived({
		hp: m.stat_hp(),
		melee: m.stat_melee(),
		shot: m.stat_attack(),
		defense: m.stat_defense(),
		support: m.stat_support(),
		craftSpeed: m.stat_craft()
	});
</script>

<Seo
	title={name}
	description={palSeoDescription(pal.id)}
	path={`/paldex/${pal.id}`}
	image={palIcon(pal.id) ?? '/logo.svg'}
	indexable={isGuestContext()}
/>

<div class="hero-wrap full-bleed">
	<ElementHero elements={pal.elements}>
		{#snippet media()}
			<a class="back-m" href={appHref('/paldex')} aria-label={m.paldex_title()}>←</a>
			{#if palIcon(pal.id)}
				<!-- Les icônes du dépôt sont en 128 px : agrandies à ~310 px pour le
				     héros, elles sont douces. Aucun render HD n'existe. -->
				<img class="render pw-float" src={palIcon(pal.id)} alt="" />
			{/if}
		{/snippet}

		<div class="pills">
			{#each pal.elements as e (e)}
				<span class="pill el">{elLabel(e)}</span>
			{/each}
			<span class="pill meta">
				{num}
				{#if caught}· {m.pal_toggle_caught()}{/if}
				<!-- « CAPTURÉ ×3 » = nombre de membres du groupe l'ayant coché.
				     Un invité est seul : le compteur n'aurait aucun sens. -->
				{#if !guest && groupCount > 0}· {m.pal_caught_by({ count: groupCount })}{/if}
			</span>
			{#if pal.nocturnal}<span class="pill meta">🌙</span>{/if}
		</div>

		<h1>{name}</h1>
		{#if gameDesc(`pal:${pal.id}`)}
			<p class="desc">{gameDesc(`pal:${pal.id}`)}</p>
		{/if}

		<div class="cta">
			{#if hasSpawns(spawnCount)}
				<a class="btn primary lift-sm" href={appHref(`/map?pal=${pal.id}`)}>
					{m.pal_locations_zones({ count: spawnZones })}
				</a>
			{/if}
			<a class="btn ghost" href={appHref('/teams')}>{m.pal_cta_team()}</a>
		</div>
	</ElementHero>
</div>

<!-- Sur mobile, le contenu remonte de 32 px sous le héros (feuille, 4b l.213). -->
<div class="sheet">
	<span class="grab" aria-hidden="true"></span>

	<!-- Sur mobile, description et CTA vivent dans la feuille et non dans le
	     héros (4b l.215 et l.226). Rendus une seule fois, montrés ici. -->
	{#if gameDesc(`pal:${pal.id}`)}
		<p class="desc-m">{gameDesc(`pal:${pal.id}`)}</p>
	{/if}

	<div class="capture">
		<button class="sphere" class:on={caught} onclick={() => store.toggle(pal.id)} aria-pressed={caught}>
			<span class="ball" aria-hidden="true"></span>
			{caught ? m.pal_toggle_caught() : m.pal_uncaught()}
		</button>
		<GroupAvatars users={store.group[pal.id] ?? []} />
		{#if alphaMarker}
			<a class="alpha" href={appHref(`/map?focus=${alphaMarker.id}`)}>
				{m.pal_locations_alpha({ level: alphaMarker.meta?.level ?? 0 })}
			</a>
		{/if}
	</div>

	<div class="stats">
		{#each STATS as s (s.label)}
			<StatCard label={s.label} value={s.value} accent={s.accent} element={pal.elements[0]} />
		{/each}
	</div>

	<!-- Duo pleine largeur, en gradient de marque et non teinté par l'élément
	     (4b l.227). -->
	<div class="cta-m">
		{#if hasSpawns(spawnCount)}
			<a class="btn-m primary" href={appHref(`/map?pal=${pal.id}`)}>
				{m.pal_locations_zones({ count: spawnZones })}
			</a>
		{/if}
		<a class="btn-m ghost" href={appHref('/teams')}>{m.pal_cta_team()}</a>
	</div>

	{#if palMoves.length}
		<h2 class="sect">{m.pal_moves()}</h2>
		<div class="attacks">
			{#each palMoves as mv (mv.skillId)}
				<AttackRow
					name={gameName(`skill:${mv.skillId}`)}
					level={mv.level}
					power={SK[mv.skillId]!.power!}
					element={SK[mv.skillId]?.element ?? pal.elements[0]}
				/>
			{/each}
		</div>
	{/if}

	<div class="columns">
		<section class="panel">
			{#if partnerSkill}
				<h2 class="sect">{m.pal_partner_skill()}</h2>
				<p class="partner-skill">{partnerSkill}</p>
			{/if}

			{#if Object.keys(pal.work).length}
				<h2 class="sect">{m.pal_work()}</h2>
				<ul class="work">
					{#each Object.entries(pal.work) as [w, lvl] (w)}
						<li>
							{#if workIcon(w)}<img src={workIcon(w)} alt="" width="18" height="18" />{/if}
							{workLabel(w, locale)}
							<span class="lvl tnum">×{lvl}</span>
						</li>
					{/each}
				</ul>
			{/if}

			<h2 class="sect">{m.pal_stats()}</h2>
			<dl class="allstats">
				{#each Object.entries(pal.stats) as [k, v] (k)}
					<div><dt>{STAT_LABELS[k] ?? k}</dt><dd class="tnum">{v}</dd></div>
				{/each}
			</dl>

			{#if pal.passives.length}
				<h2 class="sect">{m.pal_passives()}</h2>
				<ul class="plain">
					{#each pal.passives as p (p)}
						<li>
							<span class="pname">{gameName(`passive:${p}`)}</span>
							{#if gameDesc(`passive:${p}`)}<span class="pdesc">{gameDesc(`passive:${p}`)}</span>{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section class="panel">
			{#if pal.drops.length}
				<h2 class="sect">{m.pal_drops()}</h2>
				<ul class="drops">
					{#each pal.drops as d (d.itemId)}
						<li>
							<a href={appHref(`/items/${d.itemId}`)}>
								{#if itemIcon(d.itemId)}
									<img src={itemIcon(d.itemId)} alt="" width="22" height="22" />
								{/if}
								{gameName(`item:${d.itemId}`)}
							</a>
							<span class="qty tnum">
								×{d.min}{d.max !== d.min ? `–${d.max}` : ''}{d.rate < 100 ? ` (${d.rate}%)` : ''}
							</span>
						</li>
					{/each}
				</ul>
			{/if}

			<h2 class="sect">{m.pal_breeding()}</h2>
			<label class="partner">
				{m.pal_breeding_partner()}
				<select bind:value={partner}>
					<option value=""></option>
					{#each sortedPals as p (p.id)}
						<option value={p.id}>{gameName(`pal:${p.id}`)}</option>
					{/each}
				</select>
			</label>
			{#if child}
				<p class="child">
					{m.pal_breeding_child()} :
					<a href={appHref(`/paldex/${child}`)} class="child-link">
						{#if palIcon(child)}<img src={palIcon(child)} alt="" width="28" height="28" />{/if}
						{gameName(`pal:${child}`)}
					</a>
				</p>
			{/if}
			{#if pairs.length}
				<h3>{m.pal_breeding_parents()}</h3>
				<ul class="pairs">
					{#each pairs as [a, b] (a + b)}
						<li>
							<a href={appHref(`/paldex/${a}`)}>{gameName(`pal:${a}`)}</a>
							<span class="x">×</span>
							<a href={appHref(`/paldex/${b}`)}>{gameName(`pal:${b}`)}</a>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</div>
</div>

<style>
	/* Le héros va à 20 px des bords (1c l.830) là où la gouttière de <main>
	   est à 36 : on en reprend 16. */
	.hero-wrap {
		--pull: 20px;
		margin-top: -22px;
	}

	.pills {
		display: flex;
		gap: 8px;
		margin-bottom: 18px;
		flex-wrap: wrap;
	}
	.pill {
		font-size: 11.5px;
		letter-spacing: 0.1em;
		border-radius: 999px;
		padding: 6px 14px;
		text-transform: uppercase;
	}
	.pill.el {
		font-weight: 700;
		background: rgba(0, 0, 0, 0.35);
		backdrop-filter: blur(4px);
		color: color-mix(in srgb, var(--el) 25%, white);
	}
	.pill.meta {
		font-weight: 600;
		background: rgba(0, 0, 0, 0.25);
		color: rgba(255, 255, 255, 0.75);
	}

	h1 {
		margin: 0;
		font-size: 84px;
		letter-spacing: -0.03em;
		line-height: 0.95;
		color: #fff8f2;
		text-shadow: 0 4px 40px rgba(0, 0, 0, 0.3);
	}
	.desc {
		margin: 18px 0 0;
		font-size: 15px;
		line-height: 1.65;
		color: rgba(255, 240, 228, 0.85);
		max-width: 440px;
		text-wrap: pretty;
	}

	.cta {
		display: flex;
		gap: 12px;
		margin-top: 26px;
		flex-wrap: wrap;
	}
	.btn {
		padding: 12px 22px;
		border-radius: 999px;
		font-size: 13.5px;
		border: 1px solid transparent;
	}
	.btn.primary {
		background: #fff;
		color: color-mix(in srgb, var(--el) 70%, black);
		font-weight: 700;
	}
	.btn.primary:hover {
		color: color-mix(in srgb, var(--el) 70%, black);
	}
	.btn.ghost {
		border-color: rgba(255, 255, 255, 0.4);
		color: #fff;
		font-weight: 600;
	}
	.btn.ghost:hover {
		background: rgba(255, 255, 255, 0.12);
		color: #fff;
	}

	.render {
		width: 82%;
		height: 82%;
		object-fit: contain;
		filter: drop-shadow(0 24px 40px rgba(0, 0, 0, 0.45));
	}
	.back-m {
		display: none;
	}

	/* La feuille n'existe qu'en mobile ; en desktop c'est un simple flux. */
	.sheet {
		padding-top: 26px;
	}
	.grab,
	.desc-m,
	.cta-m {
		display: none;
	}

	.capture {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
		margin-bottom: 18px;
	}
	.sphere {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		border-radius: 999px;
		padding: 9px 18px;
		font-size: 13px;
		font-weight: 600;
		background: var(--color-surface);
		border: 1px solid var(--color-line);
	}
	.sphere .ball {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		border: 2px solid var(--color-muted);
	}
	.sphere.on {
		border-color: color-mix(in srgb, var(--color-el-eau) 45%, transparent);
	}
	.sphere.on .ball {
		background: var(--color-el-eau);
		border-color: var(--color-el-eau);
	}
	.alpha {
		font-size: 12.5px;
		color: var(--color-muted);
		border-bottom: 1px solid var(--color-line);
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 14px;
	}

	.sect {
		font-family: var(--font-body);
		font-size: 14px;
		font-weight: 700;
		color: var(--color-text);
		margin: 26px 0 12px;
	}

	.attacks {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}

	.columns {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
		margin-top: 26px;
		align-items: start;
	}
	.panel {
		background: var(--color-surface);
		border-radius: var(--radius-card);
		padding: 20px 22px;
	}
	.panel .sect:first-child {
		margin-top: 0;
	}

	.partner-skill {
		margin: 0;
		font-size: 13.5px;
		color: var(--color-text-2, var(--color-text));
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.work li {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 0;
		font-size: 13.5px;
	}
	.work .lvl {
		margin-left: auto;
		color: var(--color-muted);
	}

	.allstats {
		margin: 0;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px 16px;
	}
	.allstats > div {
		display: flex;
		justify-content: space-between;
		font-size: 13px;
	}
	.allstats dt {
		color: var(--color-muted);
	}
	.allstats dd {
		margin: 0;
		font-weight: 600;
	}

	.plain li {
		padding: 7px 0;
		font-size: 13px;
	}
	.pname {
		display: block;
		font-weight: 600;
	}
	.pdesc {
		display: block;
		color: var(--color-muted);
		font-size: 12.5px;
	}

	.drops li {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 0;
		font-size: 13.5px;
	}
	.drops a {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}
	.drops .qty {
		margin-left: auto;
		color: var(--color-muted);
	}

	.partner {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 13px;
		color: var(--color-muted);
	}
	.child {
		margin: 12px 0 0;
		font-size: 13.5px;
	}
	.child-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-weight: 600;
	}
	.pairs {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 4px 16px;
		font-size: 13px;
	}
	.pairs li {
		display: flex;
		gap: 6px;
	}
	.pairs .x {
		color: var(--color-muted);
	}
	h3 {
		font-family: var(--font-body);
		font-size: 13px;
		font-weight: 700;
		margin: 18px 0 8px;
	}

	@media (max-width: 1023.98px) {
		/* Héros plein écran, sans rayon ni marge (4b l.204). */
		.hero-wrap {
			--pull: 0px;
			margin-top: -8px;
		}
		.hero-wrap :global(.hero) {
			border-radius: 0;
		}
		/* Positionné par rapport à .hero (position: relative), donc calé sur son
		   propre padding de 18/20 px. */
		.back-m {
			display: grid;
			place-items: center;
			position: absolute;
			top: 18px;
			left: 20px;
			width: 38px;
			height: 38px;
			border-radius: 50%;
			background: rgba(0, 0, 0, 0.3);
			color: #fff;
			font-size: 16px;
			z-index: 1;
		}
		.render {
			width: 200px;
			height: 200px;
		}
		/* Ordres consommés par ElementHero, qui remonte ces enfants au niveau du
		   flex sur mobile (le render s'intercale en order: 2). */
		.pills {
			order: 1;
			justify-content: flex-end;
			margin-bottom: 0;
		}
		h1 {
			order: 3;
			font-size: 44px;
			text-align: center;
			margin-top: 10px;
		}
		.desc {
			display: none; /* reprise dans la feuille, en gris (4b l.215) */
		}
		.cta {
			display: none; /* reprise en bas de feuille, en duo pleine largeur */
		}

		.sheet {
			position: relative;
			margin-top: -32px;
			border-radius: 26px 26px 0 0;
			background: var(--color-bg);
			padding: 24px 0 30px;
		}
		.grab {
			display: block;
			width: 38px;
			height: 4px;
			border-radius: 99px;
			background: rgba(255, 255, 255, 0.15);
			margin: 0 auto 18px;
		}
		.desc-m {
			display: block;
			margin: 0 0 18px;
			font-size: 13.5px;
			line-height: 1.6;
			color: var(--color-muted);
			text-wrap: pretty;
		}
		.cta-m {
			display: flex;
			gap: 10px;
			margin-top: 20px;
		}
		.btn-m {
			flex: 1;
			text-align: center;
			padding: 14px;
			border-radius: 999px;
			font-size: 13.5px;
			border: 1px solid transparent;
		}
		.btn-m.primary {
			background: linear-gradient(135deg, #ff5a0f, #ff8a3d);
			color: #fff;
			font-weight: 700;
			box-shadow: 0 8px 24px rgba(255, 90, 15, 0.3);
		}
		.btn-m.primary:hover {
			color: #fff;
		}
		.btn-m.ghost {
			border-color: rgba(255, 255, 255, 0.15);
			color: var(--color-text);
			font-weight: 600;
		}
		/* Le dessin mobile (4b l.216) n'en garde que trois : HP / ATK / DÉF.
		   SUPPORT reste lisible plus bas, dans le tableau complet des stats. */
		.stats {
			grid-template-columns: repeat(3, 1fr);
			gap: 9px;
		}
		/* :global — la 4e case est la racine d'un composant enfant, hors de la
		   portée du style scopé de cette page. */
		.stats > :global(:nth-child(4)) {
			display: none;
		}
		.attacks,
		.columns {
			grid-template-columns: 1fr;
		}
		.attacks {
			gap: 8px;
		}
		.pairs {
			grid-template-columns: 1fr;
		}
	}
</style>
