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
	.page { max-width: 620px; margin: 0 auto; padding: 32px 16px; }
	.escape {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		margin-bottom: 12px;
		font-size: 13px;
		color: var(--text-3);
		transition: color 140ms;
	}
	.escape:hover { color: var(--accent); }
	.frame {
		position: relative; overflow: hidden; padding: 24px; min-height: 420px;
		display: flex; flex-direction: column;
		border-radius: var(--r-lg); border: 1px solid var(--border-strong);
		background: radial-gradient(120% 90% at 50% -10%, hsl(222 30% 15%), var(--surface-1) 55%);
	}
	.glow { position: absolute; top: -120px; left: 50%; transform: translateX(-50%); width: 380px; height: 260px; background: radial-gradient(closest-side, hsl(199 90% 55% / 0.22), transparent); pointer-events: none; }

	.hd { display: flex; align-items: center; justify-content: space-between; position: relative; }
	.kick { color: var(--accent); font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; }
	.dots { display: flex; gap: 6px; }
	.d { width: 22px; height: 4px; border-radius: 999px; background: var(--surface-3); transition: background 200ms; }
	.d.on { background: var(--accent); box-shadow: 0 0 10px hsl(199 90% 55% / 0.7); }
	.d.done { background: color-mix(in srgb, var(--el-leaf) 60%, transparent); }

	.error { margin-top: 14px; color: var(--el-fire); background: color-mix(in srgb, var(--el-fire) 12%, transparent); border: 1px solid color-mix(in srgb, var(--el-fire) 30%, transparent); border-radius: var(--r-sm); padding: 8px 12px; font-size: 13px; }

	form { display: flex; flex-direction: column; flex: 1; }
	.stage { position: relative; flex: 1; padding-top: 18px; }
	h1 { font-size: 23px; font-family: var(--font-display); }
	.grad { background: linear-gradient(180deg, var(--text-1), hsl(199 60% 78%)); -webkit-background-clip: text; background-clip: text; color: transparent; }
	.sub { color: var(--text-2); font-size: 13px; margin: 6px 0 18px; line-height: 1.5; }

	.types { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
	.type { position: relative; overflow: hidden; text-align: left; display: grid; gap: 6px; align-content: start; padding: 18px; border-radius: var(--r-lg); background: hsl(222 24% 12% / 0.7); border: 1px solid var(--border); transition: border-color 160ms, transform 160ms; }
	.type:hover { transform: translateY(-2px); border-color: var(--border-strong); }
	.type.on { border-color: var(--accent); }
	.type-local.on { border-color: var(--el-leaf); }
	.halo { position: absolute; inset: 0; opacity: 0; background: radial-gradient(120% 80% at 50% 0%, hsl(199 90% 55% / 0.18), transparent); transition: opacity 200ms; }
	.type.on .halo, .type:hover .halo { opacity: 1; }
	.type-local.on .halo { background: radial-gradient(120% 80% at 50% 0%, color-mix(in srgb, var(--el-leaf) 20%, transparent), transparent); }
	.badge { position: absolute; top: 14px; right: 14px; font-style: normal; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--el-leaf); background: color-mix(in srgb, var(--el-leaf) 16%, transparent); padding: 3px 7px; border-radius: 999px; }
	.type .ic { font-size: 30px; }
	.type strong { font-size: 16px; }
	.tag { color: var(--accent); font-size: 12px; }
	.type-local .tag { color: var(--el-leaf); }
	.bl { color: var(--text-2); font-size: 12px; line-height: 1.55; margin-top: 2px; }

	.fld { display: grid; gap: 7px; }
	.fld.big input { padding: 13px 16px; font-size: 16px; }
	.fld span { font-size: 12px; color: var(--text-2); }
	.fld input { border: 1px solid var(--border-strong); border-radius: var(--r-md); background: hsl(222 30% 6% / 0.8); color: var(--text-1); }
	.fld input:focus { border-color: var(--accent); }

	.ft { display: flex; align-items: center; gap: 10px; margin-top: 18px; position: relative; }
	.sp { flex: 1; }
	.ghost { padding: 10px 16px; border-radius: var(--r-md); background: hsl(222 24% 19% / 0.6); border: 1px solid var(--border-strong); color: var(--text-2); font-size: 13px; }
	.glossy {
		position: relative; overflow: hidden; padding: 12px 22px; border-radius: var(--r-md); border: none;
		background: linear-gradient(180deg, hsl(199 92% 62%), hsl(199 90% 46%)); color: var(--accent-ink);
		font-weight: 600; font-size: 14px; font-family: var(--font-display);
		box-shadow: 0 6px 20px hsl(199 90% 45% / 0.35);
	}
	.glossy:hover { background: linear-gradient(180deg, hsl(199 94% 66%), hsl(199 90% 50%)); color: var(--accent-ink); border-color: transparent; }
	.glossy:disabled { opacity: 0.45; box-shadow: none; }
	.shine { position: absolute; top: 0; left: -60%; width: 40%; height: 100%; background: linear-gradient(105deg, transparent, hsl(0 0% 100% / 0.35), transparent); transform: skewX(-18deg); animation: sweep 3.2s ease-in-out infinite; }
	.glossy:disabled .shine { display: none; }

	@keyframes sweep { 0%, 60% { left: -60%; } 85%, 100% { left: 130%; } }
	@media (max-width: 560px) { .types { grid-template-columns: 1fr; } }
	@media (prefers-reduced-motion: reduce) { .shine { animation: none; } .type { transition: none; } }
</style>
