<script lang="ts">
  import { api, isApiError } from '../lib/api.js';
  import { participantState } from '../lib/stores.js';
  import type { Participant } from '@shared/types.js';

  // ─── Props ────────────────────────────────────────────────────────────────

  interface Props {
    participant: Participant;
    onDone: (participant: Participant) => void;
  }
  const { participant, onDone }: Props = $props();

  // ─── State ────────────────────────────────────────────────────────────────

  let selectedFile = $state<File | null>(null);
  let previewUrl = $state<string | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);

  // ─── File selection ───────────────────────────────────────────────────────

  function onFileChange(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) return;

    // Release previous object URL to avoid memory leaks
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    selectedFile = file;
    previewUrl = URL.createObjectURL(file);
    error = null;
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!selectedFile || loading) return;

    error = null;
    loading = true;
    try {
      const { participant: updated } = await api.go.uploadAvatar(selectedFile);
      participantState.value = updated;
      onDone(updated);
    } catch (err) {
      error = isApiError(err) ? err.error : 'Une erreur est survenue.';
    } finally {
      loading = false;
    }
  }
</script>

<div class="onboarding-page">
  <header class="onboarding-header">
    <h1>Bienvenue, {participant.displayName} !</h1>
    <p class="subtitle">Une dernière étape : ajoute ta photo de profil.</p>
  </header>

  <form onsubmit={handleSubmit} class="card">
    {#if error}
      <div class="error-banner" role="alert">{error}</div>
    {/if}

    <label class="upload-area" class:has-preview={previewUrl !== null}>
      {#if previewUrl}
        <!-- svelte-ignore a11y_img_redundant_alt -->
        <img src={previewUrl} alt="Aperçu" class="preview-img" />
        <span class="change-label">Changer</span>
      {:else}
        <div class="upload-placeholder">
          <span class="upload-icon">📷</span>
          <span class="upload-text">Prendre ou choisir une photo</span>
          <span class="upload-hint">Appareil photo recommandé</span>
        </div>
      {/if}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onchange={onFileChange}
        disabled={loading}
        class="file-input"
      />
    </label>

    <button
      type="submit"
      class="btn-primary"
      disabled={!selectedFile || loading}
    >
      {loading ? 'Envoi…' : 'Continuer'}
    </button>
  </form>
</div>

<style>
  .onboarding-page {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px 16px;
    padding-bottom: calc(24px + env(safe-area-inset-bottom));
    gap: 32px;
  }

  .onboarding-header {
    text-align: center;
  }

  h1 {
    font-size: 24px;
    font-weight: 700;
    color: var(--text);
    margin: 0 0 8px;
  }

  .subtitle {
    color: var(--text-muted);
    font-size: 15px;
    margin: 0;
  }

  .card {
    width: 100%;
    max-width: 400px;
    background: var(--surface);
    border-radius: 16px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .error-banner {
    padding: 12px 16px;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.4);
    border-radius: 8px;
    color: #f87171;
    font-size: 14px;
  }

  .upload-area {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 220px;
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
  }

  .upload-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 24px;
    text-align: center;
  }

  .upload-icon {
    font-size: 48px;
    line-height: 1;
  }

  .upload-text {
    font-size: 16px;
    font-weight: 500;
    color: var(--text);
  }

  .upload-hint {
    font-size: 13px;
    color: var(--text-muted);
  }

  .preview-img {
    width: 100%;
    height: 220px;
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
</style>