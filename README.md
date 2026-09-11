# Notas Locales

Aplicación de escritorio para Windows con notas privadas, locales y multiusuario.
Cada persona que usa el mismo equipo tiene su propio usuario protegido por PIN,
sus propias notas y carpetas, y una sesión que se cierra automáticamente tras
un período de inactividad configurable — **sin bloquear ni cerrar la
aplicación**, solo la sesión del usuario activo.

## Características

- 👤 Múltiples usuarios en el mismo equipo, cada uno con PIN (4–8 dígitos, con hash Argon2, nunca en texto plano).
- ⏱️ Cierre automático de sesión configurable por usuario (nunca, 1–60 min, o un valor personalizado), que solo vuelve a la pantalla "Seleccionar usuario".
- 📝 Notas ilimitadas, con guardado automático (debounce) y guardado manual (Ctrl+S).
- ✍️ Editor enriquecido: negrita, cursiva, subrayado, tachado, color de texto, resaltado, alineación, listas, encabezados, citas, enlaces, y 9 tipos de letra con tamaño configurable.
- 📁 Carpetas, ⭐ favoritas, 🗑️ papelera (con restaurar/eliminar definitivo/vaciar), 🔎 búsqueda por título/contenido/carpeta.
- 🌙 Modo claro / oscuro / automático (según el tema del sistema), por usuario.
- 🔐 Datos completamente separados por usuario; toda consulta y mutación en el backend revalida el `user_id` propietario antes de tocar una fila.
- 📤📥 Exportar/importar respaldo en `.json`, exportar notas individuales en `.txt`/`.md`.
- 💾 100% local y offline: SQLite en el equipo del usuario, sin servidores ni cuentas externas.
- ⌨️ Atajos: `Ctrl+N` nueva nota, `Ctrl+S` guardar, `Ctrl+F` buscar, `Ctrl+B/I/U` formato, `Ctrl+Shift+L` cerrar sesión, `Esc` cerrar ventanas emergentes.

## Tecnología y por qué

- **Tauri 2 + Rust** para el shell de escritorio: produce un binario nativo pequeño, sin motor Chromium empaquetado (usa WebView2 en Windows), y da acceso directo a SQLite y al sistema de archivos sin depender de Node en producción.
- **React + TypeScript** para la interfaz.
- **Tiptap** (sobre ProseMirror) para el editor de texto enriquecido.
- **SQLite** (vía `rusqlite`, con `bundled` para no depender de una instalación externa de SQLite) como base de datos local. Un pool `r2d2` gestiona las conexiones.
- **Argon2** para el hash del PIN.

Esta combinación cumple con la prioridad del proyecto: aplicación de escritorio real, offline, con instalador `.exe`, y fácil de mantener con un único lenguaje de UI (TypeScript) y un backend de sistema en Rust.

## Estructura del proyecto

```
notas-locales/
├── src/                    # Frontend React/TypeScript
│   ├── components/         # Pantallas y widgets de la UI
│   ├── api.ts              # Wrapper de los comandos Tauri
│   ├── types.ts             # Tipos compartidos con el backend
│   └── useSessionTimer.ts  # Temporizador de inactividad por usuario
└── src-tauri/               # Backend Rust
    ├── src/
    │   ├── commands.rs      # Comandos invocables desde el frontend
    │   ├── db.rs             # Conexión SQLite y migraciones
    │   └── models.rs         # Structs compartidos
    └── tauri.conf.json       # Configuración de la app y del instalador
```

## Requisitos previos

Para desarrollar o compilar esta aplicación necesitas, en la máquina donde
la vayas a construir (con conexión a Internet para descargar dependencias):

- [Node.js](https://nodejs.org/) 18 o superior y npm.
- [Rust](https://www.rust-lang.org/tools/install) (toolchain estable) y Cargo.
- En Windows: [Microsoft Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) y el runtime **WebView2** (viene preinstalado en Windows 10/11 actualizados).

## Instalar dependencias

```bash
npm install
```

La primera vez que compiles el backend, Cargo descargará las dependencias de
Rust automáticamente (incluida una copia de SQLite vía la feature `bundled`,
así no necesitas instalar SQLite por separado).

## Ejecutar en desarrollo

```bash
npm run tauri:dev
```

Esto levanta Vite en `http://localhost:1420` y abre la ventana de la
aplicación conectada a esa vista, con recarga en caliente del frontend.

## Generar la versión de producción / el instalador `.exe`

```bash
npm run tauri:build
```

Esto compila el frontend (`vite build`) y el backend en modo release, y
genera los instaladores configurados (`nsis` y `msi`) dentro de:

```
src-tauri/target/release/bundle/nsis/   → Notas Locales_0.1.0_x64-setup.exe
src-tauri/target/release/bundle/msi/    → Notas Locales_0.1.0_x64_en-US.msi
```

El `.exe` generado por NSIS es el instalador recomendado para distribuir a
otros equipos Windows: no requiere Internet y crea su propia base de datos
local al primer uso.

## Dónde se guardan los datos

La base de datos SQLite se crea en el directorio de datos de aplicación del
usuario de Windows (nunca dentro de la carpeta de instalación, para que las
actualizaciones no pongan en riesgo los datos ni requieran permisos de
administrador):

```
%APPDATA%\com.notaslocales.app\notas-locales.sqlite3
```

## Respaldo: exportar e importar

Desde **Configuración → Respaldo**, cada usuario puede:

- **Exportar**: genera un `.json` con sus notas, carpetas y preferencias.
- **Importar**: selecciona un `.json` exportado previamente. Si detecta una
  nota con el mismo identificador, pregunta si deseas sobrescribirla o
  conservar ambas copias — nunca sobrescribe en silencio.

Este es también el mecanismo para mover notas de un equipo a otro, ya que
los datos son locales por computadora.

## Pruebas

Este primer build no incluye una suite de pruebas automatizadas (no
implementé pruebas falsas o vacías para simular cobertura). Antes de
distribuir la aplicación, verifica manualmente el siguiente checklist,
alineado con los criterios de aceptación del proyecto:

- **Usuarios**: crear, crear un segundo usuario, cambiar PIN, eliminar usuario, iniciar y cerrar sesión.
- **Seguridad**: PIN correcto/incorrecto, cierre automático tras el tiempo configurado, cierre manual.
- **Privacidad**: con el Usuario A crea una nota; entra como Usuario B y confirma que no aparece.
- **Notas**: crear, editar, guardar, buscar, eliminar, restaurar, duplicar, favoritos.
- **Editor**: fuentes, tamaños, negrita, cursiva, subrayado, colores, listas, alineación.
- **Persistencia**: cerrar y volver a abrir la aplicación; los datos deben seguir ahí.
- **Sesión**: configurar 1 minuto, dejar inactiva la app, confirmar que la app NO se cierra pero la sesión SÍ, y que regresa a "Seleccionar usuario".
- **Respaldos**: exportar, importar, verificar integridad de los datos importados.

## Estado de este primer build

Todo lo descrito arriba está implementado con lógica real (no hay botones
decorativos ni funciones "próximamente"). Lo que queda pendiente de tu lado,
por la falta de acceso a Internet en el entorno donde se escribió este
código, es: ejecutar `npm install` / la primera compilación de Cargo, correr
el checklist manual de pruebas de arriba, y — si quieres un ícono propio en
vez del provisional incluido — reemplazar los archivos en `src-tauri/icons/`
(puedes regenerarlos con `npx tauri icon ruta/a/tu/logo.png`).
