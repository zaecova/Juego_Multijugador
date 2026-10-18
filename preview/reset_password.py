"""Reset a local preview account password from the machine hosting the demo."""
from getpass import getpass
from pathlib import Path
import hashlib
import os
import re
import sqlite3

DB_PATH = Path(__file__).parent / "preview.sqlite3"


def main():
    if not DB_PATH.exists():
        print("No se encontró la base de cuentas de la demo. Inicia el servidor una vez y vuelve a intentarlo.")
        return
    email = input("Correo de la cuenta: ").strip().lower()
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
        print("El correo no parece válido.")
        return
    password = getpass("Nueva contraseña (mínimo 8 caracteres): ")
    if len(password) < 8:
        print("La contraseña debe tener al menos 8 caracteres.")
        return
    if password != getpass("Repite la nueva contraseña: "):
        print("Las contraseñas no coinciden.")
        return
    salt = os.urandom(16)
    password_hash = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    with sqlite3.connect(DB_PATH, timeout=10) as conn:
        cursor = conn.execute("UPDATE accounts SET salt = ?, password_hash = ? WHERE email = ?", (salt, password_hash, email))
    if cursor.rowcount:
        print("Contraseña actualizada. Ya puedes iniciar sesión en la demo.")
    else:
        print("No encontramos una cuenta con ese correo en esta demo local.")


if __name__ == "__main__":
    main()
