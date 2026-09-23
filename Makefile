# Universal API — everyday commands.
#
# Deployment lives here because the GitHub → Vercel integration stopped delivering pushes
# (nothing built between 2026-09-21 and a manual deploy on 2026-09-23). Until that is
# reconnected in Vercel → Settings → Git, `make deploy` is how production gets updated.
#
# Deploys ship the WORKING DIRECTORY, not the last pushed commit: `vercel` uploads these
# files and builds them in the cloud. `make deploy` therefore refuses to run with a dirty
# tree, so what is live always matches a commit you can point at.

SHELL := /bin/bash
VERCEL := npx --yes vercel
SCOPE := mohit-hingoranis-projects
PROJECT := api-sandbox
PROD_URL := https://api-sandbox-eight.vercel.app

.DEFAULT_GOAL := help
.PHONY: help dev check build test lint typecheck link deploy deploy-preview verify logs status migrate migrate-prod clean-guard

help: ## Show this list
	@echo "Universal API"
	@echo
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[1m%-16s\033[0m %s\n", $$1, $$2}'
	@echo
	@echo "  Production: $(PROD_URL)"

# ── development ───────────────────────────────────────────────────────────────
dev: ## Run the app locally (uses .env.development.local)
	npm run dev

typecheck: ## TypeScript, no emit
	npx tsc --noEmit -p .

lint: ## ESLint
	npx eslint src auth.ts

test: ## Vitest (Postgres suites skip unless PG_TEST_DATABASE_URL is set)
	npx vitest run

build: ## Production build, locally
	npm run build

check: typecheck lint test ## Everything a deploy should pass first

# ── deployment ────────────────────────────────────────────────────────────────
clean-guard:
	@if [ -n "$$(git status --porcelain)" ]; then \
		echo "Refusing to deploy: the working tree has uncommitted changes."; \
		echo "A deploy ships these files, so commit or stash them first —"; \
		echo "otherwise production would run code that exists on no commit."; \
		git status --short; \
		exit 1; \
	fi
	@echo "Working tree clean at $$(git rev-parse --short HEAD) on $$(git rev-parse --abbrev-ref HEAD)."

link: ## Link this directory to the Vercel project (once per machine)
	$(VERCEL) link --scope $(SCOPE) --project $(PROJECT) --yes

deploy: clean-guard check ## Check, then deploy the current commit to production
	$(VERCEL) --prod
	@$(MAKE) verify

deploy-preview: check ## Deploy a preview build (its own URL, production untouched)
	$(VERCEL)

deploy-fast: clean-guard ## Deploy to production without running the checks first
	$(VERCEL) --prod
	@$(MAKE) verify

verify: ## Ask production what it is actually serving
	@echo "Checking $(PROD_URL) …"
	@printf '  landing page      %s\n' "$$(curl -s -o /dev/null -w '%{http_code}' --max-time 25 $(PROD_URL)/)"
	@printf '  admin route live  %s\n' "$$(curl -s --max-time 25 -X PATCH -H 'Content-Type: application/json' -d '{"role":"user"}' $(PROD_URL)/api/admin/users/x/role)"
	@printf '  sign-in page      %s\n' "$$(curl -s -o /dev/null -w '%{http_code}' --max-time 25 $(PROD_URL)/sign-in)"
	@echo "  (admin route should answer {\"error\":\"Not found.\"} — an HTML 404 means old code)"

logs: ## Tail production logs
	$(VERCEL) logs $(PROD_URL)

status: ## Recent deployments
	$(VERCEL) ls $(PROJECT) --scope $(SCOPE)

# ── database ──────────────────────────────────────────────────────────────────
migrate: ## Apply migrations to the LOCAL dev database
	DATABASE_URL="$$(grep -m1 '^DATABASE_URL=' .env.development.local | cut -d= -f2- | tr -d '"'"'"'')" node scripts/db-migrate.mjs

migrate-prod: ## Apply migrations to the HOSTED database (asks first)
	@echo "This writes to the production database named in .env.local."
	@read -p "Type 'yes' to continue: " answer; [ "$$answer" = "yes" ] || { echo "Stopped."; exit 1; }
	node --env-file=.env.local scripts/db-migrate.mjs
