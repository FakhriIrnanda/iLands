import { NextResponse } from 'next/server'
import { parseStationCSV, getStationMeta, STATION_IDS } from '@/lib/parseCSV'
import { getActiveEvent } from '@/lib/simState'

function simulateAllSensors(stationsData: any[]) {
  return stationsData.map(s => {
    const isAnomaly = s.latest.score > 50
    return {
      id: s.id, name: s.meta?.name,
      location: s.meta?.location?.split(',')[0],
      sensors: {
        inclinometer: { value: parseFloat((isAnomaly?2.1+Math.random()*1.5:0.3+Math.random()*0.4).toFixed(2)), unit:'°', status:isAnomaly?'WARNING':'NORMAL', label:'Tilt Angle' },
        piezometer:   { value: parseFloat((isAnomaly?85+Math.random()*20:40+Math.random()*20).toFixed(1)),      unit:'kPa', status:isAnomaly?'ELEVATED':'NORMAL', label:'Pore Water Pressure' },
        soilMoisture: { value: parseFloat((isAnomaly?72+Math.random()*15:35+Math.random()*15).toFixed(1)),      unit:'%',   status:isAnomaly?'HIGH':'NORMAL',     label:'Soil Moisture' },
        crackMeter:   { value: parseFloat((isAnomaly?3.2+Math.random()*2:0.1+Math.random()*0.3).toFixed(2)),   unit:'mm',  status:isAnomaly?'WARNING':'NORMAL',   label:'Crack Width' },
      }
    }
  })
}

// Simulate slope hazard data per station
function simulateSlopeHazard(id: string) {
  const hazardMap: Record<string, any> = {
    BAKO: { slope: 28, ndvi: 0.62, geology: 'Granite', road: 'Present', river: 'Nearby 200m' },
    CUSV: { slope: 22, ndvi: 0.71, geology: 'Sedimentary', road: 'Present', river: 'None' },
    MYVA: { slope: 35, ndvi: 0.58, geology: 'Granite', road: 'Present', river: 'Nearby 350m' },
    NTUS: { slope: 18, ndvi: 0.74, geology: 'Alluvium', road: 'Present', river: 'Nearby 100m' },
    SAMP: { slope: 42, ndvi: 0.49, geology: 'Ultramafic', road: 'None', river: 'Nearby 500m' },
  }
  return hazardMap[id] ?? { slope: 25, ndvi: 0.65, geology: 'Mixed', road: 'Unknown', river: 'Unknown' }
}

// Generate prediction probabilities based on data
function generatePrediction(score: number, trend: string, anomDays: number, avgRain: number) {
  const base = score / 100
  const trendBoost = trend === 'Increasing' ? 0.15 : trend === 'Decreasing' ? -0.1 : 0
  const anomBoost  = anomDays * 0.05
  const rainBoost  = avgRain > 20 ? 0.1 : avgRain > 10 ? 0.05 : 0

  const p24 = Math.min(Math.max(base + trendBoost + anomBoost + rainBoost + (Math.random()*0.05), 0.05), 0.95)
  const p48 = Math.min(Math.max(p24 + 0.05 + (Math.random()*0.08), 0.05), 0.95)
  const p72 = Math.min(Math.max(p48 + 0.03 + (Math.random()*0.05), 0.05), 0.95)

  return {
    h24: parseFloat((p24 * 100).toFixed(1)),
    h48: parseFloat((p48 * 100).toFixed(1)),
    h72: parseFloat((p72 * 100).toFixed(1)),
    label: p48 > 0.6 ? 'Risk expected to INCREASE in next 24–48 hours' :
           p48 > 0.35 ? 'Risk may increase within next 48 hours — monitor closely' :
           'Risk expected to remain stable over next 72 hours',
  }
}

export async function GET() {
  const allData = STATION_IDS.map(sid => {
    const meta   = getStationMeta(sid)
    const rows   = parseStationCSV(sid)
    const last7  = rows.slice(-7)
    const last30 = rows.slice(-30)
    const latest = rows[rows.length - 1]

    const avg = (arr: (number|null)[]) => {
      const v = arr.filter(x=>x!==null) as number[]
      return v.length ? parseFloat((v.reduce((a,b)=>a+b,0)/v.length).toFixed(3)) : 0
    }

    const prev7      = rows.slice(-14,-7)
    const avgVel7    = avg(last7.map(r=>r.h_vel_mmday))
    const avgVelPrev = avg(prev7.map(r=>r.h_vel_mmday))
    const trend      = avgVel7 > avgVelPrev*1.2 ? 'Increasing' : avgVel7 < avgVelPrev*0.8 ? 'Decreasing' : 'Stable'
    const anomDays   = last7.filter(r=>r.anomaly_any==='YES').length

    // Simulate rainfall
    const avgRain = 8 + Math.random()*15
    const rain24  = parseFloat((avgRain * (0.8+Math.random()*0.6)).toFixed(1))
    const rainCumulative = parseFloat((avgRain * 7).toFixed(1))
    const rainfallImpact = rain24 > 25 ? 'High' : rain24 > 12 ? 'Moderate' : 'Low'
    const rainfallCorr   = anomDays > 1 ? 'Detected' : 'Not Detected'

    const simEvent = getActiveEvent(sid)
    const liveScore = simEvent ? 100 : latest.risk_score
    const overallStatus = liveScore > 70 ? 'CRITICAL' : liveScore > 35 ? 'WARNING' : 'STABLE'

    const groundCondition = liveScore > 60 ? 'Weak' : liveScore > 30 ? 'Moderate' : 'Stable'

    const prediction = generatePrediction(liveScore, trend, anomDays, avgRain)
    const hazard     = simulateSlopeHazard(sid)

    return {
      id: sid, meta,
      latest: { risk: latest.risk_level, score: liveScore, hVel: latest.h_vel_mmday, uVel: latest.u_vel_mmday, anomaly: simEvent ? 'YES' : latest.anomaly_any, zscoreU: latest.zscore_u },
      gnssData: { e: latest.e_mm, n: latest.n_mm, u: latest.u_mm, hVel: latest.h_vel_mmday, uVel: latest.u_vel_mmday, trend },
      weatherData: { rain24, rainCumulative, intensity: rainfallImpact, rainfallCorr },
      sensorData: { soilMoisture: 35+Math.random()*15, piezometer: 40+Math.random()*20, tilt: 0.3+Math.random()*0.4 },
      hazardData: hazard,
      classification: { riskLevel: overallStatus==='CRITICAL'?'High':overallStatus==='WARNING'?'Medium':'Low', movementTrend: trend, rainfallImpact, groundCondition, anomalyDetected: simEvent ? 'Yes' : anomDays > 0 ? 'Yes' : 'No', overallStatus },
      prediction,
      summary: { trend, rainfallCorr, overallStatus, avgVel7, anomDays, avgRain: parseFloat(avgRain.toFixed(1)) },
      last30: rows.slice(-30).map(r => ({ date:r.date, h_vel:r.h_vel_mmday, u:r.u_mm, risk:r.risk_level })),
    }
  })

  const sensorData   = simulateAllSensors(allData)
  const criticalSites = allData.filter(d=>d.summary.overallStatus==='CRITICAL').length
  const warningSites  = allData.filter(d=>d.summary.overallStatus==='WARNING').length
  const networkStatus = criticalSites>0?'CRITICAL':warningSites>1?'WARNING':'STABLE'
  const increasingSites = allData.filter(d=>d.summary.trend==='Increasing').length
  const totalAnomalyDays = allData.reduce((s,d)=>s+d.summary.anomDays,0)

  const prompt = `You are a senior geotechnical hazard analyst for the Cameron Highlands iLands AI Risk Classification & Prediction System.

Network Status: ${networkStatus} | Sites: 5 GNSS stations, Cameron Highlands
Date: ${new Date().toLocaleDateString('en-GB')}
Critical sites: ${criticalSites} | Warning sites: ${warningSites} | Increasing movement: ${increasingSites}
Total anomaly days (last 7d): ${totalAnomalyDays}

Per-site: ${allData.map(d=>`${d.meta?.name}: Status=${d.classification.overallStatus}, Trend=${d.classification.movementTrend}, RainfallImpact=${d.classification.rainfallImpact}, Ground=${d.classification.groundCondition}, P(48h)=${d.prediction.h48}%`).join(' | ')}

Return ONLY JSON:
{
  "networkStatus": "STABLE"|"WARNING"|"CRITICAL",
  "overallRisk": "Low"|"Medium"|"High",
  "keyFindings": ["finding1","finding2","finding3"],
  "rainfallAssessment": "one sentence",
  "movementAssessment": "one sentence",
  "prioritySite": "site name",
  "recommendation": "one actionable sentence",
  "narrative": "2-3 sentence professional summary"
}`

  try {
    const apiKey = process.env.GROQ_API_KEY
    const mockAI = {
      networkStatus, overallRisk: criticalSites>0?'High':warningSites>0?'Medium':'Low',
      keyFindings: [
        `${increasingSites} of 5 sites showing increasing displacement trend`,
        `${totalAnomalyDays} anomaly days detected across network this week`,
        `Network avg H-velocity: ${(allData.reduce((s,d)=>s+d.summary.avgVel7,0)/5).toFixed(2)} mm/day`,
      ],
      rainfallAssessment: `Rainfall influence ${allData.filter(d=>d.weatherData.rainfallCorr==='Detected').length>1?'detected at multiple sites — elevated pore pressure risk':'not significant across network this period'}.`,
      movementAssessment: `Overall displacement ${networkStatus==='STABLE'?'within acceptable parameters':'showing elevated activity requiring attention'}.`,
      prioritySite: allData.sort((a,b)=>b.latest.score-a.latest.score)[0]?.meta?.name ?? 'RockShed',
      recommendation: totalAnomalyDays>3?'Deploy field inspection within 24 hours to highest-risk sites.':'Maintain standard monitoring cadence and prepare field team on standby.',
      narrative: `The Cameron Highlands GNSS network reports ${networkStatus} conditions across 5 monitoring sites. ${increasingSites>0?`Movement trends are increasing at ${increasingSites} site(s), requiring heightened attention.`:'No accelerating displacement detected.'} Multi-source correlation of GNSS, rainfall, and geotechnical data indicates ${networkStatus==='STABLE'?'stable slope conditions':'elevated hazard potential'}.`
    }

    if (!apiKey) return NextResponse.json({ allData, ai:mockAI, networkStatus, sensorData, generatedAt:new Date().toISOString() })

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},
      body:JSON.stringify({ model:'llama-3.3-70b-versatile', max_tokens:600, temperature:0.3,
        messages:[{role:'system',content:'Geohazard analyst. JSON only.'},{role:'user',content:prompt}] })
    })
    const data = await res.json()
    const text = data.choices?.[0]?.message?.content??''
    try {
      const parsed = JSON.parse(text.replace(/```json|```/g,'').trim())
      return NextResponse.json({ allData, ai:parsed, networkStatus, sensorData, generatedAt:new Date().toISOString() })
    } catch {
      return NextResponse.json({ allData, ai:mockAI, networkStatus, sensorData, generatedAt:new Date().toISOString() })
    }
  } catch {
    return NextResponse.json({ error:'Failed' }, { status:500 })
  }
}