# Luma — traduction au clic

Extension Chrome basée sur la version 1.3.1 fournie, avec une interface
majoritairement blanche et des accents noirs.

## Télécharger et installer

[Télécharger le ZIP de l’extension](https://github.com/Zakir310/Luma-translate-/raw/refs/heads/main/livraison/Luma-CHROME.zip)

1. Décompresser le ZIP sur un ordinateur.
2. Ouvrir `chrome://extensions` dans Chrome et activer le mode développeur.
3. Cliquer sur **Charger l’extension non empaquetée** et choisir le dossier
   **Luma** extrait, celui qui contient `manifest.json`.
4. Ouvrir une page web ordinaire, la recharger et sélectionner du texte.

## Essai sans installation

Télécharger [Luma-TEST.html](livraison/Luma-TEST.html) et l’ouvrir dans un navigateur.
Ce fichier autonome permet de tester l’interface et quelques traductions locales
d’exemple. Il ne traduit pas des textes libres ni des pages web.

## État de validation

Les contrôles de l’aperçu web et les exemples du fichier autonome ont été testés
dans Chromium. Le chargement complet de l’extension et la traduction en ligne
restent à valider sur Chrome utilisateur.

La traduction réelle utilise le service Google non officiel présent dans
l’archive d’origine. La lecture utilise les voix locales. ElevenLabs n’est pas
encore connecté ; aucune clé API n’est incluse dans ce dépôt.

Voir [TESTER.md](TESTER.md) pour les détails.
