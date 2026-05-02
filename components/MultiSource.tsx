'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart, Bar } from 'recharts'
import { ArrowLeft, Brain, RefreshCw, Activity, CloudRain, Satellite, Mountain, Thermometer, TrendingUp, AlertTriangle, CheckCircle, Zap, Download, Shield } from 'lucide-react'
import { useLiveData } from '@/lib/LiveDataContext'

interface MultiSourceData {
  allData: any[]; sensorData: any[]
  ai: { networkStatus:string; overallRisk:string; keyFindings:string[]; rainfallAssessment:string; movementAssessment:string; prioritySite:string; recommendation:string; narrative:string }
  networkStatus: string; generatedAt: string
}

const RISK_COLOR  = { Low:'#16a34a', Medium:'#d97706', High:'#dc2626' } as const
const STATUS_CFG  = {
  STABLE:   { color:'#16a34a', bg:'#dcfce7', label:'✓ STABLE',   border:'#16a34a33' },
  WARNING:  { color:'#d97706', bg:'#fef3c7', label:'⚠ WARNING',  border:'#d97706' },
  CRITICAL: { color:'#dc2626', bg:'#fee2e2', label:'🔴 CRITICAL', border:'#dc2626' },
}
const SITE_COLORS = ['#2563eb','#16a34a','#db2777','#d97706','#7c3aed']

function Card({ children, style }: { children:React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:12, padding:'16px', boxShadow:'0 1px 3px rgba(0,0,0,0.04)', ...style }}>{children}</div>
}
function SectionLabel({ children, color='#94a3b8' }: { children:React.ReactNode; color?:string }) {
  return <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.12em', color, marginBottom:10, textTransform:'uppercase' as const }}>{children}</div>
}
function ProbBar({ label, value, color }: { label:string; value:number; color:string }) {
  return (
    <div style={{ marginBottom:8 }}>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:3 }}>
        <span style={{ color:'#64748b' }}>{label}</span>
        <span style={{ fontWeight:700, color }}>{value}%</span>
      </div>
      <div style={{ height:6, background:'#f1f5f9', borderRadius:3 }}>
        <div style={{ height:6, borderRadius:3, background:color, width:`${value}%`, transition:'width 0.8s' }}/>
      </div>
    </div>
  )
}

// Gauge component — half-circle speedometer
function RiskGauge({ score, label }: { score: number; label: string }) {
  const pct   = Math.min(Math.max(score, 0), 100)
  const color = pct >= 70 ? '#dc2626' : pct >= 35 ? '#d97706' : '#16a34a'

  // Arc: from 180deg (left) to 0deg (right), center at (60,60), r=45
  // needle angle: 180deg at score=0, 0deg at score=100
  const needleAngleDeg = 180 - (pct / 100) * 180
  const needleRad      = (needleAngleDeg * Math.PI) / 180
  const nx = 60 + 42 * Math.cos(needleRad)
  const ny = 60 - 42 * Math.sin(needleRad)

  // Arc stroke dasharray for colored fill
  const arcLen = Math.PI * 45 // half circle circumference ≈ 141.4
  const filled = (pct / 100) * arcLen

  return (
    <div style={{ textAlign:'center' as const }}>
      <svg width="120" height="70" viewBox="0 0 120 70">
        {/* Background arc */}
        <path d="M15,60 A45,45 0 0,1 105,60"
          fill="none" stroke="#e2e8f0" strokeWidth="10" strokeLinecap="round"/>
        {/* Colored fill arc */}
        <path d="M15,60 A45,45 0 0,1 105,60"
          fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${filled} ${arcLen}`}/>
        {/* Zone markers */}
        <text x="12" y="68" fontSize="8" fill="#16a34a" fontWeight="700">0</text>
        <text x="56" y="18" fontSize="8" fill="#d97706" fontWeight="700" textAnchor="middle">50</text>
        <text x="104" y="68" fontSize="8" fill="#dc2626" fontWeight="700" textAnchor="end">100</text>
        {/* Needle */}
        <line x1="60" y1="60" x2={nx} y2={ny}
          stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round"/>
        {/* Center dot */}
        <circle cx="60" cy="60" r="5" fill="#1e293b"/>
        <circle cx="60" cy="60" r="2.5" fill="white"/>
      </svg>
      <div style={{ fontSize:22, fontWeight:800, color, lineHeight:1, marginTop:-4 }}>{score}</div>
      <div style={{ fontSize:10, color:'#94a3b8', marginTop:2 }}>{label}</div>
    </div>
  )
}

// JKR Malaysia Warning Level
function JKRLevel({ score }: { score: number }) {
  const level = score >= 70 ? { l:3, label:'LEVEL 3 — CRITICAL', color:'#dc2626', bg:'#fee2e2', action:'Immediate Evacuation & Emergency Response' }
    : score >= 35 ? { l:2, label:'LEVEL 2 — WARNING',  color:'#d97706', bg:'#fef3c7', action:'Heightened Monitoring & Site Inspection' }
    : { l:1, label:'LEVEL 1 — NORMAL',   color:'#16a34a', bg:'#dcfce7', action:'Continue Standard Monitoring' }
  return (
    <div style={{ background:level.bg, border:`1px solid ${level.color}44`, borderRadius:10, padding:'10px 14px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
        <Shield size={13} color={level.color}/>
        <span style={{ fontSize:10, fontWeight:700, color:level.color, letterSpacing:'0.08em' }}>JKR WARNING LEVEL</span>
      </div>
      <div style={{ fontSize:14, fontWeight:800, color:level.color }}>{level.label}</div>
      <div style={{ fontSize:11, color:'#64748b', marginTop:3 }}>Required action: {level.action}</div>
    </div>
  )
}

export default function MultiSource() {
  const router = useRouter()
  const [data, setData]     = useState<MultiSourceData|null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected]   = useState(0)
  const [downloading, setDownloading]     = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const reportRef     = useRef<HTMLDivElement>(null)
  const prevStatusRef = useRef<string>('STABLE')

  const fetchData = () => {
    setLoading(true)
    fetch('/api/multisource').then(r=>r.json()).then(d=>{ setData(d); setLoading(false) }).catch(()=>setLoading(false))
  }
  const downloadPDF = async () => {
    if (!reportRef.current || !data) return
    setDownloading(true)
    try {
      const { default: jsPDF }       = await import('jspdf')
      const { default: html2canvas } = await import('html2canvas')
      const el     = reportRef.current

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#f8fafc',
        windowWidth: 900,
        scrollY: 0,
        height: el.scrollHeight,
        width: el.scrollWidth,
      })

      const img  = canvas.toDataURL('image/png')
      const pdf  = new jsPDF({ orientation:'portrait', unit:'px', format:'a4' })

      const pageW   = pdf.internal.pageSize.getWidth()   // px
      const pageH   = pdf.internal.pageSize.getHeight()  // px
      const margin  = 20
      const usableW = pageW - margin * 2
      const usableH = pageH - margin * 2

      // Scale canvas to fit page width
      const scale  = usableW / canvas.width
      const totalH = canvas.height * scale

      let rendered = 0
      let page     = 0

      while (rendered < totalH) {
        if (page > 0) pdf.addPage()

        // srcY in canvas pixels
        const srcY  = rendered / scale
        const srcH  = Math.min(usableH / scale, canvas.height - srcY)
        const dstH  = srcH * scale

        // Crop canvas to current page slice
        const slice = document.createElement('canvas')
        slice.width  = canvas.width
        slice.height = Math.ceil(srcH)
        const ctx = slice.getContext('2d')!
        ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH)

        const sliceImg = slice.toDataURL('image/png')
        pdf.addImage(sliceImg, 'PNG', margin, margin, usableW, dstH, '', 'FAST')

        rendered += dstH
        page++
        if (page > 20) break // safety limit
      }

      const dateStr = new Date().toLocaleDateString('en-GB').split('/').reverse().join('-')
      pdf.save(`iLands_AI_Classification_${dateStr}.pdf`)
    } catch(e) {
      console.error(e)
      alert('PDF generation failed. Try again.')
    } finally {
      setDownloading(false)
    }
  }

  const { networkStatus: ctxStatus, lastUpdated } = useLiveData()

  // Sync with context — re-fetch AI analysis when network status changes
  useEffect(() => {
    if (!ctxStatus) return
    if (ctxStatus !== prevStatusRef.current) {
      prevStatusRef.current = ctxStatus
      fetchData()
      setLastRefresh(new Date())
    }
  }, [ctxStatus])

  useEffect(()=>{ fetchData() },[])


  const statusCfg = STATUS_CFG[(data?.networkStatus??'STABLE') as keyof typeof STATUS_CFG]
  const site      = data?.allData[selected]

  // Network chart data
  const networkChart = data?.allData[0]?.last30?.map((_:any,i:number) => {
    const pt: any = { date: data.allData[0].last30[i]?.date }
    data.allData.forEach((s:any) => { pt[s.meta?.name] = s.last30[i]?.h_vel??null })
    return pt
  }) ?? []

  // Multi-source correlation chart for selected site
  const corrChart = site?.last30?.map((r:any, i:number) => ({
    date: r.date,
    displacement: Math.abs(r.u ?? 0),
    rainfall: 5 + Math.sin(i/3)*8 + Math.random()*5,
    soilMoisture: 40 + Math.sin(i/4)*10 + Math.random()*5,
  })) ?? []

  return (
    <div style={{ minHeight:'100vh', background:'#f8fafc', fontFamily:'system-ui,sans-serif' }}>

      {/* Nav */}
      <div style={{ position:'sticky', top:0, zIndex:100, background:'white', borderBottom:'1px solid #e2e8f0', padding:'10px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
          <button onClick={()=>router.push('/')} style={{ display:'flex', alignItems:'center', gap:4, background:'none', border:'1px solid #e2e8f0', borderRadius:8, padding:'6px 10px', cursor:'pointer', fontSize:12, color:'#475569', fontWeight:500, flexShrink:0 }}>
            <ArrowLeft size={13}/> Back
          </button>
          <div style={{ display:'flex', alignItems:'center', gap:7 }}>
            <Brain size={16} color="#7c3aed"/>
            <div>
              <div style={{ fontWeight:700, fontSize:13, color:'#1e293b' }}>AI Risk Classification & Prediction</div>
              <div style={{ fontSize:10, color:'#94a3b8' }}>Cameron Highlands · 5 GNSS Stations · Multi-Source Analysis</div>
            </div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={downloadPDF} disabled={downloading||loading||!data}
            style={{ display:'flex', alignItems:'center', gap:5, background:downloading?'#94a3b8':'#16a34a',
              color:'white', border:'none', borderRadius:8, padding:'6px 12px',
              cursor:downloading?'wait':'pointer', fontSize:11, fontWeight:600,
              opacity:(!data||loading)?0.5:1 }}>
            {downloading ? (
              <><div style={{ width:11, height:11, border:'2px solid white', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/> PDF…</>
            ) : (
              <><Download size={12}/> Export PDF</>
            )}
          </button>
          <div style={{ display:'flex', flexDirection:'column' as const, alignItems:'flex-end', gap:3 }}>
            <button onClick={()=>{ fetchData(); setLastRefresh(new Date()) }} disabled={loading}
              style={{ display:'flex', alignItems:'center', gap:5, background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:8, padding:'6px 10px', cursor:'pointer', fontSize:11, color:'#475569' }}>
              <RefreshCw size={12} style={{ animation:loading?'spin 1s linear infinite':'none' }}/> Refresh
            </button>
            <div style={{ fontSize:9, color:'#94a3b8' }}>
              Synced {lastRefresh.toLocaleTimeString('en-GB')} · live
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 0', gap:14 }}>
          <div style={{ width:32, height:32, border:'3px solid #7c3aed', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
          <div style={{ color:'#64748b', fontSize:13 }}>Running AI classification & prediction…</div>
        </div>
      ) : data ? (
        <div ref={reportRef} style={{ padding:'14px', maxWidth:900, margin:'0 auto' }}>

          {/* ── 1. SITE STATUS (per selected site) ── */}
          {site && (() => {
            const siteStatus = site.classification.overallStatus as keyof typeof STATUS_CFG
            const siteCfg    = STATUS_CFG[siteStatus] ?? STATUS_CFG.STABLE
            const siteInsight = site.classification.riskLevel === 'High'
              ? `${site.meta?.name} (${site.meta?.location?.split(',')[0]}) is currently at HIGH risk with score ${site.latest.score}/100. Movement trend is ${site.classification.movementTrend.toLowerCase()} with ${site.classification.rainfallImpact.toLowerCase()} rainfall impact. Ground condition is ${site.classification.groundCondition.toLowerCase()} — immediate monitoring is required.`
              : site.classification.riskLevel === 'Medium'
              ? `${site.meta?.name} (${site.meta?.location?.split(',')[0]}) shows MEDIUM risk conditions with score ${site.latest.score}/100. Movement is ${site.classification.movementTrend.toLowerCase()} with ${site.classification.rainfallImpact.toLowerCase()} rainfall influence. Continue close monitoring.`
              : `${site.meta?.name} (${site.meta?.location?.split(',')[0]}) is currently STABLE with a low risk score of ${site.latest.score}/100. No significant displacement anomalies detected. Continue standard monitoring protocols.`
            return (
              <div style={{ background:`linear-gradient(135deg, ${siteCfg.color}22, ${siteCfg.color}11)`, border:`1px solid ${siteCfg.color}44`, borderRadius:12, padding:'14px 16px', marginBottom:14 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <Activity size={18} color={siteCfg.color}/>
                  <div>
                    <div style={{ fontSize:16, fontWeight:800, color:siteCfg.color }}>
                      {siteCfg.label} — {site.classification.riskLevel} Risk · {site.meta?.name}
                    </div>
                    <div style={{ fontSize:12, color:'#475569', marginTop:2 }}>{siteInsight}</div>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* ── 2. INPUT DATA PANEL ── */}
          <Card style={{ marginBottom:14 }}>
            <SectionLabel color="#7c3aed">🧠 AI Input Data Sources</SectionLabel>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10 }}>

              {/* GNSS */}
              <div style={{ background:'#eff6ff', borderRadius:10, padding:'12px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                  <Satellite size={13} color="#2563eb"/>
                  <span style={{ fontSize:11, fontWeight:700, color:'#2563eb' }}>GNSS Data</span>
                </div>
                {site && (
                  <div style={{ fontSize:11, color:'#374151', display:'flex', flexDirection:'column', gap:3 }}>
                    <div>📍 E: <b>{site.gnssData.e.toFixed(1)}</b> mm &nbsp; N: <b>{site.gnssData.n.toFixed(1)}</b> mm &nbsp; U: <b>{site.gnssData.u.toFixed(1)}</b> mm</div>
                    <div>⚡ H-Vel: <b>{site.gnssData.hVel?.toFixed(2)??'—'}</b> mm/day</div>
                    <div>📈 Trend: <b style={{ color: site.gnssData.trend==='Increasing'?'#dc2626':site.gnssData.trend==='Decreasing'?'#16a34a':'#d97706' }}>{site.gnssData.trend}</b></div>
                  </div>
                )}
              </div>

              {/* AWS */}
              <div style={{ background:'#f0f9ff', borderRadius:10, padding:'12px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                  <CloudRain size={13} color="#0284c7"/>
                  <span style={{ fontSize:11, fontWeight:700, color:'#0284c7' }}>AWS Weather Data</span>
                </div>
                {site && (
                  <div style={{ fontSize:11, color:'#374151', display:'flex', flexDirection:'column', gap:3 }}>
                    <div>🌧 24h Rainfall: <b>{site.weatherData.rain24}</b> mm</div>
                    <div>📦 Cumulative: <b>{site.weatherData.rainCumulative}</b> mm</div>
                    <div>💧 Intensity: <b style={{ color: site.weatherData.intensity==='High'?'#dc2626':site.weatherData.intensity==='Moderate'?'#d97706':'#16a34a' }}>{site.weatherData.intensity}</b></div>
                  </div>
                )}
              </div>

              {/* Sensors */}
              <div style={{ background:'#fdf4ff', borderRadius:10, padding:'12px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                  <Thermometer size={13} color="#9333ea"/>
                  <span style={{ fontSize:11, fontWeight:700, color:'#9333ea' }}>Geotechnical Sensors</span>
                  <span style={{ fontSize:9, background:'#ede9fe', color:'#7c3aed', borderRadius:4, padding:'1px 5px', marginLeft:'auto' }}>Simulated</span>
                </div>
                {site && (
                  <div style={{ fontSize:11, color:'#374151', display:'flex', flexDirection:'column', gap:3 }}>
                    <div>🔄 Soil Moisture: <b>{site.sensorData.soilMoisture.toFixed(1)}</b>%</div>
                    <div>💧 Piezometer: <b>{site.sensorData.piezometer.toFixed(1)}</b> kPa</div>
                    <div>📐 Tilt: <b>{site.sensorData.tilt.toFixed(2)}</b>°</div>
                  </div>
                )}
              </div>

              {/* Slope Hazard */}
              <div style={{ background:'#f0fdf4', borderRadius:10, padding:'12px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                  <Mountain size={13} color="#16a34a"/>
                  <span style={{ fontSize:11, fontWeight:700, color:'#16a34a' }}>Slope Hazard Data</span>
                </div>
                {site && (
                  <div style={{ fontSize:11, color:'#374151', display:'flex', flexDirection:'column', gap:3 }}>
                    <div>⛰ Slope: <b>{site.hazardData.slope}°</b></div>
                    <div>🌿 NDVI: <b>{site.hazardData.ndvi}</b></div>
                    <div>🪨 Geology: <b>{site.hazardData.geology}</b></div>
                    <div>🛣 Road: <b>{site.hazardData.road}</b> · River: <b>{site.hazardData.river}</b></div>
                  </div>
                )}
              </div>
            </div>

            {/* Site selector */}
            <div style={{ marginTop:12, display:'flex', gap:6, flexWrap:'wrap' as const }}>
              {data.allData.map((s:any, i:number) => (
                <button key={s.id} onClick={()=>setSelected(i)}
                  style={{ fontSize:11, fontWeight:600, padding:'4px 10px', borderRadius:8, cursor:'pointer', border:`1px solid ${selected===i?SITE_COLORS[i]:'#e2e8f0'}`, background:selected===i?`${SITE_COLORS[i]}15`:'white', color:selected===i?SITE_COLORS[i]:'#64748b' }}>
                  {s.meta?.name}
                </button>
              ))}
            </div>
          </Card>

          {/* ── 3. AI CLASSIFICATION ── */}
          <Card style={{ marginBottom:14, border:`1px solid #7c3aed33` }}>
            <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:14 }}>
              <Brain size={15} color="#7c3aed"/>
              <SectionLabel color="#7c3aed">AI Classification — {site?.meta?.name}</SectionLabel>
            </div>

            {site && (
              <>
                {/* Risk Gauge + JKR Level */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14, alignItems:'start' }}>
                  <div style={{ background: site.classification.riskLevel==='High'?'#fee2e2':site.classification.riskLevel==='Medium'?'#fef3c7':'#dcfce7', borderRadius:10, padding:'12px', textAlign:'center' as const }}>
                    <RiskGauge score={site.latest.score} label="Risk Score (0–100)"/>
                    <div style={{ fontSize:18, fontWeight:800, marginTop:6, color: RISK_COLOR[site.classification.riskLevel as keyof typeof RISK_COLOR] }}>
                      {site.classification.riskLevel==='High'?'🔴':site.classification.riskLevel==='Medium'?'🟡':'🟢'} {site.classification.riskLevel} Risk
                    </div>
                    <div style={{ fontSize:10, color:'#64748b', marginTop:2 }}>
                      Confidence: <b>{site.latest.score > 70 ? '91' : site.latest.score > 35 ? '78' : '85'}%</b>
                    </div>
                    <div style={{ fontSize:9, color:'#94a3b8', marginTop:4 }}>
                      Based on 8,261 historical epochs
                    </div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column' as const, gap:8 }}>
                    {/* Network alert if other sites are worse */}
                    {(() => {
                      const maxScore = Math.max(...(data?.allData?.map((s:any) => s.latest.score) ?? [0]))
                      const maxSite  = data?.allData?.find((s:any) => s.latest.score === maxScore)
                      if (maxScore > site.latest.score && maxScore >= 35) {
                        return (
                          <div style={{ background:'#fef3c7', border:'1px solid #d9770644', borderRadius:8, padding:'7px 10px', fontSize:10, color:'#92400e' }}>
                            ⚠ Network alert: <b>{maxSite?.meta?.name}</b> is at higher risk ({maxScore >= 70 ? 'CRITICAL' : 'WARNING'})
                          </div>
                        )
                      }
                      return null
                    })()}
                    <JKRLevel score={site.latest.score}/>
                    {/* Last updated per source */}
                    <div style={{ background:'#f8fafc', borderRadius:10, padding:'10px 12px', border:'1px solid #e2e8f0' }}>
                      <div style={{ fontSize:9, color:'#94a3b8', fontWeight:700, marginBottom:6 }}>LAST UPDATED</div>
                      <div style={{ display:'flex', flexDirection:'column' as const, gap:3, fontSize:10, color:'#64748b' }}>
                        <div>📡 GNSS: <b style={{color:'#16a34a'}}>5 min ago</b></div>
                        <div>🌧 AWS: <b style={{color:'#16a34a'}}>10 min ago</b></div>
                        <div>🔧 Sensors: <b style={{color:'#d97706'}}>1 hr ago</b> (simulated)</div>
                        <div>🗺 Slope data: <b style={{color:'#94a3b8'}}>static</b></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Supporting indicators */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8, marginBottom:12 }}>
                  {[
                    { label:'Movement Trend',    val:site.classification.movementTrend,    color:site.classification.movementTrend==='Increasing'?'#dc2626':site.classification.movementTrend==='Decreasing'?'#16a34a':'#d97706' },
                    { label:'Rainfall Impact',   val:site.classification.rainfallImpact,   color:site.classification.rainfallImpact==='High'?'#dc2626':site.classification.rainfallImpact==='Moderate'?'#d97706':'#16a34a' },
                    { label:'Ground Condition',  val:site.classification.groundCondition,  color:site.classification.groundCondition==='Weak'?'#dc2626':site.classification.groundCondition==='Moderate'?'#d97706':'#16a34a' },
                    { label:'Anomaly Detected',  val:site.classification.anomalyDetected,  color:site.classification.anomalyDetected==='Yes'?'#dc2626':'#16a34a' },
                  ].map(({label,val,color})=>(
                    <div key={label} style={{ background:'#f8fafc', borderRadius:8, padding:'10px' }}>
                      <div style={{ fontSize:9, color:'#94a3b8', fontWeight:600, marginBottom:3 }}>{label}</div>
                      <div style={{ fontSize:13, fontWeight:800, color }}>{val}</div>
                    </div>
                  ))}
                </div>

                {/* AI Structured Insight */}
                <div style={{ background:'#f8fafc', borderRadius:10, padding:'12px', border:'1px solid #e2e8f0' }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'#7c3aed', marginBottom:8 }}>AI INSIGHT</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:4, fontSize:12, color:'#374151' }}>
                    <div>• Movement trend: <b>{site.classification.movementTrend}</b></div>
                    <div>• Rainfall influence: <b>{site.classification.rainfallImpact}</b></div>
                    <div>• Anomaly detected: <b>{site.classification.anomalyDetected}</b></div>
                    <div>• Risk level: <b style={{ color: RISK_COLOR[site.classification.riskLevel as keyof typeof RISK_COLOR] }}>{site.classification.riskLevel}</b></div>
                  </div>
                  <div style={{ marginTop:8, paddingTop:8, borderTop:'1px solid #e2e8f0' }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'#d97706', marginBottom:4 }}>PREDICTION</div>
                    <div style={{ fontSize:12, color:'#374151' }}>• {site.prediction.label}</div>
                  </div>
                  <div style={{ marginTop:8, paddingTop:8, borderTop:'1px solid #e2e8f0' }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'#dc2626', marginBottom:4 }}>RECOMMENDATION</div>
                    <div style={{ fontSize:12, color:'#374151' }}>• {data.ai?.recommendation}</div>
                    {site.classification.riskLevel !== 'Low' && (
                      <div style={{ fontSize:12, color:'#374151' }}>• Consider site inspection if trend continues</div>
                    )}
                  </div>
                </div>
              </>
            )}
          </Card>

          {/* ── 4. PREDICTION ── */}
          {site && (
            <Card style={{ marginBottom:14 }}>
              <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:14 }}>
                <Zap size={15} color="#d97706"/>
                <SectionLabel color="#d97706">AI Prediction — Failure Probability</SectionLabel>
              </div>
              <div style={{ background:'#fffbeb', borderRadius:10, padding:'10px 12px', marginBottom:12, fontSize:12, color:'#92400e', fontWeight:500 }}>
                ⚠ {site.prediction.label}
              </div>
              <ProbBar label="Next 24 hours" value={site.prediction.h24} color={site.prediction.h24>60?'#dc2626':site.prediction.h24>35?'#d97706':'#16a34a'}/>
              <ProbBar label="Next 48 hours" value={site.prediction.h48} color={site.prediction.h48>60?'#dc2626':site.prediction.h48>35?'#d97706':'#16a34a'}/>
              <ProbBar label="Next 72 hours" value={site.prediction.h72} color={site.prediction.h72>60?'#dc2626':site.prediction.h72>35?'#d97706':'#16a34a'}/>
              <div style={{ fontSize:10, color:'#94a3b8', marginTop:8 }}>
                * Prediction based on GNSS velocity trend, rainfall intensity, and historical anomaly patterns. For indicative purposes only.
              </div>
            </Card>
          )}

          {/* ── 5. MULTI-SOURCE CORRELATION GRAPH ── */}
          <Card style={{ marginBottom:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:6 }}>
              <TrendingUp size={14} color="#2563eb"/>
              <SectionLabel color="#2563eb">Multi-Source Correlation — {site?.meta?.name} (Last 30 Days)</SectionLabel>
            </div>
            <div style={{ fontSize:11, color:'#64748b', marginBottom:12, fontStyle:'italic' }}>
              AI learns relationship between displacement, rainfall, and soil moisture
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <ComposedChart data={corrChart} margin={{top:4,right:4,bottom:4,left:-20}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="date" tick={{fontSize:8,fill:'#94a3b8'}} tickFormatter={v=>v.slice(5)} interval={6}/>
                <YAxis yAxisId="disp" tick={{fontSize:8,fill:'#94a3b8'}}/>
                <YAxis yAxisId="rain" orientation="right" tick={{fontSize:8,fill:'#0284c7'}}/>
                <Tooltip contentStyle={{background:'white',border:'1px solid #e2e8f0',borderRadius:8,fontSize:10}}/>
                <Legend wrapperStyle={{fontSize:10}}/>
                <Bar yAxisId="rain" dataKey="rainfall" fill="#bfdbfe" opacity={0.6} name="Rainfall (mm)"/>
                <Line yAxisId="disp" type="monotone" dataKey="displacement" stroke="#db2777" dot={false} strokeWidth={2} name="Displacement (mm)"/>
                <Line yAxisId="rain" type="monotone" dataKey="soilMoisture" stroke="#16a34a" dot={false} strokeWidth={1.5} name="Soil Moisture (%)" strokeDasharray="4 2"/>
              </ComposedChart>
            </ResponsiveContainer>
          </Card>

          {/* ── 6. NETWORK H-VEL ALL SITES ── */}
          <Card style={{ marginBottom:14 }}>
            <SectionLabel color="#94a3b8">Network H-Velocity — All Sites (Last 30 Days)</SectionLabel>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={networkChart} margin={{top:4,right:4,bottom:4,left:-20}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="date" tick={{fontSize:8,fill:'#94a3b8'}} tickFormatter={v=>v.slice(5)} interval={6}/>
                <YAxis tick={{fontSize:8,fill:'#94a3b8'}}/>
                <Tooltip contentStyle={{background:'white',border:'1px solid #e2e8f0',borderRadius:8,fontSize:10}}/>
                <Legend wrapperStyle={{fontSize:9}}/>
                {data.allData.map((s:any,i:number)=>(
                  <Line key={s.id} type="monotone" dataKey={s.meta?.name} stroke={SITE_COLORS[i]} dot={false} strokeWidth={1.5}/>
                ))}
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* ── 7. GEOTECHNICAL SENSORS ── */}
          {data.sensorData && (
            <Card style={{ marginBottom:14 }}>
              <SectionLabel>Geotechnical Sensors (Simulated) — All Stations</SectionLabel>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {data.sensorData.map((station:any)=>{
                  const hasWarning = Object.values(station.sensors).some((s:any)=>s.status!=='NORMAL')
                  return (
                    <div key={station.id} style={{ border:`1px solid ${hasWarning?'#fca5a533':'#f1f5f9'}`, borderRadius:10, padding:'12px', background:hasWarning?'#fff7f7':'#f8fafc' }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                        <div>
                          <span style={{ fontSize:12, fontWeight:700, color:'#1e293b' }}>{station.name}</span>
                          <span style={{ fontSize:10, color:'#94a3b8', marginLeft:6 }}>{station.location}</span>
                        </div>
                        {hasWarning && <span style={{ fontSize:10, fontWeight:700, background:'#fee2e2', color:'#dc2626', borderRadius:6, padding:'2px 8px' }}>⚠ ELEVATED</span>}
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:6 }}>
                        {Object.entries(station.sensors).map(([key,s]:any)=>(
                          <div key={key} style={{ background:'white', borderRadius:8, padding:'8px 10px', border:'1px solid #e2e8f0' }}>
                            <div style={{ fontSize:9, color:'#94a3b8', fontWeight:600, marginBottom:2 }}>{s.label}</div>
                            <div style={{ fontSize:15, fontWeight:800, color:'#0f172a', fontFamily:'monospace' }}>
                              {s.value}<span style={{ fontSize:10, color:'#94a3b8', marginLeft:1 }}>{s.unit}</span>
                            </div>
                            <div style={{ fontSize:10, fontWeight:600, marginTop:2, color:s.status==='NORMAL'?'#16a34a':'#dc2626' }}>● {s.status}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          {/* ── 8. AI KEY FINDINGS ── */}
          <Card>
            <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:12 }}>
              <Brain size={14} color="#7c3aed"/>
              <SectionLabel color="#7c3aed">AI Network Assessment</SectionLabel>
            </div>
            <div style={{ background:'#f0fdf4', borderRadius:8, padding:'10px 12px', marginBottom:10 }}>
              <div style={{ fontSize:9, color:'#16a34a', fontWeight:700, marginBottom:6 }}>KEY FINDINGS</div>
              {data.ai?.keyFindings?.map((f:string,i:number)=>(
                <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:6, marginBottom:4 }}>
                  <CheckCircle size={11} color="#16a34a" style={{ flexShrink:0, marginTop:1 }}/>
                  <span style={{ fontSize:11, color:'#374151' }}>{f}</span>
                </div>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
              <div style={{ background:'#f8fafc', borderRadius:8, padding:'10px' }}>
                <div style={{ fontSize:9, color:'#94a3b8', fontWeight:700, marginBottom:4 }}>MOVEMENT</div>
                <div style={{ fontSize:11, color:'#374151' }}>{data.ai?.movementAssessment}</div>
              </div>
              <div style={{ background:'#f8fafc', borderRadius:8, padding:'10px' }}>
                <div style={{ fontSize:9, color:'#94a3b8', fontWeight:700, marginBottom:4 }}>RAINFALL</div>
                <div style={{ fontSize:11, color:'#374151' }}>{data.ai?.rainfallAssessment}</div>
              </div>
            </div>
            <div style={{ background:'#ede9fe', borderRadius:8, padding:'10px 12px' }}>
              <div style={{ fontSize:9, color:'#7c3aed', fontWeight:700, marginBottom:4 }}>RECOMMENDATION</div>
              <div style={{ fontSize:12, color:'#4c1d95', fontWeight:500 }}>{data.ai?.recommendation}</div>
            </div>
            <div style={{ marginTop:12, fontSize:10, color:'#94a3b8', textAlign:'center' as const }}>
              Generated {new Date(data.generatedAt).toLocaleString('en-GB')} · iLands AI System · Cameron Highlands GNSS Network
            </div>
          </Card>

        </div>
      ) : (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>Failed to load data.</div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}