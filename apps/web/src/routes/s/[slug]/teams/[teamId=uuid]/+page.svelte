<script lang="ts">
	import { page } from '$app/state';
	import TeamEditorScreen from './TeamEditorScreen.svelte';

	let { data } = $props();
</script>

<!-- Clé par teamId : en navigation client entre deux équipes, ce composant est
     réutilisé ; sans {#key}, le store de l'éditeur garderait l'ancienne équipe
     (écritures silencieuses sur le mauvais id). La clé recrée tout le sous-arbre.
     (Un composant enfant est nécessaire : <svelte:window>/<svelte:head> ne
     peuvent pas apparaître dans un bloc.) -->
{#key page.params.teamId}
	<TeamEditorScreen {data} />
{/key}
