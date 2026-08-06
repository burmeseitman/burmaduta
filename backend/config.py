# backend/config.py
"""
Environment configuration and start-up validation.

api.py imports the parsed values from here and refuses to boot if the
environment is not deployable. The same checks run standalone as a pre-flight,
so a misconfiguration is caught before it becomes an outage:

    docker compose exec api python backend/config.py

Exits 0 when the environment is safe to serve, 1 otherwise. No database
connection is made, so this is safe to run against a live container.
"""
import os
import sys
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(BASE_DIR, ".env"))

# Values shipped in .env.example. Treating these as unset stops a copied
# template from being mistaken for a configured secret.
PLACEHOLDER_SECRETS = {
    "your_secret_api_key_here",
    "your_sample_secret_api_key_123",
    "changeme",
    "secret",
}
MIN_API_KEY_LENGTH = 16


def _as_bool(raw, default=False):
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def parse_allowed_origins(raw):
    return [o.strip() for o in (raw or "").split(",") if o.strip()]


API_KEY = (os.getenv("API_KEY") or "").strip()
ALLOWED_ORIGINS_RAW = (os.getenv("ALLOWED_ORIGINS") or "").strip()
ALLOWED_ORIGINS = parse_allowed_origins(ALLOWED_ORIGINS_RAW)
INTERNAL_STORE_URI = (os.getenv("INTERNAL_STORE_URI") or "").strip()
FORECAST_SCHEDULER_ENABLED = _as_bool(os.getenv("FORECAST_SCHEDULER_ENABLED"), default=False)

# Which peers uvicorn will believe when they send X-Forwarded-For. Safe as "*"
# only while the container port is published host-local, so the sole peer that
# can connect is the reverse proxy. See API_BIND_HOST in docker-compose.yml.
TRUSTED_PROXY_IPS = (os.getenv("TRUSTED_PROXY_IPS") or "*").strip()

# Cosine-similarity cutoff above which two reports are treated as the same
# incident. Configurable because the effective scale changed: with a broken
# sentence-transformers the scraper was silently scoring bigram Jaccard, and real
# multilingual embeddings do not distribute the same way. Calibrate against real
# data with backend/calibrate_dedup.py before moving it.
_DEDUP_RAW = os.getenv("DEDUP_SIMILARITY_THRESHOLD")
_DEDUP_UNPARSEABLE = None
try:
    DEDUP_SIMILARITY_THRESHOLD = float(_DEDUP_RAW or 0.85)
except ValueError:
    _DEDUP_UNPARSEABLE = _DEDUP_RAW
    DEDUP_SIMILARITY_THRESHOLD = 0.85


def validate():
    """Returns (errors, warnings). A non-empty errors list must block start-up."""
    errors = []
    warnings = []

    # --- API key ---
    if not API_KEY:
        errors.append(
            "API_KEY is not set. The API previously fell back to a public "
            "placeholder, which accepts any caller who has read the repository."
        )
    elif API_KEY.lower() in PLACEHOLDER_SECRETS:
        errors.append(
            f"API_KEY is still the example placeholder ({API_KEY!r}). Generate one, "
            "e.g. `python -c \"import secrets;print(secrets.token_urlsafe(32))\"`."
        )
    elif len(API_KEY) < MIN_API_KEY_LENGTH:
        errors.append(
            f"API_KEY is only {len(API_KEY)} characters; require at least "
            f"{MIN_API_KEY_LENGTH}."
        )

    # --- CORS ---
    if not ALLOWED_ORIGINS:
        errors.append(
            "ALLOWED_ORIGINS is not set. The API previously fell back to '*' while "
            "also sending credentials, which browsers reject and which would expose "
            "user sessions to any origin."
        )
    elif "*" in ALLOWED_ORIGINS:
        errors.append(
            "ALLOWED_ORIGINS contains '*'. A wildcard cannot be combined with "
            "credentialed requests; list exact origins instead."
        )
    else:
        for origin in ALLOWED_ORIGINS:
            if not origin.startswith(("http://", "https://")):
                errors.append(f"ALLOWED_ORIGINS entry {origin!r} needs an http:// or https:// scheme.")
            elif origin.endswith("/"):
                errors.append(f"ALLOWED_ORIGINS entry {origin!r} must not have a trailing slash; browsers send the bare origin.")

    # --- Database (warning only: DBManager has a documented mock fallback) ---
    if not INTERNAL_STORE_URI:
        warnings.append(
            "INTERNAL_STORE_URI is not set. DBManager will fall back to in-memory "
            "mock data and the API will serve placeholder news."
        )

    if _DEDUP_UNPARSEABLE is not None:
        errors.append(
            f"DEDUP_SIMILARITY_THRESHOLD is {_DEDUP_UNPARSEABLE!r}, which is not a "
            "number. Refusing to quietly substitute the default for a value that "
            "was set deliberately."
        )
    elif not 0.0 < DEDUP_SIMILARITY_THRESHOLD <= 1.0:
        errors.append(
            f"DEDUP_SIMILARITY_THRESHOLD is {DEDUP_SIMILARITY_THRESHOLD}; it is a "
            "cosine similarity and must be within (0.0, 1.0]. At 0 every report "
            "would be discarded as a duplicate."
        )

    if TRUSTED_PROXY_IPS == "*":
        warnings.append(
            "TRUSTED_PROXY_IPS is '*': any peer may set X-Forwarded-For, which is "
            "what the rate limiter keys on. This is only safe while the API port is "
            "bound host-local (API_BIND_HOST=127.0.0.1). If the port is reachable "
            "from the internet, rate limits can be bypassed by rotating the header."
        )

    if FORECAST_SCHEDULER_ENABLED:
        warnings.append(
            "FORECAST_SCHEDULER_ENABLED is on: Prophet will fit in-process at 03:00 "
            "SGT. Confirm headroom with backend/measure_forecast.py."
        )

    return errors, warnings


def enforce():
    """Raises SystemExit when the environment is not safe to serve."""
    errors, warnings = validate()
    for warning in warnings:
        print(f"⚠️  {warning}")
    if errors:
        # Keep stdout ahead of stderr so the two blocks stay in order in docker logs.
        sys.stdout.flush()
        print("\n❌ Refusing to start — invalid configuration:\n", file=sys.stderr)
        for error in errors:
            print(f"   • {error}", file=sys.stderr)
        print("\nSee .env.example for the expected variables.\n", file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    errors, warnings = validate()
    print(f"Checking environment from {os.path.join(BASE_DIR, '.env')} + process env\n")
    print(f"  API_KEY               : {'set (' + str(len(API_KEY)) + ' chars)' if API_KEY else 'MISSING'}")
    print(f"  ALLOWED_ORIGINS       : {ALLOWED_ORIGINS or 'MISSING'}")
    print(f"  INTERNAL_STORE_URI    : {'set' if INTERNAL_STORE_URI else 'MISSING'}")
    print(f"  FORECAST_SCHEDULER    : {'enabled' if FORECAST_SCHEDULER_ENABLED else 'disabled'}")
    print()
    for warning in warnings:
        print(f"⚠️  {warning}")
    if errors:
        print("\n❌ NOT deployable — the strict api.py would refuse to start:\n")
        for error in errors:
            print(f"   • {error}")
        raise SystemExit(1)
    print("✅ Environment is deployable.")
