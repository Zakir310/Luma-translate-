# Luma — traduction au clic

Extension Chrome basée sur la version 1.3.1 fournie, avec une interface
majoritairement blanche et des accents noirs.

## Télécharger et installer

[Télécharger Luma avec ElevenLabs](https://github.com/Zakir310/Luma-translate-/raw/refs/heads/main/livraison/Luma-ElevenLabs.zip)

Depuis la version 1.5, plus besoin de serveur ni de terminal : collez votre clé
ElevenLabs une seule fois dans le menu Luma, elle reste enregistrée dans Chrome sur cet
ordinateur (jamais synchronisée). La lecture continue même menu fermé.
Voir [les instructions](livraison/INSTALLATION-ELEVENLABS.txt).

1. Décompresser le ZIP sur un ordinateur.
2. Ouvrir `chrome://extensions` dans Chrome et activer le mode développeur.
3. Cliquer sur **Charger l’extension non empaquetée** et choisir le dossier
   **Luma** extrait, celui qui contient `manifest.json`.
4. Ouvrir une page web ordinaire, la recharger et sélectionner du texte.

## Essai sans installation

Télécharger [Luma-TEST.html](livraison/Luma-TEST.html) et l’ouvrir dans un navigateur.
Ce fichier autonome permet de tester l’interface et quelques traductions locales
d’exemple. Il ne traduit pas des textes libres ni des pages web.

## État de validation (version 1.5.2)

- Testé par l’utilisateur sur Chrome (Mac) : traduction de sélection et de page,
  lecture ElevenLabs avec une vraie clé.
- Testé automatiquement dans Chromium avec des API simulées : traduction (souris,
  Alt+T, page entière), clé ElevenLabs, lecture menu fermé, pause, pages longues.

La traduction utilise le service Google non officiel présent dans l’archive d’origine ;
sa disponibilité n’est pas garantie. La lecture ElevenLabs appelle directement l’API
depuis l’extension (le serveur local de `server/` reste utilisable en option).
La clé est saisie dans le menu et stockée uniquement dans Chrome sur l’ordinateur.
Aucune clé API n’est incluse dans ce dépôt.

Icône : sources SVG dans `design/`.

Voir [TESTER.md](TESTER.md) pour les détails.
