.PHONY: help setup up down up-api down-volumes wait-mongo dev build test verify

COMPOSE := docker compose
export HUSKY := 0

help:
	@echo "mayday-api — common targets"
	@echo ""
	@echo "  make setup   — install deps, create .env, start Mongo, run migrations"
	@echo "  make up      — start MongoDB (docker compose)"
	@echo "  make down    — stop compose services"
	@echo "  make dev     — run API locally (tsx watch; requires make up)"
	@echo "  make up-api  — build and start API + Mongo in Docker"
	@echo "  make down-volumes — stop services and remove Mongo volume"
	@echo "  make build   — compile TypeScript to dist/"
	@echo "  make test    — run tests"
	@echo "  make verify  — build + smoke-check running server"

setup: .env
	@command -v node >/dev/null || (echo "Node.js is required (see .nvmrc)"; exit 1)
	@[ -f .nvmrc ] && command -v nvm >/dev/null 2>&1 && . "$$HOME/.nvm/nvm.sh" && nvm use || true
	npm ci
	$(MAKE) up
	$(MAKE) wait-mongo
	npm run mongo:migrate
	@echo ""
	@echo "Setup complete. Start the API with: make dev"

.env:
	@test -f .env || cp .env.example .env
	@echo "Created .env from .env.example (edit as needed)"

up:
	$(COMPOSE) up -d mongo

down:
	$(COMPOSE) down

up-api:
	$(COMPOSE) --profile api up -d --build

down-volumes:
	$(COMPOSE) down -v

wait-mongo:
	@echo "Waiting for MongoDB on :27017..."
	@for i in $$(seq 1 30); do \
		$(COMPOSE) exec -T mongo mongosh --quiet --eval "db.adminCommand('ping').ok" 2>/dev/null | grep -q 1 && exit 0; \
		sleep 1; \
	done; \
	echo "MongoDB did not become ready in 30s"; exit 1

dev:
	npm run dev

build:
	npm run build

test:
	npm run test

verify:
	npm run verify
