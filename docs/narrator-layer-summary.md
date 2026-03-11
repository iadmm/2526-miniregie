# Couche narrative — Résumé des possibilités
> MiniRégie TV · IAD Louvain-la-Neuve · JAM Multimédia 48h · Février 2026

---

## Intention fondamentale

La narration n'est pas un décor. C'est une démonstration en acte du pouvoir des systèmes réactifs et non-linéaires. L'objectif non avoué : montrer aux étudiants ce que leurs outils habituels — fermés, linéaires, scriptés — ne peuvent structurellement pas faire.

Ce que MiniRégie peut faire et qu'un programme linéaire ne peut pas :
- Lire l'état du système en temps réel et réagir
- Se souvenir de ce qui s'est passé et en tirer des conséquences narratives
- Observer des comportements collectifs émergents que personne n'a planifiés
- Exposer sa propre mécanique à voix haute
- Ingérer le monde extérieur dans sa narration
- Nommer des événements qui n'existent que parce qu'un système les observe

La narration doit rester **subtile et non dérangeante**. Elle comble les creux, elle ne vole jamais la vedette aux participants.

---

## Architecture en cinq couches

### T1 — Scheduled
Contenu injecté à des moments planifiés connus à l'avance. Structure dramatique des 48h. Le narrateur sait que certains moments vont arriver.

**Sources :** horloge serveur, `schedule.json`

**Événements détectables :**
- Seuils temporels JAM : H+01, H+06, H+12, H+24, H+36, T−06, T−01, T−10, JAM_END
- Heure réelle du serveur (3h du matin est observable et distinct de tout seuil JAM)
- Lever du soleil calculé précisément depuis les coordonnées de Louvain-la-Neuve

---

### T1 — Reactive
Réponse à des événements émergents du système en cours de fonctionnement. Le narrateur ne l'a pas prévu — il observe et réagit.

**Sources :** GlobalState via Socket.io

**Événements détectables :**
- `pool.fresh = 0` depuis plus de 5 minutes — creux d'activité
- `pool.fresh` remonte après un creux — reprise
- Pic de soumissions — taux inhabituellement élevé sur fenêtre glissante
- `pool.total` franchit des paliers symboliques (50, 100, 200…)
- Entrée en régime hold — item tenu à l'écran, pool vide de nouveautés
- Sortie du régime hold — nouvelle soumission reçue
- Panic activé puis résolu
- Client TV déconnecté puis reconnecté
- Retour depuis `micro-trottoir` vers `jam-mode`

---

### T1 — Méta-système
Le narrateur parle du système en train de fonctionner. Pas ses erreurs — sa mécanique normale, exposée à voix haute. C'est la couche avec l'argument pédagogique le plus direct.

**Sources :** GlobalState + pool API (scores, counts, statuts)

**Événements détectables :**
- Règle `gims-replacement` déclenchée — le système a remplacé silencieusement une soumission par autre chose
- Règle `enrich-youtube-dedup` déclenchée — même vidéo soumise plusieurs fois, score dégradé automatiquement
- Item attendant depuis longtemps dans le pool sans avoir été affiché
- Item progressant en tête de queue — score calculable et observable
- Nombre d'items évalués pour sélectionner le suivant à chaque cycle
- Éviction automatique `unresolvable` — le système a vérifié, a attendu, a conclu

---

### T2 — Behavioral
Observation des patterns individuels et collectifs dans l'historique des MediaEvents. La distinction clé avec Reactive : Reactive lit **ce qui est**, Behavioral lit **ce qui s'est fait**. C'est le cœur de l'effet clickclickclick — l'observation nommée, le moment où les participants réalisent que le système les a vus.

**Sources :** historique MediaEvents (requêtes agrégées)

**Événements détectables :**
- Même participant soumettant plusieurs fois en peu de temps
- Première soumission d'un participant sans historique dans le pool
- Même `youtubeId` soumis par deux participants distincts — convergence culturelle spontanée
- Équipe précédemment active devenue silencieuse depuis plus de 2h
- Quota clips atteint pour un participant (3 clips max)
- Changement de registre dans le flux — ex: note soumise après une longue série de YouTube

---

### T2 — Environnementale
Données extérieures au système. Ancre la JAM dans le monde physique. Crée un contraste entre l'espace clos de création et le monde qui continue.

**Sources :** 1 API météo externe + calcul astronomique

**Événements détectables :**
- Précipitations à Louvain-la-Neuve
- Température extérieure notable — froid nocturne, contraste intérieur/extérieur
- Lever du soleil à l'heure calculée — après une nuit de travail

---

## Couches T3 — Gardées en réserve

Complexité élevée ou risque éditorial trop important pour un événement unique.

**Relationnelle** — croisement de données inter-participants, détection de corrélations. Fort narrativement, coûteux techniquement.

**Anticipatoire** — trajectoires calculées sur historique glissant. Risque de faux positifs embarrassants devant le public.

**Par l'absence** — commenter ce qui n'est pas là (équipes sans soumissions, types de contenus jamais utilisés). Très fort mais risque de devenir culpabilisant mal dosé.

---

## Règles d'injection communes à toutes les couches

Le NarratorEngine injecte dans le pool via `pool.addItem()` avec le fingerprint réservé `system:narrator`. Exempté du rate limit et du Guard statut JAM.

**Priorité dans le pool :** `80` — en dessous des soumissions normales (`100`). Le narrateur comble, il ne s'impose pas.

**Deux types d'injection :**
- `ticker` — message défilant dans le `persistent-layer`, ne consomme pas de slot visuel
- `note` — entre dans le pool normal, scorée, affichée selon le cycle habituel

**Règles de silence :** le narrateur ne réagit pas à tout. Un intervalle minimum entre deux injections (ordre de grandeur : 8 minutes) évite la surcharge. Une même catégorie d'événement ne se déclenche pas deux fois de suite sans délai suffisant.

---

## Ce que cette architecture démontre

Chaque couche illustre quelque chose de différent sur la non-linéarité :

- **Scheduled** — une narration peut avoir une forme sans script unique
- **Reactive** — une narration peut lire l'état du monde en temps réel
- **Méta-système** — une narration peut parler d'elle-même en train de fonctionner
- **Behavioral** — une narration peut se souvenir de ce que les gens ont fait
- **Environnementale** — une narration peut ingérer le monde extérieur

Ensemble, ces cinq couches forment un argument complet que les outils linéaires et les programmes walled garden ne peuvent pas tenir.

---

*Résumé établi après session de travail · Février 2026*
*Le catalogue de messages (140 variations, 28 événements) est dans un document séparé.*
*La personnalité du narrateur est en cours d'élaboration — elle naîtra des choix dans ce catalogue.*
