
# include docker/.env

# NAME = ft
# SRC_DIR = docker/srcs
# DOCKER_COMPOSE = $(SRC_DIR)/docker-compose.yml
# LOGIN = $(WORDPRESS_URL)

# all: setup up

# setup:
# 	# Add domain mapping to /etc/hosts if not already present
# 	@grep -q "$(LOGIN)" /etc/hosts || echo "127.0.0.1 $(LOGIN)" | sudo tee -a /etc/hosts > /dev/null
# 	# Create persistent WordPress data folder
# 	@sudo mkdir -p $(DATA_PATH)/wordpress
# 	# Create persistent MariaDB data folder
# 	@sudo mkdir -p $(DATA_PATH)/mariadb

# up:
# 	# Build images and start all containers in detached mode
# 	docker compose -p $(NAME) -f $(DOCKER_COMPOSE) up --build -d

# down:
# 	docker compose -p $(NAME) -f $(DOCKER_COMPOSE) down

# stop:
# 	docker compose -p $(NAME) -f $(DOCKER_COMPOSE) stop

# start:
# 	docker compose -p $(NAME) -f $(DOCKER_COMPOSE) start

# logs:
# 	docker compose -p $(NAME) -f $(DOCKER_COMPOSE) logs -f

# ps:
# 	docker compose -p $(NAME) -f $(DOCKER_COMPOSE) ps

# secrets:
# 	@mkdir -p ./secrets
# 	@echo "login42" > ./secrets/db_root_password.txt
# 	@echo "login42" > ./secrets/db_password.txt
# 	@echo "login42" > ./secrets/wp_admin_password.txt
# 	@echo "login42" > ./secrets/wp_user_password.txt
# 	@echo "Docker secrets created successfully in ./secrets/"

# clean:
# 	docker compose -p $(NAME) -f $(DOCKER_COMPOSE) down --rmi all -v --remove-orphans


# fclean: clean
# 	docker system prune -af --volumes
# 	@sudo rm -rf $(DATA_PATH)/wordpress
# 	@sudo rm -rf $(DATA_PATH)/mariadb

# re: clean all

# .PHONY: all setup up down logs ps clean fclean re



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

backend-shell:
	docker compose exec backend sh

frontend-shell:
	docker compose exec frontend sh

db-shell:
	docker compose exec db psql -U family -d familytree

#seed:
#	docker compose exec db psql -U family -d familytree -f /docker-entrypoint-initdb.d/init.sql

clean: down
	docker compose rm -f
	docker volume rm family-tree_dbdata || true

.PHONY: up down build logs ps backend-shell frontend-shell db-shell seed clean