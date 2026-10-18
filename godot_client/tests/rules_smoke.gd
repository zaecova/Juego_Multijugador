extends SceneTree

func _initialize() -> void:
 run.call_deferred()

func run() -> void:
 var game = load("res://scenes/main.tscn").instantiate()
 root.add_child(game)
 var s: Dictionary = game._new_runner()
 # Pick clue 6 first: collection is independent of order and idempotent.
 s["lane"] = 2
 s["x"] = 3.0
 s["d"] = 60.0
 game._simulate(s, 0.0)
 assert(s["clues"].has(2))
 var score := int(s["points"])
 game._simulate(s, 0.0)
 assert(s["points"] == score)
 # Grounded obstacle costs exactly one attempt.
 s["lane"] = 1
 s["x"] = 0.0
 s["d"] = 26.0
 game._simulate(s, 0.0)
 assert(s["attempts"] == 2)
 game._simulate(s, 0.0)
 assert(s["attempts"] == 2)
 # Jumping clears another obstacle.
 s["lane"] = 2
 s["x"] = 3.0
 s["d"] = 47.0
 s["h"] = 1.5
 game._simulate(s, 0.0)
 assert(s["attempts"] == 2)
 # A missed clue no longer prevents ending the round.
 s["d"] = 278.0
 game._simulate(s, 0.0)
 assert(s["done"] and not s["won"])
 var winner: Dictionary = game._new_runner()
 winner["clues"] = range(12)
 winner["d"] = 278.0
 game._simulate(winner, 0.0)
 assert(winner["done"] and winner["won"])
 game.online = true
 game.racing = true
 game.round_id = 2
 game.roster = {1: game._new_runner()}
 game._accept_command(1, 1, false, 1)
 assert(game.roster[1]["lane"] == 1)
 game._accept_command(1, 100, false, 2)
 assert(game.roster[1]["lane"] == 1)
 game._accept_command(1, 1, false, 2)
 assert(game.roster[1]["lane"] == 2)
 print("RULES_SMOKE PASS")
 quit()
