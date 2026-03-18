<script lang="ts">
  import { socketState } from '../lib/socket.svelte.ts';
  import { api } from '../lib/api.ts';
  import JamControls from './JamControls.svelte';
  import type { Participant } from '@shared/types';

  interface Props {
    me: Participant;
    onLogout: () => void;
  }

  const { me, onLogout }: Props = $props();

  const jamStatus = $derived(socketState.globalState?.jam.status ?? 'idle');
  const activeApp = $derived(socketState.globalState?.broadcast.activeApp ?? '—');
  const panicState = $derived(socketState.globalState?.broadcast.panicState ?? false);
  const poolTotal = $derived(socketState.globalState?.pool.total ?? 0);
  const poolFresh = $derived(socketState.globalState?.pool.fresh ?? 0);
  const connected = $derived(socketState.connected);

  // Format ms as HH:MM:SS
  function formatTime(ms: number | null): string {
    if (ms === null || ms <= 0) return '—';
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
  }

  async function handleLogout(): Promise<void> {
    try {
      await api.auth.logout();
    } catch {
      // ignore logout errors
    }
    onLogout();
  }
</script>

<header class="header">
  <div class="header-left">
    <span class="brand">📺 MiniRégie</span>

    <span class="conn-dot" class:connected title={connected ? 'Connecté' : 'Déconnecté'}></span>

    <span class="badge badge-{jamStatus}" class:badge-panic={panicState}>
      {panicState ? 'PANIC' : jamStatus.toUpperCase()}
    </span>

    {#if jamStatus === 'running' || panicState}
      <span class="time-remaining" title="Temps restant">
        {formatTime(socketState.timeRemaining)}
      </span>
    {/if}

    <span class="active-app" title="App active">
      App: <strong>{activeApp}</strong>
    </span>
  </div>

  <div class="header-center">
    <JamControls />
  </div>

  <div class="header-right">
    <span class="pool-stat" title="Items dans le pool">
      Pool: <strong>{poolTotal}</strong> / fresh: <strong>{poolFresh}</strong>
    </span>

    <span class="user-info" title={me.role}>
      {me.displayName}
    </span>

    <button class="btn btn-ghost btn-sm" onclick={handleLogout}>
      Déconnexion
    </button>
  </div>
</header>

<style>
  .header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 10px 20px;
    background: var(--bg-surface);
    border-bottom: 1px solid var(--border);
    flex-wrap: wrap;
    min-height: 56px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .header-center {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
    margin-left: auto;
  }

  .brand {
    font-weight: 700;
    font-size: 15px;
    color: var(--accent);
    white-space: nowrap;
  }

  .conn-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-dim);
    flex-shrink: 0;
  }

  .conn-dot.connected {
    background: var(--success);
    box-shadow: 0 0 6px var(--success);
  }

  .time-remaining {
    font-variant-numeric: tabular-nums;
    font-size: 18px;
    font-weight: 700;
    color: var(--accent);
    letter-spacing: 0.02em;
  }

  .active-app {
    font-size: 12px;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .pool-stat {
    font-size: 12px;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .user-info {
    font-size: 12px;
    color: var(--text-muted);
    white-space: nowrap;
  }
</style>
