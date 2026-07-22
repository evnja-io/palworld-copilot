"""Télécharge les saves du serveur hébergé via SFTP.

Env requises : SFTP_HOST (URL sftp://hote:port), SFTP_USER, SFTP_PASSWORD,
SAVE_REMOTE_DIR (dossier du monde, ex. Pal/Saved/SaveGames/0/<WorldID>).
Usage : python fetch-saves.py <dossier_local>
Télécharge Players/*.sav (noms 32 hex uniquement) + Level.sav.
"""

import os
import re
import sys
from urllib.parse import urlparse

import paramiko

if len(sys.argv) != 2:
    print("Usage: fetch-saves.py <dossier_local>", file=sys.stderr)
    sys.exit(1)
dest = sys.argv[1]
os.makedirs(dest, exist_ok=True)

for var in ("SFTP_HOST", "SFTP_USER", "SFTP_PASSWORD", "SAVE_REMOTE_DIR"):
    if not os.environ.get(var):
        print(f"Variable {var} manquante", file=sys.stderr)
        sys.exit(1)

u = urlparse(os.environ["SFTP_HOST"])
remote = os.environ["SAVE_REMOTE_DIR"].rstrip("/")

t = paramiko.Transport((u.hostname, u.port or 22))
t.connect(username=os.environ["SFTP_USER"], password=os.environ["SFTP_PASSWORD"])
sftp = paramiko.SFTPClient.from_transport(t)

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
