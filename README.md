# En busca del tesoro

Juego de carreras bíblico con una arquitectura online en desarrollo. El cliente y el servidor de partidas usan Godot 4 y ENet; una API HTTPS gestiona cuentas y progreso, y PostgreSQL conserva los datos.

## Componentes

- `api/`: API JSON para registro, inicio de sesión y progreso. Las contraseñas se almacenan con Argon2id; los tokens de sesión son firmados y expiran.
- `database/`: esquema inicial de PostgreSQL.
- `game_server/`: proyecto Godot headless con autoridad de partida en el servidor.
- `compose.yaml`: API y base de datos para desarrollo local.

## Versión web publicada

Juega en: **https://en-busca-del-tesoro-online.snugmule3.chatgpt.site**

La carpeta `web/` contiene la versión de navegador publicada con Sites: cuentas con correo o usuario, contraseña, recuperación con código personal y salas multijugador de hasta cuatro participantes. El servidor valida la carrera y sincroniza el estado mediante HTTPS. No se envían correos de recuperación; cada usuario debe guardar el código que recibe al crear su cuenta.

Esta adaptación usa Canvas con perspectiva. Es independiente del cliente Godot y de la demo Python anterior. La compilación y siete pruebas automatizadas pasaron; la revisión visual en navegador y la prueba con dispositivos físicos siguen pendientes. Consulta [`web/README.md`](web/README.md).

## Cliente Godot jugable: multijugador LAN

El proyecto `godot_client/project.godot` incorpora el corredor 3D de selva con pistas bíblicas, obstáculos, vidas y puntuación. Ábrelo en Godot **4.3 o posterior** y ejecútalo con F5.

- Hasta cuatro jugadores: uno crea la partida y los demás se unen por su IP local.
- El anfitrión inicia la carrera y calcula movimiento, colisiones y puntos.
- Usa **UDP 24560**, distinto del servidor independiente de `game_server/`.
- Para una prueba en el mismo equipo, abre dos instancias y usa `127.0.0.1`.
- Instrucciones y pruebas reproducibles: [`godot_client/README.md`](godot_client/README.md).

Este cliente es un prototipo LAN autónomo: todavía no se conecta con `api/`, `database/`, `game_server/` ni la demo web. No incluye cuentas ni partidas por Internet. La conexión se comprobó con dos procesos locales en Godot 4.3; queda pendiente probar la interfaz visual y equipos físicos.

## Vista previa jugable

Para ver una demo local sin instalar dependencias, en PowerShell ejecuta `$env:PORT=8001; python preview/server.py` y abre `http://localhost:8001`. Puedes probarla como invitado o crear una cuenta local con correo, contraseña (mínimo 8 caracteres) y género; el avatar de perfil cambia según la opción elegida. Las pestañas abiertas en esta misma instancia comparten una sala de prueba: los jugadores se ven y sus cambios de carril se sincronizan. La carrera, los obstáculos y el progreso todavía se simulan localmente en cada navegador; falta conectarlos al servidor autoritativo Godot. Esta demo no envía correo de verificación y guarda las cuentas en `preview/preview.sqlite3`; es independiente de la API y del servidor Godot descritos arriba, y no debe publicarse como servicio de producción. El botón de Google queda pendiente de configurar OAuth Client ID.

Si olvidaste la contraseña de una cuenta local, ejecuta `python preview/reset_password.py` desde la carpeta del proyecto y sigue las indicaciones en la terminal. La contraseña nueva se escribe de forma oculta y no se envía por chat. La demo todavía no tiene recuperación por correo.

Para borrar todas las cuentas locales de la demo, ejecuta `python preview/clear_accounts.py`.

## Publicar una demo online

El archivo `render.yaml` permite crear una demo web en Render desde este repositorio: en Render elige **New > Blueprint**, conecta `zaecova/Juego_Multijugador` y confirma la creación del servicio `en-busca-del-tesoro`. Render asignará una URL HTTPS al terminar. El servicio acepta conexiones externas y la sala de prueba sincroniza jugadores mientras la instancia está activa.

Esta configuración usa el plan gratuito y almacenamiento temporal. Render puede apagar la instancia y borrar las cuentas SQLite; úsala solo para probar, nunca para guardar contraseñas importantes. Además, las partidas siguen siendo una sala de demostración: posiciones y obstáculos no se comparten con autoridad del servidor Godot. Para un lanzamiento estable hacen falta almacenamiento persistente y conectar el cliente al servidor de partidas.

## Requisitos

- Docker Desktop con Docker Compose.
- Godot 4.2 o posterior para abrir/ejecutar el servidor; Godot 4.3 o posterior para el cliente LAN.

## Ejecutar API y base de datos

1. Copia `.env.example` a `.env` y cambia `APP_SECRET` por un valor aleatorio largo.
2. Ejecuta `docker compose up --build`.
3. La API de desarrollo queda en `http://localhost:8000`; documentación interactiva: `/docs`.

Endpoints iniciales: `POST /v1/auth/register`, `POST /v1/auth/login`, `GET /v1/me` y `GET /health`.

Para producción, publica la API detrás de un proxy con TLS, define secretos seguros y limita solicitudes en el proxy. El servicio de partidas debe exponerse solo en el puerto UDP configurado. No se deben aceptar puntuaciones ni progreso calculados por el cliente.

## Servidor de partidas

Abre `game_server/project.godot` con Godot 4 y ejecuta `server.gd` en modo headless. El puerto ENet predeterminado es UDP 2456. El servidor mantiene la posición, carril, salto, colisiones y puntuación; el cliente solo envía acciones. Este servidor todavía no está integrado con el cliente LAN de `godot_client/` ni con la identidad de la API.

## Estado y siguientes pasos

La base online cubre cuentas, tokens, persistencia de perfiles y una sala ENet autoritativa mínima. A continuación se debe integrar el cliente Godot LAN con este servidor, validar el token de API al entrar a la sala, añadir progreso de partidas y configurar HTTPS/limitación de solicitudes para despliegue.

Las citas bíblicas deben revisarse junto con la licencia de la traducción elegida antes de publicar.
