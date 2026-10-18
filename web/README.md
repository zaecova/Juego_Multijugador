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
Se puede iniciar sesión con correo o usuario. Las contraseñas se derivan con PBKDF2-SHA256, 100000 iteraciones y sal aleatoria por cuenta. Las sesiones usan cookies Secure, HttpOnly y SameSite=Strict; solo se guarda su hash en D1 y caducan en siete días. Hay limitación de intentos de autenticación y recuperación.

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
