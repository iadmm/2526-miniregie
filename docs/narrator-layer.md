# Couche narrative — JOSÉ / NarratorEngine
> IAD Louvain-la-Neuve · JAM Multimédia 48h · Version 2.0 · Mars 2026

---

## Concept

Ajout d'une couche narrative optionnelle et non intrusive portée par un personnage fictif — **José** — qui injecte des messages, tickers et contenus dans le flux à des moments clés de la JAM. José n'est pas une vraie IA : c'est un ensemble de contenus pré-écrits et de règles d'injection avec une voix éditoriale cohérente.

Principe de base : **subtil et non dérangeant**. José comble les creux, il ne vole jamais la vedette aux participants.

La couche narrative n'est pas un décor. C'est une démonstration en acte du pouvoir des systèmes réactifs et non-linéaires — ce que les outils linéaires et walled-garden ne peuvent structurellement pas faire.

---

## NarratorEngine — intégration système

### Positionnement

Service serveur qui s'injecte dans le pool via `pool.addItem()` avec le fingerprint réservé `system:narrator`. Exempté du rate limit et du Guard statut JAM, comme les uploads admin.

**Priorité dans le pool :** `80` — en dessous des soumissions normales (`100`). José comble, il ne s'impose pas.

### Deux modes d'injection

**Scheduled** — contenu injecté à des moments précis, co-planifié avec `schedule.json` :

```javascript
[
  { at: 'H+01:00:00', type: 'ticker', content: "..." },
  { at: 'H+12:00:00', type: 'ticker', content: "..." },
  { at: 'T-06:00:00', type: 'note',   content: "..." },
  { at: 'T-00:10:00', type: 'ticker', content: "..." },
]
```

**Reactive** — réponse à des événements du GlobalState :

| Condition | Délai | Type |
|---|---|---|
| `pool.total` passe sous 3 items | +90s | Ticker |
| `pool.fresh` = 0 depuis > 5min | +2min | Note |
| `jam.status` → `running` | +8min | Ticker |

Le délai évite que l'injection paraisse mécanique.

### Règles de silence

Le NarratorEngine ne réagit pas à tout. Un intervalle minimum entre deux injections (ordre de grandeur : 8 minutes) évite la surcharge. Une même catégorie d'événement ne se déclenche pas deux fois de suite sans délai suffisant.

---

## Architecture en cinq couches

### T1 — Scheduled
Contenu injecté à des moments planifiés. Structure dramatique des 48h.

**Événements détectables :**
- Seuils temporels JAM : H+01, H+06, H+12, H+24, H+36, T−06, T−01, T−10, JAM_END
- Heure réelle du serveur (3h du matin est observable)
- Lever du soleil calculé depuis les coordonnées de Louvain-la-Neuve

### T1 — Reactive
Réponse à des événements émergents. Le narrateur observe et réagit.

**Sources :** GlobalState via Socket.io

**Événements détectables :**
- `pool.fresh = 0` depuis plus de 5 minutes — creux d'activité
- `pool.fresh` remonte après un creux — reprise
- Pic de soumissions — taux inhabituellement élevé sur fenêtre glissante
- `pool.total` franchit des paliers symboliques (50, 100, 200…)
- Entrée en régime hold — item tenu à l'écran, pool vide
- Sortie du régime hold — nouvelle soumission reçue
- Panic activé puis résolu
- Client TV déconnecté puis reconnecté
- Retour depuis `micro-trottoir` vers `jam-mode`

### T1 — Méta-système
Le narrateur parle du système en train de fonctionner. C'est la couche avec l'argument pédagogique le plus direct.

**Événements détectables :**
- Règle `gims-replacement` déclenchée
- Règle `enrich-youtube-dedup` déclenchée
- Item attendant depuis longtemps sans avoir été affiché
- Item progressant en tête de queue
- Éviction automatique `unresolvable`

### T2 — Behavioral
Observation des patterns dans l'historique des MediaEvents.

**Sources :** historique MediaEvents (requêtes agrégées)

**Événements détectables :**
- Même participant soumettant plusieurs fois en peu de temps
- Première soumission d'un participant sans historique
- Même `youtubeId` soumis par deux participants distincts — convergence culturelle
- Équipe précédemment active devenue silencieuse depuis > 2h
- Quota clips atteint pour un participant
- Changement de registre dans le flux

### T2 — Environnementale
Données extérieures. Ancre la JAM dans le monde physique.

**Sources :** 1 API météo externe + calcul astronomique

**Événements détectables :**
- Précipitations à Louvain-la-Neuve
- Température extérieure notable
- Lever du soleil à l'heure calculée

---

## Couches T3 — Gardées en réserve

Complexité élevée ou risque éditorial trop important pour un premier événement.

- **Relationnelle** — croisement inter-participants, détection de corrélations
- **Anticipatoire** — trajectoires calculées sur historique glissant (risque de faux positifs)
- **Par l'absence** — commenter ce qui n'est pas là (risque de devenir culpabilisant)

---

## Identité visuelle

- Tickers signés avec le label **`▸ JOSÉ`**, couleur d'accent distincte, monospace
- Notes : légère bordure distincte côté renderer, rien d'ostensible

---

## Ce que cette architecture démontre

| Couche | Ce qu'elle illustre |
|---|---|
| Scheduled | Une narration peut avoir une forme sans script unique |
| Reactive | Une narration peut lire l'état du monde en temps réel |
| Méta-système | Une narration peut parler d'elle-même en train de fonctionner |
| Behavioral | Une narration peut se souvenir de ce que les gens ont fait |
| Environnementale | Une narration peut ingérer le monde extérieur |

---

## Modificiations système

| Élément | Type | Description |
|---|---|---|
| `system:narrator` | Fingerprint réservé | Exempté rate limit et Guard JAM |
| `priority: 80` | Valeur de scoring | En dessous des soumissions normales |
| `NarratorEngine` | Service serveur | Scheduled + reactive, écoute GlobalState |
| `ticker` | Type MediaItem | Message défilant, NarratorEngine uniquement |

---

*Le catalogue de messages (140 variations, 28 événements) est dans un document séparé — à rédiger.*  
*La personnalité de José naîtra des choix dans ce catalogue.*
