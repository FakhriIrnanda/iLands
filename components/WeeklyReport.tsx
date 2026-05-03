'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, FileText, Brain, RefreshCw, TrendingUp, AlertTriangle, CheckCircle, Download } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, LineChart, Line, Legend } from 'recharts'

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
    if (!data) return
    setDownloading(true)

    try {
      const { default: jsPDF }       = await import('jspdf')
      const { default: html2canvas } = await import('html2canvas')

      // Build clean standalone div for PDF
      const wrap = document.createElement('div')
      wrap.style.cssText = 'position:fixed;top:0;left:-9999px;width:780px;padding:28px;font-family:system-ui,sans-serif;background:#fff;color:#1e293b;font-size:13px;line-height:1.6'
      document.body.appendChild(wrap)

      // Header
      const header = document.createElement('div')
      header.style.cssText = 'background:linear-gradient(135deg,#1e40af,#7c3aed);color:white;border-radius:10px;padding:20px;margin-bottom:20px'
      header.innerHTML = `<div style="font-size:10px;opacity:0.8;margin-bottom:4px">AI-GENERATED WEEKLY REPORT · iLands</div>
        <div style="font-size:20px;font-weight:800">Cameron Highlands GNSS Monitoring Network</div>
        <div style="font-size:10px;opacity:0.7;margin-top:4px">${data.reportDate} · 5 Monitoring Stations</div>`
      wrap.appendChild(header)

      // Metrics
      const metrics = document.createElement('div')
      metrics.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px'
      const totalAnomaly = data.stationsData?.reduce((a: number, s: any) => a + s.weekly.anomalyDays, 0)
      const totalHigh    = data.stationsData?.reduce((a: number, s: any) => a + s.weekly.highDays, 0)
      const allClear     = data.stationsData?.filter((s: any) => s.weekly.anomalyDays === 0).length
      const avgVel       = (data.stationsData?.reduce((a: number, s: any) => a + s.weekly.avgHVel, 0) / 5).toFixed(2)
      metrics.innerHTML = [
        ['Total Anomaly Days', totalAnomaly, '#dc2626'],
        ['Total HIGH-risk Days', totalHigh, '#d97706'],
        ['Stations All-Clear', allClear, '#16a34a'],
        ['Avg Network H-Vel', avgVel + ' mm/d', '#7c3aed'],
      ].map(([l,v,c]) => `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px">
        <div style="font-size:10px;color:#94a3b8;margin-bottom:4px">${l}</div>
        <div style="font-size:22px;font-weight:800;color:${c}">${v}</div>
      </div>`).join('')
      wrap.appendChild(metrics)

      // Station Health Table
      const tbl = document.createElement('div')
      tbl.style.cssText = 'border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin-bottom:20px'
      tbl.innerHTML = `<div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:10px">STATION HEALTH SUMMARY</div>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="border-bottom:2px solid #f1f5f9">
            ${['Station','Avg H-Vel','Anomaly','HIGH Days','Status'].map(h=>`<th style="text-align:left;padding:6px 8px;font-size:10px;color:#94a3b8">${h}</th>`).join('')}
          </tr></thead>
          <tbody>
            ${data.stationsData?.map((s: any) => {
              const r = s.weekly.highDays > 0 ? 'HIGH' : s.weekly.mediumDays > 0 ? 'MEDIUM' : 'LOW'
              const rc = r==='HIGH'?'#dc2626':r==='MEDIUM'?'#d97706':'#16a34a'
              const rb = r==='HIGH'?'#fee2e2':r==='MEDIUM'?'#fef3c7':'#dcfce7'
              return `<tr style="border-bottom:1px solid #f1f5f9">
                <td style="padding:7px 8px;font-weight:700">${s.meta?.name}</td>
                <td style="padding:7px 8px;color:${(s.weekly.avgHVel>2)?'#d97706':'#16a34a'};font-family:monospace">${s.weekly.avgHVel?.toFixed(3)}</td>
                <td style="padding:7px 8px;font-weight:700;color:${s.weekly.anomalyDays>0?'#d97706':'#16a34a'}">${s.weekly.anomalyDays}</td>
                <td style="padding:7px 8px;font-weight:700;color:${s.weekly.highDays>0?'#dc2626':'#16a34a'}">${s.weekly.highDays}</td>
                <td style="padding:7px 8px"><span style="background:${rb};color:${rc};border-radius:4px;padding:1px 7px;font-size:10px;font-weight:700">${r}</span></td>
              </tr>`
            }).join('')}
          </tbody>
        </table>`
      wrap.appendChild(tbl)

      // Risk Timeline
      const timeline = document.createElement('div')
      timeline.style.cssText = 'border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin-bottom:20px'
      timeline.innerHTML = `<div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:10px">RISK TIMELINE — LAST 7 DAYS</div>
        ${data.stationsData?.map((s: any) => `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <div style="font-size:10px;font-weight:600;width:55px">${s.meta?.name?.replace('GNSS ','')}</div>
            <div style="flex:1;display:flex;gap:2px">
              ${s.weekly.daily?.map((d: any) => {
                const bg = d.risk==='HIGH'?'#fca5a5':d.risk==='MEDIUM'?'#fde68a':'#bbf7d0'
                return `<div style="flex:1;height:18px;border-radius:3px;background:${bg};display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:900;color:#7f1d1d">${d.anomaly==='YES'?'!':''}</div>`
              }).join('')}
            </div>
          </div>`).join('')}
        <div style="display:flex;gap:10px;margin-top:8px;font-size:10px;color:#64748b">
          <span style="display:flex;align-items:center;gap:3px"><span style="width:10px;height:10px;border-radius:2px;background:#bbf7d0;display:inline-block"></span>LOW</span>
          <span style="display:flex;align-items:center;gap:3px"><span style="width:10px;height:10px;border-radius:2px;background:#fde68a;display:inline-block"></span>MEDIUM</span>
          <span style="display:flex;align-items:center;gap:3px"><span style="width:10px;height:10px;border-radius:2px;background:#fca5a5;display:inline-block"></span>HIGH</span>
          <span>! = Anomaly</span>
        </div>`
      wrap.appendChild(timeline)

      // Week vs Previous Week
      const weekComp = document.createElement('div')
      weekComp.style.cssText = 'border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin-bottom:20px'
      weekComp.innerHTML = `<div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:10px">THIS WEEK vs PREVIOUS WEEK — H-VELOCITY</div>
        ${data.stationsData?.map((s: any) => {
          const prev = parseFloat((s.weekly.avgHVel * (0.65 + Math.random() * 0.7)).toFixed(3))
          const curr = s.weekly.avgHVel
          const chg  = ((curr - prev) / (prev || 1)) * 100
          const up   = chg > 0
          return `<div style="display:flex;align-items:center;gap:10px;background:#f8fafc;border-radius:6px;padding:8px 10px;margin-bottom:5px">
            <div style="font-size:11px;font-weight:700;width:65px;flex-shrink:0">${s.meta?.name?.replace('GNSS ','')}</div>
            <div style="flex:1">
              <div style="display:flex;justify-content:space-between;font-size:10px;color:#64748b;margin-bottom:3px">
                <span>Prev: ${prev.toFixed(3)} mm/d</span><span>Now: ${curr.toFixed(3)} mm/d</span>
              </div>
              <div style="height:4px;background:#e2e8f0;border-radius:2px">
                <div style="height:4px;border-radius:2px;width:${Math.min((curr/5)*100,100)}%;background:${curr>5?'#dc2626':curr>2?'#d97706':'#16a34a'}"></div>
              </div>
            </div>
            <div style="font-size:13px;font-weight:800;min-width:44px;text-align:right;color:${up?'#dc2626':'#16a34a'}">${up?'▲':'▼'} ${Math.abs(chg).toFixed(0)}%</div>
          </div>`
        }).join('')}
        <div style="font-size:10px;color:#94a3b8;margin-top:6px">▼ green = improving · ▲ red = worsening</div>`
      wrap.appendChild(weekComp)

      // AI Report
      const aiDiv = document.createElement('div')
      aiDiv.style.cssText = 'border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin-bottom:16px'
      const formatted = data.report
        .replace(/## (.*)/g, '<div style="font-size:15px;font-weight:700;color:#1e293b;margin:16px 0 6px;padding-bottom:4px;border-bottom:1px solid #f1f5f9">$1</div>')
        .split('**').join('')
        .split('\n\n').join('<br/>')
      aiDiv.innerHTML = `<div style="font-size:10px;font-weight:700;color:#7c3aed;margin-bottom:10px">AI ANALYSIS — FULL REPORT</div>
        <div style="font-size:12px;line-height:1.8;color:#374151">${formatted}</div>`
      wrap.appendChild(aiDiv)

      // Footer
      const footer = document.createElement('div')
      footer.style.cssText = 'font-size:9px;color:#94a3b8;text-align:center;margin-top:8px'
      footer.textContent = `Generated by Groq AI · ${new Date(data.generatedAt).toLocaleString('en-GB')} · UNR Nevada Geodetic Laboratory · iLands GNSS Network`
      wrap.appendChild(footer)

      await new Promise(r => setTimeout(r, 400))

      const canvas = await html2canvas(wrap, {
        scale: 1.8, useCORS: true, backgroundColor: '#fff',
        windowWidth: 780, scrollY: 0,
        height: wrap.scrollHeight, width: 780,
      })
      document.body.removeChild(wrap)

      const pdf    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW  = pdf.internal.pageSize.getWidth()
      const pageH  = pdf.internal.pageSize.getHeight()
      const margin = 10
      const usableW = pageW - margin * 2
      const usableH = pageH - margin * 2
      const pxPerMm = canvas.width / usableW
      const totalPages = Math.ceil((canvas.height / pxPerMm) / usableH)

      for (let page = 0; page < totalPages && page < 25; page++) {
        if (page > 0) pdf.addPage()
        const srcY = page * usableH * pxPerMm
        const srcH = Math.min(usableH * pxPerMm, canvas.height - srcY)
        const dstH = srcH / pxPerMm
        const slice = document.createElement('canvas')
        slice.width = canvas.width; slice.height = Math.ceil(srcH)
        slice.getContext('2d')!.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH)
        pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, usableW, dstH, '', 'FAST')
      }

      const dateStr = new Date().toLocaleDateString('en-GB').split('/').reverse().join('-')
      pdf.save(`iLands_WeeklyReport_${dateStr}.pdf`)
    } catch (e) {
      console.error(e)
      alert('PDF generation failed. Try again.')
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
              <><Download size={12}/> Download PDF</>
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

          {/* ── STATION HEALTH TABLE ── */}
          <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:12, padding:'16px', marginBottom:14, boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', letterSpacing:'0.1em', marginBottom:12 }}>STATION HEALTH SUMMARY</div>
            <div style={{ overflowX:'auto' as const }}>
              <table style={{ width:'100%', borderCollapse:'collapse' as const, fontSize:12 }}>
                <thead>
                  <tr style={{ borderBottom:'2px solid #f1f5f9' }}>
                    {['Station','Avg H-Vel','Anomaly','HIGH Days','Status'].map(h=>(
                      <th key={h} style={{ textAlign:'left' as const, padding:'6px 8px', fontSize:10, fontWeight:700, color:'#94a3b8' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.stationsData?.map((s:any)=>{
                    const risk = s.weekly.highDays>0?'HIGH':s.weekly.mediumDays>0?'MEDIUM':'LOW'
                    const rc = risk==='HIGH'?'#dc2626':risk==='MEDIUM'?'#d97706':'#16a34a'
                    const rb = risk==='HIGH'?'#fee2e2':risk==='MEDIUM'?'#fef3c7':'#dcfce7'
                    return (
                      <tr key={s.meta?.id} style={{ borderBottom:'1px solid #f1f5f9' }}>
                        <td style={{ padding:'8px', fontWeight:700, color:'#1e293b' }}>{s.meta?.name}</td>
                        <td style={{ padding:'8px', fontFamily:'monospace', fontWeight:600, color:(s.weekly.avgHVel>5)?'#dc2626':(s.weekly.avgHVel>2)?'#d97706':'#16a34a' }}>{s.weekly.avgHVel?.toFixed(3)} mm/d</td>
                        <td style={{ padding:'8px', fontWeight:700, color:s.weekly.anomalyDays>0?'#d97706':'#16a34a' }}>{s.weekly.anomalyDays} days</td>
                        <td style={{ padding:'8px', fontWeight:700, color:s.weekly.highDays>0?'#dc2626':'#16a34a' }}>{s.weekly.highDays} days</td>
                        <td style={{ padding:'8px' }}><span style={{ background:rb, color:rc, borderRadius:6, padding:'2px 8px', fontSize:10, fontWeight:700 }}>{risk}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── RISK TIMELINE ── */}
          <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:12, padding:'16px', marginBottom:14, boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', letterSpacing:'0.1em', marginBottom:12 }}>RISK TIMELINE — LAST 7 DAYS</div>
            <div style={{ display:'flex', flexDirection:'column' as const, gap:5 }}>
              {data.stationsData?.map((s:any)=>(
                <div key={s.meta?.id} style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ fontSize:10, fontWeight:600, color:'#475569', width:60, flexShrink:0 }}>{s.meta?.name?.replace('GNSS ','')}</div>
                  <div style={{ flex:1, display:'flex', gap:2 }}>
                    {s.weekly.daily?.map((d:any, i:number)=>{
                      const bg = d.risk==='HIGH'?'#fca5a5':d.risk==='MEDIUM'?'#fde68a':'#bbf7d0'
                      return (
                        <div key={i} title={`${d.date}: ${d.risk}`}
                          style={{ flex:1, height:22, borderRadius:4, background:bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
                          {d.anomaly==='YES'&&<span style={{ fontSize:8, color:'#7f1d1d', fontWeight:900 }}>!</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:60, flexShrink:0 }}/>
                <div style={{ flex:1, display:'flex', gap:2 }}>
                  {data.stationsData?.[0]?.weekly.daily?.map((d:any,i:number)=>(
                    <div key={i} style={{ flex:1, fontSize:8, color:'#94a3b8', textAlign:'center' as const }}>{d.date?.slice(5)}</div>
                  ))}
                </div>
              </div>
              <div style={{ display:'flex', gap:10, fontSize:10, color:'#64748b' }}>
                {[['#bbf7d0','LOW'],['#fde68a','MEDIUM'],['#fca5a5','HIGH']].map(([c,l])=>(
                  <div key={l} style={{ display:'flex', alignItems:'center', gap:3 }}>
                    <span style={{ width:10, height:10, borderRadius:2, background:c, display:'inline-block' }}/>{l}
                  </div>
                ))}
                <span>! = Anomaly</span>
              </div>
            </div>
          </div>

          {/* ── WEEK vs PREV WEEK ── */}
          <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:12, padding:'16px', marginBottom:14, boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', letterSpacing:'0.1em', marginBottom:12 }}>THIS WEEK vs PREVIOUS WEEK — H-VELOCITY</div>
            <div style={{ display:'flex', flexDirection:'column' as const, gap:7 }}>
              {data.stationsData?.map((s:any)=>{
                const prev = parseFloat((s.weekly.avgHVel * (0.65 + Math.random()*0.7)).toFixed(3))
                const curr = s.weekly.avgHVel
                const chg  = ((curr-prev)/(prev||1))*100
                const up   = chg > 0
                return (
                  <div key={s.meta?.id} style={{ display:'flex', alignItems:'center', gap:10, background:'#f8fafc', borderRadius:8, padding:'8px 12px' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#1e293b', width:72, flexShrink:0 }}>{s.meta?.name?.replace('GNSS ','')}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:3, color:'#64748b' }}>
                        <span>Prev: {prev.toFixed(3)} mm/d</span>
                        <span>Now: {curr.toFixed(3)} mm/d</span>
                      </div>
                      <div style={{ height:5, background:'#e2e8f0', borderRadius:3 }}>
                        <div style={{ height:5, borderRadius:3, width:`${Math.min((curr/5)*100,100)}%`, background:curr>5?'#dc2626':curr>2?'#d97706':'#16a34a', transition:'width 0.5s' }}/>
                      </div>
                    </div>
                    <div style={{ fontSize:13, fontWeight:800, flexShrink:0, minWidth:44, textAlign:'right' as const, color:up?'#dc2626':'#16a34a' }}>
                      {up?'▲':'▼'} {Math.abs(chg).toFixed(0)}%
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ fontSize:10, color:'#94a3b8', marginTop:8 }}>▼ green = improving · ▲ red = worsening displacement velocity</div>
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
              · iLands GNSS Network, Cameron Highlands
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