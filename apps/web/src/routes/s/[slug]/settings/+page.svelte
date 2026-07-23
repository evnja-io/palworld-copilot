<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	let { data } = $props();

	let copiedCode = $state<string | null>(null);

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
</script>

<svelte:head><title>{m.settings_title()}</title></svelte:head>

<div class="wrap">
	<h1>{m.settings_title()}</h1>

	<section>
		<h2>{m.settings_rename()}</h2>
		<form method="POST" action="?/rename" use:enhance>
			<input name="name" type="text" maxlength="60" value={data.server.name} required />
			<button type="submit">{m.settings_rename_save()}</button>
		</form>
	</section>

	<section>
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
			<button type="submit">{m.settings_invite_create()}</button>
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

	<section>
		<h2>{m.settings_members_title()}</h2>
		<ul class="members">
			{#each data.members as mem (mem.userId)}
				<li>
					{#if mem.avatarUrl}
						<img src={mem.avatarUrl} alt="" width="24" height="24" />
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
</div>

<style>
	.wrap {
		max-width: 680px;
		margin: 0 auto;
		padding: 24px 16px;
		display: grid;
		gap: 32px;
	}
	section {
		display: grid;
		gap: 12px;
	}
	h2 {
		font-size: 15px;
		font-weight: 600;
		color: var(--text-1);
	}
	form {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		align-items: end;
	}
	.invite-form label {
		display: grid;
		gap: 4px;
		font-size: 12px;
		color: var(--text-2);
	}
	input {
		padding: 8px 10px;
		border: 1px solid var(--border-strong);
		border-radius: var(--r-md);
		background: var(--input-bg);
		color: var(--text-1);
		font-size: 13px;
	}
	button {
		padding: 8px 14px;
		border-radius: var(--r-md);
		background: var(--accent);
		color: var(--accent-ink);
		font-weight: 600;
		font-size: 13px;
	}
	button.ghost {
		background: var(--surface-2);
		color: var(--text-2);
	}
	button.danger {
		background: color-mix(in srgb, var(--el-fire) 20%, transparent);
		color: var(--el-fire);
	}
	.empty {
		color: var(--text-3);
	}
	.invites,
	.members {
		list-style: none;
		display: grid;
		gap: 8px;
	}
	.invites li {
		display: grid;
		gap: 6px;
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		background: var(--surface-1);
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
		padding: 8px 12px;
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		background: var(--surface-1);
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
</style>
