import 'server-only'

import type { WeatherData } from '../../../lib/weather.ts'

export const runtime = 'nodejs'

const OPENWEATHER_URL = 'https://api.openweathermap.org/data/2.5/weather'

function json(body: WeatherData | { message: string }, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseWeather(data: unknown): WeatherData | null {
  if (
    !isRecord(data)
    || typeof data.name !== 'string'
    || !data.name.trim()
    || !isRecord(data.sys)
    || typeof data.sys.country !== 'string'
    || !isRecord(data.main)
    || typeof data.main.temp !== 'number'
    || !Number.isFinite(data.main.temp)
    || !Array.isArray(data.weather)
    || !isRecord(data.weather[0])
  ) {
    return null
  }

  const condition = data.weather[0]
  const description = typeof condition.description === 'string' && condition.description.trim()
    ? condition.description
    : condition.main

  if (typeof description !== 'string' || !description.trim()) {
    return null
  }

  // Only expose the fields rendered by the UI, never the raw provider payload.
  return {
    name: data.name,
    country: data.sys.country,
    temperature: data.main.temp,
    description,
  }
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return json({ message: 'Geçerli bir JSON gövdesi gönderin.' }, 400)
  }

  if (!isRecord(body) || typeof body.city !== 'string' || !body.city.trim()) {
    return json({ message: 'Şehir parametresi gerekli.' }, 400)
  }

  const city = body.city.trim()

  if (city.length > 100) {
    return json({ message: 'Şehir adı en fazla 100 karakter olabilir.' }, 400)
  }

  const apiKey = process.env.OPENWEATHER_API_KEY?.trim()

  if (!apiKey) {
    return json({ message: 'Hava durumu servisi henüz yapılandırılmamış.' }, 503)
  }

  const url = new URL(OPENWEATHER_URL)
  url.search = new URLSearchParams({ q: city, units: 'metric', lang: 'tr', appid: apiKey }).toString()

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })

    if (response.status === 404) {
      return json({ message: 'Şehir bulunamadı.' }, 404)
    }

    if (response.status === 429) {
      return json({ message: 'Hava durumu servisi kullanım limiti aşıldı. Lütfen daha sonra tekrar deneyin.' }, 429)
    }

    if (!response.ok) {
      return json({ message: 'Hava durumu servisine şu anda erişilemiyor.' }, 502)
    }

    const weather = parseWeather(await response.json())

    if (!weather) {
      return json({ message: 'Hava durumu servisinden geçersiz bir yanıt alındı.' }, 502)
    }

    return json(weather)
  } catch {
    // Fetch errors may contain the upstream URL (including appid); never echo them.
    return json({ message: 'Hava durumu servisine bağlanılamadı.' }, 502)
  }
}
