
up:
	docker compose up -d --build

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

db-shell:
	docker compose exec db psql -U family -d familytree

seed:
	docker compose exec backend npx prisma db seed

clean: down
	docker compose rm -f
	docker volume rm family-tree_dbdata || true

.PHONY: up down build logs ps backend-shell frontend-shell db-shell seed clean
