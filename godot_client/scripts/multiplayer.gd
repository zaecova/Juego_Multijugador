extends "res://scripts/main.gd"

# The host simulates every runner. Clients send only bounded input commands.
const PORT = 24560
const MAX_PLAYERS = 4
var online := false
var racing := false
var roster: Dictionary = {}
var ghosts: Dictionary = {}
var view: Dictionary = {}
var net_clock := 0.0
var round_id := 0
var address: LineEdit
var net_status: Label
var host_button: Button
var join_button: Button
var leave_button: Button

func _ready() -> void:
 super._ready()
 var menu = overlay.get_node("Menu")
 address = LineEdit.new()
 address.placeholder_text = "IP del anfitrión (127.0.0.1 para probar aquí)"
 address.text = "127.0.0.1"
 menu.add_child(address)
 host_button = Button.new()
 host_button.text = "CREAR PARTIDA (hasta 4 jugadores)"
 host_button.pressed.connect(_host)
 menu.add_child(host_button)
 join_button = Button.new()
 join_button.text = "UNIRSE POR IP"
 join_button.pressed.connect(_join)
 menu.add_child(join_button)
 leave_button = Button.new()
 leave_button.text = "SALIR DE LA PARTIDA"
 leave_button.pressed.connect(_leave)
 menu.add_child(leave_button)
 net_status = Label.new()
 net_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
 menu.add_child(net_status)
 overlay.position = Vector2(320, 90)
 overlay.custom_minimum_size = Vector2(640, 490)
 multiplayer.peer_connected.connect(_peer_joined)
 multiplayer.peer_disconnected.connect(_peer_left)
 multiplayer.connected_to_server.connect(_connected)
 multiplayer.connection_failed.connect(_connection_failed)
 multiplayer.server_disconnected.connect(_server_lost)
 _network_buttons()

func _network_buttons() -> void:
 host_button.disabled = online
 join_button.disabled = online
 address.editable = not online
 leave_button.visible = online
 overlay.get_node("Menu/Avatar").visible = not online
 overlay.get_node("Menu/Start").visible = not online or multiplayer.is_server()
 overlay.get_node("Menu/Start").text = "INICIAR CARRERA" if online else "JUGAR EN SOLITARIO"

func _host() -> void:
 var peer := ENetMultiplayerPeer.new()
 var result := peer.create_server(PORT, MAX_PLAYERS - 1)
 if result != OK:
  net_status.text = "No se pudo abrir el puerto UDP %d. Error %d." % [PORT, result]
  return
 multiplayer.multiplayer_peer = peer
 online = true
 running = false
 roster = {1: _new_runner()}
 _network_buttons()
 _publish()

func _join() -> void:
 var peer := ENetMultiplayerPeer.new()
 var result := peer.create_client(address.text.strip_edges(), PORT)
 if result != OK:
  net_status.text = "Dirección inválida o error de conexión: %d" % result
  return
 multiplayer.multiplayer_peer = peer
 online = true
 running = false
 net_status.text = "Conectando…"
 _network_buttons()

func _connected() -> void:
 net_status.text = "Conectado. El anfitrión iniciará la carrera."

func _connection_failed() -> void:
 _leave()
 net_status.text = "No se pudo conectar. Revisa la IP, la red y el firewall."

func _server_lost() -> void:
 _leave()
 net_status.text = "El anfitrión se desconectó."

func _leave() -> void:
 multiplayer.multiplayer_peer.close()
 multiplayer.multiplayer_peer = OfflineMultiplayerPeer.new()
 online = false
 racing = false
 running = false
 roster.clear()
 view.clear()
 for ghost in ghosts.values():
  ghost.queue_free()
 ghosts.clear()
 player.visible = true
 player.position = Vector3.ZERO
 for obj in objects:
  obj.visible = true
 overlay.visible = true
 overlay.get_node("Menu/Title").text = "EN BUSCA DEL TESORO"
 overlay.get_node("Menu/Subtitle").text = "Selva 3D | 12 pistas bíblicas"
 net_status.text = ""
 notice.text = ""
 _network_buttons()

func _peer_joined(id: int) -> void:
 if not online or not multiplayer.is_server():
  return
 if racing or roster.size() >= MAX_PLAYERS:
  multiplayer.multiplayer_peer.disconnect_peer(id)
  return
 roster[id] = _new_runner()
 _publish()

func _peer_left(id: int) -> void:
 if online and multiplayer.is_server():
  roster.erase(id)
  if racing and _all_done():
   racing = false
  _publish()

func _new_runner() -> Dictionary:
 return {"lane": 1, "x": 0.0, "d": 0.0, "h": 0.0, "v": 0.0,
  "points": 0, "lives": 3, "attempts": 3, "clues": [], "hits": [],
  "done": false, "won": false, "message": "¡Recoge las luces doradas!",
  "last_input": -1000}

func _restart() -> void:
 if not online:
  super._restart()
  return
 if not multiplayer.is_server() or racing:
  return
 round_id += 1
 for id in roster.keys():
  roster[id] = _new_runner()
 racing = true
 _publish()

func _move_lane(dir: int) -> void:
 if online:
  _send_command(clampi(dir, -1, 1), false)
 else:
  super._move_lane(dir)

func _jump() -> void:
 if online:
  _send_command(0, true)
 else:
  super._jump()

func _send_command(dir: int, jumping: bool) -> void:
 if not racing:
  return
 if multiplayer.is_server():
  _accept_command(1, dir, jumping, round_id)
 else:
  command.rpc_id(1, dir, jumping, round_id)

@rpc("any_peer", "call_remote", "reliable")
func command(dir: int, jumping: bool, requested_round: int) -> void:
 if online and multiplayer.is_server():
  _accept_command(multiplayer.get_remote_sender_id(), dir, jumping, requested_round)

func _accept_command(id: int, dir: int, jumping: bool, requested_round: int) -> void:
 if not racing or requested_round != round_id or not roster.has(id) or abs(dir) > 1:
  return
 var state: Dictionary = roster[id]
 var now := Time.get_ticks_msec()
 if state["done"] or now - int(state["last_input"]) < 70:
  return
 state["last_input"] = now
 state["lane"] = clampi(int(state["lane"]) + dir, 0, 2)
 if jumping and float(state["h"]) <= 0.01:
  state["v"] = 8.0

func _physics_process(delta: float) -> void:
 if not online or not multiplayer.is_server():
  return
 if racing:
  for state in roster.values():
   _simulate(state, delta)
  if _all_done():
   racing = false
 net_clock += delta
 if net_clock >= 0.05:
  net_clock = 0.0
  _publish()

func _all_done() -> bool:
 for state in roster.values():
  if not state["done"]:
   return false
 return true

func _simulate(s: Dictionary, delta: float) -> void:
 if s["done"]:
  return
 s["d"] += SPEED * delta
 s["v"] -= 19.0 * delta
 s["h"] = maxf(0.0, float(s["h"]) + float(s["v"]) * delta)
 if float(s["h"]) <= 0:
  s["v"] = 0.0
 s["x"] = lerpf(float(s["x"]), LANES[int(s["lane"])], minf(1.0, delta * 12))
 for obj in objects:
  if absf(obj.position.z + float(s["d"])) >= 1.0 or absf(obj.position.x - float(s["x"])) >= 1.1:
   continue
  var kind := str(obj.get_meta("kind"))
  if kind == "clue":
   var idx := int(obj.get_meta("index"))
   if not s["clues"].has(idx):
    s["clues"].append(idx)
    s["points"] += int(VERSES[idx][3])
    s["message"] = "%s: %s (+%d)" % [VERSES[idx][0], VERSES[idx][1], VERSES[idx][3]]
  elif kind == "obstacle" and float(s["h"]) < 1.25:
   var idx := objects.find(obj)
   if not s["hits"].has(idx):
    s["hits"].append(idx)
    s["attempts"] -= 1
    s["message"] = "¡Tronco! Pierdes una oportunidad."
    if int(s["attempts"]) <= 0:
     s["lives"] -= 1
     s["attempts"] = 3
    if int(s["lives"]) <= 0:
     s["done"] = true
 if float(s["d"]) >= 278.0:
  s["done"] = true
  s["won"] = s["clues"].size() == 12
  s["message"] = "¡Tesoro encontrado!" if s["won"] else "Meta alcanzada: %d/12 frases." % s["clues"].size()

func _publish() -> void:
 snapshot.rpc(roster, racing, round_id)

@rpc("authority", "call_local", "unreliable_ordered", 1)
func snapshot(states: Dictionary, active: bool, current_round: int) -> void:
 if not online:
  return
 view = states.duplicate(true)
 racing = active
 round_id = current_round
 var my_id := multiplayer.get_unique_id()
 if not view.has(my_id):
  return
 var s: Dictionary = view[my_id]
 overlay.visible = not racing
 overlay.get_node("Menu/Start").text = "VOLVER A CORRER" if not racing and current_round > 0 else "INICIAR CARRERA"
 var board := "Jugadores: %d/%d | UDP %d" % [view.size(), MAX_PLAYERS, PORT]
 for id in view.keys():
  var entry: Dictionary = view[id]
  board += "\n%s: %d puntos · %d/12 frases%s" % ["Tú" if id == my_id else "Jugador %s" % id, entry["points"], entry["clues"].size(), " · Meta" if entry["done"] else ""]
 net_status.text = board
 hud.text = "VIDAS: %d | OPORTUNIDADES: %d | FRASES: %d/12 | PUNTOS: %d | JUGADORES: %d" % [s["lives"], s["attempts"], s["clues"].size(), s["points"], view.size()]
 notice.text = str(s["message"])
 if s["done"] and racing:
  notice.text += " · Esperando al resto…"
 for obj in objects:
  var kind := str(obj.get_meta("kind"))
  obj.visible = not s["clues"].has(int(obj.get_meta("index"))) if kind == "clue" else not s["hits"].has(objects.find(obj))
 for id in ghosts.keys():
  if not view.has(id):
   ghosts[id].queue_free()
   ghosts.erase(id)
 for id in view.keys():
  if id != my_id and not ghosts.has(id):
   var ghost := Node3D.new()
   add_child(ghost)
   _box(ghost, Vector3(0, 1.25, 0), Vector3(0.8, 1.2, 0.5), Color("35c8dc"))
   _ball(ghost, Vector3(0, 2.15, 0), 0.43, Color("c68d5d"))
   var tag := Label3D.new()
   tag.text = "Jugador %s" % id
   tag.position.y = 3.0
   tag.billboard = BaseMaterial3D.BILLBOARD_ENABLED
   ghost.add_child(tag)
   ghosts[id] = ghost

func _process(delta: float) -> void:
 if not online:
  super._process(delta)
  return
 var my_id := multiplayer.get_unique_id()
 for id in view.keys():
  var s: Dictionary = view[id]
  var target := Vector3(float(s["x"]), float(s["h"]), -float(s["d"]))
  var model: Node3D = player if id == my_id else ghosts.get(id)
  if model != null:
   model.position = model.position.lerp(target, minf(1.0, delta * 20))
 camera.position = camera.position.lerp(player.position + Vector3(0, 4.5, 8.5), minf(1.0, delta * 6))
 camera.look_at(player.position + Vector3(0, 1, -7))
