<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import { absoluteUrl, alternates, ogLocale, SITE_URL } from '$lib/seo';

	let {
		title,
		description,
		path,
		image = '/logo.svg',
		type = 'website',
		indexable = true
	}: {
		/** Titre de la page, sans le nom du site (ajouté ici). */
		title: string;
		description: string;
		/** Chemin interne NON localisé et NON préfixé : '/paldex/SheepBall'. */
		path: string;
		image?: string;
		type?: 'website' | 'article';
		/** false sur les pages tenant (/s/<slug>/…) : elles sont en noindex via le
		 *  layout, et y émettre un canonical vers la page publique enverrait un
		 *  signal contradictoire. On garde alors juste titre + description. */
		indexable?: boolean;
	} = $props();

	const locale = $derived(getLocale());
	const canonical = $derived(absoluteUrl(path, locale));
	const alts = $derived(alternates(path));
	const fullTitle = $derived(`${title} — ${m.app_title()}`);
	const imageUrl = $derived(new URL(image, SITE_URL).href);
</script>

<svelte:head>
	<title>{fullTitle}</title>
	<meta name="description" content={description} />
	{#if indexable}
		<link rel="canonical" href={canonical} />
		{#each alts as alt (alt.hreflang)}
			<link rel="alternate" hreflang={alt.hreflang} href={alt.href} />
		{/each}

		<meta property="og:type" content={type} />
		<meta property="og:site_name" content={m.app_title()} />
		<meta property="og:title" content={fullTitle} />
		<meta property="og:description" content={description} />
		<meta property="og:url" content={canonical} />
		<meta property="og:image" content={imageUrl} />
		<meta property="og:locale" content={ogLocale(locale)} />

		<meta name="twitter:card" content="summary_large_image" />
		<meta name="twitter:title" content={fullTitle} />
		<meta name="twitter:description" content={description} />
		<meta name="twitter:image" content={imageUrl} />
	{/if}
</svelte:head>
