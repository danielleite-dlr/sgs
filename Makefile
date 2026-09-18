# ─── SGS Development Makefile ─────────────────────────────────────────────────
# Usage: make <target>
#
# Prerequisites:
#   - Docker Desktop (or Docker Engine) running
#   - pnpm >= 9 installed globally
#   - Node.js 22 LTS
#
# First-time setup:
#   1. cp .env.example .env  (and fill in secrets)
#   2. make install
#   3. make up
# ──────────────────────────────────────────────────────────────────────────────

.PHONY: all help install up down dev logs ps clean reset prisma-migrate prisma-generate prisma-studio \
        stg-deploy stg-update stg-up stg-down stg-ps stg-logs stg-logs-backend stg-migrate stg-seed stg-psql \
        stg-create-admin

# Default target
all: help

help: ## Show this help message
	@echo "SGS — Plataforma de Gestão para Salões de Beleza"
	@echo ""
	@echo "Usage: make <target>"
	@echo ""
	@echo "Targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  %-20s %s\n", $$1, $$2}'

# ─── Dependencies ────────────────────────────────────────────────────────────

install: ## Install all pnpm dependencies across the monorepo
	pnpm install

# ─── Docker Compose ──────────────────────────────────────────────────────────

up: ## Start all Docker services in detached mode
	docker compose up -d

down: ## Stop and remove all Docker containers (preserves volumes)
	docker compose down

logs: ## Stream logs from all services (Ctrl+C to stop)
	docker compose logs -f

logs-backend: ## Stream logs from backend service only
	docker compose logs -f backend

logs-frontend: ## Stream logs from frontend service only
	docker compose logs -f frontend

ps: ## Show status of all Docker services
	docker compose ps

# ─── Development ─────────────────────────────────────────────────────────────

dev: up ## Start infra services and run backend + frontend in watch mode
	@echo "Starting backend and frontend dev servers..."
	@echo "  Backend:     http://localhost:3000"
	@echo "  Frontend:    http://localhost:5173"
	@echo "  GraphQL:     http://localhost:3000/graphql"
	@echo "  Meilisearch: http://localhost:7700"
	@echo ""
	@echo "Press Ctrl+C to stop"
	@pnpm --filter @sgs/backend dev & pnpm --filter @sgs/frontend dev

# ─── Cleanup ─────────────────────────────────────────────────────────────────

clean: ## Stop containers and remove all volumes (DESTROYS DATA)
	@echo "WARNING: This will destroy all Docker volumes including the database!"
	@read -p "Continue? [y/N] " confirm; \
	if [ "$$confirm" = "y" ] || [ "$$confirm" = "Y" ]; then \
		docker compose down -v; \
		echo "Volumes removed."; \
	else \
		echo "Cancelled."; \
	fi

reset: down clean up ## Full reset: stop, destroy volumes, restart

# ─── Prisma ──────────────────────────────────────────────────────────────────

prisma-migrate: ## Run pending Prisma migrations (uses DIRECT_DATABASE_URL)
	pnpm --filter @sgs/backend prisma:migrate

prisma-generate: ## Regenerate Prisma client types
	pnpm --filter @sgs/backend prisma:generate

prisma-studio: ## Open Prisma Studio in browser
	pnpm --filter @sgs/backend prisma:studio

# ─── Tests ───────────────────────────────────────────────────────────────────

test: ## Run all backend unit tests
	pnpm --filter @sgs/backend test

test-cov: ## Run backend tests with coverage report
	pnpm --filter @sgs/backend test:cov

# ─── Build ───────────────────────────────────────────────────────────────────

build: ## Build all apps for production
	pnpm --filter @sgs/backend build
	pnpm --filter @sgs/frontend build

# ─── Staging (VPS: sgs.jessicaseixasmakeup.com.br) ────────────────────────────
# Rodam na VPS, contra docker-compose.staging.yml + .env.staging.

STG := docker compose -f docker-compose.staging.yml --env-file .env.staging

stg-deploy: ## Deploy completo do staging (build + migrations + up)
	./scripts/deploy-staging.sh

stg-update: ## git pull + deploy completo do staging
	./scripts/deploy-staging.sh --pull

stg-up: ## Sobe os serviços do staging sem reconstruir
	$(STG) up -d

stg-down: ## Para o staging (preserva os volumes)
	$(STG) down

stg-ps: ## Status dos serviços do staging
	$(STG) ps

stg-logs: ## Stream dos logs do staging (Ctrl+C para sair)
	$(STG) logs -f

stg-logs-backend: ## Stream dos logs do backend de staging
	$(STG) logs -f backend

stg-migrate: ## Aplica migrations pendentes no banco de staging
	$(STG) --profile tools run --rm migrate

stg-seed: ## Roda o seed no banco de staging
	$(STG) --profile tools run --rm migrate pnpm db:seed

stg-psql: ## Abre um psql no banco de staging
	$(STG) exec postgres sh -c 'psql -U $$POSTGRES_USER -d $$POSTGRES_DB'

stg-create-admin: ## Cria/promove um platform admin (EMAIL=... SENHA=... NOME="...")
	@test -n "$(EMAIL)" || (echo "uso: make stg-create-admin EMAIL=... SENHA=... NOME=\"...\""; exit 1)
	@test -n "$(SENHA)" || (echo "uso: make stg-create-admin EMAIL=... SENHA=... NOME=\"...\""; exit 1)
	$(STG) exec backend node dist/scripts/create-platform-admin.js "$(EMAIL)" "$(SENHA)" "$(NOME)"
