---
name: 04-demo-and-deploy
description: Facilita probar el sistema sin fricción y dejar la aplicación lista para producción.
---

# Skill 04: Modo Evaluación (Jurado) y Despliegue en Vercel

## Objetivo
Facilitar que el jurado pruebe el sistema sin fricción y dejar la aplicación lista para producción.

## Pasos Incrementales
1. **Seed inicial de taller:** Crear script `npm run seed` con 4 piezas de cerámica realistas para que la web nunca se vea vacía al entrar por primera vez.
2. **Modo Prueba Seguro (Sandbox para Evaluadores):**
   - Permitir que cualquier número que envíe la palabra clave de activación del Sandbox pueda probar crear/editar piezas (con un límite máximo de 15 productos en DB para evitar spam, eliminando los más viejos de prueba si se supera).
3. **Verificación Final:**
   - Correr `make test` y `make build` asegurando 0 errores.
   - Documentar en `README.md` las instrucciones exactas en 3 pasos para que el evaluador pruebe la web y el bot de WhatsApp.
