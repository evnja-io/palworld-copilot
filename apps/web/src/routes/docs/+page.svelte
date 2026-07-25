<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import Seo from '$lib/components/Seo.svelte';

	const GITHUB_URL = 'https://github.com/evnja-io/palworld-copilot';

	const steps = [
		{ title: m.docs_start_signin_title, body: m.docs_start_signin_body },
		{ title: m.docs_start_create_title, body: m.docs_start_create_body },
		{ title: m.docs_start_invite_title, body: m.docs_start_invite_body },
		{ title: m.docs_start_claim_title, body: m.docs_start_claim_body },
		{ title: m.docs_start_sftp_title, body: m.docs_start_sftp_body }
	];

	const sharing = [m.docs_sharing_list_1, m.docs_sharing_list_2, m.docs_sharing_list_3, m.docs_sharing_list_4];
</script>

<Seo title={m.docs_title()} description={m.docs_intro()} path="/docs" />

<!-- La marque de l'en-tête ramène à l'accueil : le lien « retour » devient redondant. -->
<AppHeader />

<div class="docs">

	<main>
		<h1>{m.docs_title()}</h1>
		<p class="intro">{m.docs_intro()}</p>

		<section>
			<h2>{m.docs_start_title()}</h2>
			<ol class="steps">
				{#each steps as s, i (i)}
					<li>
						<h3><span class="num tnum">{i + 1}</span>{s.title()}</h3>
						<p>{s.body()}</p>
					</li>
				{/each}
			</ol>
		</section>

		<section>
			<h2>{m.docs_sharing_title()}</h2>
			<p>{m.docs_sharing_body()}</p>
			<ul class="sharing">
				{#each sharing as item, i (i)}
					<li>{item()}</li>
				{/each}
			</ul>
		</section>

		<section>
			<h2>{m.docs_selfhost_title()}</h2>
			<p>{m.docs_selfhost_body()}</p>
			<a class="ghost" href="{GITHUB_URL}#self-hosting" target="_blank" rel="noopener">
				<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true" fill="currentColor">
					<path
						d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.42 7.42 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
					/>
				</svg>
				{m.docs_selfhost_cta()}
			</a>
		</section>
	</main>

	<footer>
		<p>{m.landing_footer_license()}</p>
		<p>{m.landing_footer_disclaimer()}</p>
	</footer>
</div>

<style>
	.docs {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
	}

	main {
		flex: 1;
		width: min(760px, calc(100% - 32px));
		margin: 0 auto;
		padding: 24px 0 56px;
	}

	h1 {
		font-size: clamp(26px, 4vw, 34px);
		margin-bottom: 10px;
	}
	.intro {
		margin: 0 0 36px;
		max-width: 62ch;
		font-size: 14px;
		color: var(--text-2);
		text-wrap: pretty;
	}

	section + section {
		margin-top: 40px;
	}
	h2 {
		font-family: var(--font-display);
		font-size: 19px;
		color: var(--text-1);
		margin-bottom: 14px;
	}
	section > p {
		margin: 0 0 14px;
		font-size: 13.5px;
		color: var(--text-2);
	}

	.steps {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 10px;
	}
	.steps li {
		padding: 16px 18px;
		border-radius: var(--r-md);
		border: 1px solid var(--border);
		background: linear-gradient(180deg, hsl(222 26% 12% / 0.6), hsl(222 28% 9% / 0.7));
	}
	.steps h3 {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 14px;
		font-weight: 600;
		color: var(--text-1);
		margin-bottom: 6px;
	}
	.num {
		flex: none;
		display: inline-grid;
		place-items: center;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		font-family: var(--font-display);
		font-size: 12px;
		font-weight: 600;
		color: var(--accent-ink);
		background: linear-gradient(180deg, hsl(199 92% 62%), hsl(199 90% 46%));
	}
	.steps p {
		margin: 0;
		font-size: 13px;
		color: var(--text-2);
	}

	.sharing {
		margin: 0;
		padding: 0 0 0 18px;
		display: grid;
		gap: 8px;
		font-size: 13px;
		color: var(--text-2);
	}
	.sharing li::marker {
		color: var(--accent);
	}

	.ghost {
		display: inline-flex;
		align-items: center;
		gap: 9px;
		padding: 11px 20px;
		border-radius: var(--r-md);
		font-family: var(--font-display);
		font-size: 13.5px;
		font-weight: 600;
		color: var(--text-1);
		border: 1px solid var(--border-strong);
		background: hsl(222 24% 19% / 0.6);
		transition: border-color 140ms, transform 140ms cubic-bezier(0.23, 1, 0.32, 1);
	}
	.ghost:hover {
		border-color: hsl(199 90% 55% / 0.45);
		transform: translateY(-1px);
	}

	footer {
		padding: 0 16px 26px;
		text-align: center;
		font-size: 11.5px;
		color: var(--text-4);
	}
	footer p {
		margin: 2px 0;
	}
</style>
