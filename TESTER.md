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

L’intégration n’est pas encore effectuée : la CLI attend une clé dans
`ELEVENLABS_API_KEY`, configurée dans les secrets de l’environnement.
Aucune clé ne doit être incluse dans les fichiers de l’extension ou une archive.
Une connexion serveur sera nécessaire pour utiliser une clé privée depuis une
extension distribuée. La lecture actuelle utilise toujours les voix locales.
