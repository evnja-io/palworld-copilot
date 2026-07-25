<script lang="ts">
	// Onboarding — étapes 3 (import) + 4 (prêt/invitation), sur le serveur réel.
	// Direction « expédition nocturne » (variante E). Dédié : formulaire SFTP +
	// test ; local : renvoi vers l'outil d'envoi. Réutilise saveImportConfig,
	// /api/.../sftp-test et createInvite.
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { appHref } from '$lib/nav';
	import { m } from '$lib/paraglide/messages';

	let { data } = $props();

	let step = $state(0); // 0 = import, 1 = prêt
	// Copie locale amorcée par le load ; ré-écrite quand l'action ?/invite répond.
	// svelte-ignore state_referenced_locally
	let inviteCode = $state<string | null>(data.inviteCode);
	let copied = $state(false);
	let testResult = $state('');
	let sftpForm = $state<HTMLFormElement | null>(null);

	const activeDot = $derived(step === 0 ? 2 : 3);
	const stepLabels = [
		m.onboarding_step_type,
		m.onboarding_step_name,
		m.onboarding_step_import,
		m.onboarding_step_done
	];

	function inviteLink(code: string): string {
		return `${page.url.origin}/join/${code}`;
	}

	async function copyInvite() {
		if (!inviteCode) return;
		await navigator.clipboard.writeText(inviteLink(inviteCode));
		copied = true;
		setTimeout(() => (copied = false), 1600);
	}

	function sftpError(code: string): string {
		if (code === 'password_required') return m.settings_sftp_err_password_required();
		return m.settings_sftp_err_fields();
	}

	async function testSftp() {
		if (!sftpForm) return;
		testResult = m.settings_sftp_test_running();
		const fd = new FormData(sftpForm);
		const res = await fetch(`/api/servers/${page.params.slug}/sftp-test`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				host: String(fd.get('sftpHost') ?? ''),
				port: Number.parseInt(String(fd.get('sftpPort') ?? '22'), 10),
				user: String(fd.get('sftpUser') ?? ''),
				password: String(fd.get('sftpPassword') ?? ''),
				remoteDir: String(fd.get('remoteDir') ?? '') || null
			})
		});
		const body = await res.json();
		testResult = body.ok
			? m.settings_sftp_test_ok({ remoteDir: body.remoteDir })
			: m.settings_sftp_test_error({ error: body.error });
	}
</script>

<svelte:head><title>{m.onboarding_done_title()}</title></svelte:head>

<div class="page">
	<div class="frame">
		<div class="glow"></div>

		<header class="hd">
			<p class="kick">✦ {data.name}</p>
			<div class="dots">
				{#each stepLabels as _, i (i)}<span class="d" class:on={i === activeDot} class:done={i < activeDot}></span>{/each}
			</div>
		</header>

		{#if step === 0}
			<div class="stage">
				{#if data.kind === 'dedicated'}
					<h1 class="grad">{m.onboarding_import_dedicated_title()}</h1>
					<p class="sub">{m.onboarding_import_dedicated_subtitle()}</p>

					<form
						method="POST"
						action="?/saveSftp"
						bind:this={sftpForm}
						use:enhance={() => async ({ result, update }) => {
							await update({ reset: false });
							if (result.type === 'success' && result.data?.savedSftp) step = 1;
						}}
					>
						<div class="grid2">
							<label class="fld"><span>{m.settings_sftp_host()}</span><input name="sftpHost" type="text" required /></label>
							<label class="fld"><span>{m.settings_sftp_port()}</span><input name="sftpPort" type="number" min="1" max="65535" value="22" /></label>
							<label class="fld"><span>{m.settings_sftp_user()}</span><input name="sftpUser" type="text" required /></label>
							<label class="fld"><span>{m.settings_sftp_password()}</span><input name="sftpPassword" type="password" placeholder={m.settings_sftp_password_unset_placeholder()} /></label>
							<label class="fld wide"><span>{m.settings_sftp_remote_dir()}</span><input name="remoteDir" type="text" placeholder={m.settings_sftp_remote_dir_placeholder()} /></label>
						</div>

						{#if page.form?.action === 'sftp' && page.form?.error}
							<p class="error">{sftpError(page.form.error)}</p>
						{/if}

						<div class="row">
							<button type="button" class="test" onclick={testSftp}>{m.settings_sftp_test()}</button>
							{#if testResult}<span class="test-result">{testResult}</span>{/if}
						</div>

						<footer class="ft">
							<span class="sp"></span>
							<button type="submit" class="glossy"><span class="shine"></span>{m.onboarding_import_dedicated_save()}</button>
						</footer>
					</form>
				{:else}
					<h1 class="grad">{m.onboarding_import_local_title()}</h1>
					<p class="sub">{m.onboarding_import_local_subtitle()}</p>

					<a class="drop" href={appHref('/upload')}>
						<span class="dic">⬆</span>
						<span>{m.onboarding_import_local_cta()}</span>
					</a>

					<footer class="ft">
						<span class="sp"></span>
						<button type="button" class="ghost" onclick={() => (step = 1)}>{m.onboarding_import_skip()} →</button>
					</footer>
				{/if}
			</div>
		{:else}
			<div class="stage done">
				<div class="burst">🎉</div>
				<h1 class="grad">{m.onboarding_done_title()}</h1>
				<p class="sub">{m.onboarding_done_subtitle()}</p>

				<div class="invitebox">
					<p class="ihint">{m.onboarding_invite_hint()}</p>
					{#if inviteCode}
						<div class="invite">
							<code>{inviteLink(inviteCode)}</code>
							<button type="button" class="copy" onclick={copyInvite}>{copied ? m.onboarding_invite_copied() : m.onboarding_invite_copy()}</button>
						</div>
					{:else}
						<form method="POST" action="?/invite" use:enhance={() => async ({ result, update }) => {
							await update();
							if (result.type === 'success' && result.data?.inviteCode) inviteCode = String(result.data.inviteCode);
						}}>
							<button type="submit" class="ghost">{m.onboarding_invite_create()}</button>
						</form>
					{/if}
				</div>

				<a class="glossy finish" href={`/s/${page.params.slug}`}><span class="shine"></span>{m.onboarding_finish()}</a>
			</div>
		{/if}
	</div>
</div>

<style>
	.page { max-width: 620px; margin: 0 auto; padding: 32px 16px 56px; }
	.frame {
		position: relative; overflow: hidden; padding: 24px; min-height: 420px;
		display: flex; flex-direction: column;
		border-radius: var(--r-lg); border: 1px solid var(--border-strong);
		background: radial-gradient(120% 90% at 50% -10%, hsl(222 30% 15%), var(--surface-1) 55%);
	}
	.glow { position: absolute; top: -120px; left: 50%; transform: translateX(-50%); width: 380px; height: 260px; background: radial-gradient(closest-side, hsl(199 90% 55% / 0.22), transparent); pointer-events: none; }

	.hd { display: flex; align-items: center; justify-content: space-between; position: relative; gap: 12px; }
	.kick { color: var(--accent); font-size: 12px; font-weight: 600; letter-spacing: 0.04em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.dots { display: flex; gap: 6px; flex: none; }
	.d { width: 22px; height: 4px; border-radius: 999px; background: var(--surface-3); transition: background 200ms; }
	.d.on { background: var(--accent); box-shadow: 0 0 10px hsl(199 90% 55% / 0.7); }
	.d.done { background: color-mix(in srgb, var(--el-leaf) 60%, transparent); }

	.stage { position: relative; flex: 1; display: flex; flex-direction: column; padding-top: 18px; }
	h1 { font-size: 22px; font-family: var(--font-display); }
	.grad { background: linear-gradient(180deg, var(--text-1), hsl(199 60% 78%)); -webkit-background-clip: text; background-clip: text; color: transparent; }
	.sub { color: var(--text-2); font-size: 13px; margin: 6px 0 18px; line-height: 1.5; }

	form { display: flex; flex-direction: column; flex: 1; }
	.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
	.fld { display: grid; gap: 6px; }
	.fld.wide { grid-column: 1 / -1; }
	.fld span { font-size: 12px; color: var(--text-2); }
	.fld input { padding: 10px 13px; border: 1px solid var(--border-strong); border-radius: var(--r-md); background: hsl(222 30% 6% / 0.8); color: var(--text-1); font-size: 14px; }
	.fld input:focus { border-color: var(--accent); }

	.error { margin-top: 12px; color: var(--el-fire); background: color-mix(in srgb, var(--el-fire) 12%, transparent); border: 1px solid color-mix(in srgb, var(--el-fire) 30%, transparent); border-radius: var(--r-sm); padding: 8px 12px; font-size: 13px; }

	.row { display: flex; align-items: center; gap: 12px; margin-top: 14px; flex-wrap: wrap; }
	.test { padding: 9px 16px; font-size: 13px; border-radius: var(--r-md); border: 1px solid var(--border-strong); background: var(--surface-2); color: var(--text-1); }
	.test-result { font-size: 12px; color: var(--text-2); }

	.drop { display: grid; justify-items: center; gap: 8px; text-align: center; padding: 34px; border-radius: var(--r-lg); color: var(--text-1); font-size: 14px; font-weight: 600; text-decoration: none; border: 1px dashed var(--border-strong); background: hsl(222 30% 6% / 0.5); transition: border-color 160ms, background 160ms; }
	.drop:hover { border-color: var(--accent); background: hsl(222 26% 12% / 0.7); }
	.drop .dic { font-size: 26px; color: var(--accent); }

	.ft { display: flex; align-items: center; gap: 10px; margin-top: auto; padding-top: 18px; position: relative; }
	.sp { flex: 1; }
	.ghost { padding: 10px 16px; border-radius: var(--r-md); background: hsl(222 24% 19% / 0.6); border: 1px solid var(--border-strong); color: var(--text-2); font-size: 13px; }
	.glossy {
		position: relative; overflow: hidden; padding: 12px 22px; border-radius: var(--r-md); border: none;
		background: linear-gradient(180deg, hsl(199 92% 62%), hsl(199 90% 46%)); color: var(--accent-ink);
		font-weight: 600; font-size: 14px; font-family: var(--font-display); text-decoration: none;
		box-shadow: 0 6px 20px hsl(199 90% 45% / 0.35);
	}
	.shine { position: absolute; top: 0; left: -60%; width: 40%; height: 100%; background: linear-gradient(105deg, transparent, hsl(0 0% 100% / 0.35), transparent); transform: skewX(-18deg); animation: sweep 3.2s ease-in-out infinite; }

	.done { align-items: center; text-align: center; }
	.burst { font-size: 46px; filter: drop-shadow(0 0 20px hsl(199 90% 55% / 0.5)); }
	.invitebox { width: 100%; max-width: 420px; margin: 16px 0 8px; }
	.ihint { font-size: 12px; color: var(--text-3); margin-bottom: 8px; }
	.invite { display: flex; gap: 8px; }
	.invite code { flex: 1; padding: 10px 12px; border-radius: var(--r-md); background: hsl(222 30% 6% / 0.8); border: 1px solid var(--border); font-size: 12px; color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.copy { padding: 10px 12px; border-radius: var(--r-md); background: var(--accent-soft); color: var(--accent); border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent); font-size: 12px; }
	.finish { margin-top: 12px; }

	@keyframes sweep { 0%, 60% { left: -60%; } 85%, 100% { left: 130%; } }
	@media (max-width: 560px) { .grid2 { grid-template-columns: 1fr; } }
	@media (prefers-reduced-motion: reduce) { .shine { animation: none; } }
</style>
