<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages';

	let { data, form } = $props();

	function errorMessage(code: string): string {
		const map: Record<string, string> = {
			invite_not_found: m.join_err_invite_not_found(),
			invite_revoked: m.join_err_invite_revoked(),
			invite_expired: m.join_err_invite_expired(),
			invite_maxed: m.join_err_invite_maxed()
		};
		return map[code] ?? code;
	}

	const invalidReason = $derived(
		!data.invite ? 'invite_not_found' : !data.invite.valid ? (data.invite.reason ?? '') : ''
	);
</script>

<svelte:head><title>{m.join_title()}</title></svelte:head>

<div class="wrap">
	<h1>{m.join_title()}</h1>

	{#if !data.invite}
		<p class="error">{m.join_not_found()}</p>
	{:else if invalidReason}
		<p class="error">{errorMessage(invalidReason)}</p>
	{:else}
		<p class="prompt">{m.join_prompt({ name: data.invite.serverName })}</p>
		{#if form?.error}
			<p class="error">{errorMessage(form.error)}</p>
		{/if}
		{#if data.loggedIn}
			<form method="POST" use:enhance>
				<button type="submit">{m.join_accept({ name: data.invite.serverName })}</button>
			</form>
		{:else}
			<a class="login" href="/login/discord?redirectTo={encodeURIComponent(page.url.pathname)}"
				>{m.join_login()}</a
			>
		{/if}
	{/if}
</div>

<style>
	.wrap {
		max-width: 460px;
		margin: 0 auto;
		padding: 48px 16px;
		text-align: center;
	}
	h1 {
		margin-bottom: 16px;
	}
	.prompt {
		color: var(--text-2);
		margin-bottom: 20px;
	}
	.error {
		color: var(--el-fire);
		background: color-mix(in srgb, var(--el-fire) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--el-fire) 30%, transparent);
		border-radius: var(--r-sm);
		padding: 8px 12px;
		font-size: 13px;
	}
	button,
	.login {
		display: inline-block;
		padding: 11px 22px;
		border-radius: var(--r-md);
		background: var(--accent);
		color: var(--accent-ink);
		font-weight: 600;
		font-size: 14px;
	}
</style>
