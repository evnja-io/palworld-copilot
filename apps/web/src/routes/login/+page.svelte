<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import LangSwitch from '$lib/components/LangSwitch.svelte';

	/* Colonnes décoratives de Pals (icônes désaturées, façon « non capturé ») */
	const palColumns = [
		['SheepBall', 'Kitsunebi', 'Penguin', 'Carbunclo', 'ChickenPal', 'CuteFox', 'PinkCat'],
		['Anubis', 'ElecPanda', 'GrassMammoth', 'WhiteTiger', 'BlueDragon', 'LilyQueen', 'NegativeKoala'],
		['JetDragon', 'PinkLizard', 'FlowerDinosaur', 'Hedgehog', 'FoxMage', 'RaijinDaughter', 'WhiteMoth'],
		['CatMage', 'LazyCatfish', 'SakuraSaurus', 'IceDeer', 'HadesBird', 'KingBahamut', 'SweetsSheep']
	];

	const nf = new Intl.NumberFormat(getLocale());
	const stats = [
		{ label: m.landing_stat_pals, count: 288 },
		{ label: m.landing_stat_items, count: 1148 },
		{ label: m.landing_stat_alphas, count: 152 },
		{ label: m.landing_stat_relics, count: 138 }
	];

	const features = [
		{ icon: '/icons/items/PalSphere_Mega.webp', title: m.landing_feat_paldex_title, body: m.landing_feat_paldex_body },
		{ icon: '/icons/items/Relic.webp', title: m.landing_feat_map_title, body: m.landing_feat_map_body },
		{ icon: '/icons/items/Blueprint.webp', title: m.landing_feat_tech_title, body: m.landing_feat_tech_body },
		{ icon: '/icons/build/workbench.webp', title: m.landing_feat_craft_title, body: m.landing_feat_craft_body },
		{ icon: '/icons/build/palboxterminal.webp', title: m.landing_feat_import_title, body: m.landing_feat_import_body }
	];
</script>

<svelte:head>
	<title>{m.app_title()}</title>
	<meta name="description" content={m.landing_sub()} />
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="landing">
	<!-- Ciel : aurores + étoiles -->
	<div class="sky" aria-hidden="true">
		<div class="aurora a1"></div>
		<div class="aurora a2"></div>
		<div class="aurora a3"></div>
	</div>

	<!-- Colonnes de Pals en dérive -->
	<div class="drift" aria-hidden="true">
		{#each palColumns as col, ci (ci)}
			<div class="col" class:reverse={ci % 2 === 1} style="--dur: {38 + ci * 7}s">
				<div class="track">
					{#each [...col, ...col] as name, i (i)}
						<img src="/icons/pals/{name}.webp" alt="" width="72" height="72" decoding="async" draggable="false" />
					{/each}
				</div>
			</div>
		{/each}
	</div>

	<header class="top">
		<LangSwitch />
	</header>

	<main>
		<section class="hero">
			<div class="card">
				<img class="mark" src="/icons/items/PalSphere_Mega.webp" alt="" width="60" height="60" />
				<p class="eyebrow">{m.app_title()}</p>
				<h1>{m.landing_title()}</h1>
				<p class="sub">{m.landing_sub()}</p>
				<a class="cta" href="/login/discord">
					<svg viewBox="0 0 127.14 96.36" width="20" height="20" aria-hidden="true" fill="currentColor">
						<path
							d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0a105.89 105.89 0 0 0-26.25 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15ZM42.45 65.69C36.18 65.69 31 60 31 53s5-12.74 11.43-12.74S54 46 53.89 53s-5.05 12.69-11.44 12.69Zm42.24 0C78.41 65.69 73.25 60 73.25 53s5-12.74 11.44-12.74S96.23 46 96.12 53s-5.04 12.69-11.43 12.69Z"
						/>
					</svg>
					{m.auth_login_discord()}
					<span class="shine"></span>
				</a>
				<p class="private">{m.landing_private()}</p>
				<ul class="stats">
					{#each stats as s, i (i)}
						<li class="tnum">{s.label({ count: nf.format(s.count) })}</li>
					{/each}
				</ul>
			</div>
		</section>

		<section class="features">
			{#each features as f, i (i)}
				<article class="feature" style="--delay: {0.35 + i * 0.08}s">
					<img src={f.icon} alt="" width="42" height="42" loading="lazy" decoding="async" />
					<h3>{f.title()}</h3>
					<p>{f.body()}</p>
				</article>
			{/each}
		</section>
	</main>

	<footer>
		<p>{m.landing_footer_license()}</p>
		<p>{m.landing_footer_disclaimer()}</p>
	</footer>
</div>

<style>
	.landing {
		position: relative;
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		overflow: clip;
		isolation: isolate;
	}

	/* ————— Ciel ————— */
	.sky {
		position: fixed;
		inset: 0;
		z-index: -2;
		background:
			radial-gradient(1px 1px at 12% 22%, hsl(220 40% 85% / 0.5), transparent 100%),
			radial-gradient(1px 1px at 31% 68%, hsl(220 40% 85% / 0.3), transparent 100%),
			radial-gradient(1.5px 1.5px at 47% 12%, hsl(220 40% 85% / 0.4), transparent 100%),
			radial-gradient(1px 1px at 63% 41%, hsl(220 40% 85% / 0.35), transparent 100%),
			radial-gradient(1px 1px at 78% 76%, hsl(220 40% 85% / 0.45), transparent 100%),
			radial-gradient(1.5px 1.5px at 89% 28%, hsl(220 40% 85% / 0.3), transparent 100%),
			radial-gradient(1px 1px at 22% 88%, hsl(220 40% 85% / 0.3), transparent 100%),
			linear-gradient(180deg, hsl(222 34% 5%), var(--bg) 55%, hsl(222 30% 8%));
	}
	.aurora {
		position: absolute;
		border-radius: 50%;
		filter: blur(70px);
		opacity: 0.3;
		animation: aurora 22s ease-in-out infinite alternate;
	}
	.a1 {
		width: 44vw;
		height: 34vh;
		left: 8%;
		top: -8%;
		background: radial-gradient(closest-side, var(--accent), transparent 70%);
	}
	.a2 {
		width: 38vw;
		height: 30vh;
		right: 4%;
		top: 16%;
		background: radial-gradient(closest-side, var(--el-dark), transparent 70%);
		animation-delay: -8s;
	}
	.a3 {
		width: 50vw;
		height: 28vh;
		left: 28%;
		bottom: -12%;
		background: radial-gradient(closest-side, var(--el-ice), transparent 70%);
		opacity: 0.1;
		animation-delay: -15s;
	}
	@keyframes aurora {
		from {
			transform: translate3d(0, 0, 0) scale(1);
		}
		to {
			transform: translate3d(4vw, 3vh, 0) scale(1.15);
		}
	}

	/* ————— Pals en dérive ————— */
	.drift {
		position: fixed;
		inset: 0;
		z-index: -1;
		display: flex;
		justify-content: space-between;
		padding: 0 6vw;
		mask-image: linear-gradient(180deg, transparent, black 14%, black 86%, transparent);
	}
	.col {
		overflow: hidden;
	}
	.track {
		display: flex;
		flex-direction: column;
		gap: 56px;
		padding: 28px 0;
		animation: drift var(--dur) linear infinite;
	}
	.col.reverse .track {
		animation-direction: reverse;
	}
	.track img {
		border-radius: 50%;
		filter: saturate(0.35) brightness(0.8);
		opacity: 0.45;
		user-select: none;
	}
	@keyframes drift {
		from {
			transform: translateY(0);
		}
		to {
			transform: translateY(-50%);
		}
	}

	/* ————— Entête ————— */
	.top {
		position: absolute;
		top: 14px;
		right: 16px;
		z-index: 2;
	}

	/* ————— Héros ————— */
	.hero {
		min-height: 88dvh;
		display: grid;
		place-items: center;
		padding: 56px 16px 24px;
	}
	.card {
		position: relative;
		max-width: 580px;
		text-align: center;
		padding: 44px 40px 36px;
		border-radius: var(--r-lg);
		border: 1px solid var(--border-strong);
		background: linear-gradient(180deg, hsl(222 26% 14% / 0.62), hsl(222 30% 8% / 0.72));
		backdrop-filter: blur(14px);
		-webkit-backdrop-filter: blur(14px);
		animation: rise 0.7s cubic-bezier(0.23, 1, 0.32, 1) both;
	}
	/* Liseré glossy en haut de la carte */
	.card::before {
		content: '';
		position: absolute;
		inset: 0 0 auto;
		height: 1px;
		border-radius: inherit;
		background: linear-gradient(90deg, transparent 8%, hsl(199 90% 75% / 0.55), transparent 92%);
	}
	.mark {
		margin-bottom: 14px;
		animation: bob 5s ease-in-out infinite;
	}
	@keyframes bob {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-6px);
		}
	}
	.eyebrow {
		margin: 0 0 10px;
		font-family: var(--font-display);
		font-size: 11.5px;
		font-weight: 600;
		letter-spacing: 0.24em;
		text-transform: uppercase;
		color: var(--accent);
	}
	.card h1 {
		font-size: clamp(28px, 5vw, 42px);
		line-height: 1.12;
		margin-bottom: 12px;
		background: linear-gradient(180deg, var(--text-1), hsl(220 25% 74%));
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
	}
	.sub {
		margin: 0 auto 28px;
		max-width: 46ch;
		font-size: 14.5px;
		color: var(--text-2);
		text-wrap: pretty;
	}

	/* CTA glossy */
	.cta {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 10px;
		padding: 13px 26px;
		border-radius: var(--r-md);
		overflow: hidden;
		font-family: var(--font-display);
		font-size: 15px;
		font-weight: 600;
		color: var(--accent-ink);
		background: linear-gradient(180deg, hsl(199 92% 62%), hsl(199 90% 46%));
		border: 1px solid hsl(199 90% 70% / 0.6);
		transition: transform 140ms cubic-bezier(0.23, 1, 0.32, 1), filter 140ms;
	}
	.cta:hover {
		color: var(--accent-ink);
		filter: brightness(1.08);
		transform: translateY(-1px);
	}
	.cta:active {
		transform: scale(0.97);
	}
	.cta .shine {
		position: absolute;
		inset: 0;
		background: linear-gradient(115deg, transparent 32%, hsl(0 0% 100% / 0.45) 48%, transparent 60%);
		transform: translateX(-110%);
	}
	.cta:hover .shine {
		animation: shine 0.9s cubic-bezier(0.23, 1, 0.32, 1);
	}
	@keyframes shine {
		to {
			transform: translateX(110%);
		}
	}

	.private {
		margin: 16px 0 0;
		font-size: 12px;
		color: var(--text-3);
	}

	.stats {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 6px 0;
		margin: 26px 0 0;
		padding: 14px 0 0;
		border-top: 1px solid var(--border);
		list-style: none;
		font-size: 12.5px;
		color: var(--text-2);
	}
	.stats li {
		display: flex;
		align-items: center;
	}
	.stats li + li::before {
		content: '';
		width: 3px;
		height: 3px;
		border-radius: 50%;
		background: var(--text-4);
		margin: 0 12px;
	}

	/* ————— Fonctionnalités ————— */
	.features {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
		gap: 12px;
		width: min(1080px, calc(100% - 32px));
		margin: 0 auto;
		padding-bottom: 48px;
	}
	.feature {
		padding: 18px 16px;
		border-radius: var(--r-md);
		border: 1px solid var(--border);
		background: linear-gradient(180deg, hsl(222 26% 12% / 0.6), hsl(222 28% 9% / 0.7));
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		transition: border-color 140ms, transform 140ms cubic-bezier(0.23, 1, 0.32, 1);
		animation: rise 0.7s cubic-bezier(0.23, 1, 0.32, 1) var(--delay) both;
	}
	.feature:hover {
		border-color: hsl(199 90% 55% / 0.35);
		transform: translateY(-2px);
	}
	.feature img {
		box-sizing: content-box;
		padding: 7px;
		border-radius: var(--r-sm);
		background: hsl(222 24% 19% / 0.8);
		border: 1px solid var(--border);
		filter: saturate(0.9);
		margin-bottom: 10px;
		transition: filter 140ms;
	}
	.feature:hover img {
		filter: saturate(1.15);
	}
	.feature h3 {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-1);
		margin-bottom: 4px;
	}
	.feature p {
		margin: 0;
		font-size: 12.5px;
		color: var(--text-2);
	}

	/* ————— Pied de page ————— */
	footer {
		padding: 0 16px 26px;
		text-align: center;
		font-size: 11.5px;
		color: var(--text-4);
	}
	footer p {
		margin: 2px 0;
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(16px);
		}
	}

	@media (max-width: 760px) {
		.drift {
			padding: 0 3vw;
		}
		.col:nth-child(2),
		.col:nth-child(3) {
			display: none;
		}
		.card {
			padding: 36px 22px 30px;
		}
		.hero {
			min-height: 92dvh;
		}
	}
</style>
