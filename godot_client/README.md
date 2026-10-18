# En busca del tesoro — prototipo multijugador LAN

Proyecto Godot 4.3 o posterior. Incluye la versión individual y una primera carrera simultánea para hasta cuatro jugadores, con anfitrión autoritativo.

## Abrir
1. Descarga y descomprime el ZIP completo.
2. En Godot, selecciona Importar y abre `project.godot`.
3. Ejecuta el proyecto con F5.

## Probar entre dos equipos en la misma red
1. Abre el proyecto en ambos equipos con la misma versión de Godot.
2. En el primero, pulsa CREAR PARTIDA. Permite Godot en el firewall de la red privada para UDP 24560.
3. Obtén la IPv4 local del anfitrión con `ipconfig` en Windows (por ejemplo, 192.168.1.20).
4. En el segundo, introduce esa IP y pulsa UNIRSE POR IP.
5. Espera a que ambos aparezcan en la lista. El anfitrión pulsa INICIAR CARRERA.
6. Los jugadores avanzan simultáneamente y ven a los demás. Recoge las luces doradas, cambia de carril y salta los troncos.
7. Al finalizar todos, el anfitrión puede iniciar otra carrera. Para abandonar durante la carrera, cierra la ventana; el botón SALIR está disponible en el menú.

Para probar en una sola computadora, abre dos instancias y usa 127.0.0.1. También puedes usar la opción de múltiples instancias de ejecución del editor.

## Controles
- A/D o flechas: cambiar carril.
- Espacio/W/flecha arriba: saltar.
- Botones táctiles: izquierda, salto y derecha.

## Reglas multijugador
- Cada jugador recoge sus propias 12 pistas; recoger una no la quita a los demás.
- Las pistas pueden recogerse sin exigir orden. Una pista perdida no bloquea el final de la carrera.
- Cada pista suma el valor indicado en pantalla. El tesoro se logra recogiendo las 12.
- Cada jugador tiene tres vidas con tres oportunidades por vida.
- La carrera termina para cada jugador al llegar a 278 metros o agotar vidas. La tabla final muestra puntos y frases de todos; se comparan por puntos y, en empate, se comparte la posición (no hay desempate temporal).
- No se admiten nuevas incorporaciones durante la carrera. Se puede entrar entre rondas.
- Si se desconecta un participante, se retira de la partida. Si sale el anfitrión, se cierra la sesión para todos.

## Estructura técnica
- `scripts/main.gd`: escenario procedural, avatar, UI y modo individual original.
- `scripts/multiplayer.gd`: sala, transporte ENet, entradas, simulación en el anfitrión y estado visual en los clientes.
- `scenes/main.tscn`: escena de entrada.
- El anfitrión simula a 60 pasos por segundo. Publica estados a 20 Hz; los clientes interpolan las posiciones.
- Los clientes envían cambio de carril y salto. El anfitrión calcula posición, colisiones, vidas y puntos. Rechaza entradas de jugadores ajenos a la ronda y limita la frecuencia de comandos.
- Las revisiones de ronda evitan aplicar entradas atrasadas a una nueva carrera.

## Alcance y siguientes etapas
Es una maqueta 3D con figuras geométricas y una sesión por IP en red local. No incluye cuentas, matchmaking, base de datos, servidor dedicado desplegado, migración de anfitrión, protección completa contra abuso, predicción de movimiento ni exportaciones para tiendas. El anfitrión debe ser de confianza.

La base usa Godot, pero no se entregan ejecutables Windows/Android/iOS ni una versión web. Cada plataforma requiere exportación y pruebas; Android requiere permiso de Internet. ENet usa UDP y no permite una exportación web directa: el navegador necesita otro transporte. Las partidas por Internet requieren una fase adicional de conectividad y alojamiento.

El modo individual conserva sus reglas originales: pistas en orden y reinicio si falta alguna. Las mejoras de recogida libre y final sin bloqueo corresponden al modo multijugador.

## Textos bíblicos
Las frases son extractos abreviados de la maqueta y mantienen la escritura original sin tildes. Antes de publicar, seleccionar una traducción, verificar la literalidad y los permisos de uso. Las indicaciones de ruta son narrativas: no hay caminos ramificados.

## Documentación técnica oficial
- https://docs.godotengine.org/en/stable/tutorials/networking/high_level_multiplayer.html
- https://docs.godotengine.org/en/stable/classes/class_enetmultiplayerpeer.html

## Validación realizada
- Godot 4.3: importación del proyecto y compilación de scripts.
- Dos procesos locales: conexión real ENet, inicio compartido, movimiento del cliente validado por el anfitrión y recepción de posiciones.
- Pruebas de reglas: pistas fuera de orden, puntos sin duplicados, daño sin duplicados, salto sobre tronco, final con pistas faltantes, tesoro completo y rechazo de comandos inválidos o de otra ronda.
- Las pruebas se ejecutaron sin interfaz gráfica. El renderizador dummy de Godot 4.3 emitió mensajes de liberación de mallas al cerrar; queda pendiente la revisión visual y la prueba entre dispositivos físicos.

Los scripts reproducibles están en `tests/`. Para la prueba de conexión, ejecutar `network_smoke.gd` con el argumento de usuario `host` y, medio segundo después, con `client` en otro proceso. La prueba de reglas es `rules_smoke.gd`.
