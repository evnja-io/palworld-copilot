<script lang="ts">
	import type { GroupUser } from '$lib/types';

	let { users }: { users: GroupUser[] } = $props();
</script>

{#if users.length}
	<span class="avatars">
		{#each users as u (u.id)}
			{#if u.avatarUrl}
				<img src={u.avatarUrl} alt={u.username} title={u.username} width="28" height="28" />
			{:else}
				<span class="fallback" title={u.username}>{u.username.slice(0, 1).toUpperCase()}</span>
			{/if}
		{/each}
	</span>
{/if}

<style>
	.avatars {
		display: inline-flex;
	}
	.avatars > :global(*) {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		border: 2px solid var(--surface-1);
		margin-left: -8px;
	}
	.avatars > :global(:first-child) {
		margin-left: 0;
	}
	.fallback {
		display: grid;
		place-items: center;
		background: var(--surface-3);
		color: var(--text-2);
		font-size: 12px;
		font-weight: 600;
	}
</style>
