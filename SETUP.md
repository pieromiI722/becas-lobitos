# Concurso de Declamación — puesta en marcha

| Ruta      | Quién             | Para qué                                                    |
|-----------|-------------------|-------------------------------------------------------------|
| `/`       | Público           | Info del concurso + resultados (se actualiza solo)          |
| `/jurado` | Jurados           | Calificar a cada concursante con la rúbrica de 100 puntos   |
| `/admin`  | Organización      | Importar CSV, ver progreso en vivo, publicar por categoría  |

## 1. Supabase
1. **SQL Editor** → pegar y ejecutar `supabase/privado/00_todo_en_uno.sql`
   (esquema + 63 concursantes + 3 jurados y admin). Esa carpeta está fuera de git;
   en el repo quedan `schema.sql` y `usuarios.sql` como plantilla.
2. **Authentication → Sign In / Providers → Email**: desactivar *Allow new users to sign up*.
3. **Project Settings → API**: copiar URL y *publishable/anon key*.

Credenciales de los jurados: `supabase/privado/CREDENCIALES.txt`.
Para cambiar una contraseña: editar `supabase/privado/usuarios.sql` y volver a ejecutarlo.

## 2. Local
```
cp .env.example .env   # pegar URL y key
npm install
npm run dev            # http://localhost:5173  ·  /jurado  ·  /admin
```

## 3. Vercel
Importar el repo (framework: Vite), agregar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
en Environment Variables, desplegar y conectar el dominio.

## Durante el concurso
- Los jurados entran en `/jurado` con su usuario (ej. `jurado1`) y contraseña.
- En `/admin` se ve cuántos jurados calificaron a cada concursante.
- **Publicar resultados** en una categoría → aparece al instante en `/` y se bloquean las notas
  de esa categoría. *Retirar publicación* la oculta y vuelve a habilitar la edición.
- Puntaje final = promedio de los jurados. Desempate = criterio "Interpretación".
