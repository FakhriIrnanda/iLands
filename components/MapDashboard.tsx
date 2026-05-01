'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { MapContainer, TileLayer, CircleMarker, Popup, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Satellite, FileText, Brain } from 'lucide-react'

interface StationMeta {
  id: string; name: string; location: string
  lat: number; lon: number
  riskLevel: 'LOW'|'MEDIUM'|'HIGH'
  riskScore: number; latestDate: string; totalRecords: number
  latestE: number; latestN: number; latestU: number
  latestHVel: number|null; anomalyToday: boolean
}
interface LiveData {
  station: string; phase: string
  current: { e:number; n:number; u:number; risk:string; score:number; anomaly:string; h_vel:number|null; e_vel:number|null }
}

const RISK_COLOR  = { LOW:'#16a34a', MEDIUM:'#d97706', HIGH:'#dc2626' } as const
const RISK_RING   = { LOW:'#22c55e', MEDIUM:'#f59e0b', HIGH:'#ef4444' } as const

// Create custom label marker
function createLabelIcon(name: string, risk: string, anomaly: boolean, trend: string) {
  const color  = RISK_COLOR[risk as keyof typeof RISK_COLOR] ?? '#16a34a'
  const ring   = RISK_RING[risk as keyof typeof RISK_RING]   ?? '#22c55e'
  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'
  const trendColor = trend === 'up' ? '#dc2626' : trend === 'down' ? '#16a34a' : '#d97706'

  const html = `
    <div style="position:relative;display:flex;flex-direction:column;align-items:center;pointer-events:none">
      <!-- label -->
      <div style="
        background:white;
        border:1.5px solid ${ring};
        border-radius:6px;
        padding:3px 7px;
        font-size:10px;
        font-weight:700;
        color:#1e293b;
        white-space:nowrap;
        box-shadow:0 1px 6px rgba(0,0,0,0.12);
        display:flex;align-items:center;gap:4px;
        margin-bottom:3px;
      ">
        <span style="width:7px;height:7px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0"></span>
        ${name}
        <span style="color:${trendColor};font-size:11px;font-weight:900">${trendIcon}</span>
        ${anomaly ? '<span style="background:#ede9fe;color:#7c3aed;border-radius:3px;padding:0 4px;font-size:9px">⚠</span>' : ''}
      </div>
      <!-- dot -->
      <div style="
        width:14px;height:14px;border-radius:50%;
        background:${anomaly ? '#7c3aed' : color};
        border:2.5px solid ${anomaly ? '#a78bfa' : ring};
        box-shadow:0 0 0 3px ${(anomaly ? '#7c3aed' : color)}22;
      "></div>
    </div>
  `
  return L.divIcon({
    html,
    className: '',
    iconSize: [120, 44],
    iconAnchor: [60, 44],
    popupAnchor: [0, -44],
  })
}

export default function MapDashboard() {
  const router = useRouter()
  const [stations, setStations]   = useState<StationMeta[]>([])
  const [liveMap, setLiveMap]     = useState<Record<string,LiveData>>({})
  const [serverTime, setServerTime] = useState(new Date())
  const tickRef = useRef<Record<string,number>>({})

  useEffect(() => {
    fetch('/api/stations').then(r=>r.json()).then(d=>setStations(d.stations))
    const t = setInterval(()=>setServerTime(new Date()), 1000)
    return ()=>clearInterval(t)
  }, [])

  useEffect(() => {
    if (!stations.length) return
    const poll = async () => {
      for (const s of stations) {
        tickRef.current[s.id] = ((tickRef.current[s.id]??0)+1) % 90
        const res = await fetch(`/api/live/${s.id}?tick=${tickRef.current[s.id]}`)
        const d: LiveData = await res.json()
        setLiveMap(prev => ({...prev, [s.id]: d}))
      }
    }
    poll()
    const iv = setInterval(poll, 5000)
    return ()=>clearInterval(iv)
  }, [stations])

  return (
    <div style={{ width:'100vw', height:'100vh', position:'relative', background:'#f0f0eb' }}>

      {/* Header */}
      <div style={{
        position:'absolute', top:0, left:0, right:0, zIndex:1000,
        background:'rgba(255,255,255,0.96)', backdropFilter:'blur(8px)',
        borderBottom:'1px solid #e2e8f0',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'10px 16px', gap:8, flexWrap:'wrap'
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <Satellite size={18} color="#1e40af"/>
          <div>
            <div style={{ fontWeight:700, fontSize:13, color:'#1e293b' }}>
              iLands — Intelligent Landslide Monitoring System
            </div>
            <div style={{ fontSize:10, color:'#64748b' }}>
              Cameron Highlands, Pahang · 5 Stations · 5-min Epoch
            </div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button onClick={()=>router.push('/multisource')}
            style={{ display:'flex', alignItems:'center', gap:5, background:'#7c3aed', color:'white',
              border:'none', borderRadius:8, padding:'6px 12px', fontSize:11, fontWeight:600, cursor:'pointer' }}>
            <Brain size={13}/> Multi-Source AI
          </button>
          <button onClick={()=>router.push('/report')}
            style={{ display:'flex', alignItems:'center', gap:5, background:'#1e40af', color:'white',
              border:'none', borderRadius:8, padding:'6px 12px', fontSize:11, fontWeight:600, cursor:'pointer' }}>
            <FileText size={13}/> Weekly Report
          </button>
          <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11 }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background:'#22c55e', display:'inline-block',
              boxShadow:'0 0 0 3px rgba(34,197,94,0.25)', animation:'pulse 2s infinite' }}/>
            <span style={{ fontFamily:'monospace', fontWeight:700, color:'#1e293b', fontSize:12 }}>
              {serverTime.toLocaleTimeString('en-GB')}
            </span>
          </div>
        </div>
      </div>

      {/* Map */}
      <MapContainer center={[4.48, 101.37]} zoom={12}
        style={{ width:'100%', height:'100%' }} zoomControl={true}>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap &copy; CARTO'/>

        {stations.map(s => {
          const liveS   = liveMap[s.id]
          const risk    = (liveS?.current.risk ?? s.riskLevel) as keyof typeof RISK_COLOR
          const isAnomaly = liveS?.current.anomaly === 'YES'
          // trend from velocity
          const eVel  = liveS?.current.e_vel ?? 0
          const trend = Math.abs(eVel) > 3 ? 'up' : Math.abs(eVel) < -3 ? 'down' : 'stable'
          const icon  = createLabelIcon(s.name, risk, isAnomaly, trend)

          return (
            <Marker key={s.id} position={[s.lat, s.lon]} icon={icon}
              eventHandlers={{ click: ()=>router.push(`/station/${s.id}`) }}>
              <Popup>
                <div style={{ minWidth:170, padding:4 }}>
                  <div style={{ fontWeight:700, fontSize:13 }}>{s.name}</div>
                  <div style={{ fontSize:11, color:'#64748b', marginBottom:8 }}>{s.location}</div>
                  <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:8 }}>
                    <span style={{
                      background: risk==='HIGH'?'#fee2e2':risk==='MEDIUM'?'#fef3c7':'#dcfce7',
                      color: risk==='HIGH'?'#dc2626':risk==='MEDIUM'?'#d97706':'#16a34a',
                      borderRadius:4, padding:'2px 8px', fontSize:11, fontWeight:700 }}>
                      {risk} · {liveS?.current.score ?? s.riskScore}
                    </span>
                    {isAnomaly && (
                      <span style={{ background:'#ede9fe', color:'#7c3aed',
                        borderRadius:4, padding:'2px 8px', fontSize:11, fontWeight:700 }}>⚠ ANOMALY</span>
                    )}
                  </div>
                  {liveS && (
                    <div style={{ fontSize:11, fontFamily:'monospace', color:'#475569',
                      display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4, marginBottom:8 }}>
                      <div><span style={{color:'#2563eb'}}>E</span> {liveS.current.e.toFixed(1)}</div>
                      <div><span style={{color:'#16a34a'}}>N</span> {liveS.current.n.toFixed(1)}</div>
                      <div><span style={{color:'#db2777'}}>U</span> {liveS.current.u.toFixed(1)}</div>
                    </div>
                  )}
                  <button onClick={()=>router.push(`/station/${s.id}`)}
                    style={{ width:'100%', background:'#1e40af', color:'white', border:'none',
                      borderRadius:6, padding:'5px 0', fontSize:11, fontWeight:600, cursor:'pointer' }}>
                    View Full Detail →
                  </button>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>

      {/* Legend */}
      <div style={{
        position:'absolute', bottom:20, left:12, zIndex:999,
        background:'rgba(255,255,255,0.96)', border:'1px solid #e2e8f0',
        borderRadius:10, padding:'10px 14px', boxShadow:'0 2px 10px rgba(0,0,0,0.08)'
      }}>
        <div style={{ fontSize:9, fontWeight:700, color:'#94a3b8', letterSpacing:'0.1em', marginBottom:8 }}>RISK LEVEL</div>
        {[['HIGH','#dc2626'],['MEDIUM','#d97706'],['LOW','#16a34a'],['ANOMALY','#7c3aed']] .map(([l,c])=>(
          <div key={l} style={{ display:'flex', alignItems:'center', gap:7, marginBottom:4 }}>
            <span style={{ width:9, height:9, borderRadius:'50%', background:c, display:'inline-block' }}/>
            <span style={{ fontSize:10, fontWeight:600, color:'#475569' }}>{l}</span>
          </div>
        ))}
        <div style={{ borderTop:'1px solid #f1f5f9', marginTop:8, paddingTop:6 }}>
          <div style={{ fontSize:9, fontWeight:700, color:'#94a3b8', marginBottom:4 }}>TREND</div>
          {[['↑ Increasing','#dc2626'],['→ Stable','#d97706'],['↓ Decreasing','#16a34a']].map(([l,c])=>(
            <div key={l} style={{ display:'flex', alignItems:'center', gap:7, marginBottom:3 }}>
              <span style={{ fontSize:11, fontWeight:900, color:c, width:9 }}>{l[0]}</span>
              <span style={{ fontSize:10, color:'#475569' }}>{l.slice(2)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Station pills */}
      <div style={{ position:'absolute', bottom:20, right:12, zIndex:999, display:'flex', flexDirection:'column', gap:5 }}>
        {stations.map(s => {
          const liveS   = liveMap[s.id]
          const risk    = (liveS?.current.risk ?? s.riskLevel) as keyof typeof RISK_COLOR
          const isAnomaly = liveS?.current.anomaly === 'YES'
          return (
            <button key={s.id} onClick={()=>router.push(`/station/${s.id}`)}
              style={{ display:'flex', alignItems:'center', gap:8,
                background:'rgba(255,255,255,0.96)', border:`1px solid ${RISK_RING[risk]}44`,
                borderRadius:8, padding:'5px 10px', cursor:'pointer',
                boxShadow:'0 1px 5px rgba(0,0,0,0.07)' }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:RISK_COLOR[risk], flexShrink:0 }}/>
              <span style={{ fontSize:11, fontWeight:600, color:'#1e293b' }}>{s.name}</span>
              <span style={{ fontSize:10, fontWeight:700, padding:'1px 5px', borderRadius:4,
                background: risk==='HIGH'?'#fee2e2':risk==='MEDIUM'?'#fef3c7':'#dcfce7',
                color: RISK_COLOR[risk] }}>{risk}</span>
              {isAnomaly && <span style={{ fontSize:9, background:'#ede9fe', color:'#7c3aed',
                borderRadius:3, padding:'1px 4px', fontWeight:700 }}>⚠</span>}
            </button>
          )
        })}
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  )
}