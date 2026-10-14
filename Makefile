# Generate SSL certificates if they don't exist

# Compose files for the whole stack: the app plus the IV.5 Cybersecurity module
# (two WAFs and Vault, docker-compose-security.yml).
STACK = -f docker-compose.yml -f docker-compose-security.yml

# The one command: app + WAFs + Vault. Open the app at https://localhost:8443.
#
# Teammates with a Vault login set VAULT_USER (e.g. in ~/.zshrc): the dev
# secrets are then fetched from the solsys Vault through their own SSH tunnel
# and held in memory only, so their .env needs no secrets (see
# scripts/vault/lib.sh). Without VAULT_USER (an evaluator, a 42 machine) the
# values come from .env, as before.
up: certs
	@if [ -n "$$VAULT_USER" ]; then \
		./scripts/vault/with-secrets.sh dev -- $(MAKE) --no-print-directory stack; \
	else \
		$(MAKE) --no-print-directory stack; \
	fi

# What `up` runs, with the secrets already in the environment or in .env.
#
# Order matters here: build first, then `vault` (no dependency on backend),
# then vault-init.sh bootstraps Vault *and* starts `backend` itself with the
# correct env in one shot, THEN frontend/WAF start — by which point backend is
# already up, so their `depends_on: backend` is satisfied without Compose
# recreating it a second time. The WAFs are restarted last because their nginx
# looks up backend's/frontend's addresses only when it starts; on a re-run,
# vault-init recreates backend and the WAFs would otherwise answer 502.
stack: certs
	docker compose $(STACK) build
	docker compose $(STACK) up -d vault
	./scripts/vault-init.sh
	docker compose $(STACK) up -d --no-deps frontend waf-frontend waf-backend
	docker compose $(STACK) restart waf-frontend waf-backend

# Same as `up`, but against local Supabase (`supabase start`) instead of the
# shared dev DB — see scripts/local-up.sh for what it sets.
local: certs
	@if [ -n "$$VAULT_USER" ]; then \
		./scripts/vault/with-secrets.sh dev -- ./scripts/local-up.sh; \
	else \
		./scripts/local-up.sh; \
	fi

# Production only, run ON the server (needs docker-compose.prod.yml and the
# server's .env) — NOT a local dev target. Builds and restarts everything; see
# scripts/prod-up.sh for which compose files it uses and why.
prod:
	./scripts/prod-up.sh

# From your laptop: update and restart https://ft.natscho.my in one command.
# Pulls DEPLOY_BRANCH on the server, then runs scripts/prod-up.sh there (what
# `make prod` runs; solsys has no make installed). Needs SSH
# access to the server (`solsys` in ~/.ssh/config, jumping through GCP).
DEPLOY_HOST ?= solsys
DEPLOY_DIR ?= ft_transcendence
DEPLOY_BRANCH ?= branchsaurus
deploy:
	ssh $(DEPLOY_HOST) 'set -e; cd $(DEPLOY_DIR); git fetch -q origin; git checkout -q $(DEPLOY_BRANCH); git pull -q --ff-only origin $(DEPLOY_BRANCH); echo "[deploy] $$(hostname) now at $$(git log --oneline -1)"; ./scripts/prod-up.sh'

# Share holders: unseal Vault after solsys restarts (2 of 5 shares; solsys's
# own share is applied by scripts/prod-up.sh). Goes through your SSH tunnel (lib.sh).
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
	@# The WAFs' nginx runs as a non-root user and can't read mkcert's 0600 key.
	@chmod 644 certs/localhost-key.pem

# These always use both compose files: forgetting `-f docker-compose-security.yml`
# would orphan `vault`/`waf-*`.
down:
	docker compose $(STACK) down

build:
	docker compose $(STACK) build

logs:
	docker compose $(STACK) logs -f

ps:
	docker compose $(STACK) ps

# Rebuild and restart one side. backend goes through vault-init.sh, so it keeps
# its Vault credentials; then the WAF in front of it is restarted (see `up`).
backend:
	docker compose $(STACK) build backend
	docker compose $(STACK) up -d vault
	./scripts/vault-init.sh
	docker compose $(STACK) restart waf-backend

frontend:
	docker compose $(STACK) up -d --build --no-deps frontend
	docker compose $(STACK) restart waf-frontend

backend-shell:
	docker compose exec backend sh

frontend-shell:
	docker compose exec frontend sh

seed:
	docker compose exec backend npx prisma db seed

clean: down
	docker compose $(STACK) rm -f

.PHONY: up stack local prod deploy unseal certs down build logs ps backend frontend backend-shell frontend-shell seed clean
