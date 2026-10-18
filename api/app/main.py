import base64
import hashlib
import hmac
import json
import os
import re
import time
from contextlib import asynccontextmanager
from typing import Annotated

import psycopg
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError
from fastapi import Depends, FastAPI, Header, HTTPException, status
from pydantic import BaseModel, Field
from psycopg.rows import dict_row

DATABASE_URL = os.environ["DATABASE_URL"]
APP_SECRET = os.environ["APP_SECRET"].encode()
if len(APP_SECRET) < 32:
    raise RuntimeError("APP_SECRET debe tener al menos 32 bytes")
TOKEN_TTL = int(os.getenv("TOKEN_TTL_SECONDS", "3600"))
PASSWORDS = PasswordHasher()
USERNAME_RE = re.compile(r"^[a-zA-Z0-9_]{3,24}$")


def connect():
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)


@asynccontextmanager
async def lifespan(_: FastAPI):
    for attempt in range(30):
        try:
            with connect() as conn:
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS users (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        username TEXT NOT NULL UNIQUE,
                        password_hash TEXT NOT NULL,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                    );
                    CREATE TABLE IF NOT EXISTS progress (
                        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                        clues INTEGER NOT NULL DEFAULT 0 CHECK (clues >= 0),
                        best_score INTEGER NOT NULL DEFAULT 0 CHECK (best_score >= 0),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                    );
                """)
            break
        except psycopg.OperationalError:
            if attempt == 29:
                raise
            time.sleep(2)
    yield


app = FastAPI(title="En busca del tesoro API", version="0.1.0", lifespan=lifespan)


class Credentials(BaseModel):
    username: str = Field(min_length=3, max_length=24)
    password: str = Field(min_length=10, max_length=128)


def b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def issue_token(user_id: str) -> str:
    now = int(time.time())
    header = b64(b'{"alg":"HS256","typ":"JWT"}')
    payload = b64(json.dumps({"sub": user_id, "iat": now, "exp": now + TOKEN_TTL}, separators=(",", ":")).encode())
    body = f"{header}.{payload}"
    signature = b64(hmac.new(APP_SECRET, body.encode(), hashlib.sha256).digest())
    return f"{body}.{signature}"


def current_user(authorization: Annotated[str | None, Header()] = None):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Se requiere un token Bearer")
    try:
        header, payload, signature = authorization[7:].split(".")
        body = f"{header}.{payload}"
        expected = b64(hmac.new(APP_SECRET, body.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(expected, signature):
            raise ValueError()
        claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        if int(claims["exp"]) <= int(time.time()):
            raise ValueError()
        return claims["sub"]
    except (ValueError, KeyError, TypeError, json.JSONDecodeError):
        raise HTTPException(status_code=401, detail="Token inválido o vencido") from None


@app.get("/health")
def health():
    with connect() as conn:
        conn.execute("SELECT 1")
    return {"status": "ok"}


@app.post("/v1/auth/register", status_code=status.HTTP_201_CREATED)
def register(body: Credentials):
    if not USERNAME_RE.fullmatch(body.username):
        raise HTTPException(status_code=422, detail="Usuario: usa 3–24 letras, números o guion bajo")
    password_hash = PASSWORDS.hash(body.password)
    try:
        with connect() as conn:
            user = conn.execute(
                "INSERT INTO users(username, password_hash) VALUES (%s, %s) RETURNING id, username",
                (body.username.lower(), password_hash),
            ).fetchone()
            conn.execute("INSERT INTO progress(user_id) VALUES (%s)", (user["id"],))
    except psycopg.errors.UniqueViolation:
        raise HTTPException(status_code=409, detail="Ese nombre de usuario ya existe") from None
    return {"access_token": issue_token(str(user["id"])), "token_type": "bearer", "expires_in": TOKEN_TTL}


@app.post("/v1/auth/login")
def login(body: Credentials):
    with connect() as conn:
        user = conn.execute("SELECT id, password_hash FROM users WHERE username = %s", (body.username.lower(),)).fetchone()
    try:
        valid = user is not None and PASSWORDS.verify(user["password_hash"], body.password)
    except VerificationError:
        valid = False
    if not valid:
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")
    if PASSWORDS.check_needs_rehash(user["password_hash"]):
        with connect() as conn:
            conn.execute("UPDATE users SET password_hash = %s WHERE id = %s", (PASSWORDS.hash(body.password), user["id"]))
    return {"access_token": issue_token(str(user["id"])), "token_type": "bearer", "expires_in": TOKEN_TTL}


@app.get("/v1/me")
def me(user_id: Annotated[str, Depends(current_user)]):
    with connect() as conn:
        user = conn.execute("""
            SELECT u.username, p.clues, p.best_score, p.updated_at
            FROM users u JOIN progress p ON p.user_id = u.id WHERE u.id = %s
        """, (user_id,)).fetchone()
    if user is None:
        raise HTTPException(status_code=401, detail="Cuenta no encontrada")
    return user
