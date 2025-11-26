# DMP-v2 — Instrucciones para reproducir YouTube localmente

Problema común: al abrir `index.html` directamente con el protocolo `file://` los reproductores embebidos de YouTube pueden devolver errores (ej. 153) y bloquear la reproducción. Esto ocurre porque YouTube valida el `origin` y espera que la página se sirva por HTTP(S).

Solución rápida: servir el proyecto con un servidor HTTP local y abrir `http://localhost:8000`.

Opciones para arrancar un servidor (Windows):

1) Python (recomendado si tienes Python instalado)

- Abre PowerShell en la carpeta del proyecto y ejecuta:

  python -m http.server 8000

- Abre en el navegador: `http://localhost:8000`

2) Node (si tienes Node.js)

- Con npm disponible, puedes usar `http-server` sin instalar globalmente:

  npx http-server -p 8000

- Abre en el navegador: `http://localhost:8000`

3) Scripts incluidos

- `start-server.bat` — ejecuta `python -m http.server 8000` desde la carpeta actual.
- `start-server.ps1` — PowerShell que abre un navegador apuntando a `http://localhost:8000` después de arrancar el servidor en un proceso.

Notas sobre el código:

- Se añadió en `music.js` el parámetro `origin` al crear reproductores YT y un manejo de errores que muestra mensajes cuando se detectan códigos 100/101/150/153.
- Si abres con `file://` el script muestra un banner informativo con un botón para copiar el comando del servidor.

Si después de ejecutar el servidor local sigues teniendo problemas, copia aquí el mensaje exacto de la consola del navegador (F12 → Console) y lo reviso.
