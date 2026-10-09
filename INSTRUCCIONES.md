# Cómo obtener el instalador y llevarlo a otras PC

## Opción A (recomendada): que GitHub lo compile por ti
No necesitas instalar Rust ni Node en tu PC.

1. Sube el proyecto al repositorio (ver comandos abajo).
2. En GitHub: pestaña **Actions** → **Build instalador Windows** → **Run workflow**
   (también se ejecuta solo en cada `push`).
3. Espera ~10–15 minutos. Al terminar, entra a la ejecución y descarga el
   artefacto **Notas-Locales-instalador** (zip con el `.exe` y el `.msi`).
4. Si falla, copia el error del paso que salió en rojo y envíamelo para corregirlo.

```bash
git remote add origin https://github.com/aperezlux/app-calculater.git
git branch -M main
git push -u origin main --force
```

## Opción B: compilar en tu PC Windows
Instala una sola vez: Node.js 18+, Rust (rustup.rs) y "Build Tools de Visual Studio"
(carga de trabajo "Desarrollo para el escritorio con C++").

```bash
npm install
npm run tauri:dev      # probar la app
npm run tauri:build    # generar instalador
```
Resultado: `src-tauri/target/release/bundle/nsis/Notas Locales_0.1.0_x64-setup.exe`

## Llevarla a otras PC
1. Copia el `*-setup.exe` en una USB.
2. En cada PC (Windows 10/11 de 64 bits): doble clic → Siguiente → Finalizar.
   No requiere Internet ni permisos de administrador.
3. Cada PC crea su propia base de datos local en `%APPDATA%\com.notaslocales.app\`.
4. Para mover notas entre PC: Configuración → Respaldo → Exportar (.json) en una,
   Importar en la otra.

Nota: Windows puede mostrar "SmartScreen: editor desconocido" porque el instalador
no está firmado digitalmente. Pulsa "Más información" → "Ejecutar de todas formas".
El instalador pesa ~130 MB porque incluye WebView2 para funcionar sin Internet.

## Prueba mínima antes de repartir
1. Crear usuario A (PIN 1234), escribir una nota.
2. Cerrar sesión, crear usuario B: no debe ver la nota de A.
3. Configurar cierre automático en 1 minuto, no tocar nada: debe volver a
   "Seleccionar usuario" sin cerrarse la app.
4. Cerrar y reabrir la app: las notas siguen ahí.
