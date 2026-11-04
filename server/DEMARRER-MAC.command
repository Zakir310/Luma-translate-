#!/bin/bash
cd "$(dirname "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.volta/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js n'est pas installé. Installez la version LTS depuis https://nodejs.org puis relancez ce fichier."
  open https://nodejs.org 2>/dev/null
  read -r -p "Appuyez sur Entrée pour fermer."
  exit 1
fi
node start.mjs
echo
read -r -p "Serveur Luma arrêté. Appuyez sur Entrée pour fermer."
