<script lang="ts">
	import '@fontsource-variable/space-grotesk';
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Palworld Companion</title>
</svelte:head>

{@render children()}
