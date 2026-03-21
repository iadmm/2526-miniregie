<script lang="ts">
  import { auth, logout } from '../../lib/auth.svelte.ts';
</script>

<header class="topbar">
  <span class="logo">MiniRégie</span>
  <div class="right">
    <span class="user">{auth.participant?.displayName ?? ''}</span>
    <button onclick={logout}>Sign out</button>
  </div>
</header>

<style>
  .topbar {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 36px;
    padding: 0 12px;
    background: var(--bg-panel);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .logo {
    font-size: var(--font-size-md);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent);
  }

  .right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .user {
    font-size: var(--font-size-base);
    color: var(--text-muted);
  }

  button {
    background: none;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text-dim);
    font-size: var(--font-size-base);
    padding: 2px 8px;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }

  button:hover {
    color: var(--text);
    border-color: var(--text-muted);
  }
</style>
