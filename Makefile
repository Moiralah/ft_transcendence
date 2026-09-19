# Generate SSL certificates if they don't exist

up: certs
	docker compose up -d --build

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

.PHONY: up security security-down down build logs ps backend frontend backend-shell frontend-shell seed clean
