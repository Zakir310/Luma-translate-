# Luma — version issue de votre archive

L’extension se trouve dans `extension/`. Les fonctions de traduction de sélection,
de page et de lecture locale de la version 1.3.1 sont conservées.
Le thème du popup et du panneau de sélection est désormais blanc et noir.

## Installer dans Chrome

1. Ouvrir `chrome://extensions` et activer le mode développeur.
2. Cliquer sur « Charger l’extension non empaquetée » et sélectionner `extension/`.
3. Ouvrir une page HTTP/HTTPS, la recharger, sélectionner une phrase et utiliser
   le bouton Luma ou Alt+T. Tester aussi la traduction de page puis le retour à l’original.
4. Tester la lecture de sélection, la pause et l’arrêt avec les voix du système.

La traduction utilise le service Google non officiel déjà présent dans l’archive.
Sa disponibilité n’est pas garantie. Le texte à traduire lui est envoyé.

## Aperçu HTML

Depuis la racine du dépôt : `python -m http.server 8000`.
Ouvrir `extension/preview.html` depuis ce serveur dans un navigateur.
Le choix des langues, l’inversion, l’activation et les préférences sont utilisables.
Les fonctions Chrome sont désactivées dans cet aperçu, sans résultat simulé.
`index.html` est la première maquette indépendante ; `extension/preview.html`
est désormais l’aperçu de référence, fondé sur votre véritable extension.

## ElevenLabs

La version 1.4.0 ajoute la connexion ElevenLabs via un serveur local privé.
Voir `livraison/INSTALLATION-ELEVENLABS.txt`. La clé se saisit dans le terminal,
jamais dans le HTML ni le code de l’extension. Le menu doit rester ouvert pendant
la lecture. Maximum 5 000 caractères ; chaque génération utilise votre quota.

Vérification développeur : `node --test server/server.test.mjs`.
Les tests utilisent une API simulée. La génération ElevenLabs réelle n’a pas encore
été vérifiée. L’ancien aperçu HTML ne couvre pas cette nouvelle intégration.
