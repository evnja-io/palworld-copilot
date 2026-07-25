import { paraglideVitePlugin } from '@inlang/paraglide-js';
import adapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// Locale par cookie : conservée telle quelle sur tout ce qui est privé ou
// technique (pas de préfixe /en/ dans ces URLs).
const COOKIE_LOCALE = ['cookie', 'preferredLanguage', 'baseLocale'] as const;

export default defineConfig({
	plugins: [
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			// « url » en tête : les pages publiques sont indexables en FR (sans
			// préfixe, locale de base) et en EN sous /en/. Voir urlPatterns par
			// défaut du runtime, qui décrit déjà exactement ce découpage.
			strategy: ['url', ...COOKIE_LOCALE],
			// Premier match gagnant. Le privé garde la locale par cookie : inutile
			// de polluer /s/<slug>/… avec un préfixe de langue, ces pages sont en
			// noindex. src/hooks.ts dé-localise malgré tout, donc /en/s/… résout.
			routeStrategies: [
				{ match: '/api/:path(.*)?', exclude: true },
				{ match: '/ingest/:path(.*)?', exclude: true },
				{ match: '/s/:path(.*)?', strategy: [...COOKIE_LOCALE] },
				{ match: '/servers', strategy: [...COOKIE_LOCALE] },
				{ match: '/servers/:path(.*)?', strategy: [...COOKIE_LOCALE] },
				{ match: '/join/:path(.*)?', strategy: [...COOKIE_LOCALE] }
			]
		}),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			adapter: adapter(),
			// Requis pour que PostHog session replay fonctionne correctement avec SSR.
			paths: { relative: false }
		})
	]
});
