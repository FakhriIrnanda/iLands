import { NextResponse } from 'next/server'
import { getSimState, setSimEvent, clearSimEvent } from '@/lib/simState'
import { STATION_IDS } from '@/lib/parseCSV'

export async function POST(req: Request) {
  const body = await req.json()
  const { stationId, action, intensity = 2 } = body

  if (action === 'trigger' && STATION_IDS.includes(stationId)) {
    setSimEvent(stationId, {
      active: true,
      type: 'landslide',
      stationId,
      startedAt: Date.now(),
      durationMs: 8 * 60 * 1000, // 8 min
      intensity,
    })
    return NextResponse.json({ ok: true, message: `Landslide event triggered at ${stationId}` })
  }

  if (action === 'reset') {
    clearSimEvent(stationId)
    return NextResponse.json({ ok: true, message: `Reset ${stationId}` })
  }

  if (action === 'reset_all') {
    STATION_IDS.forEach(id => clearSimEvent(id))
    return NextResponse.json({ ok: true, message: 'All simulations reset' })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

export async function GET() {
  return NextResponse.json(getSimState())
}