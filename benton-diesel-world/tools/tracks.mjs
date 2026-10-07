// Prints ride statistics (length, cycle time, top speed, g-forces) for every
// ride and dumps sampled track geometry to tools/out/tracks.json for plotting.
//   node tools/tracks.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRuntime, ROOT } from './harness.mjs';

const rt = await createRuntime({ quiet: true });
const json = rt.exec(`
local RS = game:GetService("ReplicatedStorage")
local Shared = RS:WaitForChild("BentonShared")
local Config = require(Shared.Config)
local RideMotion = require(Shared.RideMotion)
local HttpService = game:GetService("HttpService")
local out = {}
for _, ride in Config.Rides do
  local m = RideMotion.get(ride.id)
  local info = { id = ride.id, kind = ride.kind, duration = m.duration, capacity = m.capacity, cars = m.carCount }
  if m.sampler then
    local s = m.sampler
    info.length = s.length
    local pts = {}
    local step = math.max(1, math.floor(s.count / 600))
    for i = 1, s.count, step do
      local p = s.positions[i]
      local cf = s:cframeAt(s.cum[i])
      table.insert(pts, { p.X, p.Y, p.Z, cf.UpVector.Y })
    end
    info.points = pts
  end
  -- sample the motion: max speed and g-forces of car 1
  local dt = 0.05
  local maxV, maxG, minG, maxLat = 0, 1, 1, 0
  local prevP, prevV
  local t = 0
  local cars0 = m.pose(0)
  info.rest = { cars0[1].X, cars0[1].Y, cars0[1].Z }
  local carsEnd = m.pose(m.duration)
  local d = (carsEnd[1].Position - cars0[1].Position).Magnitude
  info.endMismatch = d
  while t <= m.duration do
    local cars = m.pose(t)
    local cf = cars[1]
    local p = cf.Position
    if prevP then
      local v = (p - prevP) / dt
      if prevV then
        local a = (v - prevV) / dt
        -- specific force felt by rider (gravity 40 studs/s^2 ~ 1g)
        local f = (a + Vector3.new(0, 40, 0)) / 40
        local local_ = cf:VectorToObjectSpace(f)
        maxG = math.max(maxG, local_.Y)
        minG = math.min(minG, local_.Y)
        maxLat = math.max(maxLat, math.abs(local_.X))
      end
      maxV = math.max(maxV, v.Magnitude)
      prevV = v
    end
    prevP = p
    t += dt
  end
  info.maxSpeed = maxV
  info.maxG = maxG
  info.minG = minG
  info.maxLat = maxLat
  table.insert(out, info)
end
return HttpService:JSONEncode(out)
`)[0];
const errs = rt.errors();
const data = JSON.parse(json);
for (const r of data) {
  console.log(`${r.id.padEnd(18)} ${r.kind.padEnd(10)} cycle ${r.duration.toFixed(1).padStart(5)}s  seats ${String(r.capacity).padStart(2)}  ` +
    (r.length ? `len ${r.length.toFixed(0).padStart(4)}  ` : '            ') +
    `vmax ${r.maxSpeed.toFixed(0).padStart(3)}  g ${r.minG.toFixed(1)}..${r.maxG.toFixed(1)} lat ${r.maxLat.toFixed(1)}  endΔ ${r.endMismatch.toFixed(2)}`);
}
fs.mkdirSync(path.join(ROOT, 'tools', 'out'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'tools', 'out', 'tracks.json'), JSON.stringify(data));
if (rt.logs.some((l) => l.kind === 'error')) process.exitCode = 1;
