<script lang="ts">
  import { api, isApiError } from '../lib/api.js';
  import { participantState } from '../lib/stores.js';
  import type { Participant } from '@shared/types.js';

  // ─── Props ────────────────────────────────────────────────────────────────

  interface Props {
    onLogin: (participant: Participant) => void;
  }
  const { onLogin }: Props = $props();

  // ─── State ────────────────────────────────────────────────────────────────

  let activeTab = $state<'login' | 'register'>('login');
  let loading = $state(false);
  let error = $state<string | null>(null);

  // Login form fields
  let loginUsername = $state('');
  let loginPassword = $state('');

  // Register form fields
  let regUsername = $state('');
  let regDisplayName = $state('');
  let regTeam = $state('');
  let regPassword = $state('');
  let teams = $state<string[]>([]);

  // ─── Effects ─────────────────────────────────────────────────────────────

  $effect(() => {
    if (activeTab === 'register') {
      api.go.teams().then((t) => { teams = t; }).catch(() => { teams = []; });
    }
  });

  // ─── Handlers ─────────────────────────────────────────────────────────────

  async function handleLogin(e: SubmitEvent) {
    e.preventDefault();
    if (loading) return;
    error = null;
    loading = true;
    try {
      const { participant } = await api.auth.login(loginUsername.trim(), loginPassword);
      participantState.value = participant;
      onLogin(participant);
    } catch (err) {
      error = isApiError(err) ? err.error : 'Une erreur est survenue.';
    } finally {
      loading = false;
    }
  }

  async function handleRegister(e: SubmitEvent) {
    e.preventDefault();
    if (loading) return;
    error = null;
    if (regPassword.length < 6) {
      error = 'Le mot de passe doit faire au moins 6 caractères.';
      return;
    }
    loading = true;
    try {
      const { participant } = await api.auth.register(
        regUsername.trim(),
        regDisplayName.trim(),
        regTeam.trim(),
        regPassword,
      );
      participantState.value = participant;
      onLogin(participant);
    } catch (err) {
      error = isApiError(err) ? err.error : 'Une erreur est survenue.';
    } finally {
      loading = false;
    }
  }

  function switchTab(tab: 'login' | 'register') {
    error = null;
    activeTab = tab;
  }
</script>

<div class="login-page">
  <header class="login-header">
    <div class="logo">🎬</div>
    <h1>JAM Régie</h1>
    <p class="subtitle">IAD Multimédia</p>
  </header>

  <div class="card">
    <div class="tabs" role="tablist">
      <button
        role="tab"
        aria-selected={activeTab === 'login'}
        class="tab-btn"
        class:active={activeTab === 'login'}
        onclick={() => switchTab('login')}
      >
        Connexion
      </button>
      <button
        role="tab"
        aria-selected={activeTab === 'register'}
        class="tab-btn"
        class:active={activeTab === 'register'}
        onclick={() => switchTab('register')}
      >
        Inscription
      </button>
    </div>

    {#if error}
      <div class="error-banner" role="alert">{error}</div>
    {/if}

    {#if activeTab === 'login'}
      <form onsubmit={handleLogin} novalidate>
        <div class="field">
          <label for="login-username">Nom d'utilisateur</label>
          <input
            id="login-username"
            type="text"
            autocomplete="username"
            bind:value={loginUsername}
            required
            disabled={loading}
            placeholder="ton_pseudo"
          />
        </div>
        <div class="field">
          <label for="login-password">Mot de passe</label>
          <input
            id="login-password"
            type="password"
            autocomplete="current-password"
            bind:value={loginPassword}
            required
            disabled={loading}
            placeholder="••••••"
          />
        </div>
        <button type="submit" class="btn-primary" disabled={loading || !loginUsername || !loginPassword}>
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    {:else}
      <form onsubmit={handleRegister} novalidate>
        <div class="field">
          <label for="reg-username">Nom d'utilisateur</label>
          <input
            id="reg-username"
            type="text"
            autocomplete="username"
            bind:value={regUsername}
            required
            disabled={loading}
            placeholder="ton_pseudo"
          />
        </div>
        <div class="field">
          <label for="reg-displayname">Prénom / Pseudo affiché</label>
          <input
            id="reg-displayname"
            type="text"
            autocomplete="name"
            bind:value={regDisplayName}
            required
            disabled={loading}
            placeholder="Marie Dupont"
          />
        </div>
        <div class="field">
          <label for="reg-team">Équipe <span class="optional">(optionnel)</span></label>
          <input
            id="reg-team"
            type="text"
            list="teams-list"
            autocomplete="off"
            bind:value={regTeam}
            disabled={loading}
            placeholder="Nom de ton équipe"
          />
          <datalist id="teams-list">
            {#each teams as team (team)}
              <option value={team}></option>
            {/each}
          </datalist>
        </div>
        <div class="field">
          <label for="reg-password">Mot de passe <span class="optional">(min. 6 caractères)</span></label>
          <input
            id="reg-password"
            type="password"
            autocomplete="new-password"
            bind:value={regPassword}
            required
            disabled={loading}
            placeholder="••••••"
          />
        </div>
        <button
          type="submit"
          class="btn-primary"
          disabled={loading || !regUsername || !regDisplayName || !regPassword}
        >
          {loading ? 'Inscription…' : "S'inscrire"}
        </button>
      </form>
    {/if}
  </div>
</div>

<style>
  .login-page {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px 16px;
    padding-bottom: calc(24px + env(safe-area-inset-bottom));
    gap: 32px;
  }

  .login-header {
    text-align: center;
  }

  .logo {
    font-size: 48px;
    line-height: 1;
    margin-bottom: 8px;
  }

  h1 {
    font-size: 28px;
    font-weight: 700;
    color: var(--accent);
    margin: 0 0 4px;
    letter-spacing: -0.5px;
  }

  .subtitle {
    color: var(--text-muted);
    font-size: 14px;
    margin: 0;
  }

  .card {
    width: 100%;
    max-width: 400px;
    background: var(--surface);
    border-radius: 16px;
    overflow: hidden;
  }

  .tabs {
    display: flex;
    border-bottom: 1px solid var(--border);
  }

  .tab-btn {
    flex: 1;
    padding: 14px 8px;
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
  }

  .tab-btn.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }

  form {
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .error-banner {
    margin: 16px 16px 0;
    padding: 12px 16px;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.4);
    border-radius: 8px;
    color: #f87171;
    font-size: 14px;
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
</style>