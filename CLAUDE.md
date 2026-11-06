# Instrucciones para trabajar en este repositorio

## Tandas (carpeta `tandas/`)
- Antes de editar: `git pull` (otras sesiones también suben cambios aquí).
- **Después de cada mejora o cambio, antes de subirlo, pasa las pruebas:** `cd tandas-pruebas && node run.js` (≈ 2 min; `--rapido` si solo se tocó algo pequeño).
  No se da nada por hecho: si algo falla se corrige y se vuelve a pasar la batería completa.
- Cada fallo corregido y cada botón o función nueva llevan su propia prueba en `tandas-pruebas/` (ver `LEEME.md` de esa carpeta).
- Las simulaciones largas (un usuario durante meses, como «Daniel» o «Danna») solo se hacen cuando el dueño pide un caso práctico.
- Al publicar: subir la versión en `VERSION` de `app.js` y el número de caché de `sw.js`.
- Las claves, códigos de invitación y datos personales nunca se suben al repositorio.
