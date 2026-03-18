<script lang="ts">
  import { api } from '../lib/api.ts';
  import type { Participant } from '@shared/types';

  interface Props {
    onLogin: (participant: Participant) => void;
    authError?: string | null;
  }

  const { onLogin, authError = null }: Props = $props();

  let username = $state('');
  let password = $state('');
  let error = $state<string | null>(null);
  let loading = $state(false);

  // Show any external auth error (e.g. role mismatch after session check)
  $effect(() => {
    if (authError) error = authError;
  });

  async function handleSubmit(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    error = null;
    loading = true;

    try {
      const { participant } = await api.auth.login(username, password);

      if (participant.role !== 'admin') {
        error = 'Accès réservé aux admins.';
        return;
      }

      onLogin(participant);
    } catch (err) {
      const apiErr = err as { error?: string };
      error = apiErr.error ?? 'Erreur de connexion.';
    } finally {
      loading = false;
    }
  }
</script>

<div class="login-wrap">
  <div class="login-box">
    <div class="login-logo">
      <span class="login-logo-icon">📺</span>
      <h1>MiniRégie</h1>
      <p class="login-subtitle">Interface admin — JAM Multimédia</p>
    </div>

    <form onsubmit={handleSubmit} class="login-form">
      <div class="field">
        <label for="username">Identifiant</label>
        <input
          id="username"
          type="text"
          bind:value={username}
          autocomplete="username"
          placeholder="admin"
          required
          disabled={loading}
        />
      </div>

      <div class="field">
        <label for="password">Mot de passe</label>
        <input
          id="password"
          type="password"
          bind:value={password}
          autocomplete="current-password"
          placeholder="••••••••"
          required
          disabled={loading}
        />
      </div>

      {#if error}
        <div class="error-msg">{error}</div>
      {/if}

      <button type="submit" class="btn btn-primary login-btn" disabled={loading}>
        {loading ? 'Connexion…' : 'Se connecter'}
      </button>
    </form>
  </div>
</div>

<style>
  .login-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 24px;
    background: var(--bg);
  }

  .login-box {
    width: 100%;
    max-width: 380px;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 40px 32px;
  }

  .login-logo {
    text-align: center;
    margin-bottom: 32px;
  }

  .login-logo-icon {
    font-size: 40px;
    display: block;
    margin-bottom: 8px;
  }

  .login-logo h1 {
    font-size: 22px;
    font-weight: 700;
    color: var(--accent);
    letter-spacing: -0.02em;
  }

  .login-subtitle {
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 4px;
  }

  .login-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .field input {
    width: 100%;
  }

  .login-btn {
    width: 100%;
    justify-content: center;
    padding: 10px;
    font-size: 15px;
    margin-top: 4px;
  }
</style>