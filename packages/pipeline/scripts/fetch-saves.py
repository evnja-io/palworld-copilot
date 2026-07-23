"""Télécharge les saves du serveur hébergé via SFTP.

Env requises : SFTP_HOST (URL sftp://hote:port), SFTP_USER, SFTP_PASSWORD.
SAVE_REMOTE_DIR : dossier du monde (ex. Pal/Saved/SaveGames/0/<WorldID>) ; si
vide, auto-découverte de l'unique dossier sous Pal/Saved/SaveGames/0/.
Usage : python fetch-saves.py <dossier_local>
Télécharge Players/*.sav (noms 32 hex uniquement) + Level.sav.
Quand le monde est auto-découvert, imprime en dernière ligne :
    DISCOVERED_REMOTE_DIR=<chemin>
"""

import os
import re
import sys
from urllib.parse import urlparse

SAVEGAMES_ROOT = "Pal/Saved/SaveGames/0"


def pick_world_dir(names):
    """Choisit l'unique dossier de monde parmi les entrées listées."""
    worlds = [n for n in names if n not in (".", "..")]
    if len(worlds) == 0:
        raise ValueError("aucun dossier de monde sous " + SAVEGAMES_ROOT)
    if len(worlds) > 1:
        raise ValueError(
            "plusieurs mondes sous %s (%s) — préciser SAVE_REMOTE_DIR"
            % (SAVEGAMES_ROOT, ", ".join(worlds))
        )
    return worlds[0]


def download(dest):
    import paramiko

    for var in ("SFTP_HOST", "SFTP_USER", "SFTP_PASSWORD"):
        if not os.environ.get(var):
            print(f"Variable {var} manquante", file=sys.stderr)
            sys.exit(1)

    u = urlparse(os.environ["SFTP_HOST"])
    t = paramiko.Transport((u.hostname, u.port or 22))
    t.connect(username=os.environ["SFTP_USER"], password=os.environ["SFTP_PASSWORD"])
    sftp = paramiko.SFTPClient.from_transport(t)

    discovered = None
    remote = (os.environ.get("SAVE_REMOTE_DIR") or "").rstrip("/")
    if not remote:
        world = pick_world_dir(sftp.listdir(SAVEGAMES_ROOT))
        remote = f"{SAVEGAMES_ROOT}/{world}"
        discovered = remote
        print(f"auto-découverte : {remote}")

    count = 0
    for entry in sftp.listdir_attr(f"{remote}/Players"):
        if re.fullmatch(r"[0-9A-Fa-f]{32}\.sav", entry.filename):
            sftp.get(f"{remote}/Players/{entry.filename}", os.path.join(dest, entry.filename))
            count += 1
        else:
            print(f"ignoré : {entry.filename}")
    sftp.get(f"{remote}/Level.sav", os.path.join(dest, "Level.sav"))
    print(f"téléchargé : {count} saves joueur + Level.sav -> {dest}")
    t.close()

    # Dernière ligne, machine-parsable, uniquement si le monde a été découvert.
    if discovered is not None:
        print(f"DISCOVERED_REMOTE_DIR={discovered}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: fetch-saves.py <dossier_local>", file=sys.stderr)
        sys.exit(1)
    _dest = sys.argv[1]
    os.makedirs(_dest, exist_ok=True)
    download(_dest)
