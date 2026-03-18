<script lang="ts">
  import { api, isApiError } from '../lib/api.js';

  // ─── Props ────────────────────────────────────────────────────────────────

  interface Props {
    jamStatus: string;
    onSubmitted: () => void;
  }
  const { jamStatus, onSubmitted }: Props = $props();

  // ─── State ────────────────────────────────────────────────────────────────

  type Tab = 'photo' | 'clip' | 'note' | 'link';
  let activeTab = $state<Tab>('photo');
  let loading = $state(false);
  let error = $state<string | null>(null);
  let toast = $state<string | null>(null);
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  // Photo/clip fields
  let selectedFile = $state<File | null>(null);
  let fileCaption = $state('');
  let filePreviewUrl = $state<string | null>(null);

  // Note fields
  let noteText = $state('');
  const NOTE_MAX = 280;

  // Link fields
  let linkUrl = $state('');
  let linkCaption = $state('');

  // ─── Derived ──────────────────────────────────────────────────────────────

  const jamRunning = $derived(jamStatus === 'running');

  const acceptMime = $derived(
    activeTab === 'clip'
      ? 'video/mp4,video/quicktime,video/webm'
      : 'image/jpeg,image/png,image/gif,image/webp',
  );

  const maxFileBytes = $derived(activeTab === 'clip' ? 50 * 1024 * 1024 : 10 * 1024 * 1024);
  const maxFileMb = $derived(activeTab === 'clip' ? 50 : 10);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function showToast(msg: string) {
    if (toastTimer !== null) clearTimeout(toastTimer);
    toast = msg;
    toastTimer = setTimeout(() => { toast = null; }, 3500);
  }

  function resetFileField() {
    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    selectedFile = null;
    filePreviewUrl = null;
    fileCaption = '';
  }

  function resetForm() {
    resetFileField();
    noteText = '';
    linkUrl = '';
    linkCaption = '';
    error = null;
  }

  function onTabChange(tab: Tab) {
    if (activeTab !== tab) {
      resetFileField();
      error = null;
    }
    activeTab = tab;
  }

  // ─── File handling ────────────────────────────────────────────────────────

  function onFileChange(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) return;

    if (file.size > maxFileBytes) {
      error = `Fichier trop lourd (max ${maxFileMb} Mo).`;
      input.value = '';
      return;
    }

    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    selectedFile = file;
    filePreviewUrl = URL.createObjectURL(file);
    error = null;
  }

  // ─── Submit handler ───────────────────────────────────────────────────────

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (loading) return;

    error = null;
    loading = true;

    try {
      switch (activeTab) {
        case 'note':
          if (!noteText.trim()) { error = 'Écris quelque chose d\'abord.'; return; }
          await api.go.submitNote(noteText.trim());
          break;

        case 'link': {
          const url = linkUrl.trim();
          if (!url) { error = 'Entre une URL.'; return; }
          await api.go.submitLink(url, linkCaption.trim() || undefined);
          break;
        }

        case 'photo': {
          if (!selectedFile) { error = 'Choisis une image.'; return; }
          await api.go.submitPhoto(selectedFile, fileCaption.trim() || undefined);
          break;
        }

        case 'clip': {
          if (!selectedFile) { error = 'Choisis une vidéo.'; return; }
          await api.go.submitClip(selectedFile, fileCaption.trim() || undefined);
          break;
        }
      }

      showToast('En régie !');
      resetForm();
      onSubmitted();
    } catch (err) {
      if (isApiError(err)) {
        if (err.status === 403) {
          error = 'La JAM n\'est pas encore démarrée.';
        } else if (err.status === 429) {
          error = `${err.error} Réessaie dans quelques instants.`;
        } else if (err.status === 422) {
          error = err.error;
        } else {
          error = err.error;
        }
      } else {
        error = 'Une erreur est survenue.';
      }
    } finally {
      loading = false;
    }
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'photo', label: '📸 Photo' },
    { id: 'clip',  label: '🎥 Clip' },
    { id: 'note',  label: '📝 Note' },
    { id: 'link',  label: '🔗 Lien' },
  ];
</script>

<section class="submit-section">
  <h2 class="section-title">Soumettre</h2>

  {#if !jamRunning}
    <div class="jam-status-notice">
      {#if jamStatus === 'idle'}
        La JAM n'a pas encore démarré — les soumissions seront ouvertes au lancement.
      {:else}
        La JAM est terminée. Merci pour ta participation !
      {/if}
    </div>
  {/if}

  <div class="card">
    <div class="tabs" role="tablist">
      {#each TABS as tab (tab.id)}
        <button
          role="tab"
          aria-selected={activeTab === tab.id}
          class="tab-btn"
          class:active={activeTab === tab.id}
          onclick={() => onTabChange(tab.id)}
          disabled={loading}
        >
          {tab.label}
        </button>
      {/each}
    </div>

    {#if error}
      <div class="error-banner" role="alert">{error}</div>
    {/if}

    <form onsubmit={handleSubmit} class="form-body" novalidate>
      {#if activeTab === 'photo' || activeTab === 'clip'}
        <!-- File picker -->
        <label class="upload-area" class:has-preview={filePreviewUrl !== null}>
          {#if filePreviewUrl && activeTab === 'photo'}
            <img src={filePreviewUrl} alt="Aperçu" class="preview-img" />
            <span class="change-label">Changer</span>
          {:else if filePreviewUrl && activeTab === 'clip'}
            <!-- Video preview -->
            <video src={filePreviewUrl} class="preview-video" muted playsinline></video>
            <span class="change-label">Changer</span>
          {:else}
            <div class="upload-placeholder">
              <span class="upload-icon">{activeTab === 'clip' ? '🎥' : '📸'}</span>
              <span class="upload-text">
                {activeTab === 'clip' ? 'Choisir une vidéo' : 'Choisir une image'}
              </span>
              <span class="upload-hint">Max {maxFileMb} Mo</span>
            </div>
          {/if}
          <input
            type="file"
            accept={acceptMime}
            capture={activeTab === 'photo' ? 'environment' : undefined}
            onchange={onFileChange}
            disabled={loading}
            class="file-input"
          />
        </label>
        <div class="field">
          <label for="file-caption">Légende <span class="optional">(optionnel)</span></label>
          <input
            id="file-caption"
            type="text"
            bind:value={fileCaption}
            disabled={loading}
            maxlength="200"
            placeholder="Ajouter une légende…"
          />
        </div>
        <button type="submit" class="btn-primary" disabled={loading || !selectedFile}>
          {loading ? 'Envoi…' : 'Envoyer'}
        </button>

      {:else if activeTab === 'note'}
        <div class="field">
          <label for="note-text">Message</label>
          <textarea
            id="note-text"
            bind:value={noteText}
            maxlength={NOTE_MAX}
            rows="5"
            disabled={loading}
            placeholder="Ce que tu veux partager avec la JAM…"
          ></textarea>
          <div class="char-counter" class:near-limit={noteText.length > NOTE_MAX * 0.8}>
            {noteText.length} / {NOTE_MAX}
          </div>
        </div>
        <button type="submit" class="btn-primary" disabled={loading || !noteText.trim()}>
          {loading ? 'Envoi…' : 'Envoyer'}
        </button>

      {:else if activeTab === 'link'}
        <div class="field">
          <label for="link-url">URL</label>
          <input
            id="link-url"
            type="url"
            bind:value={linkUrl}
            disabled={loading}
            placeholder="https://…"
            inputmode="url"
            autocorrect="off"
            autocapitalize="off"
          />
        </div>
        <div class="field">
          <label for="link-caption">Légende <span class="optional">(optionnel)</span></label>
          <input
            id="link-caption"
            type="text"
            bind:value={linkCaption}
            disabled={loading}
            maxlength="200"
            placeholder="Décris ce lien…"
          />
        </div>
        <button type="submit" class="btn-primary" disabled={loading || !linkUrl.trim()}>
          {loading ? 'Envoi…' : 'Envoyer'}
        </button>
      {/if}
    </form>
  </div>

  {#if toast}
    <div class="toast" role="status">✓ {toast}</div>
  {/if}
</section>

<style>
  .submit-section {
    padding: 0 16px 16px;
  }

  .section-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    margin: 0 0 12px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .jam-status-notice {
    background: rgba(255, 200, 50, 0.1);
    border: 1px solid rgba(255, 200, 50, 0.3);
    border-radius: 10px;
    padding: 12px 14px;
    font-size: 14px;
    color: #fcd34d;
    margin-bottom: 12px;
    line-height: 1.4;
  }

  .card {
    background: var(--surface);
    border-radius: 16px;
    overflow: hidden;
  }

  .tabs {
    display: flex;
    border-bottom: 1px solid var(--border);
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }

  .tabs::-webkit-scrollbar { display: none; }

  .tab-btn {
    flex: 1;
    min-width: 72px;
    padding: 12px 4px;
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: color 0.15s, border-color 0.15s;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
  }

  .tab-btn.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }

  .tab-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .error-banner {
    margin: 12px 16px 0;
    padding: 12px 14px;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.4);
    border-radius: 8px;
    color: #f87171;
    font-size: 14px;
    line-height: 1.4;
  }

  .form-body {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .upload-area {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 180px;
    border: 2px dashed var(--border);
    border-radius: 12px;
    cursor: pointer;
    overflow: hidden;
    transition: border-color 0.15s;
  }

  .upload-area:hover,
  .upload-area:focus-within {
    border-color: var(--accent);
  }

  .upload-area.has-preview {
    border-style: solid;
    border-color: var(--border);
  }

  .upload-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 20px;
    text-align: center;
  }

  .upload-icon {
    font-size: 40px;
    line-height: 1;
  }

  .upload-text {
    font-size: 15px;
    font-weight: 500;
    color: var(--text);
  }

  .upload-hint {
    font-size: 12px;
    color: var(--text-muted);
  }

  .preview-img {
    width: 100%;
    height: 180px;
    object-fit: cover;
    display: block;
  }

  .preview-video {
    width: 100%;
    height: 180px;
    object-fit: cover;
    display: block;
  }

  .change-label {
    position: absolute;
    bottom: 8px;
    right: 8px;
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    font-size: 12px;
    padding: 4px 10px;
    border-radius: 20px;
  }

  .file-input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
    width: 100%;
    height: 100%;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-muted);
  }

  .optional {
    font-weight: 400;
    opacity: 0.7;
  }

  textarea {
    resize: vertical;
    min-height: 120px;
  }

  .char-counter {
    font-size: 12px;
    color: var(--text-muted);
    text-align: right;
  }

  .char-counter.near-limit {
    color: #f59e0b;
  }

  .toast {
    position: fixed;
    bottom: calc(24px + env(safe-area-inset-bottom));
    left: 50%;
    transform: translateX(-50%);
    background: var(--accent);
    color: #000;
    font-weight: 700;
    font-size: 16px;
    padding: 12px 28px;
    border-radius: 40px;
    white-space: nowrap;
    box-shadow: 0 4px 20px rgba(26, 192, 215, 0.4);
    pointer-events: none;
    z-index: 100;
  }
</style>