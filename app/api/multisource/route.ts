import { NextResponse } from 'next/server'
import { parseStationCSV, getStationMeta, STATION_IDS } from '@/lib/parseCSV'

export async function GET() {
  const allData = STATION_IDS.map(sid => {
    const meta  = getStationMeta(sid)
    const rows  = parseStationCSV(sid)
    const last7 = rows.slice(-7)
    const latest = rows[rows.length - 1]
    const avg = (arr: (number|null)[]) => {
      const v = arr.filter(x=>x!==null) as number[]
      return v.length ? parseFloat((v.reduce((a,b)=>a+b,0)/v.length).toFixed(3)) : 0
    }
    const prev7 = rows.slice(-14,-7)
    const avgVel7  = avg(last7.map(r=>r.h_vel_mmday))
    const avgVelP  = avg(prev7.map(r=>r.h_vel_mmday))
    const trend    = avgVel7 > avgVelP*1.2 ? 'Increasing' : avgVel7 < avgVelP*0.8 ? 'Decreasing' : 'Stable'
    const anomDays = last7.filter(r=>r.anomaly_any==='YES').length
    // simulate rainfall correlation
    const avgRain  = 8 + Math.random()*12
    const rainfallCorr = anomDays > 1 ? 'Detected' : 'Not Detected'
    const overallStatus = latest.risk_score > 70 ? 'CRITICAL' : latest.risk_score > 35 ? 'WARNING' : 'STABLE'

    return {
      id: sid, meta,
      latest: {
        risk: latest.risk_level, score: latest.risk_score,
        hVel: latest.h_vel_mmday, uVel: latest.u_vel_mmday,
        anomaly: latest.anomaly_any, zscoreU: latest.zscore_u,
      },
      summary: { trend, rainfallCorr, overallStatus, avgVel7, anomDays, avgRain: parseFloat(avgRain.toFixed(1)) },
      // last 30 days for network chart
      last30: rows.slice(-30).map(r=>({ date:r.date, h_vel:r.h_vel_mmday, risk:r.risk_level, score:r.risk_score }))
    }
  })

  // Network-wide assessment
  const criticalSites  = allData.filter(d=>d.summary.overallStatus==='CRITICAL').length
  const warningSites   = allData.filter(d=>d.summary.overallStatus==='WARNING').length
  const increasingSites = allData.filter(d=>d.summary.trend==='Increasing').length
  const totalAnomalyDays = allData.reduce((s,d)=>s+d.summary.anomDays, 0)
  const networkStatus  = criticalSites>0?'CRITICAL':warningSites>1?'WARNING':'STABLE'

  const prompt = `You are a senior geotechnical hazard analyst for the Cameron Highlands iLands Multi-Source Landslide Early Warning System.

Network Status: ${networkStatus}
Sites: 5 GNSS monitoring stations, Cameron Highlands, Pahang, Malaysia
Date: ${new Date().toLocaleDateString('en-GB')}

Network Summary:
- Critical sites: ${criticalSites}
- Warning sites: ${warningSites}
- Sites with increasing movement: ${increasingSites}
- Total anomaly days across network (last 7 days): ${totalAnomalyDays}

Per-site data:
${allData.map(d=>`${d.meta?.name} (${d.meta?.location?.split(',')[0]}): Status=${d.summary.overallStatus}, Trend=${d.summary.trend}, AvgVel=${d.summary.avgVel7}mm/d, Anomaly=${d.summary.anomDays}days, Rainfall=${d.summary.rainfallCorr}`).join('\n')}

Return ONLY a JSON object (no markdown, no extra text):
{
  "networkStatus": "STABLE"|"WARNING"|"CRITICAL",
  "overallRisk": "Low"|"Medium"|"High",
  "keyFindings": ["finding 1", "finding 2", "finding 3"],
  "rainfallAssessment": "one sentence about rainfall influence across network",
  "movementAssessment": "one sentence about overall movement pattern",
  "prioritySite": "name of site needing most attention",
  "recommendation": "one actionable recommendation for field team",
  "narrative": "2-3 sentence professional summary of network-wide conditions"
}`

  try {
    const apiKey = process.env.GROQ_API_KEY
    const mockAI = {
      networkStatus,
      overallRisk: criticalSites>0?'High':warningSites>0?'Medium':'Low',
      keyFindings: [
        `${increasingSites} of 5 sites showing increasing movement trend`,
        `${totalAnomalyDays} total anomaly days detected across network this week`,
        `Network-wide avg H-velocity: ${(allData.reduce((s,d)=>s+d.summary.avgVel7,0)/5).toFixed(2)} mm/day`,
      ],
      rainfallAssessment: `Rainfall influence ${allData.filter(d=>d.summary.rainfallCorr==='Detected').length > 1 ? 'detected at multiple sites — elevated pore water pressure risk' : 'not significant across network this period'}.`,
      movementAssessment: `Overall displacement patterns are ${networkStatus==='STABLE'?'within acceptable parameters':'showing elevated activity'} with ${warningSites} site(s) requiring attention.`,
      prioritySite: allData.sort((a,b)=>b.latest.score-a.latest.score)[0]?.meta?.name ?? 'RockShed',
      recommendation: totalAnomalyDays>3 ? 'Deploy field inspection team to highest-risk sites within 24 hours.' : 'Maintain standard monitoring cadence and prepare field team on standby.',
      narrative: `The Cameron Highlands GNSS network is currently reporting ${networkStatus} conditions across all 5 monitoring sites. ${increasingSites > 0 ? `Movement trends are increasing at ${increasingSites} site(s), warranting heightened attention.` : 'No accelerating displacement trends detected.'} Continue multi-source data correlation and cross-reference with rainfall intensity records for comprehensive hazard assessment.`
    }

    if (!apiKey) {
      return NextResponse.json({ allData, ai: mockAI, networkStatus, generatedAt: new Date().toISOString() })
    }

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${apiKey}` },
      body: JSON.stringify({
        model:'llama-3.3-70b-versatile', max_tokens:600, temperature:0.3,
        messages:[
          { role:'system', content:'You are a geohazard analyst. Always respond with valid JSON only.' },
          { role:'user', content:prompt }
        ],
      }),
    })
    const data = await res.json()
    const text = data.choices?.[0]?.message?.content ?? ''
    try {
      const parsed = JSON.parse(text.replace(/```json|```/g,'').trim())
      return NextResponse.json({ allData, ai:parsed, networkStatus, generatedAt:new Date().toISOString() })
    } catch {
      return NextResponse.json({ allData, ai:mockAI, networkStatus, generatedAt:new Date().toISOString() })
    }
  } catch {
    return NextResponse.json({ error:'Failed' }, { status:500 })
  }
}