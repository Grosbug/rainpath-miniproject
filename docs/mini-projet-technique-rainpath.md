# Mini-projet technique — RainPath

> Document de cadrage du mini-projet à réaliser en amont de l'entretien technique final chez RainPath. Le rendu est étudié avant l'échange et sert de support de discussion pendant l'entretien.

## Sommaire

1. [Contexte](#1-contexte)
2. [Objectif du mini-projet](#2-objectif-du-mini-projet)
3. [Spécifications fonctionnelles](#3-spécifications-fonctionnelles)
4. [Spécifications techniques](#4-spécifications-techniques)
5. [Bonus (facultatif)](#5-bonus-facultatif)
6. [Modalités de rendu](#6-modalités-de-rendu)
7. [Préparer la discussion d'entretien](#7-préparer-la-discussion-dentretien)
8. [Conseils & rappels](#8-conseils--rappels)

---

## 1. Contexte

RainPath est un logiciel destiné aux **laboratoires d'anatomopathologie** (analyse de biopsies). Parmi les nombreuses tâches automatisées, il y a la **relance des patients** qui doivent régler tout ou une partie de leur examen.

Aujourd'hui, ces relances se font à la main, de façon irrégulière, et chaque laboratoire a ses propres habitudes :

- certains commencent par un email, d'autres directement par SMS ;
- certains attendent une semaine, d'autres trois.

Pour répondre à cette diversité, nous voulons offrir aux chefs de laboratoire **un éditeur visuel** qui leur permette de dessiner leur propre séquence de relance, à la manière d'outils comme **n8n** ou **Zapier**.

### Canaux de communication disponibles

- Email
- SMS
- WhatsApp
- Courrier postal

### Branchements dynamiques

Le workflow doit pouvoir s'orienter dynamiquement vers le canal suivant en fonction :

- **des informations disponibles sur le patient** — a-t-on son email ? son numéro ?
- **du résultat d'un envoi** — mail rejeté ? non ouvert ?
- **de délais temporels.**

---

## 2. Objectif du mini-projet

Construire une **mini-application web** qui permet à un chef de laboratoire :

1. de **dessiner visuellement** un workflow de relance sous forme de graphe à nœuds ;
2. de **sauvegarder** ce workflow dans une base de données via un backend dédié ;
3. de **recharger** un workflow existant pour le modifier.

> [!IMPORTANT]
> **Hors scope :** aucun envoi réel de message n'est attendu. Email, SMS, WhatsApp et courrier sont factices. On ne configure pas non plus de providers, pas d'authentification, pas de gestion d'utilisateurs.

---

## 3. Spécifications fonctionnelles

### Types de nœuds attendus

L'éditeur doit au minimum permettre de manipuler ces familles de nœuds :

| Famille | Détail |
|---|---|
| **Départ** | « Examen effectué » — point d'entrée du workflow |
| **Actions d'envoi** | Envoi Email · Envoi SMS · Envoi WhatsApp · Envoi Courrier postal |
| **Temporisation** | « attendre X jours » |
| **Condition — disponibilité d'une donnée** | ex. l'email du patient est-il connu ? a-t-il WhatsApp ? |
| **Condition — résultat d'une action précédente** | ex. mail rejeté ? mail ouvert ? |
| **Fin** | Nœud terminal du workflow |

### Exemple de scénario à pouvoir modéliser

> À **J+7** après l'examen, envoyer un **email**.
> Si l'email du patient est inconnu **OU** si le mail est rejeté, tenter un message **WhatsApp** si le patient en dispose. Sinon, envoyer immédiatement un **SMS**.
> À **J+15**, si toujours rien, envoyer un **courrier postal**.
> Si toujours rien à **J+30**, **fin** du workflow.

Cet exemple est illustratif : l'éditeur doit être suffisamment souple pour qu'un utilisateur compose sa propre séquence.

### Capacités attendues de l'éditeur

- Ajouter, supprimer, déplacer des nœuds sur le canvas.
- Relier les nœuds entre eux (création / suppression d'arêtes).
- Éditer les paramètres d'un nœud (délai, contenu factice du message, condition…).
- Sauvegarder le workflow (appel API vers le backend).
- Lister et recharger les workflows existants depuis la base.

---

## 4. Spécifications techniques

### Frontend

- **React + TypeScript** (imposés).
- **Librairie de graphe au choix** — ton choix sera discuté en entretien, donc sois prêt·e à le justifier.
- **Style et UX libres** — on attend une interface soignée, claire et utilisable.

### Backend

- **NestJS** (imposé).
- **Prisma** comme ORM (imposé).
- **Base SQL au choix** — SQLite est largement suffisant pour ce mini-projet.
- **API REST minimaliste** — créer / lister / charger / mettre à jour un workflow.
- **Pas d'authentification.**
- **Schéma de données** à concevoir librement.

### Repository

- **Monorepo public** sur GitHub (ou GitLab), structuré clairement — par exemple `/frontend` et `/backend`.

---

## 5. Bonus (facultatif)

Si tu as le temps et l'envie, tu peux ajouter une vue **« dossier patient » fictif** qui affiche le graphe configuré et matérialise visuellement l'avancement du patient dans le workflow :

- quelles étapes ont déjà été déclenchées,
- quelle est l'étape courante,
- quelles étapes restent à venir.

La progression peut être totalement simulée (pas besoin de cron ni de logique d'exécution réelle).

---

## 6. Modalités de rendu

- **Format :** lien vers un repository Git public (GitHub ou GitLab).
- **Quand :** à nous transmettre avant l'entretien final par email.
- **Durée conseillée :** entre **2 et 3 heures**. Un peu plus ou un peu moins, ce n'est pas un souci. Ce qui compte, c'est de pouvoir lire dans ton rendu **l'intention, la trajectoire et la manière de travailler**.

---

## 7. Préparer la discussion d'entretien

Le projet sera étudié avant l'entretien, puis nous en discuterons ensemble. Viens avec en tête :

- ce dont tu es **satisfait·e** ;
- ce que tu aurais **amélioré** avec plus de temps ;
- ce que tu considères comme **manquant ou incomplet** ;
- les **choix techniques** que tu défendrais, et ceux que tu referais autrement.

---

## 8. Conseils & rappels

- **L'inventivité et la force de proposition sont les bienvenues.** Si tu vois une approche, une feature ou une UX que nous n'avons pas explicitement demandée mais qui te semble pertinente, fonce !
- **Aucun envoi réel n'est attendu** — tout est factice, concentre-toi sur la **configuration** et la **persistance**.
- **La qualité et la clarté de l'UX/UI est très importante.**
- **Le plus important :** aide-toi au maximum des **agents IA** pour réaliser le projet — c'est ce qu'on attendra de toi pendant le stage.

> Bon courage, merci pour le temps accordé et au plaisir d'en discuter avec toi.
