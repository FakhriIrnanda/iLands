'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Zap, RotateCcw, AlertTriangle, Activity } from 'lucide-react'

const STATIONS = [
  { id:'BAKO', name:'GNSS Site 1', location:'Lavender Park' },
  { id:'CUSV', name:'GNSS Site 2', location:'Ringlet' },
  { id:'MYVA', name:'GNSS Site 3', location:'Ringlet' },
  { id:'NTUS', name:'GNSS Site 4', location:'Tanah Rata' },
  { id:'SAMP', name:'GNSS Site 5', location:'RockShed' },
]

const INTENSITY = [
  { val:1, label:'Minor',    desc:'Slow creep, Z-score ~2σ', color:'#d97706' },
  { val:2, label:'Moderate', desc:'Active slip, Z-score ~4σ', color:'#f97316' },
  { val:3, label:'Major',    desc:'Rapid failure, Z-score >6σ', color:'#dc2626' },
]

export default function SimPanel() {
  const router  = useRouter()
  const [selected,  setSelected]  = useState('SAMP')
  const [intensity, setIntensity] = useState(2)
  const [simState,  setSimState]  = useState<Record<string,any>>({})
  const [liveData,  setLiveData]  = useState<Record<string,any>>({})
  const [ticks,     setTicks]     = useState<Record<string,number>>({})
  const intervalRef = useRef<any>(null)

  // Poll sim state + live data
  useEffect(() => {
    const poll = async () => {
      const simRes = await fetch('/api/simulate')
      setSimState(await simRes.json())

      const newLive: Record<string,any> = {}
      const newTicks = { ...ticks }
      for (const s of STATIONS) {
        newTicks[s.id] = ((newTicks[s.id]??0)+1) % 90
        const r = await fetch(`/api/live/${s.id}?tick=${newTicks[s.id]}`)
        newLive[s.id] = await r.json()
      }
      setLiveData(newLive)
      setTicks(newTicks)
    }
    poll()
    intervalRef.current = setInterval(poll, 3000)
    return () => clearInterval(intervalRef.current)
  }, [])

  const trigger = async () => {
    await fetch('/api/simulate', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ stationId:selected, action:'trigger', intensity }),
    })
  }

  const reset = async (id?: string) => {
    await fetch('/api/simulate', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ stationId:id??selected, action: id?'reset':'reset_all' }),
    })
  }

  const activeStation = STATIONS.find(s=>s.id===selected)
  const live = liveData[selected]
  const sim  = simState[selected]

  return (
    <div style={{ minHeight:'100vh', background:'#0a1628', fontFamily:'system-ui,sans-serif', color:'white' }}>

      {/* Nav */}
      <div style={{ background:'#0f2044', borderBottom:'1px solid #1e3a5f',
        padding:'12px 16px', display:'flex', alignItems:'center', gap:10 }}>
        <button onClick={()=>router.push('/')}
          style={{ display:'flex', alignItems:'center', gap:4, background:'none',
            border:'1px solid #1e3a5f', borderRadius:8, padding:'6px 10px',
            cursor:'pointer', fontSize:12, color:'#94a3b8' }}>
          <ArrowLeft size={13}/> Back to Map
        </button>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <Zap size={16} color="#f59e0b"/>
          <div>
            <div style={{ fontWeight:700, fontSize:14 }}>Landslide Event Simulator</div>
            <div style={{ fontSize:10, color:'#64748b' }}>Inject simulated displacement for demo/testing</div>
          </div>
        </div>
      </div>

      <div style={{ padding:'16px', maxWidth:600, margin:'0 auto' }}>

        {/* Warning banner */}
        <div style={{ background:'#713f12', border:'1px solid #92400e', borderRadius:10,
          padding:'10px 14px', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
          <AlertTriangle size={14} color="#fbbf24"/>
          <span style={{ fontSize:12, color:'#fde68a' }}>
            Simulation mode — data is synthetic for demonstration purposes only
          </span>
        </div>

        {/* Station selector */}
        <div style={{ background:'#111e38', border:'1px solid #1e3a5f', borderRadius:12,
          padding:'16px', marginBottom:14 }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#64748b', letterSpacing:'0.1em', marginBottom:10 }}>
            SELECT STATION
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {STATIONS.map(s => {
              const live = liveData[s.id]
              const isActive = simState[s.id]?.active
              const risk = live?.current?.risk ?? 'LOW'
              const riskColor = risk==='HIGH'?'#ef4444':risk==='MEDIUM'?'#f59e0b':'#22c55e'
              return (
                <button key={s.id} onClick={()=>setSelected(s.id)}
                  style={{ background: selected===s.id?'#1a3a6e':'#0f2044',
                    border:`1px solid ${selected===s.id?'#3b82f6':'#1e3a5f'}`,
                    borderRadius:8, padding:'10px 12px', cursor:'pointer', textAlign:'left' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <span style={{ fontSize:12, fontWeight:700, color:'white' }}>{s.name}</span>
                    <span style={{ width:8, height:8, borderRadius:'50%', background:riskColor, display:'inline-block' }}/>
                  </div>
                  <div style={{ fontSize:10, color:'#64748b', marginTop:2 }}>{s.location}</div>
                  {isActive && (
                    <div style={{ marginTop:4, fontSize:9, background:'#7f1d1d',
                      color:'#fca5a5', borderRadius:4, padding:'1px 6px', display:'inline-block' }}>
                      ● SIMULATING
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Intensity selector */}
        <div style={{ background:'#111e38', border:'1px solid #1e3a5f', borderRadius:12,
          padding:'16px', marginBottom:14 }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#64748b', letterSpacing:'0.1em', marginBottom:10 }}>
            EVENT INTENSITY
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
            {INTENSITY.map(i => (
              <button key={i.val} onClick={()=>setIntensity(i.val)}
                style={{ background:intensity===i.val?`${i.color}22`:'#0f2044',
                  border:`1px solid ${intensity===i.val?i.color:'#1e3a5f'}`,
                  borderRadius:8, padding:'10px 8px', cursor:'pointer', textAlign:'center' }}>
                <div style={{ fontSize:12, fontWeight:700, color:i.color }}>{i.label}</div>
                <div style={{ fontSize:9, color:'#64748b', marginTop:3, lineHeight:1.4 }}>{i.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Live preview */}
        {live && (
          <div style={{ background:'#111e38', border:`1px solid ${live.simulation?.active?'#ef4444':'#1e3a5f'}`,
            borderRadius:12, padding:'16px', marginBottom:14,
            transition:'border-color 0.3s' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#64748b', letterSpacing:'0.1em' }}>
                LIVE PREVIEW — {activeStation?.name}
              </div>
              {live.simulation?.active ? (
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ width:8, height:8, borderRadius:'50%', background:'#ef4444',
                    display:'inline-block', animation:'blink 0.8s infinite' }}/>
                  <span style={{ fontSize:10, color:'#f87171', fontWeight:700 }}>
                    {live.simulation.phase} · {live.simulation.progress}%
                  </span>
                </div>
              ) : (
                <span style={{ fontSize:10, color:'#22c55e' }}>● NORMAL</span>
              )}
            </div>

            {live.simulation?.active && (
              <div style={{ marginBottom:10 }}>
                {/* Progress bar */}
                <div style={{ height:4, background:'#1e3a5f', borderRadius:2, marginBottom:6 }}>
                  <div style={{ height:4, borderRadius:2, background:'#ef4444',
                    width:`${live.simulation.progress}%`, transition:'width 0.5s' }}/>
                </div>
                <div style={{ fontSize:10, color:'#64748b' }}>
                  Time remaining: {live.simulation.timeLeft}s
                </div>
              </div>
            )}

            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
              {[
                { l:'EAST',  v:live.current.e, vel:live.current.e_vel, c:'#60a5fa' },
                { l:'NORTH', v:live.current.n, vel:live.current.n_vel, c:'#34d399' },
                { l:'UP',    v:live.current.u, vel:live.current.u_vel, c:'#f472b6' },
              ].map(({l,v,vel,c}) => (
                <div key={l} style={{ background:'#0f2044', borderRadius:8, padding:'10px 8px' }}>
                  <div style={{ fontSize:9, fontWeight:700, color:c, marginBottom:4 }}>{l}</div>
                  <div style={{ fontSize:18, fontWeight:800, fontFamily:'monospace', color:'white' }}>
                    {v.toFixed(1)}
                  </div>
                  <div style={{ fontSize:9, color:'#64748b', marginTop:2 }}>mm</div>
                  {vel !== null && (
                    <div style={{ fontSize:10, color: vel>=0?c:'#f87171', marginTop:3, fontWeight:600 }}>
                      {vel>=0?'▲':'▼'} {Math.abs(vel).toFixed(1)} mm/d
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ marginTop:10, display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <div style={{ background:'#0f2044', borderRadius:8, padding:'8px 10px' }}>
                <div style={{ fontSize:9, color:'#64748b', marginBottom:2 }}>H-VELOCITY</div>
                <div style={{ fontSize:16, fontWeight:700, fontFamily:'monospace',
                  color:(live.current.h_vel??0)>10?'#f87171':(live.current.h_vel??0)>2?'#fbbf24':'#4ade80' }}>
                  {live.current.h_vel?.toFixed(2)} mm/d
                </div>
              </div>
              <div style={{ background:'#0f2044', borderRadius:8, padding:'8px 10px' }}>
                <div style={{ fontSize:9, color:'#64748b', marginBottom:2 }}>RISK</div>
                <div style={{ fontSize:16, fontWeight:700,
                  color:live.current.risk==='HIGH'?'#f87171':live.current.risk==='MEDIUM'?'#fbbf24':'#4ade80' }}>
                  {live.current.risk} · {live.current.score}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
          <button onClick={trigger}
            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              background:'#dc2626', color:'white', border:'none', borderRadius:10,
              padding:'14px', fontSize:14, fontWeight:700, cursor:'pointer',
              boxShadow:'0 0 20px rgba(220,38,38,0.3)' }}>
            <Zap size={18}/> TRIGGER EVENT
          </button>
          <button onClick={()=>reset()}
            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              background:'#1e3a5f', color:'#94a3b8', border:'1px solid #1e3a5f',
              borderRadius:10, padding:'14px', fontSize:14, fontWeight:700, cursor:'pointer' }}>
            <RotateCcw size={16}/> RESET ALL
          </button>
        </div>

        {/* Go to station */}
        <button onClick={()=>router.push(`/station/${selected}`)}
          style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            background:'#1a3a6e', color:'#93c5fd', border:'1px solid #1e4d94',
            borderRadius:10, padding:'12px', fontSize:13, fontWeight:600, cursor:'pointer' }}>
          <Activity size={15}/> View {activeStation?.name} Dashboard →
        </button>

        {/* Instructions */}
        <div style={{ marginTop:16, background:'#111e38', border:'1px solid #1e3a5f',
          borderRadius:10, padding:'14px', fontSize:11, color:'#64748b', lineHeight:1.8 }}>
          <div style={{ fontWeight:700, color:'#94a3b8', marginBottom:6 }}>HOW TO USE</div>
          <div>1. Select a station and intensity level</div>
          <div>2. Click <b style={{color:'#f87171'}}>TRIGGER EVENT</b></div>
          <div>3. Go to station dashboard to see live displacement spike</div>
          <div>4. Event runs for 8 minutes: Pre-failure → Main Failure → Settling</div>
          <div>5. Click Reset All to return to normal</div>
        </div>
      </div>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>
    </div>
  )
}