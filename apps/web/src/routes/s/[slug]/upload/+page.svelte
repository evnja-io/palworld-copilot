<script lang="ts">
	import type { ActionResult } from '@sveltejs/kit';
	import { deserialize } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { upload } from '@vercel/blob/client';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import { selectUploadFiles, validateSelection, type FileDescriptor, type KeptFile } from '$lib/upload-select';

	let { data } = $props();

	type Phase = 'idle' | 'uploading' | 'error' | 'done';

	// Sélection courante : descripteurs (framework-free) + File[] bruts pour
	// retrouver le contenu binaire au moment de l'envoi (upload-select.ts ne
	// connaît pas le DOM, cf. brief tâche 4).
	let kept = $state<KeptFile[]>([]);
	let ignoredCount = $state(0);
	let selectedFiles = $state<File[]>([]);

	let phase = $state<Phase>('idle');
	let uploadId = $state<string | null>(null);
	let progressPercent = $state(0);
	let errorMessage = $state<string | null>(null);
	let dispatched = $state<boolean | null>(null);
	// Vrai pendant toute demande d'annulation en vol (avec ou sans uploadId
	// connu) : désactive le bouton Annuler pour éviter un double-clic et
	// affiche un libellé dédié tant que le règlement final n'est pas acquis.
	let cancelling = $state(false);

	let folderInput = $state<HTMLInputElement | null>(null);
	let filesInput = $state<HTMLInputElement | null>(null);

	// Mécanisme d'annulation de la chaîne startUpload() : un compteur de
	// génération (pas besoin d'être réactif, jamais lu dans le template) que
	// chaque étape re-vérifie après une attente async — si l'annulation l'a
	// incrémenté entre-temps, on abandonne sans toucher à `phase`/`errorMessage`.
	// L'AbortController est passé en plus à upload() (@vercel/blob/client
	// 2.6.1 expose `abortSignal`, cf. client.d.ts) pour interrompre les
	// requêtes réseau en cours, pas seulement arrêter d'attendre leur résultat.
	let uploadGeneration = 0;
	let abortController: AbortController | null = null;

	// Génération pour laquelle une annulation a été demandée alors que le
	// `?/start` correspondant était encore en vol (uploadId pas encore connu
	// côté client, donc pas encore de ligne à annuler côté serveur). Lu et
	// remis à null par startUpload() dès que `?/start` résout — jamais lu
	// dans le template.
	let pendingCancelGeneration: number | null = null;

	const validation = $derived(validateSelection(kept));
	const keptBytes = $derived(kept.reduce((sum, f) => sum + f.size, 0));
	const hasActiveServerUpload = $derived(
		data.uploads.length > 0 &&
			['uploading', 'pending', 'running'].includes(data.uploads[0].status)
	);
	const canSubmit = $derived(phase === 'idle' && validation.ok && !hasActiveServerUpload);

	// Poll pendant qu'un upload est encore en traitement côté serveur (worker
	// GitHub Actions asynchrone) — arrêt automatique dès l'état terminal ou au
	// démontage du composant.
	$effect(() => {
		const status = data.uploads[0]?.status;
		const active = status === 'uploading' || status === 'pending' || status === 'running';
		if (!active) return;
		const interval = setInterval(() => invalidateAll(), 5000);
		return () => clearInterval(interval);
	});

	function toDescriptor(file: File): FileDescriptor {
		return { name: file.name, size: file.size, relativePath: file.webkitRelativePath || file.name };
	}

	function handleFiles(fileList: FileList | null) {
		const files = fileList ? Array.from(fileList) : [];
		selectedFiles = files;
		const result = selectUploadFiles(files.map(toDescriptor));
		kept = result.kept;
		ignoredCount = result.ignoredCount;
		phase = 'idle';
		errorMessage = null;
	}

	function formatBytes(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		const units = ['KB', 'MB', 'GB'];
		let value = bytes / 1024;
		let unitIndex = 0;
		while (value >= 1024 && unitIndex < units.length - 1) {
			value /= 1024;
			unitIndex++;
		}
		return `${value.toFixed(1)} ${units[unitIndex]}`;
	}

	// Mapping partagé : erreurs de validation client (upload-select.ts) et
	// erreurs serveur (validateBlobListing / createUpload) utilisent les mêmes
	// codes courts — un seul mapping i18n pour les deux.
	function errorLabel(code: string): string {
		switch (code) {
			case 'missing_level':
				return m.upload_missing_level();
			case 'missing_player':
				return m.upload_no_players();
			case 'too_many_files':
				return m.upload_too_many_files();
			case 'level_too_large':
			case 'player_too_large':
				return m.upload_file_too_large();
			case 'already_active':
				return m.upload_already_active();
			default:
				return code;
		}
	}

	function statusLabel(status: string): string {
		switch (status) {
			case 'uploading':
				return m.upload_status_uploading();
			case 'pending':
				return m.upload_status_pending();
			case 'running':
				return m.upload_status_running();
			case 'ok':
				return m.upload_status_ok();
			case 'error':
				return m.upload_status_error();
			default:
				return status;
		}
	}

	function statusClass(status: string): string {
		if (status === 'ok') return 'ok';
		if (status === 'error') return 'error';
		return 'active';
	}

	function fmtDate(d: Date | string): string {
		return new Date(d).toLocaleString(getLocale());
	}

	async function postAction(action: string, fd: FormData): Promise<ActionResult> {
		const res = await fetch(action, { method: 'POST', body: fd });
		return deserialize(await res.text());
	}

	// Limite de concurrence simple (2-3 uploads en parallèle) : une file
	// partagée que chaque worker consomme jusqu'à épuisement ou erreur.
	async function uploadAll(
		files: KeptFile[],
		byPath: Map<string, File>,
		id: string,
		signal: AbortSignal
	) {
		const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
		const loadedByPath = new Map<string, number>();
		const recompute = () => {
			let loaded = 0;
			for (const v of loadedByPath.values()) loaded += v;
			progressPercent = totalBytes > 0 ? Math.round((loaded / totalBytes) * 100) : 100;
		};

		const queue = [...files];
		const CONCURRENCY = 3;

		async function worker() {
			for (;;) {
				// Ne pas piocher un fichier de plus si l'annulation a déjà eu lieu
				// (évite un appel upload() superflu ; celui déjà en vol sera de
				// toute façon interrompu par abortSignal).
				if (signal.aborted) return;
				const kf = queue.shift();
				if (!kf) return;
				const file = byPath.get(kf.relativePath);
				if (!file) continue;
				const pathname =
					kf.kind === 'level'
						? `uploads/${data.serverId}/${id}/Level.sav`
						: `uploads/${data.serverId}/${id}/Players/${kf.name}`;
				await upload(pathname, file, {
					access: 'public',
					handleUploadUrl: `/api/servers/${page.params.slug}/upload`,
					clientPayload: JSON.stringify({ uploadId: id }),
					multipart: true,
					abortSignal: signal,
					onUploadProgress: ({ loaded }) => {
						loadedByPath.set(kf.relativePath, loaded);
						recompute();
					}
				});
				loadedByPath.set(kf.relativePath, kf.size);
				recompute();
			}
		}

		const workers = Array.from({ length: Math.min(CONCURRENCY, files.length) }, () => worker());
		// Promise.allSettled plutôt que Promise.all : un abort() coupe jusqu'à
		// CONCURRENCY requêtes en vol simultanément, donc plusieurs workers
		// peuvent rejeter en même temps — Promise.all ne remonterait que le
		// premier rejet et laisserait les autres bruiter la console. On
		// n'attend ici que pour détecter un véritable échec (signal non
		// aborted) ; une annulation volontaire ne doit jamais remonter d'erreur.
		const results = await Promise.allSettled(workers);
		if (!signal.aborted) {
			const failure = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
			if (failure) throw failure.reason;
		}
	}

	async function startUpload() {
		// generation capturée au début : si cancelCurrent() incrémente
		// uploadGeneration pendant une des attentes ci-dessous, toute reprise
		// après coup (succès ou rejet, y compris le 409 déclenché par notre
		// propre annulation) est ignorée — l'état laissé par le cancel prime.
		const generation = ++uploadGeneration;
		const controller = new AbortController();
		abortController = controller;

		errorMessage = null;
		dispatched = null;
		phase = 'uploading';
		progressPercent = 0;

		try {
			const startResult = await postAction('?/start', new FormData());

			if (pendingCancelGeneration === generation) {
				// cancelCurrent() a été appelé pendant que ce ?/start était en
				// vol, à un moment où uploadId n'existait pas encore côté
				// client : c'est ici qu'on règle le sort de la ligne serveur,
				// quel que soit le résultat de ?/start (y compris si ?/cancel
				// lui-même rejette, cf. settleDeferredCancel).
				try {
					if (startResult.type === 'success') {
						const id = (startResult.data as { uploadId: string }).uploadId;
						const fd = new FormData();
						fd.set('uploadId', id);
						await postAction('?/cancel', fd);
					}
				} finally {
					await settleDeferredCancel();
				}
				return;
			}

			if (generation !== uploadGeneration) return;
			if (startResult.type === 'failure') {
				errorMessage = errorLabel(String((startResult.data as { error?: string })?.error ?? ''));
				phase = 'error';
				return;
			}
			if (startResult.type !== 'success') {
				errorMessage = 'error';
				phase = 'error';
				return;
			}
			const id = (startResult.data as { uploadId: string }).uploadId;
			uploadId = id;

			const byPath = new Map(selectedFiles.map((f) => [f.webkitRelativePath || f.name, f]));
			await uploadAll(kept, byPath, id, controller.signal);
			if (generation !== uploadGeneration) return;

			const finalizeBody = new FormData();
			finalizeBody.set('uploadId', id);
			const finalizeResult = await postAction('?/finalize', finalizeBody);
			if (generation !== uploadGeneration) return;
			if (finalizeResult.type === 'failure') {
				errorMessage = errorLabel(String((finalizeResult.data as { error?: string })?.error ?? ''));
				phase = 'error';
				return;
			}
			if (finalizeResult.type !== 'success') {
				errorMessage = 'error';
				phase = 'error';
				return;
			}

			dispatched = (finalizeResult.data as { dispatched: boolean }).dispatched;
			phase = 'done';
			resetSelection();
			await invalidateAll();
		} catch (err) {
			// Une annulation demandée pendant que ?/start était encore en vol
			// peut aussi faire rejeter ?/start lui-même (réseau, parse) avant
			// même d'avoir pu lire son résultat : sans ce cas, le mismatch de
			// génération ci-dessous ferait sortir silencieusement sans jamais
			// rétablir phase/cancelling, laissant l'UI bloquée sur "annulation
			// en cours" indéfiniment.
			if (pendingCancelGeneration === generation) {
				await settleDeferredCancel();
				return;
			}
			// Un rejet provoqué par notre propre annulation (abortSignal, ou le
			// 409 bad_state du prochain appel serveur après un cancel déjà
			// réglé) ne doit jamais écraser l'état laissé par cancelCurrent().
			if (generation !== uploadGeneration) return;
			errorMessage = err instanceof Error ? err.message : String(err);
			phase = 'error';
		} finally {
			if (abortController === controller) abortController = null;
		}
	}

	// Règle l'état local après qu'une annulation a été décidée pendant que
	// ?/start était encore en vol (cf. pendingCancelGeneration) — appelé que
	// ?/start ait réussi, échoué fonctionnellement, ou rejeté (réseau/parse).
	// invalidateAll() est best-effort : un échec de rafraîchissement de
	// l'historique ne doit jamais empêcher l'UI de redevenir utilisable.
	async function settleDeferredCancel() {
		pendingCancelGeneration = null;
		await invalidateAll().catch(() => {});
		phase = 'idle';
		uploadId = null;
		cancelling = false;
		resetSelection();
	}

	function resetSelection() {
		kept = [];
		ignoredCount = 0;
		selectedFiles = [];
		uploadId = null;
		if (folderInput) folderInput.value = '';
		if (filesInput) filesInput.value = '';
	}

	async function cancelCurrent() {
		if (cancelling) return;
		cancelling = true;

		// Invalide la chaîne startUpload() en cours avant même de contacter le
		// serveur : toute reprise ultérieure de cette chaîne (succès ou rejet)
		// se retrouvera avec un uploadGeneration différent et sera ignorée —
		// sauf le cas ci-dessous, explicitement pris en charge par
		// startUpload() via pendingCancelGeneration.
		const generation = uploadGeneration;
		uploadGeneration++;
		abortController?.abort();
		abortController = null;
		errorMessage = null;
		progressPercent = 0;

		if (!uploadId) {
			// ?/start est encore en vol pour cette génération : la ligne
			// serveur n'a pas encore d'id connu ici, impossible de poster
			// ?/cancel maintenant. On mémorise la demande — startUpload()
			// l'annulera dès que ?/start aura renvoyé le uploadId (ou, s'il a
			// échoué/rejeté, constatera qu'il n'y a rien à annuler) puis réglera
			// phase/cancelling via settleDeferredCancel(). La phase reste
			// 'uploading' (état "annulation en cours" dans l'UI) pour empêcher
			// un redémarrage tant que la ligne n'est pas réellement annulée.
			pendingCancelGeneration = generation;
			return;
		}

		const fd = new FormData();
		fd.set('uploadId', uploadId);

		try {
			const result = await postAction('?/cancel', fd);
			const cancelled =
				result.type === 'success' && (result.data as { cancelled?: boolean }).cancelled === true;
			if (cancelled) {
				resetSelection();
			} else {
				// La ligne n'était déjà plus annulable côté serveur (passée en
				// 'running' par le worker, ou déjà terminale) : on ne prétend pas
				// avoir réussi l'annulation, on se contente de sortir de l'écran
				// d'upload local.
				uploadId = null;
			}
		} catch {
			// ?/cancel a rejeté (réseau/parse) : impossible de savoir si la
			// ligne serveur a été annulée, mais l'utilisateur ne doit pas rester
			// bloqué sur le bouton Annuler. Un redémarrage ultérieur essuiera au
			// pire un already_active renvoyé par le serveur.
			uploadId = null;
		} finally {
			// Best-effort : un échec de rafraîchissement de l'historique ne
			// doit jamais empêcher l'UI de redevenir utilisable.
			await invalidateAll().catch(() => {});
			phase = 'idle';
			cancelling = false;
		}
	}
</script>

<svelte:head><title>{m.upload_title()}</title></svelte:head>

<div class="wrap">
	<header class="exp-hero">
		<p class="exp-kicker">✦ {m.upload_local_world_hint()}</p>
		<h1 class="exp-grad">{m.upload_title()}</h1>
		<p class="intro">{m.upload_intro()}</p>
	</header>

	<section class="exp-card">
		<h2>{m.upload_folder_hint()}</h2>
		<code class="path">%LOCALAPPDATA%\Pal\Saved\SaveGames\&lt;SteamID&gt;\&lt;WorldID&gt;\</code>
	</section>

	<section class="exp-card">
		<div class="pickers">
			<label class="picker" class:disabled={phase === 'uploading'}>
				<span class="pic">📁</span>
				<span class="ptxt">{m.upload_pick_folder()}</span>
				<input
					bind:this={folderInput}
					type="file"
					webkitdirectory
					multiple
					disabled={phase === 'uploading'}
					onchange={(e) => handleFiles((e.currentTarget as HTMLInputElement).files)}
				/>
			</label>
			<label class="picker" class:disabled={phase === 'uploading'}>
				<span class="pic">📄</span>
				<span class="ptxt">{m.upload_pick_files()}</span>
				<input
					bind:this={filesInput}
					type="file"
					accept=".sav"
					multiple
					disabled={phase === 'uploading'}
					onchange={(e) => handleFiles((e.currentTarget as HTMLInputElement).files)}
				/>
			</label>
		</div>

		{#if kept.length > 0 || ignoredCount > 0}
			<p class="summary">
				{m.upload_files_summary({
					kept: kept.length,
					ignored: ignoredCount,
					size: formatBytes(keptBytes)
				})}
			</p>
		{/if}

		{#if !validation.ok && (kept.length > 0 || ignoredCount > 0)}
			<p class="error">{errorLabel(validation.error)}</p>
		{/if}

		{#if hasActiveServerUpload && phase === 'idle'}
			<p class="error">{m.upload_already_active()}</p>
		{/if}

		<div class="cta-row">
			<button type="button" class="exp-glossy" disabled={!canSubmit} onclick={startUpload}>
				⬆ {m.upload_start()}
			</button>
			{#if phase === 'uploading'}
				<button type="button" class="danger" disabled={cancelling} onclick={cancelCurrent}>
					{cancelling ? m.upload_cancelling() : m.upload_cancel()}
				</button>
			{/if}
		</div>

		{#if phase === 'uploading'}
			<div class="bar"><span style="width:{progressPercent}%"></span></div>
			<p class="progress">{m.upload_uploading({ percent: progressPercent })}</p>
		{/if}

		{#if phase === 'error' && errorMessage}
			<p class="error">{errorMessage}</p>
			{#if uploadId}
				<button type="button" class="danger" disabled={cancelling} onclick={cancelCurrent}>
					{cancelling ? m.upload_cancelling() : m.upload_cancel()}
				</button>
			{/if}
		{/if}

		{#if phase === 'done'}
			<p class="ok">
				{dispatched ? m.upload_finalize_queued() : m.upload_finalize_queued_cron()}
			</p>
		{/if}
	</section>

	<section class="exp-card">
		<h2>{m.upload_history_title()}</h2>
		{#if data.uploads.length === 0}
			<p class="empty">{m.upload_history_empty()}</p>
		{:else}
			<ul class="uploads">
				{#each data.uploads as row (row.id)}
					<li>
						<div class="row">
							<span class="badge {statusClass(row.status)}">{statusLabel(row.status)}</span>
							<span class="date">{fmtDate(row.createdAt)}</span>
							{#if row.status === 'uploading' || row.status === 'pending'}
								<form
									method="POST"
									action="?/cancel"
									use:enhance={() => {
										// Cette ligne d'historique peut être la même que celle
										// pilotée par startUpload() (data.uploads[0] pendant
										// phase === 'uploading') : si on annule via ce formulaire,
										// il faut aussi couper la chaîne JS en cours, sinon elle
										// continue et finit par échouer sur un 409 bad_state.
										if (row.id === uploadId) {
											uploadGeneration++;
											abortController?.abort();
											abortController = null;
											phase = 'idle';
											uploadId = null;
										}
										return async ({ update }) => update();
									}}
									class="cancel-row"
								>
									<input type="hidden" name="uploadId" value={row.id} />
									<button type="submit" class="ghost danger">{m.upload_cancel()}</button>
								</form>
							{/if}
						</div>
						<div class="meta">
							<span>{row.fileCount} · {formatBytes(row.totalBytes)}</span>
							{#if row.status === 'ok' && row.stats}
								{@const stats = row.stats as { pals?: number; techs?: number; players?: number }}
								<span class="stats">
									{m.upload_stats_summary({
										pals: stats.pals ?? 0,
										techs: stats.techs ?? 0,
										players: stats.players ?? 0
									})}
								</span>
							{/if}
							{#if row.status === 'error' && row.error}
								<span class="err">{row.error}</span>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>

<style>
	.wrap {
		max-width: 680px;
		margin: 0 auto;
		padding: 32px 16px 56px;
		display: grid;
		gap: 20px;
	}
	.exp-hero h1 {
		font-size: 24px;
		margin: 6px 0 8px;
	}
	.intro {
		color: var(--text-2);
		font-size: 13px;
		line-height: 1.5;
		margin: 0;
		max-width: 52ch;
	}

	.exp-card {
		display: grid;
		gap: 12px;
	}
	h2 {
		font-size: 15px;
		font-weight: 600;
		color: var(--text-1);
		margin: 0;
	}
	.path {
		display: block;
		font-size: 12px;
		color: var(--text-1);
		background: var(--input-bg);
		border: 1px solid var(--border-strong);
		border-radius: var(--r-sm);
		padding: 10px 12px;
		word-break: break-all;
	}

	.pickers {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	.picker {
		display: grid;
		justify-items: center;
		gap: 6px;
		text-align: center;
		padding: 20px 14px;
		border: 1px dashed var(--border-strong);
		border-radius: var(--r-md);
		background: rgba(13, 14, 18, 0.5);
		color: var(--text-2);
		font-size: 13px;
		cursor: pointer;
		transition: border-color 140ms, background 140ms;
	}
	.picker:hover {
		border-color: var(--accent);
		background: rgba(21, 22, 28, 0.6);
	}
	.picker.disabled {
		opacity: 0.5;
		pointer-events: none;
	}
	.picker .pic {
		font-size: 22px;
	}
	.picker input {
		display: none;
	}

	.summary {
		font-size: 12px;
		color: var(--text-2);
		margin: 0;
	}
	.progress {
		font-size: 12px;
		color: var(--text-2);
		margin: 0;
	}
	.bar {
		height: 6px;
		border-radius: 999px;
		background: var(--surface-3);
		overflow: hidden;
	}
	.bar span {
		display: block;
		height: 100%;
		background: linear-gradient(90deg, #ff5a0f, #ff8a3d);
		transition: width 200ms cubic-bezier(0.23, 1, 0.32, 1);
	}
	.error {
		color: var(--el-fire);
		font-size: 12px;
		margin: 0;
	}
	.ok {
		color: var(--el-leaf);
		font-size: 13px;
		margin: 0;
	}

	.cta-row {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	.exp-glossy {
		font-size: 14px;
	}
	button.danger {
		background: color-mix(in srgb, var(--el-fire) 18%, transparent);
		color: var(--el-fire);
		border: 1px solid color-mix(in srgb, var(--el-fire) 30%, transparent);
		border-radius: var(--r-md);
		padding: 9px 14px;
		font-size: 13px;
		font-weight: 600;
	}
	button.ghost {
		background: var(--surface-2);
	}
	button.ghost.danger {
		background: color-mix(in srgb, var(--el-fire) 14%, transparent);
	}
	.empty {
		color: var(--text-3);
		font-size: 13px;
	}
	.uploads {
		list-style: none;
		display: grid;
		gap: 8px;
		margin: 0;
		padding: 0;
	}
	.uploads li {
		display: grid;
		gap: 6px;
		padding: 12px;
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		background: var(--surface-2);
	}
	.row {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.badge {
		font-size: 11px;
		padding: 2px 9px;
		border-radius: 999px;
		font-weight: 600;
	}
	.badge.ok {
		color: var(--el-leaf);
		background: color-mix(in srgb, var(--el-leaf) 16%, transparent);
	}
	.badge.error {
		color: var(--el-fire);
		background: color-mix(in srgb, var(--el-fire) 16%, transparent);
	}
	.badge.active {
		color: var(--accent);
		background: var(--accent-soft);
	}
	.date {
		font-size: 12px;
		color: var(--text-3);
	}
	.cancel-row {
		margin-left: auto;
	}
	.meta {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
		font-size: 12px;
		color: var(--text-2);
	}
	.meta .err {
		color: var(--el-fire);
	}

	@media (max-width: 480px) {
		.pickers {
			grid-template-columns: 1fr;
		}
	}
</style>
