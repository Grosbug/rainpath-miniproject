# Rainpath — one-shot dev bootstrap.
#
# Quick start:
#   make up      install everything, prep the DB with demo data, run the app
#   make help    list every target
#
# Each step is idempotent — re-running `make up` after the first time only does
# what's still missing (pnpm install hits the cache, migrate is a no-op if the
# schema is in sync, the seed is additive). Use `make reset` to wipe & rebuild
# the SQLite DB from scratch.

.PHONY: help up setup prereqs install env db migrate seed dev clean-db reset

# Bare `make` prints the help — never silently launches a long pipeline.
.DEFAULT_GOAL := help

help:
	@echo "Rainpath — make targets"
	@echo ""
	@echo "  make up        full path: prereqs → install → env → db → dev"
	@echo "  make setup     install + env + db, then stop (no dev server)"
	@echo "  make dev       pnpm dev (shared + backend + frontend in parallel)"
	@echo ""
	@echo "  make prereqs   check Node, activate pinned pnpm via corepack"
	@echo "  make install   pnpm install"
	@echo "  make env       copy backend/.env.example → backend/.env if missing"
	@echo "  make db        prisma generate + migrate + seed (demo data)"
	@echo "  make migrate   prisma migrate dev"
	@echo "  make seed      re-run the additive seed (no DB wipe)"
	@echo ""
	@echo "  make clean-db  delete backend/prisma/dev.db (irreversible)"
	@echo "  make reset     clean-db + setup + dev (fresh start)"

up: setup dev

setup: prereqs install env db

prereqs:
	@command -v node >/dev/null 2>&1 || { \
		echo "✗ Node.js not found. Install Node 18+ from https://nodejs.org and re-run."; \
		exit 1; }
	@echo "✓ Node $$(node -v)"
	@# Bootstrap pnpm in this order: (1) already on PATH (Homebrew / manual install) →
	@# nothing to do, (2) Corepack available → download + activate the pinned version,
	@# (3) neither → fail with install instructions. Corepack is the supported path
	@# for fresh Node installs (16+); on older Node or Homebrew Node without corepack
	@# the user installed pnpm themselves and we just verify it.
	@PNPM_VERSION=$$(node -p "require('./package.json').packageManager.split('@')[1]") ; \
		if command -v pnpm >/dev/null 2>&1 ; then \
			echo "✓ pnpm $$(pnpm -v) (already installed)" ; \
		elif command -v corepack >/dev/null 2>&1 ; then \
			corepack enable >/dev/null 2>&1 || true ; \
			corepack prepare pnpm@$$PNPM_VERSION --activate >/dev/null 2>&1 || { \
				echo "✗ Corepack failed to activate pnpm@$$PNPM_VERSION." ; \
				echo "  Try:  sudo corepack enable" ; \
				echo "  Or:   npm install -g pnpm@$$PNPM_VERSION" ; \
				exit 1; } ; \
			echo "✓ pnpm $$(pnpm -v) (via corepack)" ; \
		else \
			echo "✗ Neither pnpm nor corepack found." ; \
			echo "  Install pnpm with one of:" ; \
			echo "    npm install -g pnpm@$$PNPM_VERSION" ; \
			echo "    brew install pnpm" ; \
			echo "    curl -fsSL https://get.pnpm.io/install.sh | sh -" ; \
			exit 1 ; \
		fi

install:
	pnpm install

env:
	@if [ ! -f backend/.env ]; then \
		cp backend/.env.example backend/.env ; \
		echo "✓ backend/.env created from .env.example" ; \
	else \
		echo "= backend/.env already exists — leaving it alone" ; \
	fi

db:
	pnpm --filter @rainpath/backend prisma:generate
	pnpm --filter @rainpath/backend prisma:migrate
	pnpm --filter @rainpath/backend prisma:seed

migrate:
	pnpm --filter @rainpath/backend prisma:migrate

seed:
	pnpm --filter @rainpath/backend prisma:seed

dev:
	pnpm dev

clean-db:
	@rm -f backend/prisma/dev.db backend/prisma/dev.db-journal
	@echo "✓ Removed backend/prisma/dev.db"

reset: clean-db setup dev
