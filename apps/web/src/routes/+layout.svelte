<script lang="ts">
	// Les polices Atlas (Bricolage Grotesque + Space Grotesk) sont chargées via
	// Google Fonts dans app.html — plus de fonte auto-hébergée ici.
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Palworld Companion</title>
</svelte:head>

{@render children()}
