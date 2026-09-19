# Generate SSL certificates if they don't exist

up: certs
	docker compose up -d --build

# WAF (ModSecurity + OWASP CRS), IV.5 Cybersecurity module — separate from
# `up` so the rest of the team isn't forced to pull that image.
security: certs
	docker compose -f docker-compose.yml -f docker-compose-security.yml up -d --build

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

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f

ps:
	docker compose ps

backend:
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
	docker compose rm -f

.PHONY: up security security-down down build logs ps backend-shell frontend-shell db-shell seed clean
