# En busca del tesoro — web multijugador

Versión web en Canvas con perspectiva de la selva, salas por código para cuatro jugadores y cuentas obligatorias. Esta es una adaptación web independiente del cliente Godot; no ejecuta el proyecto Godot dentro del navegador.

## Jugar
1. Crear cuenta con usuario, correo y contraseña de al menos 10 caracteres.
2. Guardar el código personal de recuperación que se muestra una vez.
3. Crear una sala o unirse con un código de seis caracteres.
4. El anfitrión inicia la carrera. Hay tres segundos de cuenta atrás.
5. A/D o flechas cambian carril; espacio/W/arriba saltan. Hay controles táctiles.
6. Recoger las doce pistas para alcanzar el tesoro. Las pistas son individuales. La ronda termina al llegar a la meta o agotar vidas; perder una pista no bloquea la meta.

## Cuentas y recuperación
Se puede iniciar sesión con correo o usuario. Las contraseñas se derivan con PBKDF2-SHA256, 100000 iteraciones y sal aleatoria por cuenta. Las sesiones caducan en siete días y solo se guarda su hash en D1. Se admite la cookie Secure/HttpOnly/SameSite=Strict y un token de sesión por pestaña para alojamientos o navegadores que no reenvían esa cookie. El cliente guarda ese token en sessionStorage cuando está disponible y lo envía en el cuerpo HTTPS de las solicitudes; nunca lo coloca en enlaces ni parámetros de URL. Hay limitación de intentos de autenticación y recuperación.

La recuperación se realiza con un código aleatorio de 128 bits que el usuario debe guardar. Al usarlo cambia la contraseña, invalida sesiones y entrega un código nuevo. No se envía correo ni se comprueba la titularidad de la dirección. No se debe presentar este flujo como recuperación por correo. Si se pierden tanto la contraseña como el código, no hay recuperación automática.

## Multijugador
El servidor calcula las posiciones, saltos, colisiones, vidas y puntos. Los clientes envían acciones y reciben el estado por HTTPS aproximadamente cada 200 ms; no usa WebSocket ni ENet. D1 guarda las salas con revisiones y escrituras condicionales para resolver concurrencia. Cada sala admite cuatro cuentas distintas, no permite incorporaciones durante la carrera y caduca tras una hora sin actividad. Un participante sin actividad durante 25 segundos se retira; el anfitrión pasa a otro participante si corresponde.

Es una primera versión web con sincronización por consultas periódicas, adecuada para pruebas pequeñas. No se ha validado su capacidad con muchas salas simultáneas. No incluye integración con la API Python ni el servidor Godot del repositorio.

## Desarrollo y publicación
Requiere Node 22.13 o posterior y pnpm. Las migraciones se generan con `pnpm db:generate`. El despliegue administra el recurso D1 declarado en `.openai/hosting.json`. No ejecutar CREATE/ALTER durante las peticiones.

- Pruebas: `node --test tests/*.test.mjs` (las pruebas de API requieren Node con `node:sqlite`).
- Compilación: helper de Sites `build-site.mjs`.
- La publicación utiliza el flujo de Sites y conserva la identidad del proyecto.

## Validación
Pruebas de reglas, cuentas, contraseñas, recuperación de un solo uso, invalidación de sesiones, acceso autenticado, dos jugadores compartiendo carrera, entrada de cliente y permisos del anfitrión. Incluye una comprobación del script cliente en un DOM simulado y compilación de producción. La revisión visual en navegador y la prueba con dispositivos físicos quedan pendientes.

Los textos bíblicos son fragmentos abreviados de la maqueta; falta seleccionar una traducción y revisar la literalidad y permisos antes de una publicación editorial definitiva.

## Corrección de creación de sala
Los registros de producción mostraban autenticación correcta seguida de respuestas 401 al crear salas. El cliente ahora conserva y envía explícitamente la sesión y la credencial de sala, sin depender de que el alojamiento reenvíe cookies o el encabezado Authorization. La prueba de regresión registra una cuenta, crea e inicia una sala y comprueba la revocación sin enviar cookies. Si la sesión venció, la interfaz vuelve al inicio de sesión.

## Jungla fotográfica y alias
La vegetación usa las fotografías proporcionadas de palmeras, cacao y atardecer. Se alternan a lo largo de la carrera y forman capas con movimiento alrededor del camino. Los archivos se conservan como fotografías originales en `public/jungle/`; no se usa la fotografía que contiene una persona. El campo «Tu nombre o alias en la partida» se muestra al crear o unirse a la sala; el servidor limita su longitud y lo muestra sobre el corredor y en la lista de jugadores. El alias no cambia el usuario de acceso.

## Sendero de rocas
El camino usa piedras irregulares con perspectiva. Los obstáculos son escalones naturales de roca que atraviesan los tres carriles. El servidor exige estar en el aire al llegar al escalón; cambiar de carril no evita el desnivel. Los carriles se usan para recoger las pistas.

## Libro de recompensa
Cuando el servidor confirma que se ha recogido una nueva pista, aparece un libro abierto con resplandor dorado, referencia y texto bíblico. Permanece 3 segundos; el texto también queda en el panel de recorrido. El aviso permite seguir jugando y no pausa la carrera multijugador. Reiniciar la ronda o salir limpia el libro y su temporizador.

## Sonidos de naturaleza
`public/nature-audio.js` sintetiza un arroyo suave y cantos de pájaros mediante Web Audio. Al aparecer el libro se escucha un acorde suave y relajante de tres segundos. Se inicia tras la primera interacción del usuario, suena durante la carrera y se silencia al terminar, salir o pasar la pestaña a segundo plano. Incluye interruptor y volumen. Son sonidos sintetizados, no grabaciones de aves ni agua. No solicita acceso al micrófono ni descarga audio externo.

Los mensajes de recompensa se encolan para que cada texto permanezca tres segundos completos, incluso si se recoge otra pista antes de terminar de leer. Al salir o reiniciar se vacía la cola. El sonido de recompensa respeta el volumen, el silencio y la visibilidad de la pestaña.

## Tiempo de reacción ampliado
La velocidad de avance baja de 9 a 4,5 unidades por segundo: cada desnivel tarda el doble en llegar y la carrera dura unos 62 segundos, más la cuenta atrás. El servidor envía la velocidad en el estado para que el movimiento del navegador coincida con las colisiones. Se conserva la duración del salto y de los mensajes.
