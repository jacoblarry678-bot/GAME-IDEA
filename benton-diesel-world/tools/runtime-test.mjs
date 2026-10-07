// Runs the real server and client scripts headlessly against the mock
// engine and plays through a guest's day: build the park, join, queue for a
// ride, ride it, buy a souvenir and a meal, watch a show.
//   npm test            (or: node tools/runtime-test.mjs [--dump])
import fs from 'node:fs';
import path from 'node:path';
import { createRuntime, ROOT } from './harness.mjs';

const dump = process.argv.includes('--dump');
const rt = await createRuntime({ quiet: true });
let failed = false;

function lua(code, name = '=test') {
  return rt.exec(code, name);
}
function step(seconds, frame = 1 / 10) {
  // advance virtual time, rendering frames for client code
  lua(`
    local M = _G.__mock
    local remaining = ${seconds}
    while remaining > 0 do
      local dt = math.min(${frame}, remaining)
      M.advance(dt)
      M.frame(dt)
      remaining -= dt
    end
  `);
}
function check(label, code) {
  const [pok, ok, detail] = lua(`return pcall(function() ${code} end)`);
  if (!pok) {
    console.log(`FAIL  ${label}  (error: ${String(ok).split('\n')[0]})`);
    failed = true;
    return;
  }
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  (' + detail + ')' : ''}`);
  if (!ok) failed = true;
}

console.log('== booting server');
let t = Date.now();
lua(`
  local M = _G.__mock
  local server = game:GetService("ServerScriptService"):FindFirstChild("BentonServer")
  M.runScript(server)
`);
step(3);
console.log(`   server boot took ${Date.now() - t} ms real time`);

check('park built', `
  local root = workspace:FindFirstChild("BentonDieselWorld")
  if not root then return false, "no BentonDieselWorld" end
  local parts = 0
  for _, d in root:GetDescendants() do if d:IsA("BasePart") then parts += 1 end end
  return parts > 5000, parts .. " parts"
`);
check('all rides built with cars', `
  local Config = require(game.ReplicatedStorage.BentonShared.Config)
  local rides = workspace.BentonDieselWorld.Rides
  for _, ride in Config.Rides do
    local m = rides:FindFirstChild(ride.id)
    if not m then return false, "missing " .. ride.id end
    if #m.Cars:GetChildren() == 0 then return false, "no cars " .. ride.id end
  end
  return true, #Config.Rides .. " rides"
`);
check('ride state published', `
  local f = game.ReplicatedStorage.BentonState.Rides.DieselThunder
  return f:GetAttribute("Wait") ~= nil and f:GetAttribute("Duration") > 0, "wait " .. tostring(f:GetAttribute("Wait"))
`);

const hasClient = fs.existsSync(path.join(ROOT, 'src', 'client'));
console.log('== player joins');
lua(`
  local M = _G.__mock
  local p = M.addPlayer("TestGuest", 1234)
  p:LoadCharacter()
`);
if (hasClient) {
  lua(`
    local M = _G.__mock
    local p = M.localPlayer
    local client = game.StarterPlayer.StarterPlayerScripts:FindFirstChild("BentonClient"):Clone()
    client.Parent = p.PlayerScripts
    M.runScript(client)
  `);
}
step(8);
check('profile loaded', `
  local p = game.Players.TestGuest
  return p:GetAttribute("DataReady") == true and p:GetAttribute("Bucks") ~= nil, "bucks " .. tostring(p:GetAttribute("Bucks"))
`);

console.log('== queue for Little Haulers Truck Trek');
lua(`
  local p = game.Players.TestGuest
  local prompt = workspace.BentonDieselWorld.Rides.TruckTrek.Queue.QueuePoint.JoinPrompt
  _G.__mock.getSignal(prompt, "Triggered"):Fire(p)
`);
step(1);
check('player is in line', `
  local p = game.Players.TestGuest
  return p:GetAttribute("QueueRide") == "TruckTrek", "pos " .. tostring(p:GetAttribute("QueuePos")) .. " eta " .. tostring(p:GetAttribute("QueueEta"))
`);
const before = lua('return game.Players.TestGuest:GetAttribute("Bucks")')[0];
let boarded = false;
for (let i = 0; i < 200 && !boarded; i++) {
  step(1);
  boarded = lua('return game.Players.TestGuest:GetAttribute("Riding") == "TruckTrek"')[0];
}
check('player boarded', `return ${boarded}, nil`);
check('rider anchored in seat', `
  local root = game.Players.TestGuest.Character.HumanoidRootPart
  return root.Anchored == true, tostring(root.Position)
`);
let off = false;
for (let i = 0; i < 120 && !off; i++) {
  step(1);
  off = lua('return game.Players.TestGuest:GetAttribute("Riding") == ""')[0];
}
step(1);
check('rider released and rewarded', `
  local p = game.Players.TestGuest
  local root = p.Character.HumanoidRootPart
  return root.Anchored == false and p:GetAttribute("Bucks") > ${before}, "bucks ${before} -> " .. p:GetAttribute("Bucks")
`);

console.log('== shopping and dining');
lua(`
  local p = game.Players.TestGuest
  p.Character:PivotTo(CFrame.new(-30, 4, 170))
  local action = game.ReplicatedStorage.BentonRemotes.Action
  action:FireServer({ type = "Buy", venue = "Emporium", item = "GearEars" })
`);
step(1);
lua(`
  local p = game.Players.TestGuest
  p.Character:PivotTo(CFrame.new(30, 4, 170))
  game.ReplicatedStorage.BentonRemotes.Action:FireServer({ type = "Buy", venue = "Bakery", item = "Coffee" })
`);
step(1);
check('hat bought and worn', `
  local p = game.Players.TestGuest
  local acc = p.Character:FindFirstChild("GearEars")
  return acc ~= nil, if acc then "wearing" else "not wearing"
`);
check('food in backpack', `
  local p = game.Players.TestGuest
  for _, t in p.Backpack:GetChildren() do if t:GetAttribute("ItemId") == "Coffee" then return true, t.Name end end
  return false, "no coffee"
`);
lua(`
  local p = game.Players.TestGuest
  local tool
  for _, t in p.Backpack:GetChildren() do if t:GetAttribute("ItemId") == "Coffee" then tool = t end end
  p:SetAttribute("Hunger", 50)
  tool.Parent = p.Character
  _G.__mock.getSignal(tool, "Activated"):Fire()
`);
step(2);
check('eating restores hunger and boosts speed', `
  local p = game.Players.TestGuest
  local hum = p.Character.Humanoid
  return p:GetAttribute("Hunger") > 50 and hum.WalkSpeed > 18, "hunger " .. p:GetAttribute("Hunger") .. " speed " .. hum.WalkSpeed
`);

console.log('== shows');
lua(`
  local p = game.Players.TestGuest
  p.Character:PivotTo(CFrame.new(225, 4, 222))
  game.ServerScriptService.BentonServer:SetAttribute("StartShow", "BigDreams")
`);
step(2);
check('show running', `return game.ReplicatedStorage.BentonState.Shows.BigDreams:GetAttribute("Running") == true, nil`);
step(75);
check('show finished and rewarded', `
  local p = game.Players.TestGuest
  local f = game.ReplicatedStorage.BentonState.Shows.BigDreams
  return f:GetAttribute("Running") == false, "bucks " .. p:GetAttribute("Bucks")
`);
for (const id of ['StuntSpectacular', 'BigRigParade', 'BentonNights']) {
  lua(`game.ServerScriptService.BentonServer:SetAttribute("StartShow", "${id}")`);
  step(4);
}
step(110);

console.log('== a full park day (simulated)');
t = Date.now();
step(240, 0.25);
console.log(`   4 park hours simulated in ${Date.now() - t} ms`);
check('rides have been running', `
  local total = 0
  for _, f in game.ReplicatedStorage.BentonState.Rides:GetChildren() do total += f:GetAttribute("CycleId") end
  return total > 10, total .. " dispatches"
`);

if (dump) {
  // export parts for the 3D preview renderer
  const json = lua(`
    local M = _G.__mock
    local out = {}
    local S = M.state
    for _, d in workspace:GetDescendants() do
      if d:IsA("BasePart") and d.Transparency < 0.95 then
        local cf = d.CFrame
        local shape = "block"
        if d:IsA("WedgePart") then shape = "wedge"
        elseif d:IsA("Part") then
          local sh = d.Shape
          if sh == Enum.PartType.Ball then shape = "ball" elseif sh == Enum.PartType.Cylinder then shape = "cyl" end
          if d:FindFirstChildOfClass("SpecialMesh") then shape = "ellipsoid" end
        end
        local c = d.Color
        table.insert(out, { shape, d.Size.X, d.Size.Y, d.Size.Z, cf:GetComponents() })
        local t = out[#out]
        t[17] = math.floor(c.R * 255) t[18] = math.floor(c.G * 255) t[19] = math.floor(c.B * 255)
        t[20] = d.Transparency
        t[21] = d.Material.Name
      end
    end
    return game:GetService("HttpService"):JSONEncode({ parts = out, terrain = #M.terrainOps })
  `)[0];
  fs.mkdirSync(path.join(ROOT, 'tools', 'out'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'tools', 'out', 'parts.json'), json);
  console.log('   wrote tools/out/parts.json');
}

const errors = rt.logs.filter((l) => l.kind === 'error');
const warns = rt.logs.filter((l) => l.kind === 'warn');
const uniq = (arr) => [...new Map(arr.map((l) => [l.msg.split('\n')[0], l])).values()];
if (warns.length) {
  console.log(`\n${warns.length} warnings (unique):`);
  for (const w of uniq(warns).slice(0, 30)) console.log('  ' + w.msg.split('\n')[0]);
}
if (errors.length) {
  console.log(`\n${errors.length} runtime errors (unique):`);
  for (const e of uniq(errors).slice(0, 20)) console.log('  ' + e.msg.split('\n').slice(0, 6).join('\n    '));
  failed = true;
}
console.log(failed ? '\nRUNTIME TEST FAILED' : '\nRUNTIME TEST PASSED');
process.exitCode = failed ? 1 : 0;
