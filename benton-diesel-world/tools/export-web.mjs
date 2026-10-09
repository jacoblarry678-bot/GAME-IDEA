// Builds the park with the real Luau game code (in the mock engine) and
// exports everything the browser edition needs to web/public/park.json:
// static parts, signs, terrain, ride tracks + vehicles, guest figures,
// item models and the park config.
//   node tools/export-web.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRuntime, ROOT } from './harness.mjs';

const rt = await createRuntime({ quiet: true });
const L = (c) => rt.exec(c)[0];
L(`_G.__mock.runScript(game.ServerScriptService.BentonServer)`);
L(`local M=_G.__mock for i=1,30 do M.advance(0.1) end`);

const json = L(String.raw`
local M = _G.__mock
local HttpService = game:GetService("HttpService")
local Shared = game.ReplicatedStorage.BentonShared
local Config = require(Shared.Config)
local Items = require(Shared.Items)
local Props = require(Shared.Props)
local RideMotion = require(Shared.RideMotion)
local QueueLine = require(Shared.QueueLine)
local Staff = require(Shared.Staff)
local Clock = require(Shared.Clock)
local root = workspace.BentonDieselWorld

local materials, matIndex = {}, {}
local function mat(name)
  local i = matIndex[name]
  if not i then
    table.insert(materials, name)
    i = #materials - 1
    matIndex[name] = i
  end
  return i
end

local function shapeOf(p)
  if p:IsA("WedgePart") then return 1 end
  if p:FindFirstChildOfClass("SpecialMesh") then
    local mt = p:FindFirstChildOfClass("SpecialMesh").MeshType
    if mt == Enum.MeshType.Head then return 5 end
    return 4
  end
  if p:IsA("Part") then
    if p.Shape == Enum.PartType.Cylinder then return 2 end
    if p.Shape == Enum.PartType.Ball then return 3 end
  end
  return 0
end

local function rgb(c)
  return math.floor(c.R * 255 + 0.5) * 65536 + math.floor(c.G * 255 + 0.5) * 256 + math.floor(c.B * 255 + 0.5)
end

-- part record: shape, sx, sy, sz, 12 cframe comps, color, material, transparency, collide
local function rec(p, rel)
  local cf = if rel then rel * p.CFrame else p.CFrame
  local t = { shapeOf(p), p.Size.X, p.Size.Y, p.Size.Z }
  for _, v in { cf:GetComponents() } do table.insert(t, v) end
  table.insert(t, rgb(p.Color))
  table.insert(t, mat(p.Material.Name))
  table.insert(t, p.Transparency)
  table.insert(t, if p.CanCollide then 1 else 0)
  return t
end

local function partsOf(model, rel, skip)
  local out = {}
  for _, d in model:GetDescendants() do
    if d:IsA("BasePart") and d.Transparency < 0.98 and not (skip and skip[d]) then
      table.insert(out, rec(d, rel))
    end
  end
  return out
end

local function comps(cf) return { cf:GetComponents() } end
local function v3(v) return { v.X, v.Y, v.Z } end

-- dynamic models are exported separately
local dynamic = {}
local function markDynamic(model)
  for _, d in model:GetDescendants() do dynamic[d] = true end
  dynamic[model] = true
end
for _, rm in root.Rides:GetChildren() do
  markDynamic(rm.Cars)
  markDynamic(rm.Moving)
end
local globe = root:FindFirstChild("BentonGlobe", true)
markDynamic(globe)
-- other models that turn (windmill, gears, film reels, show cars, lighthouse lamp)
local spinnerModels = {}
for _, m in game:GetService("CollectionService"):GetTagged("Spinner") do
  if m ~= globe and m:IsDescendantOf(root) then
    markDynamic(m)
    table.insert(spinnerModels, m)
  end
end

-- static parts
local static, index = {}, {}
for _, d in root:GetDescendants() do
  if d:IsA("BasePart") and not dynamic[d] then
    if d.Transparency < 0.98 then
      table.insert(static, rec(d))
      index[d] = #static - 1
    end
  end
end

-- scenery the browser edition draws its own way: trees, bushes and ride
-- tracks keep their parts for collisions but are hidden from view
local CollectionService = game:GetService("CollectionService")
local hidden = {}
local function hide(inst)
  for _, d in inst:GetDescendants() do
    if index[d] ~= nil then table.insert(hidden, index[d]) end
  end
  if index[inst] ~= nil then table.insert(hidden, index[inst]) end
end
local trees = {}
for _, m in CollectionService:GetTagged("Tree") do
  if m:IsDescendantOf(root) then
    local leaf = nil
    for _, d in m:GetDescendants() do
      if d:IsA("BasePart") and d.Material == Enum.Material.Grass then leaf = d.Color break end
    end
    table.insert(trees, { kind = m:GetAttribute("TreeKind"), pos = v3(m:GetAttribute("Base")), s = m:GetAttribute("TreeScale"), leaf = leaf and rgb(leaf) or 0 })
    hide(m)
  end
end
-- staff figures (cashiers, operators, greeters, vendors): drawn as people
local staffSpots = {}
for _, m in CollectionService:GetTagged("StaffSpot") do
  if m:IsDescendantOf(root) then
    local feet = m:GetPivot() * CFrame.new(0, -Props.STAND_HEIGHT, 0)
    table.insert(staffSpots, { role = m:GetAttribute("Role"), land = m:GetAttribute("Land"), seed = m:GetAttribute("Seed"),
      ride = m:GetAttribute("RideId"), venue = m:GetAttribute("VenueId"), kind = m:GetAttribute("Kind"), cf = comps(feet) })
    hide(m)
  end
end
local bushes = {}
for _, b in CollectionService:GetTagged("Bush") do
  if b:IsDescendantOf(root) and index[b] ~= nil then
    table.insert(bushes, { pos = v3(b.Position), size = b.Size.X, color = rgb(b.Color) })
    hide(b)
  end
end

-- signs (SurfaceGui text)
local function fontName(f)
  local fam = tostring(f.Family)
  return fam:match("families/(%w+)%.json") or "GothamBold"
end
local function labelRec(l, y, h)
  local pad = l:FindFirstChildOfClass("UIPadding")
  return {
    text = l.Text,
    x = l.Position.X.Scale, y = y or l.Position.Y.Scale,
    w = l.Size.X.Scale, h = h or l.Size.Y.Scale,
    color = rgb(l.TextColor3),
    font = fontName(l.FontFace),
    align = l.TextXAlignment.Name,
    stroke = l:FindFirstChildOfClass("UIStroke") ~= nil,
    pad = if pad then pad.PaddingTop.Scale else 0,
  }
end
local signs = {}
local dynamicSigns = {}
for _, gui in root:GetDescendants() do
  if gui:IsA("SurfaceGui") and gui.Parent and gui.Parent:IsA("BasePart") and index[gui.Parent] ~= nil then
    local part = gui.Parent
    local entry = { part = index[part], face = gui.Face.Name, glow = gui.LightInfluence < 0.1, labels = {} }
    if gui:FindFirstChild("Wait") then
      local model = part:FindFirstAncestorOfClass("Model")
      while model and not model:GetAttribute("RideId") do model = model.Parent and model.Parent:FindFirstAncestorOfClass("Model") end
      table.insert(dynamicSigns, { kind = "wait", ride = model and model:GetAttribute("RideId"), part = index[part], face = gui.Face.Name })
    elseif gui:FindFirstChild("DieselThunder") then
      table.insert(dynamicSigns, { kind = "board", part = index[part], face = gui.Face.Name })
    else
      local list = gui:FindFirstChildOfClass("UIListLayout")
      local y = 0
      local kids = gui:GetChildren()
      for _, l in kids do
        if l:IsA("TextLabel") then
          if list then
            table.insert(entry.labels, labelRec(l, y, l.Size.Y.Scale))
            y += l.Size.Y.Scale + 0.02
          else
            table.insert(entry.labels, labelRec(l))
          end
        end
      end
      if #entry.labels > 0 then table.insert(signs, entry) end
    end
  end
end

-- terrain
local terrain = {}
for _, op in M.terrainOps do
  local kind = op[1]
  if kind == "block" then
    table.insert(terrain, { kind = kind, cf = comps(op[2]), size = v3(op[3]), material = op[4] })
  elseif kind == "ball" then
    table.insert(terrain, { kind = kind, center = v3(op[2]), radius = op[3], material = op[4] })
  elseif kind == "cylinder" then
    table.insert(terrain, { kind = kind, cf = comps(op[2]), height = op[3], radius = op[4], material = op[5] })
  end
end

-- rides
local rides = {}
for _, ride in Config.Rides do
  local m = RideMotion.get(ride.id)
  local model = root.Rides[ride.id]
  local r = {
    id = ride.id, kind = ride.kind, duration = m.duration, capacity = m.capacity, carCount = m.carCount,
    carSpacing = ride.carSpacing or 8, origin = comps(m.originCF), extrasNames = m.extras, seats = {}, cars = {}, extras = {},
  }
  for c = 1, m.carCount do
    local list = {}
    for _, s in m.seats[c] do table.insert(list, comps(s)) end
    r.seats[c] = list
    local car = model.Cars["Car" .. c]
    local pivot = car:GetPivot()
    -- lap bars and harnesses are drawn (and moved) by the browser itself
    local skip = {}
    for _, d in car:GetDescendants() do
      if d.Name == "Restraint" then skip[d] = true end
    end
    r.cars[c] = { pivot = comps(pivot), parts = partsOf(car, pivot:Inverse(), skip) }
  end
  for _, ex in model.Moving:GetChildren() do
    local pivot = ex:GetPivot()
    r.extras[ex.Name] = { pivot = comps(pivot), parts = partsOf(ex, pivot:Inverse()) }
  end
  for _, f in model:GetChildren() do
    local style = f:IsA("Folder") and f:GetAttribute("Style")
    if style then
      local a = f:GetAttributes()
      r.trackStyle = { style = style, color = a.Color and rgb(a.Color), width = a.Width, drop = a.Drop, dash = a.Dash and rgb(a.Dash), curbs = a.Curbs }
      hide(f)
    end
  end
  if m.sampler then
    local s = m.sampler
    local pos, tan, up = {}, {}, {}
    for i = 1, s.count do
      local p, t, u = s.positions[i], s.tangents[i], s.ups[i]
      table.insert(pos, p.X) table.insert(pos, p.Y) table.insert(pos, p.Z)
      table.insert(tan, t.X) table.insert(tan, t.Y) table.insert(tan, t.Z)
      table.insert(up, u.X) table.insert(up, u.Y) table.insert(up, u.Z)
    end
    r.track = { length = s.length, cum = s.cum, pos = pos, tan = tan, up = up, times = m.timing.times }
  end
  local crew = Staff.crew(ride.id)
  if crew then
    local list = function(cfs) local out = {} for _, cf in cfs do table.insert(out, comps(cf)) end return out end
    r.crew = { restraint = crew.restraint, console = comps(crew.console), operator = comps(crew.operator), stops = list(crew.stops),
      stopCars = crew.stopCars, homes = list(crew.homes), exit = comps(crew.exit), attendants = crew.attendants,
      routes = { Staff.route(crew, 1), Staff.route(crew, 2) } }
  end
  local line = QueueLine.get(ride.id)
  if line then
    local pts = {}
    for _, p in line.points do table.insert(pts, p.X) table.insert(pts, p.Z) end
    r.queue = { points = pts, cum = line.cum, length = line.length, signAt = line.signAt,
      gate = { line.gate.X, line.gate.Z }, gateDir = { line.gateDir.X, line.gateDir.Z }, outward = { line.outward.X, line.outward.Z },
      maze = comps(line.mazeCFrame), mazeSize = { line.mazeSize.X, line.mazeSize.Z } }
  end
  table.insert(rides, r)
end

-- globe
local gpivot = globe:GetPivot()
local globeRec = { pivot = comps(gpivot), parts = partsOf(globe, gpivot:Inverse()) }

-- spinners
local spinners = {}
for _, m in spinnerModels do
  local pivot = m:GetPivot()
  table.insert(spinners, { name = m.Name, pivot = comps(pivot), parts = partsOf(m, pivot:Inverse()),
    speed = m:GetAttribute("SpinSpeed") or 0.5, axis = m:GetAttribute("SpinAxis") or "Y" })
end

-- guest figures
local guests = {}
for seed = 1, 24 do
  for _, pose in { "sit", "stand", "cheer" } do
    local g = Props.guest(seed * 7919, pose)
    local pivot = g:GetPivot()
    table.insert(guests, { seed = seed, pose = pose, parts = partsOf(g, pivot:Inverse()) })
    g:Destroy()
  end
end

-- items
local items = {}
for _, item in Items.List do
  local e = { id = item.id }
  local preview = Props.preview(item)
  local pv = preview:GetPivot()
  e.preview = partsOf(preview, pv:Inverse())
  if item.kind == "hat" or item.kind == "face" then
    local hm = Props.hatModel(item, CFrame.new())
    e.wear = partsOf(hm, nil)
    hm:Destroy()
  elseif item.kind == "balloon" then
    local b = Props.balloon(item)
    local bp = b:GetPivot()
    e.wear = partsOf(b, bp:Inverse())
    b:Destroy()
  elseif item.kind == "held" or item.kind == "food" then
    local tool = Props.tool(item)
    local h = tool.Handle
    e.wear = partsOf(tool, h.CFrame:Inverse())
    tool:Destroy()
  end
  preview:Destroy()
  table.insert(items, e)
end

-- tagged scenery used by shows and lighting
local tags = { StageLight = {}, LakeFountain = {}, StuntFirePot = {}, ParkLamp = {}, SteamVent = {}, Campfire = {}, Searchlight = {}, Lighthouse = {} }
for tag, list in tags do
  for _, inst in game:GetService("CollectionService"):GetTagged(tag) do
    if inst:IsDescendantOf(root) then table.insert(list, comps(inst.CFrame)) end
  end
end

-- config (generic serializer)
local function ser(v, depth)
  depth = depth or 0
  local t = typeof(v)
  if t == "Vector3" then return v3(v)
  elseif t == "Color3" then return rgb(v)
  elseif t == "CFrame" then return comps(v)
  elseif t == "table" then
    local out = {}
    for k, x in v do out[k] = ser(x, depth + 1) end
    return out
  elseif t == "EnumItem" then return v.Name
  end
  return v
end
local config = {
  ParkName = Config.ParkName, Currency = Config.Currency, CurrencyShort = Config.CurrencyShort,
  Bounds = Config.Bounds, Spawn = v3(Config.Spawn), Colors = ser(Config.Colors), Economy = Config.Economy, Hunger = Config.Hunger,
  Lands = ser(Config.Lands), Rides = ser(Config.Rides), Shows = ser(Config.Shows), Venues = ser(Config.Venues), Items = ser(Items.List),
  BoardingTime = Config.BoardingTime, UnloadTime = Config.UnloadTime,
  Clock = { DAY_START = Clock.DAY_START, DAY_END = Clock.DAY_END, NIGHT_SPEED = Clock.NIGHT_SPEED, OPEN = Clock.OPEN, CLOSE = Clock.CLOSE },
}

return HttpService:JSONEncode({
  materials = materials, static = static, signs = signs, dynamicSigns = dynamicSigns, terrain = terrain,
  rides = rides, queue = { spacing = QueueLine.SPACING, lane = QueueLine.LANE }, globe = globeRec, spinners = spinners, trees = trees, bushes = bushes, hidden = hidden, staffSpots = staffSpots,
  staff = { lines = Staff.LINES, pullBy = Staff.PULL_BY, checkFrom = Staff.CHECK_FROM, allClear = Staff.ALL_CLEAR, dispatch = Staff.DISPATCH,
    walk = Staff.WALK, checkTime = Staff.CHECK_TIME, pants = rgb(Staff.PANTS), cap = rgb(Staff.CAP) }, guests = guests, items = items, tags = tags, config = config,
})
`);

const errors = rt.logs.filter((l) => l.kind === 'error');
if (errors.length) {
  console.error(errors.map((e) => e.msg).join('\n'));
  process.exit(1);
}
// round numbers to keep the file small
const data = JSON.parse(json);
const out = JSON.stringify(data, (k, v) => (typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1000) / 1000 : v));
const dir = path.join(ROOT, 'web', 'public');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'park.json'), out);
console.log(`park.json: ${(out.length / 1e6).toFixed(2)} MB, ${data.static.length} static parts, ${data.signs.length} signs, ${data.rides.length} rides, ${data.guests.length} guest figures, ${data.items.length} items`);
