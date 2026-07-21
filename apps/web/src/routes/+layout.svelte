<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { m } from '$lib/paraglide/messages';
	import LangSwitch from '$lib/components/LangSwitch.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<header>
	<strong>{m.app_title()}</strong>
	<LangSwitch />
</header>
<main>{@render children()}</main>
