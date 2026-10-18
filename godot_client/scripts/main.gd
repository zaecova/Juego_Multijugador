extends Node3D

# Prototype local: runner 3D, 12 clues, obstacles, 3 lives x 3 attempts.
# Multiplayer is a later server-authoritative milestone, not simulated here.
const VERSES = [
 ["Salmos 119:105", "Lampara es a mis pies tu palabra", "Sigue la luz", 100],
 ["Josue 1:9", "Esfuerzate y se valiente", "Cruza el puente", 150],
 ["Salmos 23:1", "Jehova es mi pastor", "Busca la cascada", 200],
 ["Filipenses 4:13", "Todo lo puedo en Cristo", "Sube la montana", 250],
 ["Proverbios 3:5", "Confia en Jehova", "Gira a la derecha", 300],
 ["Salmos 46:1", "Dios es nuestro amparo", "Busca la cueva", 350],
 ["Mateo 5:14", "Sois la luz del mundo", "Sigue el brillo", 400],
 ["Juan 14:6", "Yo soy el camino", "Sigue las huellas", 450],
 ["Salmos 37:5", "Encomienda tu camino", "Cruza el rio", 500],
 ["1 Juan 4:8", "Dios es amor", "Busca el arbol", 550],
 ["Romanos 8:39", "Nada nos separara del amor de Dios", "Abre la puerta", 600],
 ["Jeremias 31:3", "Con amor eterno te he amado", "Encuentra el tesoro", 1000]
]
const SPEED = 9.0
const LANES = [-3.0, 0.0, 3.0]
var lane := 1
var lives := 3
var attempts := 3
var points := 0
var found := 0
var running := false
var finished := false
var distance := 0.0
var jump_velocity := 0.0
var jump_height := 0.0
var objects: Array[Node3D] = []
var player: Node3D
var camera: Camera3D
var hud: Label
var notice: Label
var overlay: PanelContainer
var avatar_choice := 0
var last_hit := -100.0

func _ready() -> void:
 _build_world()
 _build_ui()
 _show_menu()

func _box(parent: Node3D, pos: Vector3, scale3: Vector3, color: Color) -> MeshInstance3D:
 var node := MeshInstance3D.new()
 var mesh := BoxMesh.new()
 mesh.size = scale3
 node.mesh = mesh
 var mat := StandardMaterial3D.new()
 mat.albedo_color = color
 node.material_override = mat
 node.position = pos
 parent.add_child(node)
 return node

func _ball(parent: Node3D, pos: Vector3, radius: float, color: Color, glow := false) -> MeshInstance3D:
 var node := MeshInstance3D.new()
 var mesh := SphereMesh.new()
 mesh.radius = radius
 mesh.height = radius * 2.0
 node.mesh = mesh
 var mat := StandardMaterial3D.new()
 mat.albedo_color = color
 if glow:
  mat.emission_enabled = true
  mat.emission = color
  mat.emission_energy_multiplier = 2.0
 node.material_override = mat
 node.position = pos
 parent.add_child(node)
 return node

func _build_world() -> void:
 var env := WorldEnvironment.new()
 env.environment = Environment.new()
 env.environment.background_mode = Environment.BG_COLOR
 env.environment.background_color = Color("8bd1de")
 add_child(env)
 var light := DirectionalLight3D.new()
 light.rotation_degrees = Vector3(-48, -25, 0)
 light.light_energy = 1.4
 add_child(light)
 _box(self, Vector3(0,-0.25,-80), Vector3(11,0.5,400), Color("b38b52"))
 for x in [-5.6,5.6]:
  _box(self, Vector3(x,0,-80), Vector3(0.35,0.5,400), Color("3e793d"))
 var rng := RandomNumberGenerator.new()
 rng.seed = 12345
 for i in range(140):
  var z := 15.0 - float(i) * 2.2
  for side in [-1,1]:
   var x := float(side) * rng.randf_range(7.0,17.0)
   var trunk := _box(self, Vector3(x,1.4,z), Vector3(0.55,2.8,0.55), Color("78502c"))
   _ball(self, Vector3(x,3.4,z), rng.randf_range(1.5,2.5), Color("267e41"))
 player = Node3D.new()
 add_child(player)
 _make_avatar()
 camera = Camera3D.new()
 camera.current = true
 camera.fov = 70.0
 add_child(camera)
 for i in range(12):
  var z := -18.0 - float(i)*21.0
  var clue := Node3D.new()
  clue.set_meta("kind", "clue")
  clue.set_meta("index", i)
  clue.position = Vector3(LANES[i%3], 1.1, z)
  add_child(clue)
  _ball(clue, Vector3.ZERO, 0.65, Color("ffda4a"), true)
  _box(clue, Vector3(0,0,0), Vector3(0.7,0.9,0.15), Color("fff3bf"))
  objects.append(clue)
  var obstacle := Node3D.new()
  obstacle.set_meta("kind", "obstacle")
  obstacle.position = Vector3(LANES[(i+1)%3], 0.65, z-8.0)
  add_child(obstacle)
  _box(obstacle, Vector3.ZERO, Vector3(1.8,1.3,1.2), Color("85502c"))
  objects.append(obstacle)
 var treasure := Node3D.new()
 treasure.set_meta("kind", "treasure")
 treasure.position = Vector3(0,0,-278)
 add_child(treasure)
 _box(treasure, Vector3(0,0.6,0), Vector3(3.0,1.2,2.2), Color("b88737"))
 _box(treasure, Vector3(0,1.5,0), Vector3(2.2,0.3,1.5), Color("ffe3a0"))
 _ball(treasure, Vector3(0,2.7,0), 1.1, Color("ffe87b"), true)
 objects.append(treasure)

func _make_avatar() -> void:
 for child in player.get_children():
  child.queue_free()
 var shirt := Color("e66c9c") if avatar_choice == 0 else Color("2777cc")
 _box(player, Vector3(0,1.25,0), Vector3(0.8,1.2,0.5), shirt)
 _ball(player, Vector3(0,2.15,0), 0.43, Color("c68d5d"))
 _box(player, Vector3(-0.23,0.4,0), Vector3(0.28,0.8,0.32), Color("343b60"))
 _box(player, Vector3(0.23,0.4,0), Vector3(0.28,0.8,0.32), Color("343b60"))
 _box(player, Vector3(0,1.5,0.42), Vector3(0.65,0.8,0.3), Color("7d6d36"))

func _build_ui() -> void:
 var ui := CanvasLayer.new()
 add_child(ui)
 hud = Label.new()
 hud.position = Vector2(20,15)
 hud.add_theme_font_size_override("font_size", 23)
 ui.add_child(hud)
 notice = Label.new()
 notice.position = Vector2(20,65)
 notice.add_theme_font_size_override("font_size", 24)
 notice.add_theme_color_override("font_color", Color("ffe16a"))
 ui.add_child(notice)
 overlay = PanelContainer.new()
 overlay.set_anchors_preset(Control.PRESET_CENTER)
 overlay.position = Vector2(390,150)
 overlay.custom_minimum_size = Vector2(500,300)
 ui.add_child(overlay)
 var panel := VBoxContainer.new()
 panel.name = "Menu"
 overlay.add_child(panel)
 var title := Label.new()
 title.name = "Title"
 title.text = "EN BUSCA DEL TESORO"
 title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
 title.add_theme_font_size_override("font_size", 30)
 panel.add_child(title)
 var subtitle := Label.new()
 subtitle.name = "Subtitle"
 subtitle.text = "Selva 3D | 12 pistas biblicas | 3 vidas"
 subtitle.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
 panel.add_child(subtitle)
 var avatar := Button.new()
 avatar.name = "Avatar"
 avatar.text = "Avatar: Exploradora (cambiar)"
 avatar.pressed.connect(_change_avatar)
 panel.add_child(avatar)
 var start := Button.new()
 start.name = "Start"
 start.text = "INICIAR AVENTURA"
 start.pressed.connect(_restart)
 panel.add_child(start)
 var instructions := Label.new()
 instructions.text = "Flechas/A-D: cambiar carril | Espacio: saltar\nRecoge las 12 luces doradas y llega a la Biblia.\nEvita los troncos. Cada vida tiene 3 oportunidades."
 instructions.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
 panel.add_child(instructions)
 var mobile := HBoxContainer.new()
 mobile.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
 mobile.position = Vector2(20,610)
 ui.add_child(mobile)
 for item in [["◀",-1],["SALTAR",0],["▶",1]]:
  var b := Button.new()
  b.text = item[0]
  b.custom_minimum_size = Vector2(115,65)
  if item[1] == 0:
   b.pressed.connect(_jump)
  else:
   b.pressed.connect(_move_lane.bind(item[1]))
  mobile.add_child(b)

func _show_menu() -> void:
 running = false
 overlay.visible = true
 _update_hud()

func _change_avatar() -> void:
 avatar_choice = 1-avatar_choice
 _make_avatar()
 overlay.get_node("Menu/Avatar").text = "Avatar: " + ("Exploradora" if avatar_choice == 0 else "Explorador") + " (cambiar)"

func _restart() -> void:
 lane = 1
 lives = 3
 attempts = 3
 points = 0
 found = 0
 distance = 0
 jump_height = 0
 jump_velocity = 0
 last_hit = -100
 finished = false
 player.position = Vector3.ZERO
 for obj in objects:
  obj.visible = true
 overlay.visible = false
 notice.text = "¡Encuentra las 12 frases!"
 running = true
 _update_hud()

func _move_lane(dir: int) -> void:
 if running:
  lane = clampi(lane+dir,0,2)

func _jump() -> void:
 if running and jump_height <= 0.01:
  jump_velocity = 8.0

func _unhandled_key_input(event: InputEvent) -> void:
 if event is InputEventKey and event.pressed and not event.echo:
  if event.keycode in [KEY_LEFT,KEY_A]:
   _move_lane(-1)
  elif event.keycode in [KEY_RIGHT,KEY_D]:
   _move_lane(1)
  elif event.keycode in [KEY_SPACE,KEY_UP,KEY_W]:
   _jump()

func _process(delta: float) -> void:
 if not running:
  camera.position = camera.position.lerp(Vector3(0,5,9), minf(1,delta*3))
  camera.look_at(Vector3(0,1,-8))
  return
 distance += SPEED*delta
 jump_velocity -= 19.0*delta
 jump_height = maxf(0.0,jump_height+jump_velocity*delta)
 if jump_height <= 0:
  jump_velocity = 0
 player.position.x = lerpf(player.position.x, LANES[lane], minf(1,delta*12))
 player.position.y = jump_height
 player.position.z = -distance
 camera.position = camera.position.lerp(player.position+Vector3(0,4.5,8.5),minf(1,delta*6))
 camera.look_at(player.position+Vector3(0,1,-7))
 for obj in objects:
  if not obj.visible:
   continue
  if absf(obj.position.z-player.position.z) < 1.0 and absf(obj.position.x-player.position.x) < 1.1:
   match str(obj.get_meta("kind")):
    "clue":
     var idx: int = obj.get_meta("index")
     if idx == found:
      found += 1
      points += int(VERSES[idx][3])
      notice.text = "%s: %s | +%d | %s" % [VERSES[idx][0],VERSES[idx][1],VERSES[idx][3],VERSES[idx][2]]
      obj.visible = false
      _update_hud()
    "obstacle":
     if jump_height < 1.25 and distance-last_hit > 1.5:
      last_hit = distance
      attempts -= 1
      notice.text = "¡Obstaculo! Pierdes una oportunidad."
      obj.visible = false
      if attempts <= 0:
       lives -= 1
       attempts = 3
      if lives <= 0:
       _finish(false)
      _update_hud()
    "treasure":
     if found == 12:
      _finish(true)
     else:
      notice.text = "Necesitas las 12 frases. Reinicia para intentar de nuevo."
      _finish(false)
 if distance > 290 and running:
  _finish(false)

func _update_hud() -> void:
 hud.text = "VIDAS: %d  |  OPORTUNIDADES: %d  |  FRASES: %d/12  |  PUNTOS: %d" % [lives,attempts,found,points]

func _finish(won: bool) -> void:
 running = false
 finished = true
 overlay.visible = true
 overlay.get_node("Menu/Title").text = "¡TESORO ENCONTRADO!" if won else "FIN DE LA AVENTURA"
 overlay.get_node("Menu/Subtitle").text = ("Con amor eterno te he amado. - Jeremias 31:3" if won else "Recolectaste %d de 12 frases." % found)
 overlay.get_node("Menu/Start").text = "VOLVER A JUGAR"
