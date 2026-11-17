.PHONY: help infra-status setup dev build test lint

help:
	@echo "Comandos disponibles:"
	@echo "  make infra-status  - Verifica entorno local, dependencias y variables .env.local"
	@echo "  make setup         - Instala dependencias del proyecto"
	@echo "  make dev           - Levanta servidor de desarrollo Next.js"
	@echo "  make build         - Compila la aplicación para producción"
	@echo "  make test          - Ejecuta los tests unitarios e integración"
	@echo "  make lint          - Ejecuta ESLint"

infra-status:
	@echo "=== Verificando entorno ==="
	@node -v
	@npm -v
	@test -f .env.local && echo "[OK] .env.local existe" || echo "[WARN] Falta .env.local"
	@test -d node_modules && echo "[OK] node_modules instalado" || echo "[WARN] Ejecutar make setup"

setup:
	npm install

dev:
	npm run dev

build:
	npm run build

test:
	npm test

lint:
	npm run lint
