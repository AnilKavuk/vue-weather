import { createServer } from 'http'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadEnvFile } from 'node:process'

for (const envFile of ['.env.local', '.env']) {
  const envPath = resolve(envFile)

  if (existsSync(envPath)) {
    loadEnvFile(envPath)
  }
}

const API_KEY = process.env.OPENWEATHER_API_KEY?.trim()

if (!API_KEY) {
  console.error('Error: Add OPENWEATHER_API_KEY to .env.local before starting the API server')
  process.exit(1)
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

const server = createServer(async (req, res) => {
  const requestUrl = new URL(req.url, 'http://localhost')
  const pathname = requestUrl.pathname

  if (pathname === '/api/weather' && req.method === 'GET') {
    const city = requestUrl.searchParams.get('q')
    const units = requestUrl.searchParams.get('units')
    const lang = requestUrl.searchParams.get('lang')

    if (!city) {
      sendJson(res, 400, { message: 'Şehir parametresi gerekli.' })
      return
    }

    try {
      const weatherParams = new URLSearchParams({
        q: city,
        units: units || 'metric',
        appid: API_KEY,
        lang: lang || 'tr',
      })
      const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?${weatherParams.toString()}`

      const response = await fetch(weatherUrl)
      const responseText = await response.text()
      let data = null

      if (responseText) {
        try {
          data = JSON.parse(responseText)
        } catch {
          // The client always receives JSON, even if the upstream service does not.
        }
      }

      if (!response.ok) {
        const statusMessages = {
          401: 'Geçersiz OpenWeather API anahtarı.',
          404: 'Şehir bulunamadı.',
          429: 'OpenWeather API kullanım limiti aşıldı.',
        }
        const message = statusMessages[response.status] || data?.message || 'Hava durumu alınamadı.'

        sendJson(res, response.status, { message })
        return
      }

      if (!data) {
        sendJson(res, 502, { message: 'OpenWeather geçersiz veya boş bir yanıt döndürdü.' })
        return
      }

      sendJson(res, response.status, data)
    } catch {
      sendJson(res, 502, { message: 'OpenWeather servisine bağlanılamadı.' })
    }
  } else {
    sendJson(res, 404, { message: 'Endpoint bulunamadı.' })
  }
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`Weather API proxy running on port ${PORT}`)
})
