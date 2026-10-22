# Araho — Règles de design

Référence unique pour l'interface. Tout nouvel écran doit les respecter.

## 1. Échelle typographique (seulement 5 niveaux)

| Rôle | Taille / graisse | Usage |
|---|---|---|
| Grand titre | 34 / 700 | Un seul par écran (titre de page) |
| Titre | 22 / 700 | Titre d'un état vide ou d'une feuille |
| Corps | 17 / 400 | Texte principal d'une ligne (nom de tâche) |
| Secondaire | 15 / 400, gris | **Une seule** ligne sous le corps |
| Annotation | 13 / 400, gris | En-têtes de section (majuscules), pieds de liste, légendes |

- La hiérarchie vient de la **taille, de la graisse et de la couleur du texte** (noir, gris, gris clair). Rien d'autre.
- Gras (600) uniquement pour : un chiffre clé, un bouton, un titre. Jamais pour décorer.
- Chiffres alignés (`tabular-nums`) pour les heures et durées.

## 2. Une ligne = une information principale

- Ligne de liste : **titre** + **une** ligne secondaire courte + **une** action à droite.
- La ligne secondaire ne passe jamais à la ligne (`nowrap` + points de suspension).
- Pas d'icône, d'étiquette ou de badge dans la ligne secondaire. Le détail va dans la feuille de détail.
- Pas de doublon: une donnée n'apparaît qu'une fois par écran (ex. pas de « 60 % » en plus de « 1h30 sur 2h30 »).

## 3. Couleur

- Le texte n'utilise que 3 tons: `label`, `label-2`, `label-3`.
- Le **bleu** est réservé aux actions (boutons, liens, onglet actif).
- La couleur d'une tâche ne vit que dans son icône (et son anneau pendant une session).
- Rouge = destructif ou « maintenant ». Orange/vert: jamais en texte courant.
- Aucun dégradé, halo, verre décoratif, ombre décorative ou bordure colorée.

## 4. Espacement (grille de 8)

- Marges horizontales: 16. Entre sections: 24. Entre titre de page et contenu: 16.
- Hauteur minimale d'une ligne: 52. Cible tactile minimale: 44.
- Respiration > séparateurs > cadres: on sépare d'abord par l'espace.

## 5. Un écran = un point focal

- **Une seule action primaire** visible par écran.
- Barre de titre: au maximum **un** bouton à droite.
- Les contrôles secondaires (navigation de date, filtres) sont discrets, en texte gris ou icône simple.

## 6. Cohérence

- Tout utilise les composants `group` / `cell` / `section`. Pas de carte ad hoc.
- Mêmes rayons (12 pour les groupes, 10 pour les contrôles), mêmes icônes (Lucide, trait 1.8).
- Clair et sombre automatiques via variables CSS.
