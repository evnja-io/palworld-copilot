<script lang="ts">
	import { getLocale, setLocale } from '$lib/paraglide/runtime';
</script>

<button
	onclick={() => setLocale(getLocale() === 'fr' ? 'en' : 'fr')}
	aria-label="Switch language"
>
	{getLocale() === 'fr' ? 'EN' : 'FR'}
</button>
