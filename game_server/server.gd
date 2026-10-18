extends Node

const DEFAULT_PORT := 2456
const MAX_CLIENTS := 32
const LANES := [-1, 0, 1]
const TRACK_LENGTH := 500.0
const OBSTACLE_SPACING := 12.0
const TICK_RATE := 10.0

var players: Dictionary = {}
var obstacles: Array[Dictionary] = []
var elapsed := 0.0
var next_obstacle_at := 10.0
var tick_accumulator := 0.0
var rng := RandomNumberGenerator.new()


func _ready() -> void:
	var port := int(OS.get_environment("GAME_PORT")) if OS.get_environment("GAME_PORT") != "" else DEFAULT_PORT
	var peer := ENetMultiplayerPeer.new()
	var error := peer.create_server(port, MAX_CLIENTS)
	if error != OK:
		push_error("No se pudo abrir ENet en UDP %d: %s" % [port, error_string(error)])
		get_tree().quit(1)
		return
	multiplayer.multiplayer_peer = peer
	multiplayer.peer_connected.connect(_on_peer_connected)
	multiplayer.peer_disconnected.connect(_on_peer_disconnected)
	rng.randomize()
	print("Servidor autoritativo ENet escuchando en UDP %d" % port)


func _physics_process(delta: float) -> void:
	elapsed += delta
	tick_accumulator += delta
	while elapsed >= next_obstacle_at:
		obstacles.append({"lane": LANES[rng.randi_range(0, 2)], "z": TRACK_LENGTH})
		next_obstacle_at += OBSTACLE_SPACING
	for obstacle in obstacles:
		obstacle.z -= 8.0 * delta
	for peer_id in players.keys():
		var player: Dictionary = players[peer_id]
		player.distance += 8.0 * delta
		player.jump_left = maxf(0.0, player.jump_left - delta)
		for obstacle in obstacles:
			if obstacle.lane == player.lane and absf(obstacle.z - player.distance) < 1.2 and player.jump_left <= 0.0:
				player.lives -= 1
				player.distance += 3.0
				if player.lives <= 0:
					player.finished = true
	if tick_accumulator >= 1.0 / TICK_RATE:
		tick_accumulator = 0.0
		_broadcast_state()
	obstacles = obstacles.filter(func(item: Dictionary) -> bool: return item.z > 0.0)


func _on_peer_connected(peer_id: int) -> void:
	players[peer_id] = {"lane": 0, "jump_left": 0.0, "distance": 0.0, "lives": 3, "finished": false, "last_action": 0.0}
	print("Jugador conectado: %d" % peer_id)
	_broadcast_state()


func _on_peer_disconnected(peer_id: int) -> void:
	players.erase(peer_id)
	print("Jugador desconectado: %d" % peer_id)
	_broadcast_state()


@rpc("any_peer", "call_remote", "reliable")
func submit_action(action: String) -> void:
	var peer_id := multiplayer.get_remote_sender_id()
	if not players.has(peer_id):
		return
	var player: Dictionary = players[peer_id]
	var now := Time.get_ticks_msec() / 1000.0
	if player.finished or now - player.last_action < 0.08:
		return
	player.last_action = now
	match action:
		"left":
			player.lane = maxi(-1, player.lane - 1)
		"right":
			player.lane = mini(1, player.lane + 1)
		"jump":
			player.jump_left = 0.7
		_:
			return
	players[peer_id] = player


func _broadcast_state() -> void:
	var snapshot := {"players": players, "elapsed": elapsed}
	_sync_state.rpc(snapshot)


@rpc("authority", "call_remote", "unreliable")
func _sync_state(_snapshot: Dictionary) -> void:
	pass
