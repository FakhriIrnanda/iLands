'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend, BarChart, Bar, ComposedChart, Area
} from 'recharts'
import { ArrowLeft, Brain, TrendingUp, FileText, AlertTriangle,
         Wifi, Battery, Satellite, CloudRain, Activity, Bell, Download } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
interface LiveData {
  station: string; epochTime: string; serverTime: string; phase: string
  tick: number; totalTicks: number
  simulation?: { active: boolean; phase?: string; progress?: number; intensity?: number; timeLeft?: number }
  current: {
    date: string; e: number; n: number; u: number
    e_vel: number|null; n_vel: number|null; u_vel: number|null; h_vel: number|null
    sig_e: number; sig_n: number; sig_u: number
    zscore_e: number; zscore_n: number; zscore_u: number
    anomaly: string; risk: string; score: number
  }
  recent: any[]
}
interface AIDecision {
  movementTrend: string; rainfallInfluence: string; riskLevel: string
  recommendation: string; simpleStatement: string; insight: string
  generatedAt: string; mock: boolean
  simulationActive?: boolean; simulationPhase?: string; simulationProgress?: number
}
interface StationData {
  meta: any; timeseries: any[]; last30: any[]
  riskDistribution: any; anomalyCount: number; totalDays: number
  alerts: any[]; sensors: any; systemStatus: any; summary: any
}

// ─── Constants ────────────────────────────────────────────────────────────────
const RISK_COLOR  = { LOW: '#16a34a', MEDIUM: '#d97706', HIGH: '#dc2626' } as const
const RISK_BG     = { LOW: '#dcfce7', MEDIUM: '#fef3c7', HIGH: '#fee2e2' } as const
const STATUS_CONFIG = {
  STABLE:   { color: '#16a34a', bg: '#dcfce7', label: '✓ STABLE' },
  WARNING:  { color: '#d97706', bg: '#fef3c7', label: '⚠ WARNING' },
  CRITICAL: { color: '#dc2626', bg: '#fee2e2', label: '🔴 CRITICAL' },
}

function LiveDot() {
  return (
    <span style={{ position:'relative', display:'inline-flex', width:9, height:9, flexShrink:0 }}>
      <span style={{ position:'absolute', inset:0, borderRadius:'50%', background:'#22c55e',
        animation:'ping 1.5s ease-in-out infinite', opacity:0.6 }} />
      <span style={{ position:'relative', width:9, height:9, borderRadius:'50%', background:'#22c55e' }} />
    </span>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.12em',
      color:'#94a3b8', marginBottom:12, textTransform:'uppercase' }}>
      {children}
    </div>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:12,
      padding:'16px', boxShadow:'0 1px 3px rgba(0,0,0,0.04)', ...style }}>
      {children}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function StationDetail() {
  const params = useParams()
  const router = useRouter()
  const id     = (params?.id as string)?.toUpperCase()

  const [stationData, setStationData] = useState<StationData|null>(null)
  const [live, setLive]               = useState<LiveData|null>(null)
  const [ai, setAI]                   = useState<AIDecision|null>(null)
  const [aiLoading, setAILoading]     = useState(false)
  const [serverTime, setServerTime]   = useState(new Date())
  const [downloading, setDownloading] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)
  const tickRef   = useRef(0)

  useEffect(() => {
    const t = setInterval(() => setServerTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!id) return
    fetch(`/api/station/${id}`).then(r => r.json()).then(setStationData)
    setAILoading(true)
    fetch(`/api/insight/${id}`).then(r => r.json()).then(d => { setAI(d); setAILoading(false) })
      .catch(() => setAILoading(false))

    // Refresh AI insight every 15s to stay in sync with sim state
    const aiInterval = setInterval(() => {
      fetch(`/api/insight/${id}`).then(r => r.json()).then(d => setAI(d)).catch(()=>{})
    }, 15000)
    return () => clearInterval(aiInterval)
  }, [id])

  const downloadPDF = async () => {
    if (!reportRef.current) return
    setDownloading(true)
    try {
      const { default: jsPDF }       = await import('jspdf')
      const { default: html2canvas } = await import('html2canvas')
      const el = reportRef.current

      // Temporarily expand all cards to avoid clipping
      const origStyle = el.style.cssText
      el.style.height = 'auto'
      el.style.overflow = 'visible'

      await new Promise(r => setTimeout(r, 300))

      const canvas = await html2canvas(el, {
        scale: 1.8,
        useCORS: true,
        backgroundColor: '#f8fafc',
        windowWidth: 900,
        scrollY: -window.scrollY,
        height: el.scrollHeight,
        width: el.scrollWidth,
      })

      el.style.cssText = origStyle

      const pdf     = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' })
      const pageW   = pdf.internal.pageSize.getWidth()
      const pageH   = pdf.internal.pageSize.getHeight()
      const margin  = 12
      const usableW = pageW - margin * 2
      const usableH = pageH - margin * 2

      // Scale canvas to A4 width
      const ratio  = usableW / (canvas.width / (96/25.4))
      const imgW   = usableW
      const imgH   = (canvas.height / (96/25.4)) * ratio
      const totalPages = Math.ceil(imgH / usableH)

      for (let page = 0; page < totalPages; page++) {
        if (page > 0) pdf.addPage()
        const yOffset = -(page * usableH)
        pdf.addImage(
          canvas.toDataURL('image/jpeg', 0.92),
          'JPEG', margin, margin + yOffset, imgW, imgH, '', 'FAST'
        )
        // Clip to page
        pdf.setFillColor(255, 255, 255)
        pdf.rect(0, 0, pageW, margin, 'F')
        pdf.rect(0, pageH - margin, pageW, margin*2, 'F')
      }

      const name = stationData?.meta?.name ?? id
      pdf.save(`iLands_${name.replace(/ /g,'_')}_${new Date().toLocaleDateString('en-GB').split('/').reverse().join('-')}.pdf`)
    } catch(e) { console.error(e); alert('PDF failed. Try again.') }
    finally { setDownloading(false) }
  }

  useEffect(() => {
    if (!id) return
    const poll = async () => {
      tickRef.current = (tickRef.current + 1) % 90
      const res = await fetch(`/api/live/${id}?tick=${tickRef.current}`)
      setLive(await res.json())
    }
    fetch(`/api/live/${id}?tick=0`).then(r => r.json()).then(setLive)
    const iv = setInterval(poll, 5000)
    return () => clearInterval(iv)
  }, [id])

  const risk = (live?.current.risk ?? stationData?.meta?.riskLevel ?? 'LOW') as keyof typeof RISK_COLOR

  // Derive overall status — AI is source of truth (sim-aware), fallback to live risk
  const overallStatus = (() => {
    if (ai?.simulationActive) {
      // Trust AI completely during simulation
      if (ai.riskLevel === 'High') return live?.current.score && live.current.score >= 80 ? 'CRITICAL' : 'WARNING'
      return 'WARNING'
    }
    // Normal: use AI status if available, else derive from live risk score
    if (ai?.movementTrend) {
      const score = live?.current.score ?? 0
      return score >= 70 ? 'CRITICAL' : score >= 35 ? 'WARNING' : 'STABLE'
    }
    return stationData?.summary?.overallStatus ?? 'STABLE'
  })()
  const statusCfg = STATUS_CONFIG[overallStatus as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.STABLE
  const ss            = stationData?.systemStatus

  return (
    <div style={{ minHeight:'100vh', background:'#f8fafc', fontFamily:'system-ui,sans-serif' }}>

      {/* ── NAV ── */}
      <div style={{ position:'sticky', top:0, zIndex:100, background:'white',
        borderBottom:'1px solid #e2e8f0', padding:'10px 16px',
        display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0, flex:1 }}>
          <button onClick={() => router.push('/')}
            style={{ display:'flex', alignItems:'center', gap:4, background:'none',
              border:'1px solid #e2e8f0', borderRadius:8, padding:'6px 10px',
              cursor:'pointer', fontSize:12, color:'#475569', fontWeight:500, flexShrink:0 }}>
            <ArrowLeft size={13}/> Back
          </button>
          <div style={{ minWidth:0, flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
              <span style={{ fontWeight:700, fontSize:14, color:'#1e293b' }}>
                {stationData?.meta?.name ?? id}
              </span>
              <span style={{ padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:800,
                background: statusCfg.bg, color: statusCfg.color }}>
                {statusCfg.label}
              </span>
              {live?.current.anomaly === 'YES' && (
                <span style={{ padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700,
                  background:'#ede9fe', color:'#7c3aed' }}>⚠ ANOMALY</span>
              )}
            </div>
            <div style={{ fontSize:10, color:'#94a3b8', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {stationData?.meta?.location}
            </div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          <button onClick={downloadPDF} disabled={downloading}
            style={{ display:'flex', alignItems:'center', gap:4,
              background: downloading?'#94a3b8':'#16a34a', color:'white',
              border:'none', borderRadius:8, padding:'6px 10px', fontSize:11, fontWeight:600,
              cursor: downloading?'wait':'pointer' }}>
            {downloading
              ? <><div style={{ width:11, height:11, border:'2px solid white', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/> PDF…</>
              : <><Download size={12}/> Download PDF</>
            }
          </button>
          <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11 }}>
            <LiveDot/>
            <span style={{ fontFamily:'monospace', fontWeight:600, color:'#1e293b', fontSize:11 }}>
              {serverTime.toLocaleTimeString('en-GB')}
            </span>
          </div>
        </div>
      </div>

      <div ref={reportRef} style={{ padding:'14px' }}>

        {/* ── SIMPLE STATEMENT BANNER ── */}
        {ai?.simpleStatement && (
          <div style={{ background: overallStatus==='CRITICAL'?'#fee2e2':overallStatus==='WARNING'?'#fef3c7':'#f0fdf4',
            border:`1px solid ${statusCfg.color}33`, borderRadius:10, padding:'10px 14px',
            marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
            <Activity size={14} color={statusCfg.color}/>
            <span style={{ fontSize:13, fontWeight:600, color: statusCfg.color }}>
              {ai.simpleStatement}
            </span>
          </div>
        )}

        {/* ── AI DECISION OUTPUT ── */}
        <Card style={{ marginBottom:12, border:`1px solid #7c3aed33` }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:12 }}>
            <Brain size={14} color="#7c3aed"/>
            <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.12em', color:'#7c3aed' }}>
              AI ASSESSMENT
            </span>
            {ai && !ai.mock && (
              <span style={{ marginLeft:'auto', fontSize:9, color:'#94a3b8' }}>AI-powered</span>
            )}
          </div>

          {aiLoading ? (
            <div style={{ display:'flex', alignItems:'center', gap:8, color:'#94a3b8', fontSize:13 }}>
              <div style={{ width:14, height:14, border:'2px solid #7c3aed',
                borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
              Generating AI assessment…
            </div>
          ) : ai ? (
            <div style={{ fontSize:13, color:'#374151' }}>

              {/* Status bar */}
              <div style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                background: ai.riskLevel==='High'?'#fee2e2':ai.riskLevel==='Medium'?'#fef3c7':'#f0fdf4',
                borderRadius:8, padding:'8px 12px', marginBottom:12
              }}>
                <span style={{ fontSize:12, color:'#64748b' }}>Current Status</span>
                <span style={{ fontWeight:800, fontSize:13,
                  color: ai.riskLevel==='High'?'#dc2626':ai.riskLevel==='Medium'?'#d97706':'#16a34a' }}>
                  {ai.riskLevel==='High'?'🔴':ai.riskLevel==='Medium'?'🟡':'🟢'} {ai.riskLevel.toUpperCase()} ({overallStatus})
                </span>
              </div>

              {/* Stats row */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginBottom:12 }}>
                {[
                  { label:'Movement', val:`${live?.current.h_vel?.toFixed(2) ?? '—'} mm/day` },
                  { label:'Trend', val: ai.movementTrend==='Increasing'?'↑ Increasing': ai.movementTrend==='Decreasing'?'↓ Decreasing':'→ Stable',
                    color: ai.movementTrend==='Increasing'?'#dc2626':ai.movementTrend==='Decreasing'?'#16a34a':'#d97706' },
                  { label:'Rainfall 24h', val:`${stationData?.last30?.[stationData.last30.length-1]?.rainfall?.toFixed(0) ?? '—'} mm` },
                ].map(({label, val, color}:any) => (
                  <div key={label} style={{ background:'#f8fafc', borderRadius:8, padding:'8px 10px', border:'1px solid #e2e8f0' }}>
                    <div style={{ fontSize:9, color:'#94a3b8', fontWeight:600, marginBottom:3 }}>{label}</div>
                    <div style={{ fontSize:12, fontWeight:700, color: color ?? '#1e293b' }}>{val}</div>
                  </div>
                ))}
              </div>

              {/* AI Decision */}
              <div style={{ marginBottom:10 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#7c3aed', marginBottom:6, letterSpacing:'0.08em' }}>AI DECISION</div>
                <div style={{ display:'flex', flexDirection:'column' as const, gap:5 }}>
                  {[
                    {
                      icon: (live?.current.h_vel ?? 0) > 5 ? '🔴' : (live?.current.h_vel ?? 0) > 2 ? '🟡' : '🟢',
                      text: (live?.current.h_vel ?? 0) > 5
                        ? `Movement accelerating (${live?.current.h_vel?.toFixed(2)} mm/day > 5 mm/day threshold)`
                        : (live?.current.h_vel ?? 0) > 2
                        ? `Movement moderate — monitor closely (${live?.current.h_vel?.toFixed(2)} mm/day)`
                        : `Movement within safe range (${live?.current.h_vel?.toFixed(2) ?? '—'} mm/day < 2 mm/day)`
                    },
                    {
                      icon: live?.current.anomaly==='YES' ? '🔴' : '🟢',
                      text: live?.current.anomaly==='YES'
                        ? `Abnormal acceleration detected (Z-score: ${live?.current.zscore_u?.toFixed(2)}σ > 3σ)`
                        : `No abnormal acceleration (Z-score: ${live?.current.zscore_u?.toFixed(2)}σ)`
                    },
                    {
                      icon: ai.rainfallInfluence==='Detected' ? '🟡' : '🟢',
                      text: `Rainfall impact: ${ai.rainfallInfluence==='Detected'?'Moderate':'Low'} (${stationData?.last30?.[stationData.last30.length-1]?.rainfall?.toFixed(0) ?? '—'} mm/24h)`
                    },
                  ].map((item, i) => (
                    <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:8,
                      background:'#f8fafc', borderRadius:7, padding:'7px 10px', border:'1px solid #e2e8f0' }}>
                      <span style={{ fontSize:12, flexShrink:0, marginTop:1 }}>{item.icon}</span>
                      <span style={{ fontSize:12, color:'#374151', lineHeight:1.5 }}>{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommendation */}
              <div style={{ background:'#ede9fe', borderRadius:8, padding:'10px 12px', border:'1px solid #ddd6fe' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#7c3aed', marginBottom:6, letterSpacing:'0.08em' }}>RECOMMENDATION</div>
                <div style={{ display:'flex', flexDirection:'column' as const, gap:4 }}>
                  {[
                    ai.riskLevel==='High' ? '🚨 Immediate field inspection required'
                      : ai.movementTrend==='Increasing' ? `⚠ Increase monitoring — velocity trending up at ${live?.current.h_vel?.toFixed(2)} mm/day`
                      : '✅ Continue standard monitoring',
                    ai.riskLevel==='High' ? '🚨 Alert emergency response team' : '✅ No immediate action required',
                  ].map((rec, i) => (
                    <div key={i} style={{ fontSize:12, color: rec.startsWith('🚨')?'#dc2626':rec.startsWith('⚠')?'#d97706':'#16a34a', fontWeight:500 }}>
                      {rec}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          ) : null}
        </Card>

        {/* ── LIVE E/N/U ── */}
        {live && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:12 }}>
            {[
              { label:'E', full:'EAST',  val:live.current.e, vel:live.current.e_vel, color:'#2563eb', sig:live.current.sig_e },
              { label:'N', full:'NORTH', val:live.current.n, vel:live.current.n_vel, color:'#16a34a', sig:live.current.sig_n },
              { label:'U', full:'UP',    val:live.current.u, vel:live.current.u_vel, color:'#db2777', sig:live.current.sig_u },
            ].map(({ full, val, vel, color, sig }) => (
              <Card key={full} style={{ padding:'12px 10px' }}>
                <div style={{ fontSize:9, fontWeight:700, color, marginBottom:4, letterSpacing:'0.08em' }}>{full}</div>
                <div style={{ fontSize:20, fontWeight:800, fontFamily:'monospace', color:'#0f172a', lineHeight:1 }}>
                  {val.toFixed(1)}
                </div>
                <div style={{ fontSize:9, color:'#94a3b8', marginTop:2 }}>mm ±{sig.toFixed(1)}</div>
                {vel !== null && (
                  <div style={{ marginTop:5, fontSize:10, fontWeight:600, color: vel>=0?color:'#dc2626' }}>
                    {vel>=0?'▲':'▼'} {Math.abs(vel).toFixed(2)}<span style={{color:'#94a3b8',fontSize:9}}> mm/d</span>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* ── H-VEL + Z-SCORE ── */}
        {live && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
            <Card style={{ padding:'12px' }}>
              <div style={{ fontSize:9, color:'#94a3b8', fontWeight:700, letterSpacing:'0.08em', marginBottom:4 }}>H-VELOCITY</div>
              <div style={{ fontSize:22, fontWeight:800, fontFamily:'monospace', color:'#0f172a' }}>
                {live.current.h_vel?.toFixed(2) ?? '—'}
                <span style={{ fontSize:11, color:'#94a3b8', marginLeft:2 }}>mm/d</span>
              </div>
              <div style={{ fontSize:10, fontWeight:600, marginTop:4,
                color:(live.current.h_vel??0)>5?'#dc2626':(live.current.h_vel??0)>2?'#d97706':'#16a34a' }}>
                {(live.current.h_vel??0)>5?'● HIGH MOTION':(live.current.h_vel??0)>2?'● MODERATE':'● STABLE'}
              </div>
            </Card>
            <Card style={{ padding:'12px' }}>
              <div style={{ fontSize:9, color:'#94a3b8', fontWeight:700, letterSpacing:'0.08em', marginBottom:4 }}>Z-SCORE (UP)</div>
              <div style={{ fontSize:22, fontWeight:800, fontFamily:'monospace',
                color:live.current.zscore_u>3?'#dc2626':live.current.zscore_u>2?'#d97706':'#16a34a' }}>
                {live.current.zscore_u.toFixed(2)}<span style={{ fontSize:11, color:'#94a3b8', marginLeft:2 }}>σ</span>
              </div>
              <div style={{ fontSize:10, fontWeight:600, marginTop:4,
                color:live.current.zscore_u>3?'#dc2626':live.current.zscore_u>2?'#d97706':'#16a34a' }}>
                {live.current.zscore_u>3?'● ANOMALOUS':live.current.zscore_u>2?'● ELEVATED':'● NORMAL'}
              </div>
            </Card>
          </div>
        )}

        {/* ── RAINFALL PANEL ── */}
        {stationData?.last30 && (
          <Card style={{ marginBottom:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:12 }}>
              <CloudRain size={13} color="#2563eb"/>
              <SectionTitle>Rainfall vs Displacement — Last 30 Days</SectionTitle>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
              <div style={{ background:'#eff6ff', borderRadius:8, padding:'8px 10px' }}>
                <div style={{ fontSize:9, color:'#2563eb', fontWeight:700 }}>LAST 24H RAINFALL</div>
                <div style={{ fontSize:20, fontWeight:800, color:'#1e40af', marginTop:2 }}>
                  {stationData.last30[stationData.last30.length-1]?.rainfall?.toFixed(1) ?? '—'}
                  <span style={{ fontSize:11, color:'#94a3b8', marginLeft:2 }}>mm</span>
                </div>
              </div>
              <div style={{ background:'#f0fdf4', borderRadius:8, padding:'8px 10px' }}>
                <div style={{ fontSize:9, color:'#16a34a', fontWeight:700 }}>7-DAY AVG RAINFALL</div>
                <div style={{ fontSize:20, fontWeight:800, color:'#15803d', marginTop:2 }}>
                  {stationData.summary?.avgRainfall7?.toFixed(1) ?? '—'}
                  <span style={{ fontSize:11, color:'#94a3b8', marginLeft:2 }}>mm/d</span>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <ComposedChart data={stationData.last30} margin={{top:4,right:4,bottom:4,left:-20}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="date" tick={{fontSize:8,fill:'#94a3b8'}} tickFormatter={v=>v.slice(5)} interval={6}/>
                <YAxis yAxisId="disp" tick={{fontSize:8,fill:'#94a3b8'}}/>
                <YAxis yAxisId="rain" orientation="right" tick={{fontSize:8,fill:'#2563eb'}}/>
                <Tooltip contentStyle={{background:'white',border:'1px solid #e2e8f0',borderRadius:8,fontSize:10}}/>
                <Legend wrapperStyle={{fontSize:10}}/>
                <Bar yAxisId="rain" dataKey="rainfall" fill="#bfdbfe" opacity={0.7} name="Rainfall (mm)"/>
                <Line yAxisId="disp" type="monotone" dataKey="u" stroke="#db2777" dot={false} strokeWidth={2} name="U Displacement (mm)"/>
              </ComposedChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* ── ALERT PANEL ── */}
        {stationData?.alerts && (
          <Card style={{ marginBottom:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:12 }}>
              <Bell size={13} color="#d97706"/>
              <SectionTitle>Alert History</SectionTitle>
              <span style={{ marginLeft:'auto', fontSize:10, fontWeight:700,
                color: (live?.current.anomaly === 'YES' || stationData.alerts.length > 0) ? '#d97706' : '#16a34a' }}>
                {stationData.alerts.length} alerts (last 90 days)
              </span>
            </div>

            {/* Live active alert — from state machine, not CSV */}
            {live?.current.anomaly === 'YES' && (
              <div style={{ display:'flex', alignItems:'center', gap:8,
                background:'#fef2f2', borderRadius:8, padding:'10px 12px', marginBottom:8,
                borderLeft:`3px solid ${live.current.risk==='HIGH'?'#dc2626':'#d97706'}`,
                border:`1px solid ${live.current.risk==='HIGH'?'#fca5a5':'#fde68a'}` }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:11, fontWeight:700,
                    color:live.current.risk==='HIGH'?'#dc2626':'#d97706' }}>
                    {live.current.score >= 70 ? 'CRITICAL' : live.current.score >= 40 ? 'WARNING' : 'WATCH'}
                  </div>
                  <div style={{ fontSize:10, color:'#64748b', marginTop:2 }}>
                    {live.simulation?.active
                      ? `Simulated event: ${live.simulation.phase} · ${live.simulation.progress}% complete`
                      : live.current.score >= 70
                      ? 'Rapid displacement detected — exceeds critical threshold'
                      : 'Anomalous displacement detected — monitoring closely'}
                  </div>
                </div>
                <div style={{ fontSize:10, color:'#94a3b8', flexShrink:0 }}>
                  {new Date().toLocaleTimeString('en-GB')}
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:4,
                  background:'#fef2f2', color:'#dc2626', borderRadius:10,
                  padding:'2px 8px', flexShrink:0, fontWeight:700, fontSize:10,
                  border:'1px solid #fca5a5' }}>
                  <span style={{ width:6, height:6, borderRadius:'50%', background:'#dc2626',
                    display:'inline-block', animation:'blink 0.8s infinite' }}/>
                  ACTIVE
                </div>
              </div>
            )}

            {stationData.alerts.length === 0 && live?.current.anomaly !== 'YES' ? (
              <div style={{ fontSize:12, color:'#94a3b8', textAlign:'center', padding:'12px 0' }}>
                ✓ No alerts in the last 90 days
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {stationData.alerts.slice(0,5).map((alert:any) => (
                  <div key={alert.id} style={{ display:'flex', alignItems:'center', gap:8,
                    background:'#f8fafc', borderRadius:8, padding:'8px 10px',
                    borderLeft:`3px solid ${alert.severity==='CRITICAL'?'#dc2626':alert.severity==='WARNING'?'#d97706':'#f59e0b'}` }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:11, fontWeight:700,
                        color:alert.severity==='CRITICAL'?'#dc2626':alert.severity==='WARNING'?'#d97706':'#f59e0b' }}>
                        {alert.severity}
                      </div>
                      <div style={{ fontSize:10, color:'#64748b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {alert.trigger}
                      </div>
                    </div>
                    <div style={{ fontSize:10, color:'#94a3b8', flexShrink:0 }}>{alert.date}</div>
                    <div style={{ background:'#dcfce7', color:'#16a34a',
                      borderRadius:10, padding:'2px 8px', flexShrink:0, fontSize:10, fontWeight:600 }}>
                      Resolved
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}



        {/* ── SYSTEM STATUS ── */}
        {ss && (
          <Card style={{ marginBottom:12 }}>
            <SectionTitle>System Status</SectionTitle>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
              <div style={{ background:'#f0fdf4', borderRadius:8, padding:'10px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:4 }}>
                  <Satellite size={11} color="#16a34a"/>
                  <span style={{ fontSize:9, color:'#16a34a', fontWeight:700 }}>GNSS</span>
                </div>
                <div style={{ fontSize:11, fontWeight:700, color:'#15803d' }}>{ss.gnss.status}</div>
                <div style={{ fontSize:9, color:'#64748b', marginTop:2 }}>{ss.gnss.satellites} sats · {ss.gnss.signal}%</div>
              </div>
              <div style={{ background:'#eff6ff', borderRadius:8, padding:'10px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:4 }}>
                  <Wifi size={11} color="#2563eb"/>
                  <span style={{ fontSize:9, color:'#2563eb', fontWeight:700 }}>COMM</span>
                </div>
                <div style={{ fontSize:11, fontWeight:700, color:'#1e40af' }}>{ss.communication.status}</div>
                <div style={{ fontSize:9, color:'#64748b', marginTop:2 }}>{ss.communication.latency}ms latency</div>
              </div>
              <div style={{ background:'#fefce8', borderRadius:8, padding:'10px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:4 }}>
                  <Battery size={11} color="#d97706"/>
                  <span style={{ fontSize:9, color:'#d97706', fontWeight:700 }}>POWER</span>
                </div>
                <div style={{ fontSize:11, fontWeight:700, color:'#92400e' }}>{ss.battery.level}%</div>
                <div style={{ fontSize:9, color:'#64748b', marginTop:2 }}>Solar {ss.battery.charging?'charging':'idle'}</div>
              </div>
            </div>
          </Card>
        )}

        {/* ── RISK DISTRIBUTION ── */}
        {stationData && (
          <Card style={{ marginBottom:12 }}>
            <SectionTitle>All-Time Risk Distribution</SectionTitle>
            {(['HIGH','MEDIUM','LOW'] as const).map(level => {
              const count = stationData.riskDistribution[level]
              const pct   = ((count / stationData.totalDays) * 100).toFixed(1)
              return (
                <div key={level} style={{ marginBottom:8 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:3 }}>
                    <span style={{ fontWeight:700, color:RISK_COLOR[level] }}>{level}</span>
                    <span style={{ color:'#94a3b8' }}>{count.toLocaleString()} ({pct}%)</span>
                  </div>
                  <div style={{ height:5, background:'#f1f5f9', borderRadius:3 }}>
                    <div style={{ height:5, borderRadius:3, width:`${pct}%`, background:RISK_COLOR[level] }} />
                  </div>
                </div>
              )
            })}
          </Card>
        )}

        {/* ── E/N/U CHART ── */}
        {stationData && stationData.timeseries.length > 0 && (
          <Card style={{ marginBottom:12 }}>
            <SectionTitle>E / N / U Displacement — Last 365 Days (mm)</SectionTitle>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={stationData.timeseries} margin={{top:4,right:4,bottom:4,left:-20}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="date" tick={{fontSize:8,fill:'#94a3b8'}} tickFormatter={v=>v.slice(5)} interval={89}/>
                <YAxis tick={{fontSize:8,fill:'#94a3b8'}}/>
                <Tooltip contentStyle={{background:'white',border:'1px solid #e2e8f0',borderRadius:8,fontSize:10}}/>
                <Legend wrapperStyle={{fontSize:10}}/>
                <Line type="monotone" dataKey="e" stroke="#2563eb" dot={false} strokeWidth={1.5} name="E"/>
                <Line type="monotone" dataKey="n" stroke="#16a34a" dot={false} strokeWidth={1.5} name="N"/>
                <Line type="monotone" dataKey="u" stroke="#db2777" dot={false} strokeWidth={1.5} name="U"/>
              </LineChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* ── H-VEL CHART ── */}
        {stationData && (
          <Card>
            <SectionTitle>H-Velocity (mm/day) — Threshold Lines</SectionTitle>
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={stationData.timeseries.filter((r:any) => r.h_vel !== null)}
                margin={{top:4,right:4,bottom:4,left:-20}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="date" tick={{fontSize:8,fill:'#94a3b8'}} tickFormatter={v=>v.slice(5)} interval={89}/>
                <YAxis tick={{fontSize:8,fill:'#94a3b8'}}/>
                <Tooltip contentStyle={{background:'white',border:'1px solid #e2e8f0',borderRadius:8,fontSize:10}}/>
                <ReferenceLine y={2} stroke="#d97706" strokeDasharray="4 2"/>
                <ReferenceLine y={5} stroke="#dc2626" strokeDasharray="4 2"/>
                <Line type="monotone" dataKey="h_vel" stroke="#7c3aed" dot={false} strokeWidth={1.5}/>
              </LineChart>
            </ResponsiveContainer>
          </Card>
        )}

      </div>
      <style>{`
        @keyframes ping  { 0%,100%{transform:scale(1);opacity:0.6} 50%{transform:scale(1.8);opacity:0} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes spin  { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  )
}