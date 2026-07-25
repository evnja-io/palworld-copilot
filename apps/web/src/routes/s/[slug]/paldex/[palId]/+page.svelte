<script lang="ts">
	import pals from '@palworld-companion/game-data/pals.json';
	import skills from '@palworld-companion/game-data/skills.json';
	import moves from '@palworld-companion/game-data/pal-moves.json';
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages';
	import { gameName, gameDesc } from '$lib/game/names';
	import { getLocale } from '$lib/paraglide/runtime';
	import { palIcon, itemIcon } from '$lib/game/icons';
	import { workIcon, workLabel } from '$lib/game/work';
	import type { Locale } from '$lib/search/tokens';
	import { childOf, parentsOf } from '$lib/game/breeding';
	import { ProgressStore } from '$lib/game/progress.svelte';
	import { appHref, isGuestContext } from '$lib/nav';
	import { palSeoDescription } from '$lib/game/seoText';
	import ElementBadge from '$lib/components/ElementBadge.svelte';
	import GroupAvatars from '$lib/components/GroupAvatars.svelte';
	import Seo from '$lib/components/Seo.svelte';

	let { data } = $props();

	const locale = getLocale() as Locale;

	const pal = $derived(pals.find((p) => p.id === data.palId)!);
	const palMoves = $derived(
		((moves as Record<string, Array<{ skillId: string; level: number }>>)[data.palId] ?? []).filter(
			(mv) => (skills as Record<string, { power?: number }>)[mv.skillId]
		)
	);
	const pairs = $derived(parentsOf(data.palId, 30));
	const sortedPals = $derived([...pals].sort((a, b) => gameName(`pal:${a.id}`).localeCompare(gameName(`pal:${b.id}`))));

	const store = new ProgressStore();
	$effect(() => {
		store.init('pal_caught', page.params.slug!, data.progress.mine, data.progress.group);
		store.startSync();
		return () => store.stopSync();
	});

	let partner = $state('');
	const child = $derived(partner ? childOf(pal.id, partner) : null);
	const caught = $derived(store.mine.has(pal.id));

	const STAT_LABELS: Record<string, string> = {
		hp: 'HP',
		melee: 'ATK (mêlée)',
		shot: 'ATK',
		defense: 'DEF',
		support: 'Support',
		craftSpeed: 'Craft'
	};
</script>

<Seo
	title={gameName(`pal:${pal.id}`)}
	description={palSeoDescription(pal.id)}
	path={`/paldex/${pal.id}`}
	image={palIcon(pal.id) ?? '/logo.svg'}
	indexable={isGuestContext()}
/>

<a href={appHref('/paldex')} class="back">← {m.paldex_title()}</a>

<header class="hero" class:caught>
	{#if palIcon(pal.id)}
		<img src={palIcon(pal.id)} alt="" width="96" height="96" class="portrait" />
	{/if}
	<div class="identity">
		<span class="num tnum">#{String(pal.zukanIndex).padStart(3, '0')}{pal.zukanSuffix ?? ''}</span>
		<h1>{gameName(`pal:${pal.id}`)}</h1>
		<div class="badges">
			{#each pal.elements as e (e)}<ElementBadge element={e} />{/each}
			{#if pal.nocturnal}<span class="tag">🌙</span>{/if}
		</div>
	</div>
	<div class="capture">
		<button class="sphere" class:on={caught} onclick={() => store.toggle(pal.id)} aria-pressed={caught}>
			<span class="ball" aria-hidden="true"></span>
			{m.pal_toggle_caught()}
		</button>
		<GroupAvatars users={store.group[pal.id] ?? []} />
	</div>
</header>

{#if gameDesc(`pal:${pal.id}`)}
	<p class="desc">{gameDesc(`pal:${pal.id}`)}</p>
{/if}

<div class="columns">
	<section>
		<h2>{m.pal_stats()}</h2>
		<dl class="stats">
			{#each Object.entries(pal.stats) as [k, v] (k)}
				<div class="stat">
					<dt>{STAT_LABELS[k] ?? k}</dt>
					<dd class="tnum">{v}</dd>
				</div>
			{/each}
		</dl>
		{#if Object.keys(pal.work).length}
			<h2>{m.pal_work()}</h2>
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
		{#if pal.passives.length}
			<h2>{m.pal_passives()}</h2>
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

	<section>
		<h2>{m.pal_drops()}</h2>
		<ul class="drops">
			{#each pal.drops as d (d.itemId)}
				<li>
					<a href={appHref(`/items/${d.itemId}`)}>
						{#if itemIcon(d.itemId)}<img src={itemIcon(d.itemId)} alt="" width="22" height="22" />{/if}
						{gameName(`item:${d.itemId}`)}
					</a>
					<span class="qty tnum">×{d.min}{d.max !== d.min ? `–${d.max}` : ''}{d.rate < 100 ? ` (${d.rate}%)` : ''}</span>
				</li>
			{/each}
		</ul>
		{#if palMoves.length}
			<h2>{m.pal_moves()}</h2>
			<ul class="moves">
				{#each palMoves as mv (mv.skillId)}
					{@const sk = (skills as Record<string, { element?: string; power?: number }>)[mv.skillId]}
					<li>
						<div class="mv-row">
							<span class="mv-level tnum">Niv. {mv.level}</span>
							<span class="mv-name">{gameName(`skill:${mv.skillId}`)}</span>
							{#if sk?.element}<ElementBadge element={sk.element} />{/if}
							{#if sk?.power}<span class="mv-power tnum">{sk.power}</span>{/if}
						</div>
						{#if gameDesc(`skill:${mv.skillId}`)}<span class="pdesc">{gameDesc(`skill:${mv.skillId}`)}</span>{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>

<section class="breeding">
	<h2>{m.pal_breeding()}</h2>
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

<style>
	.back {
		color: var(--text-3);
		font-size: 13px;
	}
	.hero {
		display: flex;
		align-items: center;
		gap: 16px;
		margin: 12px 0 4px;
		padding: 16px;
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: var(--r-lg);
		flex-wrap: wrap;
	}
	.portrait {
		filter: grayscale(1) opacity(0.45);
		transition: filter 200ms cubic-bezier(0.23, 1, 0.32, 1);
	}
	.hero.caught .portrait {
		filter: none;
	}
	.identity {
		flex: 1;
		min-width: 160px;
	}
	.num {
		font-family: var(--font-display);
		font-size: 12px;
		color: var(--text-4);
		letter-spacing: 0.06em;
	}
	.identity h1 {
		margin: 0 0 6px;
	}
	.badges {
		display: flex;
		gap: 6px;
		align-items: center;
	}
	.tag {
		font-size: 12px;
	}
	.capture {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.sphere {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: var(--text-2);
	}
	.ball {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		border: 2px solid var(--text-4);
		transition: border-color 140ms, background 140ms;
	}
	.sphere.on .ball {
		border-color: var(--accent);
		background: linear-gradient(to bottom, #f4f8fb 0 45%, var(--accent-ink) 45% 55%, var(--accent) 55%);
	}
	.desc {
		color: var(--text-2);
		max-width: 70ch;
		text-wrap: pretty;
	}
	.columns {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 24px;
		margin-top: 8px;
	}
	@media (max-width: 700px) {
		.columns {
			grid-template-columns: 1fr;
		}
	}
	section h2 {
		margin-top: 20px;
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
		margin: 0;
	}
	.stat {
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		padding: 10px 12px;
	}
	.stat dt {
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-3);
	}
	.stat dd {
		margin: 2px 0 0;
		font-family: var(--font-display);
		font-size: 20px;
		font-weight: 600;
	}
	.work,
	.plain,
	.drops,
	.moves,
	.pairs {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.work li,
	.plain li {
		color: var(--text-2);
		font-size: 13px;
	}
	.work li {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.lvl {
		color: var(--accent);
		font-weight: 600;
	}
	.drops li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 6px 10px;
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: var(--r-sm);
	}
	.drops a {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--text-1);
		font-size: 13px;
	}
	.qty {
		color: var(--text-3);
		font-size: 12px;
	}
	.plain li {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.moves li {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: 13px;
		padding: 4px 0;
	}
	.mv-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.pdesc {
		color: var(--text-3);
		font-size: 12px;
		text-wrap: pretty;
	}
	.mv-level {
		color: var(--text-4);
		font-size: 11px;
		width: 44px;
	}
	.mv-name {
		flex: 1;
		color: var(--text-1);
	}
	.mv-power {
		color: var(--text-2);
		font-weight: 600;
	}
	.breeding {
		margin-top: 24px;
		padding: 16px;
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: var(--r-lg);
	}
	.breeding h2 {
		margin-top: 0;
	}
	.partner {
		display: flex;
		align-items: center;
		gap: 10px;
		color: var(--text-2);
		font-size: 13px;
	}
	.child {
		margin: 12px 0 0;
	}
	.child-link {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		color: var(--accent);
		font-weight: 500;
	}
	.pairs {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 4px 16px;
		margin-top: 8px;
	}
	.pairs li {
		font-size: 13px;
		color: var(--text-2);
	}
	.pairs a:hover {
		color: var(--accent);
	}
	.x {
		color: var(--text-4);
		margin: 0 4px;
	}
</style>
