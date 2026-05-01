'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { ArrowLeft, Brain, AlertTriangle, TrendingUp, CloudRain, Activity, RefreshCw, CheckCircle } from 'lucide-react'

interface MultiSourceData {
  allData: any[]
  ai: {
    networkStatus: string; overallRisk: string
    keyFindings: string[]; rainfallAssessment: string
    movementAssessment: string; prioritySite: string
    recommendation: string; narrative: string
  }
  networkStatus: string
  generatedAt: string
}

const RISK_COLOR  = { LOW:'#16a34a', MEDIUM:'#d97706', HIGH:'#dc2626' } as const
const STATUS_CFG  = {
  STABLE:   { color:'#16a34a', bg:'#dcfce7', label:'✓ NETWORK STABLE' },
  WARNING:  { color:'#d97706', bg:'#fef3c7', label:'⚠ NETWORK WARNING' },
  CRITICAL: { color:'#dc2626', bg:'#fee2e2', label:'🔴 NETWORK CRITICAL' },
}
const SITE_COLORS = ['#2563eb','#16a34a','#db2777','#d97706','#7c3aed']

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:12,
      padding:'16px', boxShadow:'0 1px 3px rgba(0,0,0,0.04)', ...style }}>
      {children}
    </div>
  )
}

export default function MultiSource() {
  const router  = useRouter()
  const [data, setData]     = useState<MultiSourceData|null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = () => {
    setLoading(true)
    fetch('/api/multisource').then(r=>r.json()).then(d=>{ setData(d); setLoading(false) })
      .catch(()=>setLoading(false))
  }

  useEffect(()=>{ fetchData() },[])

  const statusCfg = STATUS_CFG[(data?.networkStatus ?? 'STABLE') as keyof typeof STATUS_CFG]

  // Build combined network chart data
  const networkChart = data?.allData[0]?.last30?.map((_:any, i:number) => {
    const point: any = { date: data.allData[0].last30[i]?.date }
    data.allData.forEach((s:any) => {
      point[s.meta?.name ?? s.id] = s.last30[i]?.h_vel ?? null
    })
    return point
  }) ?? []

  return (
    <div style={{ minHeight:'100vh', background:'#f8fafc', fontFamily:'system-ui,sans-serif' }}>

      {/* Nav */}
      <div style={{ position:'sticky', top:0, zIndex:100, background:'white',
        borderBottom:'1px solid #e2e8f0', padding:'10px 16px',
        display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button onClick={()=>router.push('/')}
            style={{ display:'flex', alignItems:'center', gap:4, background:'none',
              border:'1px solid #e2e8f0', borderRadius:8, padding:'6px 10px',
              cursor:'pointer', fontSize:12, color:'#475569', fontWeight:500 }}>
            <ArrowLeft size={13}/> Back
          </button>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <Brain size={16} color="#7c3aed"/>
            <div>
              <div style={{ fontWeight:700, fontSize:14, color:'#1e293b' }}>Multi-Source AI Analysis</div>
              <div style={{ fontSize:10, color:'#94a3b8' }}>Network-wide assessment · All 5 stations · Cameron Highlands</div>
            </div>
          </div>
        </div>
        <button onClick={fetchData} disabled={loading}
          style={{ display:'flex', alignItems:'center', gap:5, background:'#f1f5f9',
            border:'1px solid #e2e8f0', borderRadius:8, padding:'6px 12px',
            cursor:'pointer', fontSize:11, color:'#475569' }}>
          <RefreshCw size={12} style={{ animation:loading?'spin 1s linear infinite':'none' }}/> Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          padding:'80px 0', gap:16 }}>
          <div style={{ width:32, height:32, border:'3px solid #7c3aed', borderTopColor:'transparent',
            borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
          <div style={{ color:'#64748b', fontSize:13 }}>Running multi-source AI analysis…</div>
        </div>
      ) : data ? (
        <div style={{ padding:'16px', maxWidth:800, margin:'0 auto' }}>

          {/* Network status banner */}
          <div style={{ background:statusCfg.bg, border:`1px solid ${statusCfg.color}33`,
            borderRadius:12, padding:'14px 16px', marginBottom:16,
            display:'flex', alignItems:'center', gap:10 }}>
            <Activity size={18} color={statusCfg.color}/>
            <div>
              <div style={{ fontSize:15, fontWeight:800, color:statusCfg.color }}>{statusCfg.label}</div>
              <div style={{ fontSize:12, color:statusCfg.color, opacity:0.8, marginTop:2 }}>
                {data.ai?.narrative}
              </div>
            </div>
          </div>

          {/* AI Decision Box */}
          <Card style={{ marginBottom:14, border:'1px solid #7c3aed33' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:12 }}>
              <Brain size={14} color="#7c3aed"/>
              <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.12em', color:'#7c3aed' }}>
                AI MULTI-SOURCE ASSESSMENT
              </span>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
              {[
                { label:'Network Status',     val: data.ai?.networkStatus,
                  color: data.networkStatus==='CRITICAL'?'#dc2626':data.networkStatus==='WARNING'?'#d97706':'#16a34a' },
                { label:'Overall Risk',       val: data.ai?.overallRisk,
                  color: data.ai?.overallRisk==='High'?'#dc2626':data.ai?.overallRisk==='Medium'?'#d97706':'#16a34a' },
                { label:'Priority Site',      val: data.ai?.prioritySite, color:'#7c3aed' },
                { label:'Rainfall Influence', val: data.ai?.rainfallAssessment?.split('.')[0], color:'#2563eb' },
              ].map(({ label, val, color })=>(
                <div key={label} style={{ background:'#f8fafc', borderRadius:8, padding:'8px 10px' }}>
                  <div style={{ fontSize:9, color:'#94a3b8', fontWeight:600, marginBottom:3 }}>{label}</div>
                  <div style={{ fontSize:12, fontWeight:700, color, lineHeight:1.3 }}>{val}</div>
                </div>
              ))}
            </div>

            {/* Key findings */}
            <div style={{ background:'#f0fdf4', borderRadius:8, padding:'10px 12px', marginBottom:10 }}>
              <div style={{ fontSize:9, color:'#16a34a', fontWeight:700, marginBottom:6 }}>KEY FINDINGS</div>
              {data.ai?.keyFindings?.map((f:string, i:number) => (
                <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:6, marginBottom:4 }}>
                  <CheckCircle size={11} color="#16a34a" style={{ flexShrink:0, marginTop:1 }}/>
                  <span style={{ fontSize:11, color:'#374151' }}>{f}</span>
                </div>
              ))}
            </div>

            {/* Recommendation */}
            <div style={{ background:'#ede9fe', borderRadius:8, padding:'10px 12px' }}>
              <div style={{ fontSize:9, color:'#7c3aed', fontWeight:700, marginBottom:4 }}>RECOMMENDATION</div>
              <div style={{ fontSize:12, color:'#4c1d95', fontWeight:500 }}>{data.ai?.recommendation}</div>
            </div>
          </Card>

          {/* Per-site status grid */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
            {data.allData.map((s:any, i:number) => {
              const sc = STATUS_CFG[s.summary.overallStatus as keyof typeof STATUS_CFG] ?? STATUS_CFG.STABLE
              return (
                <button key={s.id} onClick={()=>router.push(`/station/${s.id}`)}
                  style={{ background:'white', border:`1px solid ${sc.color}33`,
                    borderRadius:10, padding:'12px', textAlign:'left', cursor:'pointer',
                    boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                    <span style={{ fontSize:11, fontWeight:700, color:'#1e293b' }}>{s.meta?.name}</span>
                    <span style={{ fontSize:10, fontWeight:700, padding:'1px 7px', borderRadius:10,
                      background:sc.bg, color:sc.color }}>{s.summary.overallStatus}</span>
                  </div>
                  <div style={{ fontSize:10, color:'#94a3b8', marginBottom:6 }}>
                    {s.meta?.location?.split(',')[0]}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4 }}>
                    <div style={{ fontSize:9, color:'#64748b' }}>
                      <div style={{ color:SITE_COLORS[i], fontWeight:700 }}>Trend</div>
                      {s.summary.trend}
                    </div>
                    <div style={{ fontSize:9, color:'#64748b' }}>
                      <div style={{ fontWeight:700, color:'#64748b' }}>H-Vel</div>
                      {s.summary.avgVel7} mm/d
                    </div>
                    <div style={{ fontSize:9, color:'#64748b' }}>
                      <div style={{ fontWeight:700, color:'#64748b' }}>Anomaly</div>
                      {s.summary.anomDays} days
                    </div>
                  </div>
                  <div style={{ marginTop:6, fontSize:9, color:'#94a3b8' }}>Tap to view detail →</div>
                </button>
              )
            })}
          </div>

          {/* Network H-velocity chart */}
          <Card style={{ marginBottom:14 }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', letterSpacing:'0.1em', marginBottom:12 }}>
              NETWORK H-VELOCITY — ALL SITES — LAST 30 DAYS (mm/day)
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={networkChart} margin={{top:4,right:4,bottom:4,left:-20}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="date" tick={{fontSize:8,fill:'#94a3b8'}} tickFormatter={v=>v.slice(5)} interval={6}/>
                <YAxis tick={{fontSize:8,fill:'#94a3b8'}}/>
                <Tooltip contentStyle={{background:'white',border:'1px solid #e2e8f0',borderRadius:8,fontSize:10}}/>
                <Legend wrapperStyle={{fontSize:9}}/>
                {data.allData.map((s:any, i:number) => (
                  <Line key={s.id} type="monotone" dataKey={s.meta?.name}
                    stroke={SITE_COLORS[i]} dot={false} strokeWidth={1.5}/>
                ))}
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Movement + rainfall assessment */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <Card>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                <TrendingUp size={13} color="#7c3aed"/>
                <span style={{ fontSize:10, fontWeight:700, color:'#94a3b8', letterSpacing:'0.08em' }}>
                  MOVEMENT ASSESSMENT
                </span>
              </div>
              <p style={{ margin:0, fontSize:12, color:'#374151', lineHeight:1.6 }}>
                {data.ai?.movementAssessment}
              </p>
            </Card>
            <Card>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                <CloudRain size={13} color="#2563eb"/>
                <span style={{ fontSize:10, fontWeight:700, color:'#94a3b8', letterSpacing:'0.08em' }}>
                  RAINFALL ASSESSMENT
                </span>
              </div>
              <p style={{ margin:0, fontSize:12, color:'#374151', lineHeight:1.6 }}>
                {data.ai?.rainfallAssessment}
              </p>
            </Card>
          </div>

          <div style={{ textAlign:'center', fontSize:10, color:'#94a3b8', marginTop:16, paddingBottom:24 }}>
            Generated {new Date(data.generatedAt).toLocaleString('en-GB')} ·
            iLands GNSS Network · Cameron Highlands
          </div>
        </div>
      ) : (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>Failed to load data.</div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}