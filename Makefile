# Compose file for the whole stack: the app plus the IV.5 Cybersecurity module
# (two WAFs and Vault), all in docker-compose.yml.
STACK = -f docker-compose.yml

# Host port of the local Vault. On Windows (WSL), Hyper-V reserves blocks of
# ports that often cover 8200 (`netsh interface ipv4 show excludedportrange
# protocol=tcp`), and Docker then fails with "ports are not available", so WSL
# gets 28200, well clear of those blocks. Set VAULT_PORT yourself to use another.
ifeq ($(origin VAULT_PORT),undefined)
  VAULT_PORT := $(if $(shell grep -qi microsoft /proc/version 2>/dev/null && echo wsl),28200,8200)
endif
export VAULT_PORT

# The one command: app + WAFs + Vault. Open the app at https://localhost:8443.
#
# Teammates with a Vault login set VAULT_USER (e.g. in ~/.zshrc): the dev
# secrets are then fetched from the solsys Vault through their own SSH tunnel
# and held in memory only, so their .env needs no secrets (see
# scripts/vault/lib.sh). Without VAULT_USER (an evaluator, a 42 machine) the
# values come from .env, as before.
up: certs
	@echo shared > .stack-mode
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
# shared dev DB — see scripts/local-up.sh for what it sets. It also writes
# .stack-mode, so `make backend` / `make frontend` stay on local Supabase.
local: certs
	@if [ -n "$$VAULT_USER" ]; then \
		./scripts/vault/with-secrets.sh dev -- ./scripts/local-up.sh; \
	else \
		./scripts/local-up.sh; \
	fi

# Production only, run ON the server (needs docker-compose.prod.yml and the
# server's .env) — NOT a local dev target. Builds and restarts everything; see
# scripts/prod-up.sh for which compose files it uses and why. solsys has no
# make: there, run ./scripts/prod-up.sh itself (or `make deploy` from a laptop).
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
			openssl req -x509 -newkey rsa:2048 -nodes -keyout certs/localhost-key.pem -out certs/localhost.pem -days 365 -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1"; \
		fi \
	fi
	@# The WAFs' nginx runs as a non-root user and can't read mkcert's 0600 key.
	@chmod 644 certs/localhost-key.pem

down:
	docker compose $(STACK) down

build:
	docker compose $(STACK) build

logs:
	docker compose $(STACK) logs -f

ps:
	docker compose $(STACK) ps

# Rebuild and restart one side, with the same settings as the last `make up` or
# `make local` (read from .stack-mode): after `make local` they go through
# local-up.sh, so they stay on local Supabase instead of picking up .env's
# shared database; with VAULT_USER set they get the secrets from Vault, like
# `make up`. backend goes through vault-init.sh, so it keeps its Vault
# credentials; then the WAF in front of it is restarted (see `stack`).
backend frontend: certs
	@mode=$$(cat .stack-mode 2>/dev/null || echo shared); \
	if [ "$$mode" = local ]; then run="./scripts/local-up.sh $@-stack"; \
	else run="$(MAKE) --no-print-directory $@-stack"; fi; \
	echo "[make $@] same settings as the last 'make $$( [ "$$mode" = local ] && echo local || echo up )'"; \
	if [ -n "$$VAULT_USER" ]; then ./scripts/vault/with-secrets.sh dev -- $$run; else $$run; fi

# What `backend` / `frontend` run, with the settings already in place.
backend-stack:
	docker compose $(STACK) build backend
	docker compose $(STACK) up -d vault
	./scripts/vault-init.sh
	docker compose $(STACK) restart waf-backend

frontend-stack:
	docker compose $(STACK) up -d --build --no-deps frontend
	docker compose $(STACK) restart waf-frontend

backend-shell:
	docker compose exec backend sh

frontend-shell:
	docker compose exec frontend sh

.PHONY: up stack local prod deploy unseal certs down build logs ps backend frontend backend-stack frontend-stack backend-shell frontend-shell
