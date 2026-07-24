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
		await Promise.all(workers);
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
			// Un rejet provoqué par notre propre annulation (abortSignal, ou le
			// 409 bad_state du prochain appel serveur après un cancel) ne doit
			// jamais écraser l'état laissé par cancelCurrent().
			if (generation !== uploadGeneration) return;
			errorMessage = err instanceof Error ? err.message : String(err);
			phase = 'error';
		} finally {
			if (abortController === controller) abortController = null;
		}
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
		// Invalide la chaîne startUpload() en cours avant même de contacter le
		// serveur : toute reprise ultérieure de cette chaîne (succès ou rejet)
		// se retrouvera avec un uploadGeneration différent et sera ignorée.
		uploadGeneration++;
		abortController?.abort();
		abortController = null;

		if (!uploadId) {
			phase = 'idle';
			errorMessage = null;
			progressPercent = 0;
			return;
		}

		const fd = new FormData();
		fd.set('uploadId', uploadId);
		const result = await postAction('?/cancel', fd);
		const cancelled = result.type === 'success' && (result.data as { cancelled?: boolean }).cancelled === true;

		await invalidateAll();

		if (cancelled) {
			phase = 'idle';
			errorMessage = null;
			progressPercent = 0;
			resetSelection();
		} else {
			// La ligne n'était déjà plus annulable côté serveur (passée en
			// 'running' par le worker, ou déjà terminale) : on ne prétend pas
			// avoir réussi l'annulation. Le invalidateAll ci-dessus a rafraîchi
			// l'historique et hasActiveServerUpload avec le vrai statut ; on se
			// contente de sortir de l'écran d'upload local.
			phase = 'idle';
			uploadId = null;
		}
	}
</script>

<svelte:head><title>{m.upload_title()}</title></svelte:head>

<div class="wrap">
	<h1>{m.upload_title()}</h1>
	<p class="tag">{m.upload_local_world_hint()}</p>
	<p class="intro">{m.upload_intro()}</p>

	<section>
		<h2>{m.upload_folder_hint()}</h2>
		<code class="path">%LOCALAPPDATA%\Pal\Saved\SaveGames\&lt;SteamID&gt;\&lt;WorldID&gt;\</code>
	</section>

	<section>
		<label class="picker">
			{m.upload_pick_folder()}
			<input
				bind:this={folderInput}
				type="file"
				webkitdirectory
				multiple
				disabled={phase === 'uploading'}
				onchange={(e) => handleFiles((e.currentTarget as HTMLInputElement).files)}
			/>
		</label>
		<label class="picker">
			{m.upload_pick_files()}
			<input
				bind:this={filesInput}
				type="file"
				accept=".sav"
				multiple
				disabled={phase === 'uploading'}
				onchange={(e) => handleFiles((e.currentTarget as HTMLInputElement).files)}
			/>
		</label>

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

		<button type="button" disabled={!canSubmit} onclick={startUpload}>
			{m.upload_start()}
		</button>

		{#if phase === 'uploading'}
			<p class="progress">{m.upload_uploading({ percent: progressPercent })}</p>
			<button type="button" class="danger" onclick={cancelCurrent}>{m.upload_cancel()}</button>
		{/if}

		{#if phase === 'error' && errorMessage}
			<p class="error">{errorMessage}</p>
			{#if uploadId}
				<button type="button" class="danger" onclick={cancelCurrent}>{m.upload_cancel()}</button>
			{/if}
		{/if}

		{#if phase === 'done'}
			<p class="ok">
				{dispatched ? m.upload_finalize_queued() : m.upload_finalize_queued_cron()}
			</p>
		{/if}
	</section>

	<section>
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
		padding: 24px 16px;
		display: grid;
		gap: 32px;
	}
	.tag {
		display: inline-block;
		width: fit-content;
		font-size: 11px;
		color: var(--accent);
		background: var(--accent-soft);
		padding: 2px 10px;
		border-radius: 999px;
	}
	.intro {
		color: var(--text-2);
		font-size: 13px;
	}
	section {
		display: grid;
		gap: 10px;
	}
	h2 {
		font-size: 15px;
		font-weight: 600;
		color: var(--text-1);
	}
	.path {
		display: block;
		font-size: 12px;
		color: var(--text-1);
		background: var(--input-bg);
		border: 1px solid var(--border-strong);
		border-radius: var(--r-sm);
		padding: 8px 10px;
		word-break: break-all;
	}
	.picker {
		display: grid;
		gap: 4px;
		font-size: 13px;
		color: var(--text-2);
	}
	.summary {
		font-size: 12px;
		color: var(--text-2);
	}
	.progress {
		font-size: 12px;
		color: var(--text-2);
	}
	.error {
		color: var(--el-fire);
		font-size: 12px;
	}
	.ok {
		color: var(--el-leaf);
		font-size: 13px;
	}
	button {
		width: fit-content;
		padding: 8px 14px;
		border-radius: var(--r-md);
		background: var(--accent);
		color: var(--accent-ink);
		font-weight: 600;
		font-size: 13px;
	}
	button:disabled {
		opacity: 0.5;
	}
	button.danger {
		background: color-mix(in srgb, var(--el-fire) 20%, transparent);
		color: var(--el-fire);
	}
	button.ghost {
		background: var(--surface-2);
	}
	.empty {
		color: var(--text-3);
	}
	.uploads {
		list-style: none;
		display: grid;
		gap: 8px;
	}
	.uploads li {
		display: grid;
		gap: 6px;
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		background: var(--surface-1);
	}
	.row {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.badge {
		font-size: 11px;
		padding: 1px 8px;
		border-radius: 999px;
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
</style>
