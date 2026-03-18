<script lang="ts">
  import { api, isApiError } from './lib/api.js';
  import { participantState } from './lib/stores.js';
  import Login from './components/Login.svelte';
  import Onboarding from './components/Onboarding.svelte';
  import Dashboard from './components/Dashboard.svelte';
  import type { Participant } from '@shared/types.js';

  // ─── Routing state machine ────────────────────────────────────────────────
  // Routes:
  //   'loading'    — checking session on startup
  //   'login'      — not authenticated
  //   'onboarding' — authenticated but no avatar
  //   'dashboard'  — fully onboarded

  type Route = 'loading' | 'login' | 'onboarding' | 'dashboard';
  let route = $state<Route>('loading');

  // ─── Boot: check existing session ────────────────────────────────────────

  $effect(() => {
    api.auth.me()
      .then((result) => {
        if (result === null) {
          route = 'login';
          return;
        }
        const p = result.participant;
        participantState.value = p;
        route = p.avatarUrl ? 'dashboard' : 'onboarding';
      })
      .catch((err: unknown) => {
        // Network error — default to login screen
        if (isApiError(err) && err.status === 0) {
          // No connectivity on load — still show login
        }
        route = 'login';
      });
  });

  // ─── Routing helpers ──────────────────────────────────────────────────────

  function handleLogin(participant: Participant) {
    participantState.value = participant;
    route = participant.avatarUrl ? 'dashboard' : 'onboarding';
  }

  function handleOnboardingDone(participant: Participant) {
    participantState.value = participant;
    route = 'dashboard';
  }

  function handleLogout() {
    participantState.value = null;
    route = 'login';
  }
</script>

{#if route === 'loading'}
  <div class="splash">
    <div class="spinner"></div>
  </div>

{:else if route === 'login'}
  <Login onLogin={handleLogin} />

{:else if route === 'onboarding' && participantState.value !== null}
  <Onboarding
    participant={participantState.value}
    onDone={handleOnboardingDone}
  />

{:else if route === 'dashboard' && participantState.value !== null}
  <Dashboard
    participant={participantState.value}
    onLogout={handleLogout}
  />
{/if}

<style>
  .splash {
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(26, 192, 215, 0.2);
    border-top-color: #1ac0d7;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>