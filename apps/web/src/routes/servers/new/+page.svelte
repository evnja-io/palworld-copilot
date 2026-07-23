<script lang="ts">
	import { enhance } from '$app/forms';
	import { m } from '$lib/paraglide/messages';

	let { form } = $props();

	function errorMessage(code: string): string {
		const map: Record<string, string> = {
			name_required: m.servers_err_name_required(),
			server_limit: m.servers_err_server_limit()
		};
		return map[code] ?? code;
	}
</script>

<svelte:head><title>{m.servers_new_title()}</title></svelte:head>

<div class="wrap">
	<h1>{m.servers_new_title()}</h1>

	{#if form?.error}
		<p class="error">{errorMessage(form.error)}</p>
	{/if}

	<form method="POST" use:enhance>
		<label for="name">{m.servers_new_name()}</label>
		<input id="name" name="name" type="text" maxlength="60" required />
		<button type="submit">{m.servers_new_submit()}</button>
	</form>
</div>

<style>
	.wrap {
		max-width: 420px;
		margin: 0 auto;
		padding: 40px 16px;
	}
	h1 {
		margin-bottom: 20px;
	}
	.error {
		color: var(--el-fire);
		background: color-mix(in srgb, var(--el-fire) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--el-fire) 30%, transparent);
		border-radius: var(--r-sm);
		padding: 8px 12px;
		font-size: 13px;
		margin-bottom: 16px;
	}
	form {
		display: grid;
		gap: 10px;
	}
	label {
		font-size: 13px;
		color: var(--text-2);
	}
	input {
		padding: 9px 12px;
		border: 1px solid var(--border-strong);
		border-radius: var(--r-md);
		background: var(--input-bg);
		color: var(--text-1);
		font-size: 14px;
	}
	button {
		margin-top: 6px;
		padding: 10px 16px;
		border-radius: var(--r-md);
		background: var(--accent);
		color: var(--accent-ink);
		font-weight: 600;
		font-size: 14px;
	}
</style>
