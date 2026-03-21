<script lang="ts">
  import { login } from '../../lib/auth.svelte.ts';

  let username = $state('');
  let password = $state('');
  let error    = $state<string | null>(null);
  let busy     = $state(false);

  async function submit() {
    if (!username.trim() || !password) return;
    busy = true;
    error = null;
    try {
      await login(username.trim(), password);
    } catch (e: unknown) {
      error = (e as { error?: string }).error ?? 'Login failed';
    } finally {
      busy = false;
    }
  }
</script>

<div class="login-screen">
  <form onsubmit={(e) => { e.preventDefault(); submit(); }}>
    <div class="logo">MiniRégie</div>
    <div class="subtitle">Admin</div>

    {#if error}
      <div class="error">{error}</div>
    {/if}

    <input
      class="field"
      type="text"
      placeholder="Username"
      bind:value={username}
      autocomplete="username"
      disabled={busy}
    />
    <input
      class="field"
      type="password"
      placeholder="Password"
      bind:value={password}
      autocomplete="current-password"
      disabled={busy}
    />
    <button type="submit" disabled={busy || !username.trim() || !password}>
      {busy ? '…' : 'Sign in'}
    </button>
  </form>
</div>

<style>
  .login-screen {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    background: var(--bg-deep);
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 260px;
  }

  .logo {
    font-size: var(--font-size-md);
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 2px;
  }

  .subtitle {
    font-size: var(--font-size-base);
    color: var(--text-dim);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin-bottom: 8px;
  }

  .error {
    font-size: var(--font-size-base);
    color: var(--danger);
    padding: 6px 8px;
    background: rgba(229, 57, 53, 0.1);
    border-radius: var(--radius);
  }

  .field {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-size: var(--font-size-md);
    font-family: var(--font);
    padding: 7px 10px;
    outline: none;
    transition: border-color 0.15s;
  }

  .field:focus {
    border-color: var(--accent);
  }

  .field:disabled {
    opacity: 0.5;
  }

  button {
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: var(--radius);
    font-size: var(--font-size-md);
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 8px 12px;
    cursor: pointer;
    transition: background 0.15s;
    margin-top: 4px;
  }

  button:hover:not(:disabled) {
    background: var(--accent-dim);
  }

  button:disabled {
    opacity: 0.4;
    cursor: default;
  }
</style>
