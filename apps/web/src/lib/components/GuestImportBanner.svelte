<script lang="ts">
	import { browser } from '$app/environment';
	import { invalidateAll } from '$app/navigation';
	import posthog from 'posthog-js';
	import { m } from '$lib/paraglide/messages';
	import { GUEST_PROGRESS_KINDS } from '$lib/guest';
	import { clearLocalProgress, readLocalProgress } from '$lib/game/localProgress';
	import { clearLocalTeams, listLocalTeams } from '$lib/game/localTeams';

	// Seule surface qui couvre les DEUX entonnoirs (création de serveur via
	// /servers/new → /s/<slug>/setup, et adhésion via /join/<code> → /s/<slug>),
	// plus le cas « je me connecte plus tard depuis n'importe quelle page » :
	// toutes ces destinations rendent le layout tenant.
	let { slug }: { slug: string } = $props();

	const DISMISSED_KEY = 'guest-import-dismissed-v1';

	type Counts = { pals: number; tech: number; relics: number; teams: number };
	let counts = $state<Counts | null>(null);
	let status = $state<'idle' | 'running' | 'done' | 'error'>('idle');
	let truncated = $state(false);

	function dismissedSlugs(): string[] {
		if (!browser) return [];
		try {
			const raw = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]');
			return Array.isArray(raw) ? raw.filter((s): s is string => typeof s === 'string') : [];
		} catch {
			return [];
		}
	}

	function refresh() {
		const next: Counts = {
			pals: readLocalProgress('pal_caught').length,
			tech: readLocalProgress('tech_unlocked').length,
			relics: readLocalProgress('marker').length,
			teams: listLocalTeams().length
		};
		const total = next.pals + next.tech + next.relics + next.teams;
		counts = total > 0 && !dismissedSlugs().includes(slug) ? next : null;
	}

	// Lecture au montage seulement : localStorage est invisible au rendu serveur,
	// donc pas de bannière dans le HTML initial (pas de clignotement inverse).
	$effect(() => {
		if (browser) refresh();
	});

	function dismiss() {
		try {
			localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissedSlugs(), slug]));
		} catch {
			/* stockage indisponible : la bannière réapparaîtra, sans casse */
		}
		counts = null;
		posthog.capture('guest_import_dismissed', { server_slug: slug });
	}

	async function run() {
		if (status === 'running') return; // garde anti double-soumission
		status = 'running';
		const payload = {
			progress: Object.fromEntries(GUEST_PROGRESS_KINDS.map((k) => [k, readLocalProgress(k)])),
			// Le serveur réémet les ids : on n'envoie que le contenu.
			teams: listLocalTeams().map((t) => ({ name: t.name, notes: t.notes, slots: t.slots }))
		};
		const res = await fetch(`/api/servers/${slug}/guest-import`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(payload)
		}).catch(() => null);
		if (!res?.ok) {
			status = 'error';
			return;
		}
		const result = await res.json().catch(() => null);
		truncated = Boolean(result?.teamsTruncated);
		// Purge seulement après un succès confirmé : en cas d'échec, les données
		// locales restent disponibles pour une nouvelle tentative.
		clearLocalProgress([...GUEST_PROGRESS_KINDS]);
		clearLocalTeams();
		posthog.capture('guest_import_completed', { server_slug: slug, ...result });
		status = 'done';
		counts = null;
		await invalidateAll();
	}
</script>

{#if counts}
	<div class="banner">
		<div class="text">
			<strong>{m.guest_import_title()}</strong>
			<span
				>{m.guest_import_body({
					pals: counts.pals,
					tech: counts.tech,
					relics: counts.relics,
					teams: counts.teams
				})}</span
			>
		</div>
		<div class="actions">
			<button class="primary" onclick={run} disabled={status === 'running'}>
				{status === 'running' ? m.guest_import_running() : m.guest_import_cta()}
			</button>
			<button class="ghost" onclick={dismiss}>{m.guest_import_later()}</button>
		</div>
	</div>
{:else if status === 'done'}
	<p class="flash">
		{m.guest_import_done()}
		{#if truncated}<span class="warn">{m.guest_import_truncated()}</span>{/if}
	</p>
{:else if status === 'error'}
	<p class="flash error">{m.guest_import_error()}</p>
{/if}

<style>
	.banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
		padding: 10px 16px;
		border-bottom: 1px solid var(--focus-ring);
		background: var(--accent-soft);
		font-size: 13px;
	}
	.text {
		display: flex;
		align-items: baseline;
		gap: 8px;
		flex-wrap: wrap;
		min-width: 0;
	}
	.text strong {
		font-weight: 600;
	}
	.text span {
		color: var(--text-2);
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.primary {
		font-size: 13px;
		font-weight: 500;
		color: var(--accent-ink);
		background: var(--accent);
		border: none;
		border-radius: var(--r-sm);
		padding: 6px 14px;
		white-space: nowrap;
	}
	.primary:disabled {
		opacity: 0.6;
	}
	.ghost {
		font-size: 12px;
		color: var(--text-3);
		background: none;
		white-space: nowrap;
	}
	.flash {
		margin: 0;
		padding: 8px 16px;
		border-bottom: 1px solid var(--border);
		background: var(--surface-2);
		color: var(--text-2);
		font-size: 12px;
		text-align: center;
	}
	.flash.error {
		color: var(--el-fire);
	}
	.warn {
		margin-left: 8px;
		color: var(--el-electricity);
	}
</style>
