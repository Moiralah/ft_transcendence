# Generate SSL certificates if they don't exist

# Default local start: dev secrets come from Vault (solsys, over WireGuard),
# held in memory only, and the app runs against local Supabase. No secrets in
# .env. See diagram/vault-remote-env.html. Override VAULT_ADDR to point
# elsewhere (e.g. the local rehearsal Vault at http://127.0.0.1:18200).
up: certs
	./scripts/vault/with-secrets.sh dev -- ./scripts/local-up.sh up

# Same, with the WAF + local dev-mode Vault security stack on top.
up-security: certs
	./scripts/vault/with-secrets.sh dev -- ./scripts/local-up.sh security

# The old `make up`: plain stack, values straight from .env. Fallback for when
# Vault/WireGuard isn't available; also what local-up.sh runs underneath.
# -V: fresh node_modules volumes from the new image, so newly added packages
# (e.g. after a pull) aren't hidden by an old container's copy.
up-env: certs
	docker compose up -d --build -V

# WAF + Vault, IV.5 Cybersecurity module — separate from `up` so the rest
# of the team isn't forced to pull those images.
#
# Order matters here: `vault` first (no dependency on backend), then
# vault-init.sh bootstraps Vault *and* starts `backend` itself with the
# correct env in one shot, THEN frontend/WAF start — by which point
# backend is already up, so their `depends_on: backend` is satisfied
# without Compose recreating it a second time. Starting frontend/WAF
# first (pulling backend in early via depends_on, with default/wrong env,
# before it gets fixed) was the previous — and more wasteful — ordering.
security: certs
	docker compose -f docker-compose.yml -f docker-compose-security.yml up -d --build vault
	./scripts/vault-init.sh
	docker compose -f docker-compose.yml -f docker-compose-security.yml up -d --build --no-deps frontend waf-frontend waf-backend

security-down:
	docker compose -f docker-compose.yml -f docker-compose-security.yml down

# Same as `up`/`security`, but against local Supabase (`supabase start`)
# instead of the shared dev DB — see scripts/local-up.sh for what it sets.
local: certs
	./scripts/local-up.sh up

local-security: certs
	./scripts/local-up.sh security

# Production only, run ON the server (needs docker-compose.prod.yml and the
# server's .env) — NOT a local dev target. Builds and restarts everything; see
# scripts/prod-up.sh for which compose files it uses and why.
prod:
	./scripts/prod-up.sh

# From your laptop: update and restart https://ft.natscho.my in one command.
# Pulls DEPLOY_BRANCH on the server, then runs `make prod` there. Needs SSH
# access to the server (`solsys` in ~/.ssh/config, jumping through GCP).
DEPLOY_HOST ?= solsys
DEPLOY_DIR ?= ft_transcendence
DEPLOY_BRANCH ?= branchsaurus
deploy:
	ssh $(DEPLOY_HOST) 'set -e; cd $(DEPLOY_DIR); git fetch -q origin; git checkout -q $(DEPLOY_BRANCH); git pull -q --ff-only origin $(DEPLOY_BRANCH); echo "[deploy] $$(hostname) now at $$(git log --oneline -1)"; make prod'

# Share holders: unseal Vault after solsys restarts (2 of 5 shares; solsys's
# own share is applied by `make prod`). Works over WireGuard, no SSH needed.
unseal:
	./scripts/vault/unseal.sh

certs:
	@if [ ! -f certs/localhost.pem ] || [ ! -f certs/localhost-key.pem ]; then \
		mkdir -p certs; \
		if command -v mkcert >/dev/null 2>&1; then \
			echo "Generating trusted certificates with mkcert..."; \
			mkcert -cert-file certs/localhost.pem -key-file certs/localhost-key.pem localhost 127.0.0.1 ::1; \
		else \
			echo "mkcert not found. Generating self-signed certificate with OpenSSL..."; \
			echo "You may need to manually trust this certificate in your browser."; \
			openssl req -x509 -newkey rsa:2048 -nodes -keyout certs/localhost-key.pem -out certs/localhost.pem -days 365 -subj "/CN=localhost"; \
		fi \
	fi

# These four always reference both compose files: referencing the security
# file's services when they were never started is harmless (nothing to
# stop/show/build), but the reverse — forgetting `-f docker-compose-security.yml`
# and orphaning `vault`/`waf-*` when they *were* running — is the mistake
# that actually bites. `security-down` above is now just an alias for this.
down:
	docker compose -f docker-compose.yml -f docker-compose-security.yml down

build:
	docker compose -f docker-compose.yml -f docker-compose-security.yml build

logs:
	docker compose -f docker-compose.yml -f docker-compose-security.yml logs -f

ps:
	docker compose -f docker-compose.yml -f docker-compose-security.yml ps

# Guarded: if the Vault/WAF stack is up, a plain base-file restart of
# backend would strip the VAULT_*/host.docker.internal env vars that
# `make security` set on it, silently breaking a working Vault
# integration. Re-run `make security` (safe to re-run) instead.
backend:
	@if docker ps --format '{{.Names}}' | grep -q '^transpeed-vault-1$$'; then \
		echo "Vault stack is running — plain 'make backend' would reset its DATABASE_URL/VAULT_* env vars."; \
		echo "Run 'make security' instead (safe to re-run, re-bootstraps Vault and restarts backend correctly)."; \
		exit 1; \
	fi
	docker compose up -d --build backend

frontend:
	docker compose up -d --build frontend

backend-shell:
	docker compose exec backend sh

frontend-shell:
	docker compose exec frontend sh

seed:
	docker compose exec backend npx prisma db seed

clean: down
	docker compose -f docker-compose.yml -f docker-compose-security.yml rm -f

.PHONY: up up-security up-env security security-down local local-security prod deploy unseal certs down build logs ps backend frontend backend-shell frontend-shell seed clean
