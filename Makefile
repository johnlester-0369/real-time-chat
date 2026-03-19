# =============================================================================
# Real-time Chat - Root Makefile
# =============================================================================
# Simplifies common development, build, and deployment commands
# Run `make` or `make help` to see all available commands
# =============================================================================

# Default shell
SHELL := /bin/bash

# Colors for pretty output (using printf-compatible format)
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
CYAN := \033[0;36m
RESET := \033[0m
BOLD := \033[1m

# Directories
ROOT_DIR := $(shell pwd)
PACKAGES_DIR := $(ROOT_DIR)/packages
WEB_DIR := $(PACKAGES_DIR)/web
SERVER_DIR := $(PACKAGES_DIR)/server
MOBILE_DIR := $(PACKAGES_DIR)/mobile

# =============================================================================
# Default Target (Help)
# =============================================================================
.DEFAULT_GOAL := help

.PHONY: help
help: ## Show this help message
	@printf "\n"
	@printf "$(BOLD)$(CYAN)Real-time Chat - Available Commands$(RESET)\n"
	@printf "$(CYAN)=====================================$(RESET)\n"
	@printf "\n"
	@printf "$(BOLD)Usage:$(RESET) make $(GREEN)<target>$(RESET)\n"
	@printf "\n"
	@awk 'BEGIN {FS = ":.*##"; printf ""} \
		/^[a-zA-Z_-]+:.*?##/ { printf "  $(GREEN)%-22s$(RESET) %s\n", $$1, $$2 } \
		/^##@/ { printf "\n$(BOLD)$(YELLOW)%s$(RESET)\n", substr($$0, 5) }' $(MAKEFILE_LIST)
	@printf "\n"

# =============================================================================
##@ 📦 Installation
# =============================================================================

.PHONY: install
install: ## Install all dependencies for all packages
	@printf "$(BLUE)📦 Installing dependencies for all packages...$(RESET)\n"
	@cd $(WEB_DIR) && npm install
	@cd $(SERVER_DIR) && npm install
	@cd $(MOBILE_DIR) && npm install
	@printf "$(GREEN)✅ All dependencies installed$(RESET)\n"

.PHONY: install-web
install-web: ## Install dependencies for web package
	@printf "$(BLUE)📦 Installing web dependencies...$(RESET)\n"
	@cd $(WEB_DIR) && npm install
	@printf "$(GREEN)✅ Web dependencies installed$(RESET)\n"

.PHONY: install-server
install-server: ## Install dependencies for server package
	@printf "$(BLUE)📦 Installing server dependencies...$(RESET)\n"
	@cd $(SERVER_DIR) && npm install
	@printf "$(GREEN)✅ Server dependencies installed$(RESET)\n"

.PHONY: install-mobile
install-mobile: ## Install dependencies for mobile package
	@printf "$(BLUE)📦 Installing mobile dependencies...$(RESET)\n"
	@cd $(MOBILE_DIR) && npm install
	@printf "$(GREEN)✅ Mobile dependencies installed$(RESET)\n"

# =============================================================================
##@ 🚀 Development
# =============================================================================

.PHONY: dev
dev: ## Run web and server in development mode (parallel)
	@printf "$(BLUE)🚀 Starting development servers...$(RESET)\n"
	@printf "$(YELLOW)Web:$(RESET) http://localhost:5173\n"
	@printf "$(YELLOW)API:$(RESET) http://localhost:3000\n"
	@make -j2 dev-web dev-server

.PHONY: dev-web
dev-web: ## Run web development server
	@printf "$(BLUE)🌐 Starting web dev server...$(RESET)\n"
	@cd $(WEB_DIR) && npm run dev

.PHONY: dev-server
dev-server: ## Run API server in development mode
	@printf "$(BLUE)⚙️  Starting API server...$(RESET)\n"
	@cd $(SERVER_DIR) && npm run dev

.PHONY: dev-mobile
dev-mobile: ## Run mobile app with Expo
	@printf "$(BLUE)📱 Starting Expo development server...$(RESET)\n"
	@cd $(MOBILE_DIR) && npm start

.PHONY: dev-mobile-android
dev-mobile-android: ## Run mobile app on Android
	@printf "$(BLUE)🤖 Starting Android development...$(RESET)\n"
	@cd $(MOBILE_DIR) && npm run android

.PHONY: dev-mobile-ios
dev-mobile-ios: ## Run mobile app on iOS
	@printf "$(BLUE)🍎 Starting iOS development...$(RESET)\n"
	@cd $(MOBILE_DIR) && npm run ios

.PHONY: dev-mobile-web
dev-mobile-web: ## Run mobile app in web browser via Expo
	@printf "$(BLUE)🌐 Starting Expo web...$(RESET)\n"
	@cd $(MOBILE_DIR) && npm run web

# =============================================================================
##@ 🏗️ Build
# =============================================================================

.PHONY: build
build: build-web build-server ## Build web and server for production
	@printf "$(GREEN)✅ All builds complete$(RESET)\n"

.PHONY: build-web
build-web: ## Build web for production
	@printf "$(BLUE)🏗️  Building web...$(RESET)\n"
	@cd $(WEB_DIR) && npm run build
	@printf "$(GREEN)✅ Web build complete$(RESET)\n"

.PHONY: build-server
build-server: ## Build server for production
	@printf "$(BLUE)🏗️  Building server...$(RESET)\n"
	@cd $(SERVER_DIR) && npm run build
	@printf "$(GREEN)✅ Server build complete$(RESET)\n"

# =============================================================================
##@ 🧹 Code Quality
# =============================================================================

.PHONY: lint
lint: lint-web lint-server lint-mobile ## Lint all packages
	@printf "$(GREEN)✅ All linting complete$(RESET)\n"

.PHONY: lint-web
lint-web: ## Lint web package
	@printf "$(BLUE)🔍 Linting web...$(RESET)\n"
	@cd $(WEB_DIR) && npm run lint

.PHONY: lint-server
lint-server: ## Lint server package
	@printf "$(BLUE)🔍 Linting server...$(RESET)\n"
	@cd $(SERVER_DIR) && npm run lint

.PHONY: lint-mobile
lint-mobile: ## Lint mobile package
	@printf "$(BLUE)🔍 Linting mobile...$(RESET)\n"
	@cd $(MOBILE_DIR) && npm run lint

# Mobile has no format script — aggregate targets web and server only
.PHONY: format
format: format-web format-server ## Format web and server packages
	@printf "$(GREEN)✅ Formatting complete$(RESET)\n"

.PHONY: format-web
format-web: ## Format web package
	@printf "$(BLUE)✨ Formatting web...$(RESET)\n"
	@cd $(WEB_DIR) && npm run format

.PHONY: format-server
format-server: ## Format server package
	@printf "$(BLUE)✨ Formatting server...$(RESET)\n"
	@cd $(SERVER_DIR) && npm run format

# Expo projects rely on eslint-config-expo for style enforcement; no Prettier script configured
.PHONY: format-mobile
format-mobile: ## Format mobile package (no format script — use lint-mobile instead)
	@printf "$(YELLOW)⚠️  Mobile has no format script. Run 'make lint-mobile' for code quality checks.$(RESET)\n"

# =============================================================================
##@ 🗑️ Cleanup
# =============================================================================

.PHONY: clean
clean: clean-web clean-server clean-mobile ## Clean all build artifacts
	@printf "$(GREEN)✅ All build artifacts cleaned$(RESET)\n"

.PHONY: clean-web
clean-web: ## Clean web build artifacts
	@printf "$(BLUE)🧹 Cleaning web build...$(RESET)\n"
	@rm -rf $(WEB_DIR)/dist
	@printf "$(GREEN)✅ Web cleaned$(RESET)\n"

.PHONY: clean-server
clean-server: ## Clean server build artifacts
	@printf "$(BLUE)🧹 Cleaning server build...$(RESET)\n"
	@rm -rf $(SERVER_DIR)/dist
	@printf "$(GREEN)✅ Server cleaned$(RESET)\n"

# Expo cache can cause stale bundler issues after config or dependency changes
.PHONY: clean-mobile
clean-mobile: ## Clean mobile Expo cache
	@printf "$(BLUE)🧹 Cleaning mobile cache...$(RESET)\n"
	@rm -rf $(MOBILE_DIR)/.expo
	@printf "$(GREEN)✅ Mobile cleaned$(RESET)\n"

.PHONY: clean-node
clean-node: ## Remove all node_modules directories
	@printf "$(RED)🗑️  Removing all node_modules...$(RESET)\n"
	@rm -rf $(WEB_DIR)/node_modules
	@rm -rf $(SERVER_DIR)/node_modules
	@rm -rf $(MOBILE_DIR)/node_modules
	@printf "$(GREEN)✅ All node_modules removed$(RESET)\n"

.PHONY: clean-all
clean-all: clean clean-node ## Clean everything (builds and node_modules)
	@printf "$(GREEN)✅ Everything cleaned$(RESET)\n"

# =============================================================================
##@ 🔧 Utilities
# =============================================================================

.PHONY: preview-web
preview-web: ## Preview web production build locally
	@printf "$(BLUE)👀 Previewing web build...$(RESET)\n"
	@cd $(WEB_DIR) && npm run preview

.PHONY: start-server
start-server: ## Start server in production mode (requires build first)
	@printf "$(BLUE)🚀 Starting server in production mode...$(RESET)\n"
	@cd $(SERVER_DIR) && npm start

# Copies server/.env.example → server/.env; skips if already present to protect local overrides
.PHONY: env-setup
env-setup: ## Copy server/.env.example to server/.env (skips if already exists)
	@printf "$(BLUE)📝 Setting up environment files...$(RESET)\n"
	@if [ ! -f $(SERVER_DIR)/.env ]; then \
		cp $(SERVER_DIR)/.env.example $(SERVER_DIR)/.env; \
		printf "$(GREEN)✅ Created server/.env$(RESET)\n"; \
	else \
		printf "$(YELLOW)⚠️  server/.env already exists$(RESET)\n"; \
	fi
	@printf "$(YELLOW)📝 Remember to update .env with your values!$(RESET)\n"

.PHONY: check
check: lint ## Run all checks (lint)
	@printf "$(GREEN)✅ All checks passed$(RESET)\n"

.PHONY: fresh
fresh: clean-all install ## Clean everything and reinstall all dependencies
	@printf "$(GREEN)✅ Fresh install complete$(RESET)\n"

# =============================================================================
##@ 📊 Status
# =============================================================================

.PHONY: status
status: ## Show project status
	@printf "\n"
	@printf "$(BOLD)$(CYAN)Real-time Chat Project Status$(RESET)\n"
	@printf "$(CYAN)==============================$(RESET)\n"
	@printf "\n"
	@printf "$(BOLD)📁 Directories:$(RESET)\n"
	@printf "  Root:   $(ROOT_DIR)\n"
	@printf "  Web:    $(WEB_DIR)\n"
	@printf "  Server: $(SERVER_DIR)\n"
	@printf "  Mobile: $(MOBILE_DIR)\n"
	@printf "\n"
	@printf "$(BOLD)📦 Package Versions:$(RESET)\n"
	@printf "  Web:    $$(sed -n 's/.*"version": "\(.*\)".*/\1/p' $(WEB_DIR)/package.json | head -1)\n"
	@printf "  Server: $$(sed -n 's/.*"version": "\(.*\)".*/\1/p' $(SERVER_DIR)/package.json | head -1)\n"
	@printf "  Mobile: $$(sed -n 's/.*"version": "\(.*\)".*/\1/p' $(MOBILE_DIR)/package.json | head -1)\n"
	@printf "\n"

.PHONY: ports
ports: ## Show ports used by the application
	@printf "\n"
	@printf "$(BOLD)$(CYAN)Real-time Chat Ports$(RESET)\n"
	@printf "$(CYAN)====================$(RESET)\n"
	@printf "\n"
	@printf "$(BOLD)Development:$(RESET)\n"
	@printf "  Web (Vite):    http://localhost:5173\n"
	@printf "  Server (API):  http://localhost:3000\n"
	@printf "  Mobile (Expo): http://localhost:8081\n"
	@printf "\n"