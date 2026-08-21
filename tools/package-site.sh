#!/usr/bin/env bash
# Fabrique l'archive de déploiement manuel du site Baobab Labs.
#
# Netlify attend une archive dont la RACINE contient index.html — pas un dossier
# englobant. Le netlify.toml embarqué ne conserve que les en-têtes et les
# redirections : la section [build] n'a pas de sens pour un dépôt manuel, où
# l'archive est elle-même le répertoire publié.
set -euo pipefail

racine="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
sortie="${1:-$racine/baobab-labs-site.zip}"
travail="$(mktemp -d)"
trap 'rm -rf "$travail"' EXIT

cp -R "$racine/site/." "$travail/"

# En-têtes et redirections, sans la section [build].
python3 - "$racine/netlify.toml" "$travail/netlify.toml" <<'PY'
import io, re, sys
src = io.open(sys.argv[1], encoding='utf-8').read()
i = src.index('[[redirects]]')
entete = (
    "# Déploiement manuel : cette archive EST le répertoire publié.\n"
    "# La section [build] du netlify.toml du dépôt est donc omise ici.\n\n"
)
io.open(sys.argv[2], 'w', encoding='utf-8').write(entete + src[i:])
PY

rm -f "$sortie"
( cd "$travail" && zip -rq "$sortie" . -x '.*' )
printf 'Archive : %s (%s)\n' "$sortie" "$(du -h "$sortie" | cut -f1)"
