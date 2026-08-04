<script lang="ts">
	// Onboarding — étapes 1 (type) + 2 (nom). Direction « expédition nocturne »
	// (variante E). La création POST bascule ensuite vers /s/[slug]/setup pour
	// l'import et l'invitation.
	import { enhance } from '$app/forms';
	import { m } from '$lib/paraglide/messages';

	let { form } = $props();

	type Kind = 'local' | 'dedicated';
	let step = $state(0); // 0 = type, 1 = nom
	let kind = $state<Kind | null>(null);
	let name = $state('');

	const steps = [
		m.onboarding_step_type,
		m.onboarding_step_name,
		m.onboarding_step_import,
		m.onboarding_step_done
	];

	function errorMessage(code: string): string {
		const map: Record<string, string> = {
			name_required: m.servers_err_name_required(),
			server_limit: m.servers_err_server_limit()
		};
		return map[code] ?? code;
	}
</script>

<svelte:head><title>{m.servers_new_title()}</title></svelte:head>

<div class="page">
	<div class="ambience" aria-hidden="true"></div>
	<img class="floater f1" src="/icons/pals/SheepBall.webp" alt="" aria-hidden="true" loading="lazy" />
	<img class="floater f2" src="/icons/pals/Kitsunebi.webp" alt="" aria-hidden="true" loading="lazy" />
	<a class="escape" href="/servers">← {m.servers_title()}</a>

	<div class="frame">
		<div class="glow"></div>

		<header class="hd">
			<p class="kick">✦ {m.onboarding_kicker()}</p>
			<div class="dots">
				{#each steps as _, i (i)}<span class="d" class:on={i === step} class:done={i < step}></span>{/each}
			</div>
		</header>

		{#if form?.error}
			<p class="error">{errorMessage(form.error)}</p>
		{/if}

		<form method="POST" use:enhance>
			<input type="hidden" name="kind" value={kind ?? ''} />

			{#if step === 0}
				<div class="stage">
					<h1 class="grad">{m.onboarding_type_title()}</h1>
					<p class="sub">{m.onboarding_type_subtitle()}</p>
					<div class="types">
						<button
							type="button"
							class="type type-local"
							class:on={kind === 'local'}
							aria-pressed={kind === 'local'}
							onclick={() => (kind = 'local')}
						>
							<span class="halo"></span>
							<em class="badge">{m.onboarding_local_badge()}</em>
							<span class="ic">🎒</span>
							<strong>{m.onboarding_local_title()}</strong>
							<span class="tag">{m.onboarding_local_tagline()}</span>
							<p class="bl">{m.onboarding_local_blurb()}</p>
						</button>
						<button
							type="button"
							class="type type-dedicated"
							class:on={kind === 'dedicated'}
							aria-pressed={kind === 'dedicated'}
							onclick={() => (kind = 'dedicated')}
						>
							<span class="halo"></span>
							<span class="ic">🛰️</span>
							<strong>{m.onboarding_dedicated_title()}</strong>
							<span class="tag">{m.onboarding_dedicated_tagline()}</span>
							<p class="bl">{m.onboarding_dedicated_blurb()}</p>
						</button>
					</div>
				</div>
			{:else}
				<div class="stage">
					<h1 class="grad">{m.onboarding_name_title()}</h1>
					<p class="sub">{m.onboarding_name_subtitle()}</p>
					<label class="fld big">
						<span>{m.onboarding_name_label()}</span>
						<!-- svelte-ignore a11y_autofocus -->
						<input name="name" type="text" maxlength="60" autofocus required placeholder="La Palcolonie" bind:value={name} />
					</label>
				</div>
			{/if}

			<footer class="ft">
				{#if step === 1}<button type="button" class="ghost" onclick={() => (step = 0)}>← {m.onboarding_back()}</button>{/if}
				<span class="sp"></span>
				{#if step === 0}
					<button type="button" class="glossy" disabled={kind === null} onclick={() => (step = 1)}>
						<span class="shine"></span>{m.onboarding_next()}
					</button>
				{:else}
					<button type="submit" class="glossy" disabled={name.trim().length === 0}>
						<span class="shine"></span>{m.onboarding_create()}
					</button>
				{/if}
			</footer>
		</form>
	</div>
</div>

<style>
	/* Onboarding — écran 3d : fond d'ambiance, Pals flottants, carte glassy. */
	.page {
		position: relative;
		min-height: 600px;
		display: grid;
		place-items: center;
		overflow: hidden;
		padding: 40px 16px;
	}
	.ambience {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(60% 45% at 50% -5%, rgba(255, 90, 15, 0.22), transparent 65%),
			radial-gradient(45% 40% at 90% 100%, rgba(139, 92, 246, 0.14), transparent 60%);
		pointer-events: none;
	}
	.floater {
		position: absolute;
		pointer-events: none;
		object-fit: contain;
	}
	.f1 {
		left: 7%;
		bottom: 10%;
		width: 76px;
		opacity: 0.5;
		animation: pw-float 7s ease-in-out infinite;
	}
	.f2 {
		right: 8%;
		top: 14%;
		width: 88px;
		opacity: 0.55;
		animation: pw-float 5.5s ease-in-out infinite;
	}

	.escape {
		position: absolute;
		top: 28px;
		left: 36px;
		font-size: 13px;
		color: var(--color-muted);
		z-index: 1;
	}
	.escape:hover {
		color: var(--color-text);
	}

	/* Carte glassy 560 px (3d l.482). */
	.frame {
		position: relative;
		width: 100%;
		max-width: 560px;
		border-radius: 26px;
		background: rgba(21, 22, 28, 0.85);
		backdrop-filter: blur(10px);
		border: 1px solid rgba(255, 255, 255, 0.08);
		padding: 38px 42px;
		box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5);
	}
	/* Le halo de l'ancienne direction est remplacé par les deux radiaux du fond. */
	.glow {
		display: none;
	}

	.hd {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 30px;
	}
	.kick {
		margin: 0;
		font-size: 11.5px;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: #ff9450;
	}
	/* Étapes en barres 26×5 (3d l.485) — plus les points de l'ancienne version. */
	.dots {
		display: flex;
		gap: 6px;
	}
	.d {
		width: 26px;
		height: 5px;
		border-radius: 99px;
		background: rgba(255, 255, 255, 0.12);
	}
	.d.done {
		background: #3fb950;
	}
	.d.on {
		background: #ff7a2f;
		box-shadow: 0 0 10px rgba(255, 122, 47, 0.7);
	}

	.error {
		margin: 0 0 16px;
		padding: 10px 14px;
		border-radius: var(--radius-panel);
		background: rgba(255, 90, 15, 0.12);
		border: 1px solid rgba(255, 90, 15, 0.3);
		color: #ffab73;
		font-size: 13px;
	}

	h1 {
		margin: 0 0 10px;
		font-size: 36px;
		font-weight: 800;
		letter-spacing: -0.02em;
		line-height: 1.1;
	}
	.sub {
		margin: 0 0 26px;
		font-size: 14px;
		line-height: 1.6;
		color: var(--color-muted);
		text-wrap: pretty;
	}

	/* Choix du type de monde (étape 1) — cartes teintées. */
	.types {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}
	.type {
		position: relative;
		overflow: hidden;
		text-align: left;
		display: grid;
		gap: 6px;
		align-content: start;
		padding: 18px;
		border-radius: var(--radius-card);
		background: rgba(13, 14, 18, 0.7);
		border: 1px solid var(--color-line);
		transition:
			border-color 160ms var(--ease-out-soft),
			transform 160ms var(--ease-out-soft);
	}
	.type:hover {
		background: rgba(13, 14, 18, 0.7);
		border-color: rgba(255, 122, 47, 0.4);
		transform: translateY(-2px);
	}
	.type.on {
		border-color: rgba(255, 122, 47, 0.6);
		box-shadow: 0 0 0 4px rgba(255, 122, 47, 0.12);
	}
	.halo {
		position: absolute;
		inset: 0;
		opacity: 0;
		background: radial-gradient(120% 80% at 50% 0%, rgba(255, 90, 15, 0.18), transparent);
		transition: opacity 200ms;
		pointer-events: none;
	}
	.type.on .halo {
		opacity: 1;
	}
	.badge {
		justify-self: start;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		font-style: normal;
		color: #ff9450;
		background: rgba(255, 90, 15, 0.14);
		border-radius: 999px;
		padding: 3px 9px;
	}
	.ic {
		font-size: 26px;
	}
	.type strong {
		font-family: var(--font-display);
		font-size: 16px;
		font-weight: 800;
	}
	.tag {
		font-size: 12px;
		color: #ff9450;
	}
	.bl {
		margin: 0;
		font-size: 12.5px;
		line-height: 1.5;
		color: var(--color-muted);
	}

	/* Champ « nom du monde » (3d l.494). */
	.fld {
		display: block;
	}
	.fld span {
		display: block;
		font-size: 12px;
		font-weight: 600;
		color: var(--color-muted);
		margin-bottom: 8px;
	}
	.fld input {
		width: 100%;
		border-radius: 14px;
		background: var(--color-bg);
		border: 1.5px solid rgba(255, 255, 255, 0.09);
		padding: 15px 18px;
		font-size: 16px;
		color: var(--color-text);
		transition:
			border-color 160ms var(--ease-out-soft),
			box-shadow 160ms var(--ease-out-soft);
	}
	.fld input:focus {
		outline: none;
		border-color: rgba(255, 122, 47, 0.6);
		box-shadow: 0 0 0 4px rgba(255, 122, 47, 0.12);
	}

	.ft {
		display: flex;
		align-items: center;
		margin-top: 34px;
	}
	.sp {
		flex: 1;
	}
	.ghost {
		padding: 12px 22px;
		border-radius: 999px;
		border: 1px solid rgba(255, 255, 255, 0.14);
		background: none;
		font-size: 13.5px;
		font-weight: 600;
	}
	.ghost:hover {
		background: rgba(255, 255, 255, 0.08);
	}
	.glossy {
		position: relative;
		overflow: hidden;
		padding: 12px 26px;
		border-radius: 999px;
		border: none;
		background: linear-gradient(135deg, #ff5a0f, #ff8a3d);
		color: #fff;
		font-size: 13.5px;
		font-weight: 700;
		box-shadow: 0 8px 28px rgba(255, 90, 15, 0.35);
		transition:
			transform var(--duration-hover) var(--ease-out-soft),
			box-shadow var(--duration-hover) var(--ease-out-soft);
	}
	.glossy:hover:not(:disabled) {
		background: linear-gradient(135deg, #ff6a24, #ff9a55);
		transform: translateY(-2px);
		box-shadow: 0 12px 36px rgba(255, 90, 15, 0.5);
	}
	.glossy:disabled {
		opacity: 0.45;
		box-shadow: none;
		transform: none;
	}
	/* Atlas n'a pas de balayage brillant. */
	.shine {
		display: none;
	}

	@media (max-width: 640px) {
		.page {
			padding: 72px 16px 40px;
		}
		.frame {
			padding: 26px 22px;
			border-radius: 22px;
		}
		.escape {
			top: 20px;
			left: 20px;
		}
		h1 {
			font-size: 28px;
		}
		.types {
			grid-template-columns: 1fr;
		}
		.floater {
			display: none;
		}
	}
</style>
