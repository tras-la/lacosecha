PORT ?= 8000

.PHONY: dev dev-voluntarios

dev:
	python3 -m http.server $(PORT)

dev-voluntarios:
	@echo "Abrí http://voluntarios.localhost:$(PORT)"
	python3 -m http.server $(PORT)
