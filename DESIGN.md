# Araho — Règles de design « carnet d'étude »

Référence unique pour l'interface. Tout nouvel écran doit les respecter.
Les valeurs vivent dans `src/styles/tokens.css` : on n'écrit jamais une couleur, une taille, un rayon ou une ombre en dur.

## 1. L'esprit

Un carnet de travail : papier crème, encre brune, une seule couleur d'accent (terre cuite).
Les titres sont en serif, le texte courant en sans-serif lisible. Calme, chaleureux, sans décor.

## 2. Typographie

| Token | Taille | Police | Usage |
|---|---|---|---|
| `--fs-large-title` | 32 | serif, 600 | Titre de page (un seul par écran) |
| `--fs-title` | 22 | serif, 600 | Titre de feuille, d'état vide, de carte |
| `--fs-body` | 17 | sans | Texte principal d'une ligne |
| `--fs-secondary` | 15 | sans, gris | Une seule ligne sous le corps |
| `--fs-note` | 13 | sans | Pieds de liste, légendes, surtitres |
| `--fs-micro` | 11 | sans | Calendrier et barre d'onglets uniquement |
| `--fs-display` | 56 | sans, 300 | Horloge de session uniquement |

- En-têtes de section : serif italique gris (`.group-title`). Surtitres : petites capitales espacées (`.caption`).
- Graisses : 400, 500, 600 (`--fw-*`). Le gras sert aux chiffres clés, aux boutons et aux titres.
- Chiffres alignés (`.tabular`) pour les heures et les durées.

## 3. Couleur

- Le texte n'utilise que 3 tons d'encre : `--label`, `--label-2`, `--label-3` (ce dernier pour le décoratif ou le désactivé, jamais pour une information à lire).
- `--accent` est réservé aux actions, à la sélection et au repère « maintenant ».
- `--success`, `--warning`, `--danger` : états uniquement (fait, attention, destructif).
- La couleur d'une tâche (`--sys-*`, passée en `--c`) ne vit que dans son icône, son bloc de calendrier et ses barres.
- Contraste : texte ≥ 4,5:1 sur le papier, pictogrammes ≥ 3:1. En sombre, les icônes de tâches passent à l'encre foncée (`--on-color`).
- Le thème clair et le thème sombre sont définis ensemble avec `light-dark()` : un seul endroit à modifier.

## 4. Espacement, rayons, ombres

- Grille de 4 : `--sp-1` (4) à `--sp-7` (48). Marges horizontales 16, entre sections 24.
- Rayons : `--r-sm` (6, petits éléments), `--r-md` (10, contrôles), `--r-lg` (14, cartes et feuilles), `--r-pill`.
- Ombres : `--shadow-1` (cartes posées sur le papier), `--shadow-2` (éléments flottants : feuille, dock, notification, glisser-déposer). Aucune autre.
- Aucun dégradé, halo ou verre décoratif.

## 5. Composants

- Listes : `section` > `group` > `cell` (via le composant `Section`). Pas de carte ad hoc.
- Feuilles modales : toujours le composant `Sheet` (`eyebrow`, `title`, `subtitle`, `actions`, `footer`).
- Statistiques : `stat-hero`, `stat-grid` / `stat`, `bars`, `bar` (`--p`, `--c`), `trend`.
- Retour en haut de page : `nav-bar` + `btn btn-ghost btn-back`.
- Cases : `check` (ronde, créneau) et `check is-box` (carrée, liste de validation).
- Notification éphémère : `toast`. Chargement : `spinner`.
- Mise en page ponctuelle : utilitaires `row`, `stack`, `gap-*`, `mt-*`, `mb-*`, `text-*`.

## 6. Règles d'écriture du code

- **Pas de `style={{…}}`** sauf pour une valeur calculée à l'exécution : position et hauteur dans le calendrier, `--c` (couleur de tâche), `--p` / `--h` / `--goal` (proportions).
- Une classe utilisée dans le JSX doit exister dans le CSS.
- Une ligne = une information principale, une seule ligne secondaire (`nowrap` + points de suspension).
- Une seule action primaire visible par écran.
