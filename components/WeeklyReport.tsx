'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, FileText, Brain, RefreshCw, TrendingUp, AlertTriangle, CheckCircle, Download } from 'lucide-react'

interface ReportData {
  reportDate: string
  stationsData: any[]
  report: string
  generatedAt: string
}

const RISK_COLOR = { LOW:'#16a34a', MEDIUM:'#d97706', HIGH:'#dc2626' } as const
const RISK_BG    = { LOW:'#dcfce7', MEDIUM:'#fef3c7', HIGH:'#fee2e2' } as const

function parseMarkdown(text: string) {
  return text
    .replace(/^## (.+)$/gm, '<h2 style="font-size:15px;font-weight:700;color:#1e293b;margin:20px 0 8px;padding-bottom:6px;border-bottom:1px solid #e2e8f0">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 style="font-size:13px;font-weight:700;color:#374151;margin:14px 0 6px">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#1e293b">$1</strong>')
    .replace(/^- (.+)$/gm, '<li style="margin:4px 0;color:#374151;font-size:13px;line-height:1.6">$1</li>')
    .replace(/\n\n/g, '<br/><br/>')
}

export default function WeeklyReport() {
  const router      = useRouter()
  const reportRef   = useRef<HTMLDivElement>(null)
  const [data, setData]           = useState<ReportData|null>(null)
  const [loading, setLoading]     = useState(true)
  const [downloading, setDownloading] = useState(false)

  const fetchReport = () => {
    setLoading(true)
    fetch('/api/report/ALL').then(r=>r.json()).then(d=>{ setData(d); setLoading(false) })
      .catch(()=>setLoading(false))
  }

  useEffect(()=>{ fetchReport() },[])

  const downloadPDF = async () => {
    if (!reportRef.current || !data) return
    setDownloading(true)
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: html2canvas } = await import('html2canvas')

      const element = reportRef.current
      const canvas  = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#f8fafc',
        windowWidth: 800,
      })

      const imgData = canvas.toDataURL('image/png')
      const pdf     = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

      const pageW   = pdf.internal.pageSize.getWidth()
      const pageH   = pdf.internal.pageSize.getHeight()
      const imgW    = pageW
      const imgH    = (canvas.height * imgW) / canvas.width
      const margin  = 10

      // Add pages if content is taller than one page
      let yPos = 0
      const usableH = pageH - margin * 2

      while (yPos < imgH) {
        if (yPos > 0) pdf.addPage()

        pdf.addImage(
          imgData, 'PNG',
          margin, margin - (yPos * (pageW - margin*2) / imgW),
          pageW - margin*2,
          imgH,
          '', 'FAST'
        )

        // Clip to page
        yPos += usableH
      }

      const filename = `iLands_WeeklyReport_${data.reportDate.replace(/ /g, '_')}.pdf`
      pdf.save(filename)
    } catch (err) {
      console.error('PDF error:', err)
      alert('Failed to generate PDF. Try again.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div style={{ minHeight:'100vh', background:'#f8fafc', fontFamily:'system-ui,sans-serif' }}>

      {/* Nav */}
      <div style={{ position:'sticky', top:0, zIndex:100, background:'white',
        borderBottom:'1px solid #e2e8f0', padding:'10px 14px',
        display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
          <button onClick={()=>router.push('/')}
            style={{ display:'flex', alignItems:'center', gap:4, background:'none',
              border:'1px solid #e2e8f0', borderRadius:8, padding:'6px 10px',
              cursor:'pointer', fontSize:12, color:'#475569', fontWeight:500, flexShrink:0 }}>
            <ArrowLeft size={13}/> Back
          </button>
          <div style={{ display:'flex', alignItems:'center', gap:6, minWidth:0 }}>
            <FileText size={14} color="#1e40af" style={{ flexShrink:0 }}/>
            <div style={{ minWidth:0 }}>
              <div style={{ fontWeight:700, fontSize:13, color:'#1e293b' }}>Weekly Report</div>
              {data && <div style={{ fontSize:10, color:'#94a3b8' }}>{data.reportDate}</div>}
            </div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          {/* Download PDF */}
          <button onClick={downloadPDF} disabled={downloading || loading || !data}
            style={{ display:'flex', alignItems:'center', gap:5,
              background: downloading ? '#94a3b8' : '#16a34a',
              color:'white', border:'none', borderRadius:8,
              padding:'6px 12px', cursor: downloading?'wait':'pointer',
              fontSize:11, fontWeight:600, opacity: (!data||loading)?0.5:1 }}>
            {downloading ? (
              <>
                <div style={{ width:11, height:11, border:'2px solid white',
                  borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
                PDF…
              </>
            ) : (
              <><Download size={12}/> PDF</>
            )}
          </button>
          {/* Regenerate */}
          <button onClick={fetchReport} disabled={loading}
            style={{ display:'flex', alignItems:'center', gap:4, background:'#f1f5f9',
              border:'1px solid #e2e8f0', borderRadius:8, padding:'6px 10px',
              cursor:'pointer', fontSize:11, color:'#475569' }}>
            <RefreshCw size={12} style={{ animation:loading?'spin 1s linear infinite':'none' }}/>
          </button>
        </div>
      </div>

      {/* Report content — wrapped in ref for PDF capture */}
      <div ref={reportRef} style={{ padding:'14px' }}>

        {loading ? (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
            justifyContent:'center', padding:'60px 0', gap:14 }}>
            <div style={{ width:28, height:28, border:'3px solid #7c3aed',
              borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
            <div style={{ color:'#64748b', fontSize:13 }}>Generating report with AI…</div>
          </div>
        ) : data ? (<>

          {/* Header */}
          <div style={{ background:'linear-gradient(135deg,#1e40af,#7c3aed)', borderRadius:12,
            padding:'20px 16px', marginBottom:14, color:'white' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
              <Brain size={14}/>
              <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', opacity:0.85 }}>
                AI-GENERATED WEEKLY REPORT · iLands
              </span>
            </div>
            <h1 style={{ margin:'0 0 4px', fontSize:18, fontWeight:800, lineHeight:1.3 }}>
              Cameron Highlands GNSS Network
            </h1>
            <p style={{ margin:0, opacity:0.75, fontSize:11 }}>
              {data.reportDate} · Generated: {new Date(data.generatedAt).toLocaleTimeString('en-GB')} · 5 Monitoring Stations
            </p>
          </div>

          {/* Network metrics */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
            {[
              { label:'Total Anomaly Days',
                val: data.stationsData?.reduce((a:number,s:any)=>a+s.weekly.anomalyDays,0),
                icon:<AlertTriangle size={13}/>, color:'#dc2626', bg:'#fee2e2' },
              { label:'Total HIGH-risk Days',
                val: data.stationsData?.reduce((a:number,s:any)=>a+s.weekly.highDays,0),
                icon:<AlertTriangle size={13}/>, color:'#d97706', bg:'#fef3c7' },
              { label:'Stations All-Clear',
                val: data.stationsData?.filter((s:any)=>s.weekly.anomalyDays===0).length,
                icon:<CheckCircle size={13}/>, color:'#16a34a', bg:'#dcfce7' },
              { label:'Avg Network H-Vel',
                val: (data.stationsData?.reduce((a:number,s:any)=>a+s.weekly.avgHVel,0)/5).toFixed(2)+' mm/d',
                icon:<TrendingUp size={13}/>, color:'#7c3aed', bg:'#ede9fe' },
            ].map(({label,val,icon,color,bg})=>(
              <div key={label} style={{ background:'white', border:'1px solid #e2e8f0',
                borderRadius:10, padding:'12px', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:6 }}>
                  <span style={{ background:bg, color, borderRadius:6, padding:4, display:'flex' }}>{icon}</span>
                  <span style={{ fontSize:9, color:'#94a3b8', fontWeight:600, lineHeight:1.2 }}>{label}</span>
                </div>
                <div style={{ fontSize:20, fontWeight:800, color }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Station cards */}
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:14 }}>
            {data.stationsData?.map((s:any) => {
              const risk = s.weekly.highDays>0?'HIGH':s.weekly.mediumDays>0?'MEDIUM':'LOW'
              return (
                <div key={s.meta?.id}
                  style={{ background:'white', border:`1px solid ${RISK_COLOR[risk as keyof typeof RISK_COLOR]}33`,
                    borderRadius:10, padding:'12px 14px',
                    boxShadow:'0 1px 3px rgba(0,0,0,0.04)',
                    display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:13, color:'#1e293b' }}>{s.meta?.name}</div>
                    <div style={{ fontSize:11, color:'#94a3b8', marginTop:1 }}>
                      {s.meta?.location?.split(',')[0]}
                    </div>
                    <div style={{ marginTop:6, display:'flex', gap:6, flexWrap:'wrap', fontSize:10, color:'#64748b' }}>
                      <span>⚠ {s.weekly.anomalyDays} anomaly days</span>
                      <span>↔ {s.weekly.avgHVel?.toFixed(2)} mm/d avg</span>
                    </div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flexShrink:0 }}>
                    <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:10,
                      background: RISK_BG[risk as keyof typeof RISK_BG],
                      color: RISK_COLOR[risk as keyof typeof RISK_COLOR] }}>{risk}</span>
                    {s.weekly.anomalyDays===0 && (
                      <span style={{ fontSize:9, background:'#dcfce7', color:'#16a34a',
                        borderRadius:4, padding:'1px 6px', fontWeight:700 }}>✓ CLEAR</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* AI Full Report */}
          <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:12,
            padding:'16px', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:14 }}>
              <Brain size={14} color="#7c3aed"/>
              <span style={{ fontSize:10, fontWeight:700, color:'#7c3aed', letterSpacing:'0.1em' }}>
                AI ANALYSIS — FULL REPORT
              </span>
            </div>
            <div style={{ fontSize:13, lineHeight:1.8, color:'#374151' }}
              dangerouslySetInnerHTML={{ __html: parseMarkdown(data.report) }}/>
            <div style={{ marginTop:16, paddingTop:12, borderTop:'1px solid #f1f5f9',
              fontSize:10, color:'#94a3b8', lineHeight:1.6 }}>
              Generated by Groq AI (Llama 3.3) · {new Date(data.generatedAt).toLocaleString('en-GB')} ·
              Data: UNR Nevada Geodetic Laboratory · iLands GNSS Network, Cameron Highlands
            </div>
          </div>

        </>) : (
          <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>Failed to load report.</div>
        )}
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}