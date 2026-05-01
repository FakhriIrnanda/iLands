import { NextResponse } from 'next/server'
import { parseStationCSV } from '@/lib/parseCSV'
import { getActiveEvent } from '@/lib/simState'

type Phase = 'STABLE' | 'ANOMALY' | 'RECOVERY'

interface StationState {
  phase: Phase; phaseTicksLeft: number; rowIdx: number
  anomalyOffset: { e: number; n: number; u: number }; recoveryFade: number
  // Track previous LIVE values for accurate velocity
  prevLive: { e: number; n: number; u: number } | null
}

const stateMap: Record<string, StationState> = {}

function initState(totalRows: number): StationState {
  return {
    phase: 'STABLE', phaseTicksLeft: 480,
    rowIdx: Math.max(0, totalRows - 90),
    anomalyOffset: { e:0, n:0, u:0 }, recoveryFade: 0,
    prevLive: null,
  }
}

function tickState(state: StationState, totalRows: number): StationState {
  const s = { ...state, anomalyOffset: {...state.anomalyOffset} }
  s.rowIdx = (s.rowIdx + 1) % totalRows
  s.phaseTicksLeft--

  if (s.phaseTicksLeft <= 0) {
    if (s.phase === 'STABLE') {
      if (Math.random() < 0.30) {
        s.phase = 'ANOMALY'; s.phaseTicksLeft = 36 + Math.floor(Math.random()*36)
        s.anomalyOffset = { e:(Math.random()-0.5)*12, n:(Math.random()-0.5)*10, u:-(Math.random()*18+6) }
      } else { s.phaseTicksLeft = 360 + Math.floor(Math.random()*240) }
    } else if (s.phase === 'ANOMALY') {
      s.phase = 'RECOVERY'; s.phaseTicksLeft = 24 + Math.floor(Math.random()*12); s.recoveryFade = 1.0
    } else if (s.phase === 'RECOVERY') {
      s.phase = 'STABLE'; s.phaseTicksLeft = 360 + Math.floor(Math.random()*240)
      s.anomalyOffset = {e:0,n:0,u:0}; s.recoveryFade = 0
    }
  }

  if (s.phase === 'RECOVERY' && s.phaseTicksLeft > 0) s.recoveryFade = s.phaseTicksLeft / 36
  return s
}

function jitter(sigma: number) { return (Math.random()-0.5)*2*sigma }

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const id   = params.id.toUpperCase()
  const rows = parseStationCSV(id)
  if (!rows.length) return NextResponse.json({ error:'Station not found' }, { status:404 })

  if (!stateMap[id]) stateMap[id] = initState(rows.length)
  stateMap[id] = tickState(stateMap[id], rows.length)
  const state = stateMap[id]
  const base  = rows[state.rowIdx]

  // Check active simulation
  const simEvent    = getActiveEvent(id)
  const isSimulating = !!simEvent

  let offset    = { e:0, n:0, u:0 }
  let simPhase  = ''
  let simProgress = 0

  if (isSimulating && simEvent) {
    const elapsed   = (Date.now() - simEvent.startedAt) / 1000
    const total     = simEvent.durationMs / 1000
    simProgress     = Math.min(elapsed / total, 1)
    const intensity = simEvent.intensity

    if (simProgress < 0.2) {
      const ramp = simProgress / 0.2
      // Pre-failure: max ~5mm offset (realistic creep)
      offset = {
        e:  intensity * 3  * ramp * (0.8 + Math.random()*0.4),
        n:  intensity * 2  * ramp * (0.8 + Math.random()*0.4),
        u: -intensity * 5  * ramp * (0.8 + Math.random()*0.4),
      }
      simPhase = 'PRE-FAILURE CREEP'
    } else if (simProgress < 0.6) {
      const ramp = (simProgress - 0.2) / 0.4
      // Main failure: max ~25mm offset total (realistic for 5-min epoch)
      offset = {
        e:  intensity * (8 + ramp * 17) * (0.9 + Math.random()*0.2),
        n:  intensity * (5 + ramp * 12) * (0.9 + Math.random()*0.2),
        u: -intensity * (12 + ramp * 23) * (0.9 + Math.random()*0.2),
      }
      simPhase = 'MAIN FAILURE'
    } else {
      const decay = 1 - (simProgress - 0.6) / 0.4
      offset = {
        e:  intensity * 25 * decay * (0.8 + Math.random()*0.4),
        n:  intensity * 17 * decay * (0.8 + Math.random()*0.4),
        u: -intensity * 35 * decay * (0.8 + Math.random()*0.4),
      }
      simPhase = 'POST-FAILURE SETTLING'
    }
  } else {
    if (state.phase === 'ANOMALY') offset = state.anomalyOffset
    else if (state.phase === 'RECOVERY') offset = {
      e: state.anomalyOffset.e * state.recoveryFade,
      n: state.anomalyOffset.n * state.recoveryFade,
      u: state.anomalyOffset.u * state.recoveryFade,
    }
  }

  const liveE = parseFloat((base.e_mm + offset.e + jitter(0.6)).toFixed(3))
  const liveN = parseFloat((base.n_mm + offset.n + jitter(0.5)).toFixed(3))
  const liveU = parseFloat((base.u_mm + offset.u + jitter(1.2)).toFixed(3))

  // Velocity: use previous LIVE values (not raw CSV) for accuracy
  // 5-min epoch = 1/288 day. Realistic max: ~50mm/day normal, ~150mm/day during major event
  const prevLive = state.prevLive
  let eVel = 0, nVel = 0, uVel = 0, hVel = 0

  if (prevLive) {
    const maxVel = isSimulating ? 150 : 50
    eVel = parseFloat(Math.max(-maxVel, Math.min(maxVel, (liveE - prevLive.e) * 288)).toFixed(3))
    nVel = parseFloat(Math.max(-maxVel, Math.min(maxVel, (liveN - prevLive.n) * 288)).toFixed(3))
    uVel = parseFloat(Math.max(-maxVel*2, Math.min(maxVel*2, (liveU - prevLive.u) * 288)).toFixed(3))
    hVel = parseFloat(Math.sqrt(eVel**2 + nVel**2).toFixed(3))
  }

  // Store current live values for next tick
  stateMap[id].prevLive = { e: liveE, n: liveN, u: liveU }

  // Risk classification
  let risk = 'LOW', riskScore = base.risk_score, anomaly = 'NO'

  if (isSimulating && simEvent) {
    anomaly = 'YES'
    if (simProgress < 0.2) {
      risk = 'MEDIUM'; riskScore = Math.round(25 + simProgress * 250)
    } else if (simProgress < 0.6) {
      risk = 'HIGH'; riskScore = 100
    } else {
      risk = 'HIGH'; riskScore = Math.round(100 - (simProgress - 0.6) * 150)
      if (riskScore < 40) { risk = 'MEDIUM' }
    }
  } else {
    risk = state.phase==='ANOMALY' ? 'HIGH'
         : state.phase==='RECOVERY' ? (state.recoveryFade>0.5?'MEDIUM':'LOW') : 'LOW'
    anomaly = state.phase==='ANOMALY' ? 'YES' : 'NO'
    riskScore = state.phase==='ANOMALY'
      ? Math.min(Math.round(60 + Math.abs(offset.u)*1.5), 100)
      : state.phase==='RECOVERY' ? Math.round(25*state.recoveryFade)
      : base.risk_score
  }

  const now     = new Date()
  const epochMs = now.getTime() - (90-(state.rowIdx%90))*5*60*1000
  const recent  = rows.slice(Math.max(0,state.rowIdx-23), state.rowIdx+1).map(r=>({
    date:r.date, e:r.e_mm, n:r.n_mm, u:r.u_mm, risk:r.risk_level, anomaly:r.anomaly_any
  }))

  return NextResponse.json({
    station: id, epochTime: new Date(epochMs).toISOString(),
    serverTime: now.toISOString(), phase: state.phase,
    phaseTicksLeft: state.phaseTicksLeft, tick: state.rowIdx,
    totalTicks: rows.length, epochIntervalMinutes: 5,
    simulation: isSimulating ? {
      active: true, phase: simPhase,
      progress: parseFloat((simProgress*100).toFixed(1)),
      intensity: simEvent?.intensity,
      timeLeft: Math.max(0, Math.round((simEvent!.durationMs - (Date.now()-simEvent!.startedAt))/1000)),
    } : { active: false },
    current: {
      date: base.date, e: liveE, n: liveN, u: liveU,
      e_vel: eVel, n_vel: nVel, u_vel: uVel, h_vel: hVel,
      sig_e: base.sig_e, sig_n: base.sig_n, sig_u: base.sig_u,
      zscore_e: base.zscore_e, zscore_n: base.zscore_n, zscore_u: base.zscore_u,
      anomaly, risk, score: Math.min(Math.max(riskScore, 0), 100),
    },
    recent,
  })
}