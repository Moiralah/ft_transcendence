# Generate SSL certificates if they don't exist

# Compose files for the whole stack: the app plus the IV.5 Cybersecurity module
# (two WAFs and Vault, docker-compose-security.yml).
STACK = -f docker-compose.yml -f docker-compose-security.yml

# The one command: app + WAFs + Vault. Open the app at https://localhost:8443.
#
# Order matters here: build first, then `vault` (no dependency on backend),
# then vault-init.sh bootstraps Vault *and* starts `backend` itself with the
# correct env in one shot, THEN frontend/WAF start — by which point backend is
# already up, so their `depends_on: backend` is satisfied without Compose
# recreating it a second time. The WAFs are restarted last because their nginx
# looks up backend's/frontend's addresses only when it starts; on a re-run,
# vault-init recreates backend and the WAFs would otherwise answer 502.
up: certs
	docker compose $(STACK) build
	docker compose $(STACK) up -d vault
	./scripts/vault-init.sh
	docker compose $(STACK) up -d --no-deps frontend waf-frontend waf-backend
	docker compose $(STACK) restart waf-frontend waf-backend

# Same as `up`, but against local Supabase (`supabase start`) instead of the
# shared dev DB — see scripts/local-up.sh for what it sets.
local: certs
	./scripts/local-up.sh

# Production only (needs docker-compose.prod.yml and the VM's real .env) —
# NOT a local dev target. Assumes backend/frontend are already built; see
# scripts/prod-up.sh for why this always uses all three compose files
# together, unlike `up` above.
prod:
	./scripts/prod-up.sh

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

.PHONY: up local prod certs down build logs ps backend frontend backend-shell frontend-shell seed clean
