<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { appHref } from '$lib/nav';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	let { data } = $props();

	let copiedCode = $state<string | null>(null);
	let testResult = $state('');
	let sftpForm = $state<HTMLFormElement | null>(null);

	function inviteLink(code: string): string {
		return `${page.url.origin}/join/${code}`;
	}

	async function copy(code: string) {
		await navigator.clipboard.writeText(inviteLink(code));
		copiedCode = code;
		setTimeout(() => (copiedCode = null), 1500);
	}

	function fmtDate(d: Date | string): string {
		return new Date(d).toLocaleDateString(getLocale());
	}

	function inviteStatus(inv: (typeof data.invites)[number]): string {
		if (inv.revokedAt) return m.settings_invite_revoked();
		if (inv.expiresAt && new Date(inv.expiresAt) <= new Date()) return m.settings_invite_expired();
		return m.settings_invite_active();
	}

	function usesLabel(inv: (typeof data.invites)[number]): string {
		return inv.maxUses === null
			? m.settings_invite_uses({ count: inv.useCount })
			: m.settings_invite_uses_max({ count: inv.useCount, max: inv.maxUses });
	}

	function sftpStatusLabel(status: 'running' | 'ok' | 'error' | null): string {
		if (status === 'running') return m.settings_sftp_status_running();
		if (status === 'ok') return m.settings_sftp_status_ok();
		if (status === 'error') return m.settings_sftp_status_error();
		return m.settings_sftp_status_never();
	}

	async function testSftpConnection() {
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

<svelte:head><title>{m.settings_title()}</title></svelte:head>

<div class="wrap">
	<header class="exp-hero">
		<p class="exp-kicker">✦ {data.server.name}</p>
		<h1 class="exp-grad">{m.settings_title()}</h1>
	</header>

	<section class="exp-card">
		<h2>{m.settings_rename()}</h2>
		<form method="POST" action="?/rename" use:enhance>
			<input name="name" type="text" maxlength="60" value={data.server.name} required />
			<button type="submit" class="exp-btn">{m.settings_rename_save()}</button>
		</form>
	</section>

	<section class="exp-card">
		<h2>{m.settings_invites_title()}</h2>
		<form class="invite-form" method="POST" action="?/createInvite" use:enhance>
			<label>
				{m.settings_invite_expiry()}
				<input name="expiresAt" type="datetime-local" />
			</label>
			<label>
				{m.settings_invite_maxuses()}
				<input name="maxUses" type="number" min="1" step="1" />
			</label>
			<button type="submit" class="exp-btn">{m.settings_invite_create()}</button>
		</form>

		{#if data.invites.length === 0}
			<p class="empty">{m.settings_no_invites()}</p>
		{:else}
			<ul class="invites">
				{#each data.invites as inv (inv.code)}
					<li>
						<code class="link">{inviteLink(inv.code)}</code>
						<span class="meta">{inviteStatus(inv)} · {usesLabel(inv)}</span>
						<div class="actions">
							<button type="button" class="ghost" onclick={() => copy(inv.code)}>
								{copiedCode === inv.code ? m.settings_invite_copied() : m.settings_invite_copy()}
							</button>
							{#if !inv.revokedAt}
								<form method="POST" action="?/revokeInvite" use:enhance>
									<input type="hidden" name="code" value={inv.code} />
									<button type="submit" class="danger">{m.settings_invite_revoke()}</button>
								</form>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section class="exp-card">
		<h2>{m.settings_members_title()}</h2>
		<ul class="members">
			{#each data.members as mem (mem.userId)}
				<li>
					{#if mem.avatarUrl}
						<img src={mem.avatarUrl} alt="" width="28" height="28" />
					{/if}
					<span class="name">{mem.username}</span>
					{#if mem.role === 'owner'}
						<span class="role">{m.settings_member_owner()}</span>
					{/if}
					<span class="since">{m.settings_member_since({ date: fmtDate(mem.joinedAt) })}</span>
				</li>
			{/each}
		</ul>
	</section>

	<section class="exp-card sftp">
		<h2>{m.settings_sftp_title()}</h2>
		{#if data.sftp}
			<p class="status">
				{#if data.sftp.lastImportAt}
					{m.settings_sftp_last_import_at({
						status: sftpStatusLabel(data.sftp.lastImportStatus),
						date: new Date(data.sftp.lastImportAt).toLocaleString(getLocale())
					})}
				{:else}
					{m.settings_sftp_last_import({ status: sftpStatusLabel(data.sftp.lastImportStatus) })}
				{/if}
				{#if data.sftp.lastImportError}
					<span class="err">({data.sftp.lastImportError})</span>
				{/if}
			</p>
		{/if}
		<form class="sftp-form" method="POST" action="?/saveSftp" use:enhance bind:this={sftpForm}>
			<label>
				{m.settings_sftp_host()}
				<input name="sftpHost" type="text" value={data.sftp?.sftpHost ?? ''} required />
			</label>
			<label>
				{m.settings_sftp_port()}
				<input name="sftpPort" type="number" min="1" max="65535" value={data.sftp?.sftpPort ?? 22} />
			</label>
			<label>
				{m.settings_sftp_user()}
				<input name="sftpUser" type="text" value={data.sftp?.sftpUser ?? ''} required />
			</label>
			<label>
				{m.settings_sftp_password()}
				<input
					name="sftpPassword"
					type="password"
					placeholder={data.sftp?.passwordSet
						? m.settings_sftp_password_set_placeholder()
						: m.settings_sftp_password_unset_placeholder()}
				/>
			</label>
			<label>
				{m.settings_sftp_remote_dir()}
				<input
					name="remoteDir"
					type="text"
					value={data.sftp?.remoteDir ?? ''}
					placeholder={m.settings_sftp_remote_dir_placeholder()}
				/>
			</label>
			<label class="checkbox">
				<input name="enabled" type="checkbox" checked={data.sftp?.enabled ?? false} />
				{m.settings_sftp_enabled()}
			</label>
			<div class="sftp-actions">
				<button type="submit" class="exp-btn">{m.settings_sftp_save()}</button>
				<button type="button" class="ghost" onclick={testSftpConnection}>{m.settings_sftp_test()}</button>
			</div>
		</form>
		{#if testResult}<p class="test-result">{testResult}</p>{/if}
		<p class="hint">{m.settings_sftp_test_hint()}</p>
		<p class="hint">
			{m.upload_local_world_hint()}
			<a href={appHref('/upload')}>{m.upload_title()}</a>
		</p>
	</section>
</div>

<style>
	.wrap {
		max-width: 680px;
		margin: 0 auto;
		padding: 32px 16px 56px;
		display: grid;
		gap: 20px;
	}
	.exp-hero h1 {
		font-size: 24px;
		margin: 6px 0 0;
	}

	.exp-card {
		display: grid;
		gap: 14px;
	}
	h2 {
		font-size: 15px;
		font-weight: 600;
		color: var(--text-1);
		margin: 0;
	}
	form {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		align-items: end;
	}
	.invite-form label,
	.sftp-form label {
		display: grid;
		gap: 5px;
		font-size: 12px;
		color: var(--text-2);
	}
	.sftp-form {
		width: 100%;
	}
	.sftp-form label {
		flex: 1 1 180px;
	}
	.sftp-form label.checkbox {
		flex-basis: 100%;
		display: flex;
		flex-direction: row-reverse;
		align-items: center;
		justify-content: flex-end;
		gap: 8px;
	}
	.sftp-actions {
		flex-basis: 100%;
		display: flex;
		gap: 8px;
	}
	input {
		padding: 9px 11px;
		border: 1px solid var(--border-strong);
		border-radius: var(--r-md);
		background: var(--input-bg);
		color: var(--text-1);
		font-size: 13px;
	}
	.exp-btn {
		font-size: 13px;
		padding: 9px 16px;
	}
	button.ghost {
		background: var(--surface-2);
		color: var(--text-2);
		border: 1px solid var(--border-strong);
		border-radius: var(--r-md);
		padding: 9px 14px;
		font-size: 13px;
		font-weight: 600;
	}
	button.danger {
		background: color-mix(in srgb, var(--el-fire) 18%, transparent);
		color: var(--el-fire);
		border: 1px solid color-mix(in srgb, var(--el-fire) 30%, transparent);
		border-radius: var(--r-md);
		padding: 9px 14px;
		font-size: 13px;
		font-weight: 600;
	}
	.empty {
		color: var(--text-3);
		font-size: 13px;
	}
	.invites,
	.members {
		list-style: none;
		display: grid;
		gap: 8px;
		margin: 0;
		padding: 0;
	}
	.invites li {
		display: grid;
		gap: 6px;
		padding: 12px;
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		background: var(--surface-2);
	}
	.link {
		font-size: 12px;
		color: var(--text-1);
		word-break: break-all;
	}
	.meta {
		font-size: 12px;
		color: var(--text-3);
	}
	.actions {
		display: flex;
		gap: 8px;
	}
	.members li {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		background: var(--surface-2);
	}
	.members img {
		border-radius: 50%;
	}
	.members .name {
		font-weight: 600;
		color: var(--text-1);
	}
	.members .role {
		font-size: 11px;
		color: var(--accent);
		background: var(--accent-soft);
		padding: 1px 8px;
		border-radius: 999px;
	}
	.members .since {
		margin-left: auto;
		font-size: 12px;
		color: var(--text-3);
	}
	.sftp .status {
		font-size: 12px;
		color: var(--text-2);
	}
	.sftp .err {
		color: var(--el-fire);
	}
	.sftp .test-result {
		font-size: 12px;
		color: var(--text-1);
	}
	.sftp .hint {
		font-size: 11px;
		color: var(--text-3);
		margin: 0;
	}
	.sftp .hint a {
		color: var(--accent);
	}
</style>
