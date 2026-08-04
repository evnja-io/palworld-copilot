<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import { appHref } from '$lib/nav';

	let { data } = $props();

	const df = new Intl.DateTimeFormat(getLocale(), { dateStyle: 'long', timeStyle: 'short' });

	const me = $derived(
		data.members.find((mb) => mb.id === data.user.id) ?? {
			counts: { pal_caught: 0, tech_unlocked: 0, marker: 0 }
		}
	);

	const cards = $derived([
		{
			href: '/paldex',
			title: m.nav_paldex(),
			icon: '/icons/items/PalSphere_Mega.webp',
			mine: me.counts.pal_caught,
			group: data.group.pal_caught,
			total: data.totals.pal_caught
		},
		{
			href: '/tech',
			title: m.nav_tech(),
			icon: '/icons/items/Blueprint.webp',
			mine: me.counts.tech_unlocked,
			group: data.group.tech_unlocked,
			total: data.totals.tech_unlocked
		},
		{
			href: '/map',
			title: m.map_title(),
			icon: '/icons/items/Relic.webp',
			mine: me.counts.marker,
			group: data.group.marker,
			total: data.totals.marker
		}
	]);

	function pct(n: number, total: number): number {
		return total ? Math.min(100, (n / total) * 100) : 0;
	}
</script>

<div class="home">
	<header class="intro">
		<h1>{m.home_welcome({ name: data.user.username })}</h1>
		<p class="subtitle">{m.home_subtitle()}</p>
		{#if data.lastImport}
			<p class="sync">{m.home_last_sync({ date: df.format(new Date(data.lastImport)) })}</p>
		{/if}
	</header>

	<div class="cards">
		{#each cards as c, i (c.href)}
			<a class="card" href={appHref(c.href)} style="--delay: {i * 0.06}s">
				<div class="card-head">
					<img src={c.icon} alt="" width="26" height="26" loading="lazy" decoding="async" />
					<h2>{c.title}</h2>
				</div>
				<p class="big tnum">
					{c.mine}<span class="total">/{c.total}</span>
				</p>
				<div class="bar" role="presentation">
					<div class="fill group" style="width: {pct(c.group, c.total)}%"></div>
					<div class="fill mine" style="width: {pct(c.mine, c.total)}%"></div>
				</div>
				<p class="legend">
					<span class="dot mine-dot"></span>{m.home_me()}
					<span class="dot group-dot"></span>{m.home_group()} <span class="tnum">{c.group}</span>
				</p>
			</a>
		{/each}
	</div>

	<section class="members">
		<h2>{m.home_members()}</h2>
		<ul>
			{#each data.members as mb (mb.id)}
				<li class:is-me={mb.id === data.user.id}>
					{#if mb.avatarUrl}
						<img src={mb.avatarUrl} alt="" width="30" height="30" class="avatar" />
					{:else}
						<span class="avatar fallback">{mb.username.slice(0, 1).toUpperCase()}</span>
					{/if}
					<span class="who">
						<span class="name">{mb.username}</span>
						{#if mb.nickname && mb.nickname !== mb.username}
							<span class="nickname">{mb.nickname}</span>
						{/if}
					</span>
					<span class="stats tnum">
						{m.import_kind_pal_caught({ count: mb.counts.pal_caught })}
						· {m.import_kind_tech_unlocked({ count: mb.counts.tech_unlocked })}
						· {m.home_member_markers({ count: mb.counts.marker })}
					</span>
				</li>
			{/each}
		</ul>
	</section>
</div>

<style>
	.home {
		width: min(880px, 100%);
		margin: 0 auto;
		padding: 28px 16px 48px;
	}

	.intro {
		margin-bottom: 24px;
	}
	.subtitle {
		margin: 0;
		color: var(--text-2);
	}
	.sync {
		margin: 4px 0 0;
		font-size: 12px;
		color: var(--text-3);
	}

	/* --- Cartes de progression --- */
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 12px;
		margin-bottom: 32px;
	}
	.card {
		display: block;
		padding: 16px;
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		transition: border-color 140ms, transform 140ms cubic-bezier(0.23, 1, 0.32, 1);
		animation: rise 0.5s cubic-bezier(0.23, 1, 0.32, 1) var(--delay) both;
	}
	.card:hover {
		color: inherit;
		border-color: rgba(255, 90, 15, 0.45);
		transform: translateY(-2px);
	}
	.card-head {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 10px;
	}
	.card-head img {
		border-radius: var(--r-sm);
		background: var(--surface-3);
		padding: 4px;
	}
	.card-head h2 {
		margin: 0;
		font-size: 13px;
		color: var(--text-2);
	}
	.big {
		margin: 0 0 10px;
		font-family: var(--font-display);
		font-size: 28px;
		font-weight: 600;
		line-height: 1;
		color: var(--text-1);
	}
	.big .total {
		font-size: 15px;
		font-weight: 500;
		color: var(--text-3);
	}
	.bar {
		position: relative;
		height: 6px;
		border-radius: 999px;
		background: var(--surface-3);
		overflow: hidden;
		margin-bottom: 8px;
	}
	.fill {
		position: absolute;
		inset: 0 auto 0 0;
		border-radius: 999px;
		transition: width 400ms cubic-bezier(0.23, 1, 0.32, 1);
	}
	.fill.group {
		background: color-mix(in srgb, var(--accent) 30%, transparent);
	}
	.fill.mine {
		background: var(--accent);
	}
	.legend {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 0;
		font-size: 11.5px;
		color: var(--text-3);
	}
	.dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
	}
	.mine-dot {
		background: var(--accent);
	}
	.group-dot {
		background: color-mix(in srgb, var(--accent) 30%, transparent);
		margin-left: 8px;
	}

	/* --- Membres --- */
	.members h2 {
		font-size: 13px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-3);
		margin-bottom: 10px;
	}
	.members ul {
		margin: 0;
		padding: 0;
		list-style: none;
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: var(--r-md);
	}
	.members li {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 14px;
	}
	.members li + li {
		border-top: 1px solid var(--border);
	}
	.members li.is-me {
		background: color-mix(in srgb, var(--accent) 5%, transparent);
	}
	.avatar {
		border-radius: 50%;
		flex-shrink: 0;
	}
	.fallback {
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		background: var(--surface-3);
		font-size: 13px;
		font-weight: 600;
		color: var(--text-2);
	}
	.who {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.name {
		font-weight: 500;
		color: var(--text-1);
	}
	.nickname {
		font-size: 11.5px;
		color: var(--text-3);
	}
	.stats {
		margin-left: auto;
		font-size: 12.5px;
		color: var(--text-2);
		white-space: nowrap;
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
	}

	@media (max-width: 560px) {
		.members li {
			flex-wrap: wrap;
		}
		.stats {
			margin-left: 42px;
			width: 100%;
		}
	}
</style>
