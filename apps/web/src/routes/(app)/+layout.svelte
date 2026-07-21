<script lang="ts">
	import { m } from '$lib/paraglide/messages';

	let { data, children } = $props();

	const nav = [
		{ href: '/paldex', label: m.nav_paldex },
		{ href: '/items', label: m.nav_items },
		{ href: '/craft', label: m.nav_craft },
		{ href: '/tech', label: m.nav_tech },
		{ href: '/buildings', label: m.nav_buildings },
		{ href: '/map', label: m.nav_map }
	];
</script>

<nav>
	{#each nav as item (item.href)}
		<a href={item.href}>{item.label()}</a>
	{/each}
</nav>
<div class="user">
	{#if data.user.avatarUrl}
		<img src={data.user.avatarUrl} alt="" width="24" height="24" />
	{/if}
	<span>{data.user.username}</span>
	<form method="POST" action="/logout"><button>{m.auth_logout()}</button></form>
</div>
{@render children()}
