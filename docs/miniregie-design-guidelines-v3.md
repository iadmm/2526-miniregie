# MiniRégie TV — Intentions graphiques & influences
> IAD Louvain-la-Neuve · JAM Multimédia 48h · Version 3.0 · Mars 2026
> Document destiné à guider toute décision d'implémentation graphique.

---

## Intention fondatrice

MiniRégie est un système de broadcast, pas une interface web. Chaque décision visuelle s'évalue à cette aune : est-ce que ça tiendrait à l'antenne ? Est-ce que ça supporte 48 heures de diffusion continue sans fatiguer ?

Mais MiniRégie est aussi le projet d'une école d'art. Le système revendique cette double appartenance — la rigueur du broadcast professionnel et l'énergie propre à un environnement créatif. Ce n'est pas une contradiction à résoudre, c'est une tension productive à entretenir.

Le graphisme réussit quand on ne le voit pas. Le regard doit toujours revenir au contenu des participants, jamais au cadre.

---

## Références broadcast directes

Ces quatre systèmes constituent la bibliothèque de références primaires. Chacun apporte quelque chose de précis au système MiniRégie.

### RTL Nieuws (Mark Porter, 2014)

La référence la plus directe pour l'architecture générale des composants. Mark Porter — directeur artistique du Guardian pendant dix ans avant ce projet — a construit un système de broadcast qui traite l'information comme de la typographie éditoriale plutôt que comme de la signalétique. Les éléments clés qui ont influencé MiniRégie : l'usage de rectangles blancs flottants qui ne touchent pas les bords de l'écran, la cohabitation de plusieurs surfaces sans qu'elles se concurrencent, et la sobriété chromatique (un seul accent couleur, fonctionnel, jamais décoratif). La police Graphik de Commercial Type utilisée par RTL Nieuws est dans le même registre que Schibsted Grotesk — grotesque contemporain, froid et précis.

Ce que MiniRégie retient de RTL Nieuws : la logique des surfaces flottantes, la marge commune entre tous les composants chrome, et l'idée qu'un système broadcast peut être sobre sans être austère.

### Al Jazeera English

La référence pour le ticker et le traitement du fond sombre. Al Jazeera est l'un des rares grands systèmes broadcast qui assume un fond très sombre en dehors des situations d'urgence — la plupart des chaînes utilisent des fonds clairs ou bleutés. Cette décision crée une présence à l'écran très particulière, presque cinématographique. Les éléments influents : le fond sombre qui valorise les surfaces blanches et colorées par contraste, la typographie en capitales tracées sur les bandeaux (DIN ou Bahnschrift dans leur version d'origine), et le flag coloré dans le ticker qui est le seul élément fortement teinté d'un bandeau par ailleurs neutre.

Ce que MiniRégie retient d'Al Jazeera : le fond sombre comme surface de travail, le principe du flag unique comme seul accent coloré dans le ticker, et la neutralité totale du reste du bandeau.

### CNN

La référence pour la tension asymétrique et le traitement du blanc. CNN a inventé le lower-third moderne tel qu'on le connaît — un bloc blanc avec du texte noir qui flotte dans le bas du cadre, sans fond, sans bordure, sans ombre. La force de ce système est son immédiateté : le regard va directement au texte parce qu'il n'y a rien d'autre à regarder. CNN pousse aussi loin la logique d'asymétrie — les éléments ne sont jamais centrés, jamais symétriques. La tension entre les différents blocs est compositionnelle.

Ce que MiniRégie retient de CNN : le bloc blanc sans ornementation comme traitement du lower-third, et l'asymétrie comme principe de composition plutôt que la symétrie.

### BBC Chameleon (Martin Lambie-Nairn, 1991)

La référence historique et pédagogique. Martin Lambie-Nairn a conçu pour BBC One un système graphique d'identité broadcast basé sur trois rectangles colorés en mouvement — le "globe chameleon". Ce qui est remarquable est la sobriété du principe : trois formes, une logique, une infinité de variations. Lambie-Nairn a ensuite appliqué ce même principe à Channel 4, à ITV, à de nombreux systèmes européens. Son travail a défini l'esthétique du broadcast européen des années 90.

Ce que MiniRégie retient de Lambie-Nairn : l'idée qu'un système graphique broadcast se construit sur un nombre minimal de décisions formelles appliquées avec cohérence, et que la contrainte formelle génère l'identité plutôt qu'elle ne la limite.

### The New York Times Video

La référence spécifique pour le lower-third et la note card. Le NYT utilise dans ses vidéos documentaires et ses reportages un traitement des intertitres et des attributions très reconnaissable : blocs blancs qui surgissent directement sur l'image, serif (Cheltenham, leur police historique) pour les noms propres et les titres, sans-serif pour les métadonnées et les rôles. La typographie est grande — conçue pour être lue sur un écran de téléphone tenu en portrait, pas sur un moniteur. Le blanc est légèrement chaud, jamais pur.

Ce que MiniRégie retient du NYT : le traitement du bloc blanc comme surface éditoriale autonome, le serif uniquement sur les noms propres, le blanc tempéré `#f8f7f5`, et la logique du split en plusieurs blocs qui arrivent en stagger.

---

## Références typographiques

### Jan Tschichold — Die Neue Typographie (1928)

Tschichold a posé les fondements du design typographique moderne avec un principe simple : la forme doit suivre la fonction, et la hiérarchie doit être visible dans la typographie elle-même, pas dans l'ornement. Son travail sur la grille, la standardisation et la clarté est la base intellectuelle du système typographique de MiniRégie. En particulier, sa distinction entre le "texte courant" et les "éléments fonctionnels" (titres, labels, légendes) correspond exactement à la distinction Fraunces / Schibsted Grotesk du système.

Tschichold a également formalisé l'idée que la hiérarchie se lit dans le poids et la taille, pas dans la couleur — une leçon directement appliquée dans le système d'opacités de MiniRégie.

### Emil Ruder — Typographie (1967)

Ruder, directeur de l'École des arts et métiers de Bâle, a développé une approche de la typographie fondée sur le rythme et la tension. Sa contribution la plus importante pour MiniRégie est l'idée que l'espace blanc est un élément actif, pas un vide. Les paddings serrés du lower-third ne sont pas une économie de place — c'est une décision rythmique. L'espace entre le tag et le bloc, entre le nom et le rôle, est calibré comme une mesure musicale.

Ruder a aussi insisté sur le fait que la lisibilité et la beauté ne sont pas opposées — que la typographie la plus lisible est souvent aussi la plus élégante. C'est la position exacte du système MiniRégie face à la tension broadcast / école d'art.

### Josef Müller-Brockmann — Grid Systems (1961)

Müller-Brockmann a formalisé le système de grille en 12 colonnes comme "champ de tension" plutôt que comme cage. Sa contribution au design typographique est l'idée que la grille génère des possibilités plutôt qu'elle ne les contraigne — que les ruptures intentionnelles de grille sont plus lisibles que les compositions libres, parce qu'elles s'inscrivent dans un système connu.

Pour MiniRégie, cela se traduit par l'alignement strict des composants chrome sur des marges communes (5% des bords), avec des ruptures nommées et justifiées — le trait dessiné à la plume est la seule rupture intentionnelle du système, et elle est d'autant plus lisible qu'elle s'inscrit contre un fond rigoureux.

### Mark Porter — directeur artistique, Guardian

Mark Porter a redesigné le Guardian en 2005 avec une logique qui a influencé le design éditorial mondial : traiter un quotidien comme un système typographique plutôt que comme une suite de pages. Sa contribution à MiniRégie est conceptuelle plus que formelle — l'idée qu'un système éditorial a une voix visuelle cohérente qui s'exprime dans chaque décision, même la plus petite (l'épaisseur d'un trait, la valeur d'une opacité).

Porter a également travaillé sur RTL Nieuws (cf. références broadcast ci-dessus), ce qui en fait le lien direct entre le design éditorial presse et le design broadcast dans les influences du projet.

---

## Référence école d'art : l'identité IAD

Les communications visuelles de l'IAD Louvain-la-Neuve utilisent systématiquement un trait blanc dessiné à la main — textes annotés, flèches, encerclements — sur des photographies. On retrouve ce traitement dans les affiches de stages, les communications d'inscription, les visuels événementiels. C'est un élément d'identité reconnaissable de l'école.

MiniRégie hérite directement de cette convention. L'introduction du trait dessiné à la plume dans le système broadcast n'est pas une fantaisie — c'est un signal d'appartenance institutionnelle. Les étudiants qui regardent l'écran reconnaissent le geste graphique de leur école dans un contexte qu'ils n'attendaient pas.

La tension entre le trait dessiné et le broadcast rigoureux est précisément la tension que l'IAD cultive dans sa pédagogie : maîtrise technique et liberté créative ne s'excluent pas.

---

## Référence analogique : le flip clock

Le flip clock — mécanisme d'affichage à plaquettes qui se retournent — est une référence directe aux tableaux d'affichage des gares et aéroports des années 60-80 (Solari di Udine en est le fabricant historique). Ces systèmes ont marqué une génération entière comme l'image du temps qui passe en public — le bruit mécanique des plaquettes qui tombent est encore culturellement chargé.

Dans MiniRégie, le flip clock est utilisé pour le countdown de la JAM. Ce choix est pédagogique autant qu'esthétique : il montre à des étudiants en motion design qu'on peut citer une référence analogique avec précision dans un système numérique — que le "vieux" et le "nouveau" ne sont pas en opposition mais en conversation. C'est un argument en acte pour la culture visuelle historique.

Techniquement, chaque digit est composé de deux demi-surfaces aux luminosités légèrement différentes (supérieure plus claire, inférieure plus sombre), séparées par une ligne noire. L'animation en deux phases — demi-carte supérieure qui se replie sur l'axe X, demi-carte inférieure qui se déplie — avec 70ms de chevauchement reproduit le comportement mécanique de l'original.

---

## Surface et fond

L'écran est sombre, presque noir (`#06080d`). Ce choix est technique autant qu'éditorial. Les projecteurs tiennent mieux les noirs profonds sur de longues durées. Le contenu photographique des participants, souvent capturé la nuit en conditions difficiles, respire mieux sur fond sombre. Et le noir place le spectateur en position de réception — comme dans une salle de cinéma.

Le fond n'est pas uniforme. Un dégradé radial subtil anime la surface — légèrement plus lumineux au centre-haut, plus sombre dans les coins. L'amplitude est volontairement faible (5 à 8% de variation de luminosité). Si on peut nommer le dégradé, il est trop fort. L'œil doit percevoir que le fond a de la matière, pas de la platitude.

Une respiration très lente — cycle de neuf secondes via une animation GSAP `yoyo` sur l'opacité d'une couche de lumière blanche à 3.5% — donne l'impression que le système est vivant. Ce n'est pas une animation qu'on regarde, c'est une sensation qu'on perçoit après plusieurs minutes de présence devant l'écran.

Implémentation du fond :
```
background:
  radial-gradient(ellipse 150% 90% at 50% -8%, #131f34 0%, transparent 50%),
  radial-gradient(ellipse 70%  80% at 10% 70%, #0c1828 0%, transparent 48%),
  #06080d;
```
Vignette :
```
background: radial-gradient(ellipse 110% 100% at 50% 48%, transparent 38%, rgba(2,3,8,.58) 100%);
```

---

## Couleur

Un seul accent chromatique dans tout le système : le cyan `#1ac0d7`, avec sa variante sombre `#107c9d`. Il n'apparaît qu'à des endroits précis et toujours les mêmes — le flag du ticker, le tag du lower-third, l'équipe en accent dans les variantes intégrées. Cette répétition crée la cohérence. Le spectateur reconnaît la couleur avant de lire ce qu'elle dit.

La couleur est un signal de marque, jamais une décoration. Elle ne code aucun sens sémantique (urgent, valide, erroné). Elle identifie M4TV.

Le blanc des surfaces éditoriales est `#f8f7f5` — légèrement tempéré, jamais pur `#ffffff`. Le blanc pur sur fond très sombre crée un contraste maximal qui fatigue l'œil sur 48 heures. Deux ou trois points de rouge en plus que le blanc pur suffisent à humaniser la surface. Cette décision vient directement de l'observation du NYT vidéo.

---

## Typographie

Deux polices. Pas trois.

### Fraunces — police des noms propres

Fraunces est une police serif optique variable (axe `opsz` 9–144) conçue par Undercase Type. Elle est ouverte, disponible sur Google Fonts, et très peu utilisée dans les environnements broadcast — c'est un choix d'initié.

Elle apparaît uniquement quand un être humain est nommé :
- **Lower-third** : Fraunces 400 roman. Le nom d'une personne présentée à l'écran mérite un traitement plein.
- **Attribution de note card** : Fraunces 300 roman. C'est une signature, pas une présentation. Le poids plus léger crée la bonne distance entre le corps du texte et son auteur.

L'italic n'est jamais utilisé comme style de composant. L'italic est une emphase ponctuelle à l'intérieur d'un texte courant.

La règle est absolue : si c'est un nom de personne, c'est Fraunces. Rien d'autre ne reçoit cette police.

L'influence directe est le traitement des noms propres dans la presse quotidienne de référence — Le Monde, le Guardian, le NYT — où le serif est systématiquement réservé aux moments éditoriaux forts (titres, bylines, citations). Dans MiniRégie, le seul "moment éditorial fort" est le nom d'une personne.

### Schibsted Grotesk — police du système

Schibsted Grotesk est un grotesque contemporain développé par Schibsted (groupe de presse scandinave) et publié en open source. Il est dans la lignée Univers / Aktiv Grotesk — le registre que La Cambre utilise dans ses communications institutionnelles. Froid, rationnel, précis. Pas Helvetica (trop chargé culturellement) ni Inter (trop "app") ni IBM Plex (police maison de l'IAD, explicitement exclue pour ne pas créer de confusion institutionnelle).

Il porte : le ticker, l'horloge, les rôles, les captions, les labels système, le countdown flip clock, les eyebrows, les métadonnées d'équipe, les attributions.

La distinction entre les deux polices est fonctionnelle, pas décorative. Fraunces dit : voici une personne. Schibsted Grotesk dit : voici une information.

---

## Échelle typographique

Tout ce qui est affiché sur l'écran broadcast est fait pour être lu à distance — plusieurs mètres dans une salle de projection. Cette contrainte prime sur toute autre considération.

Les tailles sont exprimées en `clamp(minimum, valeur-fluide-vw, maximum)`.

| Élément | Clamp | Police | Poids |
|---|---|---|---|
| Nom lower-third | `clamp(14px, 2vw, 24px)` | Fraunces | 400 |
| Rôle lower-third | `clamp(6px, .82vw, 9px)` | Schibsted Grotesk | 400 |
| Tag équipe | `clamp(5.5px, .72vw, 8px)` | Schibsted Grotesk | 700 |
| Corps note card | `clamp(11px, 1.55vw, 18px)` | Schibsted Grotesk | 400 |
| Auteur note card | `clamp(8px, 1.05vw, 13px)` | Fraunces | 300 |
| Équipe note card | `clamp(5px, .65vw, 7px)` | Schibsted Grotesk | 400 |
| Eyebrow note card | `clamp(5px, .68vw, 7.5px)` | Schibsted Grotesk | 400 |
| Texte ticker | `clamp(5px, .7vw, 7.5px)` | Schibsted Grotesk | 400 |
| Flag ticker | `clamp(5px, .7vw, 7.5px)` | Schibsted Grotesk | 700 |
| Horloge ticker | `clamp(5px, .7vw, 7.5px)` | Schibsted Grotesk | 500 |

---

## Hiérarchie par les opacités

Sur fond sombre, la hiérarchie s'exprime par des niveaux d'opacité du blanc. Le système ne dépasse pas quatre niveaux dans un même composant.

| Niveau | Opacité | Usage |
|---|---|---|
| Primaire | 88–90% | Corps de note, texte principal |
| Secondaire | 65% | Nom d'auteur (Fraunces 300) |
| Tertiaire | 42–45% | Eyebrow, label timestamp |
| Ghost | 28–35% | Équipe, métadonnée secondaire |

Toute valeur en dessous de 28% sur fond sombre est potentiellement illisible en conditions réelles de projection. C'est une limite physique.

---

## Le lower-third

Inspiré directement du traitement CNN et NYT, le lower-third de MiniRégie est composé de deux surfaces distinctes qui arrivent en deux temps séparés.

**Le tag équipe** — surface `#1ac0d7`, Schibsted Grotesk 700 tracké, couleur de texte `rgba(0,0,0,0.68)`. Padding minimal : `clamp(1.5px, .22vw, 2.5px)` vertical, `clamp(5px, .7vw, 7px)` horizontal. Il arrive en premier (180ms, `power2.out`), pose le contexte avant l'identité.

**Le bloc blanc** — surface `#f8f7f5`, Fraunces 400 pour le nom, Schibsted Grotesk 400 pour le rôle. Padding : `clamp(4px, .55vw, 6px)` vertical, `clamp(8px, 1.1vw, 12px)` horizontal. Il arrive en second (320ms, `power2.out`), avec 60ms de chevauchement avec le tag.

Gap entre tag et bloc : `1.5px` via `gap` sur le parent flex.

Le tag équipe est structurellement toujours présent. Fallback si équipe vide : "JAM 2026".

**Règle éditoriale critique :** le lower-third n'apparaît que dans les layouts où quelqu'un est à identifier visuellement — `VISUAL_FULL`, `MEDIA_FULL`, `MEDIA_WITH_VISUAL`, `DUAL_VISUAL`, `MICRO_TROTTOIR`. Il n'apparaît jamais avec `NOTE_CARD` (attribution intégrée dans la carte) ni avec les layouts caption (`MEDIA_WITH_CAPTION`, `VISUAL_WITH_CAPTION` — attribution inline). C'est une règle éditoriale dans le `BroadcastController`, pas une contrainte CSS.

---

## La note card

La note card est le moment le plus intime du système — la voix brute d'un participant, seule à l'écran.

La carte `#f8f7f5` est centrée légèrement au-dessus du centre géométrique (`transform: translate(-50%, -54%)`). L'œil perçoit le centre géométrique exact comme trop bas — convention héritée de la composition typographique classique, notamment documentée par Tschichold dans ses travaux sur la mise en page du livre.

**Cadre fixe :** `max-width: 58%`, `max-height: 72%`, `overflow: hidden`. Le cadre ne grandit jamais. Le texte s'adapte à l'intérieur. Les 280 caractères maximum autorisés par le système sont dimensionnés pour tenir dans ce cadre au corps défini.

**Stagger d'entrée :** chaque ligne du texte monte depuis son conteneur masquant (`overflow: hidden`) avec 90ms de décalage entre chaque ligne, easing `expo.out`. L'auteur apparaît après les lignes de texte avec une translation de 7px. Cette animation est inspirée du traitement des intertitres dans les vidéos documentaires du NYT.

Il n'y a pas de règle horizontale entre le texte et l'attribution. La rupture de taille entre le corps `1.55vw` et l'auteur `1.05vw` est la séparation. Une ligne décorative est un doublon de l'information que la typographie exprime déjà.

---

## Le ticker

Inspiré du traitement Al Jazeera — fond sombre, flag coloré unique, texte neutre. Le ticker flotte dans des marges de `5%` de chaque bord (même marge que le lower-third — alignement commun).

**Structure :** flag `#1ac0d7` + horloge (oscillation heure réelle / T−) + texte défilant. Une seule surface colorée dans tout le bandeau. Tout le reste est neutre.

**Horloge oscillante :** bascule toutes les 5 secondes entre l'heure réelle et le temps restant avant le freeze. Animation GSAP : `opacity: 0, y: -4` pour la sortie (220ms, `power2.in`), `opacity: 1, y: 0` pour l'entrée (220ms, `power2.out`), avec 60ms de délai entre les deux.

**Vitesse de défilement :** 55px/s — calibré sur l'observation de chaînes Al Jazeera et BBC News. Trop lent et le texte semble statique, trop rapide et il devient illisible.

**Dot pulsant** dans le flag : animation `opacity` entre 1 et 0.18, cycle 2.2s `ease-in-out infinite`. Signal d'activité du système sans mot.

Le ticker apparaît et disparaît par des transitions d'`opacity` — pas de wipe, pas de slide. Il est présent ou absent.

---

## Le trait dessiné à la plume

Héritage direct de l'identité visuelle de l'IAD (trait blanc dessiné à la main sur photographies, présent dans les affiches de stages, affiches d'inscription, visuels événementiels).

**Principe technique :** paths SVG animés par `stroke-dashoffset`. La valeur initiale est égale à la longueur totale du path (`getTotalLength()`). L'animation fait passer `strokeDashoffset` de `longueur` à `0` (apparition) ou de `0` à `-longueur` (disparition — le trait se rétracte par son début, comme une main qui reprend son geste).

**Propriétés du trait :**
```
fill: none
stroke: rgba(255, 255, 255, 0.88)
stroke-linecap: round
stroke-linejoin: round
stroke-width: 1.5 à 2.2 selon le geste
```
Pas de filtre de texture (`feTurbulence` ou autre). L'irrégularité vient du path lui-même, dessiné à la main dans Illustrator et exporté en SVG — jamais construit en coordonnées mathématiques. Le trait est net comme une plume, l'âme tordue comme une main qui dessine vite.

**Comportements :**

*Blob* — contour organique qui encercle un élément. Path fermé mais pas exactement — le début et la fin laissent une micro-ouverture caractéristique du geste manuel. Durée d'apparition : ~2s (`power1.inOut`). Durée de disparition : ~1s (`power2.in`).

*Soulignement* — trait sous un nom ou une phrase. Légère courbe naturelle, petit dépassement à droite. Durée : ~0.55s apparition, ~0.4s disparition.

*Flèche* — tracé courbe + deux traits asymétriques pour la pointe. La pointe est animée en deux temps après le tracé du trait (0.18s chacun, 80ms d'offset entre eux). Jamais une flèche géométrique.

*Cercle organique* — autour d'un petit élément. Ellipse délibérément asymétrique sur ses quatre quarts. Le trait revient légèrement sur lui-même à la fin — l'élan final du stylo.

*Trait libre* — geste énergétique sans destination fonctionnelle. Réservé aux moments de lancement (app `countdown-to-jam`, `IDLE`).

**Règles d'usage :**
- Le trait vit dans sa propre couche SVG `position: absolute; inset: 0; z-index: 30; pointer-events: none`
- Il n'intervient jamais dans les composants chrome structurels (ticker, lower-third, flip clock)
- Il n'est jamais permanent — il arrive, vit, repart
- La disparition est toujours `strokeDashoffset: -longueur`, pas un fade d'opacité
- Sa rareté est sa force — plus il apparaît souvent, moins il a de poids

---

## Animations et transitions

Le cut est la valeur par défaut. Un effet sans raison éditoriale est un défaut.

**Wipe horizontal** (lower-third) : `clip-path: inset(0 100% 0 0)` → `inset(0 0% 0 0)` pour l'entrée. Inverse pour la sortie. C'est le seul effet de transition autorisé pour les composants chrome. Il évoque le défilement de la presse, le déroulement d'une bobine. Référence directe aux wipes broadcast de RTL Nieuws et BBC.

**Transitions de layout** (slots de contenu) : séquence en trois phases inspirée du modèle CasparCG — wipe out des sortants (`power2.in`), déplacement géométrique des restants (`expo.out`), wipe in des entrants (`expo.out`). Le `expo.out` — très rapide au départ, très lent à l'arrivée — donne aux éléments un atterrissage précis et intentionnel.

**Stagger de la note card** : `expo.out`, 90ms entre chaque ligne, auteur 280ms après la dernière ligne. Inspiré des intertitres NYT.

**Respiration du fond** : GSAP `gsap.fromTo` sur l'opacité d'une couche de lumière, `yoyo: true`, `repeat: -1`, `ease: sine.inOut`, `duration: 9`. Imperceptible individuellement, notable par son absence.

Aucune transition ne dure plus d'une seconde.

---

## Zones de sécurité

Convention broadcast historique : action safe à 90% du cadre, title safe à 80%. Dans MiniRégie, la marge retenue est **5% de chaque bord** — entre les deux zones, adaptée aux conditions de projection en salle sur écran moderne (pas d'overscan CRT, mais lisibilité optique à respecter).

Tous les composants chrome (ticker, lower-third) respectent cette marge commune. L'alignement commun à gauche et en bas n'est pas une contrainte technique — c'est une décision de composition. Les deux éléments appartiennent au même registre d'information et partagent le même territoire visuel.

---

## Règle des composants simultanés

**Lower-third + note card : interdit.** La note porte déjà son attribution (nom Fraunces 300 + équipe Schibsted Grotesk). Ajouter un lower-third est un doublon et une surcharge visuelle.

**Lower-third + layouts caption : interdit.** Les captions (`MEDIA_WITH_CAPTION`, `VISUAL_WITH_CAPTION`) portent leur attribution inline. Même logique.

**Ticker + tous layouts : autorisé.** Le ticker porte des informations différentes de celles de la note ou de la caption. Il ne redouble pas.

Cette règle est implémentée dans le `BroadcastController` ou le `LayoutEngine`, pas en CSS.

---

## Ce qui est explicitement interdit

**La bordure colorée sur le bord gauche.** C'est l'esthétique par défaut des interfaces générées — rejetée deux fois en session de travail comme "IA cheap". Jamais, dans aucun composant.

**Le dégradé dans un composant foreground.** Le dégradé appartient au fond. Les surfaces qui portent du texte (lower-third, note card) sont planes.

**L'italic comme style de composant.** L'italic est une emphase dans un texte courant, jamais le style global d'un bloc.

**Le trait dessiné dans les composants chrome structurels.** Le trait est libre et organique — les composants broadcast sont rigoureux. Les deux territoires ne se mélangent pas.

**Plus d'un accent chromatique.** `#1ac0d7` ne coexiste pas avec une deuxième teinte dans un même composant.

**La superposition lower-third + note card.** Règle éditoriale absolue.

**Toute valeur d'opacité inférieure à 28%** sur fond sombre en conditions de projection réelles.

---

## Ce que ce système démontre

MiniRégie est conçu pour montrer aux étudiants ce que les outils linéaires et les programmes scriptés ne peuvent pas faire — lire l'état du système en temps réel, réagir à des événements émergents, se souvenir de ce qui s'est passé. Le design graphique doit être à la hauteur de cette ambition.

Sobre et construit dans ses composants broadcast (Tschichold, Ruder, Lambie-Nairn). Vivant et imparfait dans ses annotations dessinées (IAD, Studio Moniker). C'est la même tension que celle qu'une école d'art entretient entre la maîtrise technique et la liberté créative.

---

*Version 3.0 — IAD Louvain-la-Neuve · Mars 2026*
*Complète et remplace les versions 1.0 et 2.0 du même document.*
