"""Local, dependency-free preview server. Not intended for production."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
import base64
import hashlib
import hmac
import json
import os
import sqlite3
import time
import re
import threading
import uuid
from urllib.parse import parse_qs

ROOT = Path(__file__).parent
DB_PATH = ROOT / "preview.sqlite3"
SECRET = os.environ.get("PREVIEW_SECRET", "local-preview-only-change-me").encode()
ROOM_LOCK = threading.Lock()
ROOM_PLAYERS = {}


def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


with db() as conn:
    conn.execute("CREATE TABLE IF NOT EXISTS accounts (email TEXT PRIMARY KEY, salt BLOB NOT NULL, password_hash BLOB NOT NULL, created_at INTEGER NOT NULL)")
    columns = {row[1] for row in conn.execute("PRAGMA table_info(accounts)")}
    if "gender" not in columns:
        conn.execute("ALTER TABLE accounts ADD COLUMN gender TEXT NOT NULL DEFAULT ''")


def b64(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def token_for(username):
    now = int(time.time())
    header = b64(b'{"alg":"HS256","typ":"JWT"}')
    payload = b64(json.dumps({"sub": username, "exp": now + 3600}, separators=(",", ":")).encode())
    body = f"{header}.{payload}"
    sig = b64(hmac.new(SECRET, body.encode(), hashlib.sha256).digest())
    return f"{body}.{sig}"


def verify_token(value):
    try:
        header, payload, sig = value.split(".")
        body = f"{header}.{payload}"
        expected = b64(hmac.new(SECRET, body.encode(), hashlib.sha256).digest())
        claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        return claims["sub"] if hmac.compare_digest(expected, sig) and claims["exp"] > time.time() else None
    except (ValueError, KeyError, TypeError, json.JSONDecodeError):
        return None


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def send_json(self, code, data):
        raw = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def read_json(self):
        size = min(int(self.headers.get("Content-Length", "0")), 4096)
        return json.loads(self.rfile.read(size) or b"{}")

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/game/state":
            query = parse_qs(urlparse(self.path).query)
            player_id = query.get("player_id", [""])[0]
            now = time.monotonic()
            with ROOM_LOCK:
                for key in list(ROOM_PLAYERS):
                    if now - ROOM_PLAYERS[key]["seen"] > 12:
                        del ROOM_PLAYERS[key]
                if player_id in ROOM_PLAYERS:
                    ROOM_PLAYERS[player_id]["seen"] = now
                players = [{"id": key, "lane": value["lane"], "name": value["name"]} for key, value in ROOM_PLAYERS.items()]
            return self.send_json(200, {"players": players})
        if path == "/api/me":
            auth = self.headers.get("Authorization", "")
            email = verify_token(auth[7:]) if auth.startswith("Bearer ") else None
            if email:
                with db() as conn:
                    account = conn.execute("SELECT email, gender FROM accounts WHERE email = ?", (email,)).fetchone()
                if account:
                    return self.send_json(200, dict(account))
            return self.send_json(401, {"error": "Inicia sesión para continuar"})
        if path == "/api/health":
            return self.send_json(200, {"status": "ok"})
        target = ROOT / ("index.html" if path == "/" else path.lstrip("/"))
        try:
            resolved = target.resolve()
            if ROOT.resolve() not in resolved.parents or not resolved.is_file():
                raise FileNotFoundError
            raw = resolved.read_bytes()
            content_type = "text/html; charset=utf-8" if resolved.suffix == ".html" else "application/octet-stream"
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(raw)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(raw)
        except (OSError, ValueError):
            self.send_error(404)

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            body = self.read_json()
        except (ValueError, json.JSONDecodeError):
            return self.send_json(400, {"error": "JSON inválido"})
        email = str(body.get("email", "")).strip().lower()
        password = str(body.get("password", ""))
        gender = str(body.get("gender", ""))
        if path == "/api/game/join":
            auth = self.headers.get("Authorization", "")
            email = verify_token(auth[7:]) if auth.startswith("Bearer ") else None
            player_id = str(body.get("player_id", ""))
            with ROOM_LOCK:
                if player_id not in ROOM_PLAYERS:
                    player_id = uuid.uuid4().hex
                    ROOM_PLAYERS[player_id] = {"lane": 1, "name": "Explorador", "seen": time.monotonic()}
                ROOM_PLAYERS[player_id]["seen"] = time.monotonic()
                players = [{"id": key, "lane": value["lane"], "name": value["name"]} for key, value in ROOM_PLAYERS.items()]
            return self.send_json(200, {"player_id": player_id, "players": players, "account": bool(email)})
        if path == "/api/game/action":
            player_id, action = str(body.get("player_id", "")), str(body.get("action", ""))
            with ROOM_LOCK:
                player = ROOM_PLAYERS.get(player_id)
                if player is None:
                    return self.send_json(401, {"error": "Vuelve a entrar a la sala"})
                if action == "left":
                    player["lane"] = max(0, player["lane"] - 1)
                elif action == "right":
                    player["lane"] = min(2, player["lane"] + 1)
                elif action != "jump":
                    return self.send_json(400, {"error": "Acción desconocida"})
                player["seen"] = time.monotonic()
            return self.send_json(200, {"ok": True})
        if path == "/api/game/leave":
            player_id = str(body.get("player_id", ""))
            with ROOM_LOCK:
                ROOM_PLAYERS.pop(player_id, None)
            return self.send_json(200, {"ok": True})
        if path not in ("/api/register", "/api/login"):
            return self.send_json(404, {"error": "No encontrado"})
        if not (len(email) <= 254 and re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email) and len(password) >= 8):
            return self.send_json(400, {"error": "Escribe un correo válido y una contraseña de al menos 8 caracteres"})
        with db() as conn:
            row = conn.execute("SELECT salt, password_hash FROM accounts WHERE email = ?", (email,)).fetchone()
            if path == "/api/register":
                if gender not in ("femenino", "masculino"):
                    return self.send_json(400, {"error": "Selecciona femenino o masculino para continuar"})
                if row:
                    return self.send_json(409, {"error": "Ya existe una cuenta con ese correo. Inicia sesión."})
                salt = os.urandom(16)
                pwd = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
                conn.execute("INSERT INTO accounts (email, salt, password_hash, created_at, gender) VALUES (?, ?, ?, ?, ?)", (email, salt, pwd, int(time.time()), gender))
            elif not row or not hmac.compare_digest(row["password_hash"], hashlib.scrypt(password.encode(), salt=row["salt"], n=2**14, r=8, p=1)):
                return self.send_json(401, {"error": "Usuario o contraseña incorrectos"})
        with db() as conn:
            account = conn.execute("SELECT gender FROM accounts WHERE email = ?", (email,)).fetchone()
        return self.send_json(200, {"access_token": token_for(email), "email": email, "gender": account["gender"] if account else ""})


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", int(os.environ.get("PORT", "8000"))), Handler)
    print(f"Demo lista: http://localhost:{server.server_port}", flush=True)
    server.serve_forever()
