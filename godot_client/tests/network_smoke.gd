extends SceneTree

var game: Node
var elapsed := 0.0
var started := false
var moved := false
var is_host := false
var connected_seen := false
var result_reported := false

func _initialize() -> void:
 is_host = OS.get_cmdline_user_args().has("host")
 game = load("res://scenes/main.tscn").instantiate()
 root.add_child.call_deferred(game)
 setup.call_deferred()

func setup() -> void:
 if is_host:
  game._host()
 else:
  game.address.text = "127.0.0.1"
  game._join()

func _process(delta: float) -> bool:
 elapsed += delta
 if is_host and game.roster.size() == 2:
  connected_seen = true
  if not started:
   game._restart()
   started = true
 if not is_host and game.view.size() == 2:
  connected_seen = true
  if game.racing and not moved:
   game._move_lane(1)
   moved = true
 if result_reported:
  if elapsed > 8.0:
   game._leave()
   quit()
  return false
 if elapsed > 6.0:
  var success := connected_seen
  if is_host:
   success = success and started
   for id in game.roster:
    var s: Dictionary = game.roster[id]
    success = success and float(s["d"]) > 20.0
    if id != 1:
     success = success and s["lane"] == 2
  else:
   success = success and moved and game.view.has(game.multiplayer.get_unique_id())
   if success:
    success = float(game.view[game.multiplayer.get_unique_id()]["d"]) > 20.0
  print("NETWORK_SMOKE ", "HOST" if is_host else "CLIENT", " PASS" if success else " FAIL")
  if is_host and success:
   result_reported = true
  else:
   game._leave()
   quit(0 if success else 1)
 return false
