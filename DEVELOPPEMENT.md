# Développement

## Structure

| Dossier | Contenu |
|---|---|
| `extension/` | Code de l'extension Chrome (Manifest V3). C'est ce dossier qui devient `Luma/` dans le ZIP. |
| `extension/eleven-api.js` | Appels ElevenLabs (voix, synthèse, messages d'erreur, découpage des longs textes). |
| `extension/player.html`, `player.js` | Lecteur audio en arrière-plan (document offscreen) : la lecture continue menu fermé. |
| `extension/elevenlabs.js` | Section ElevenLabs du menu (clé, voix, boutons). |
| `extension/background.js` | Traduction (Google) et voix de l'ordinateur. |
| `server/` | Ancien serveur local ElevenLabs, facultatif (utilisé seulement si aucune clé n'est enregistrée dans Luma). |
| `design/` | Sources SVG de l'icône. |
| `docs/` | Images du README. |
| `livraison/` | Paquet à télécharger (`Luma.zip`) et `INSTALLATION.txt`. |

## Tests

```bash
node --test server/server.test.mjs
```

L'extension a été vérifiée dans Chromium avec des API Google et ElevenLabs simulées :
traduction (souris, Alt+T, page entière), clé valide et invalide, lecture menu fermé,
pause et arrêt, page longue lue en plusieurs parties. Elle a aussi été testée par
l'utilisateur sur Chrome (Mac), avec une vraie clé ElevenLabs.

## Fabriquer le ZIP

Copier `extension/` dans un dossier `Luma/` (sans `preview.*`), ajouter `livraison/INSTALLATION.txt`,
puis compresser `INSTALLATION.txt` et `Luma/` dans `livraison/Luma.zip`.

Les messages entre le menu et le lecteur utilisent le champ `lumaRoute`. Ne pas filtrer sur `target`,
qui sert à la langue cible de la traduction.
