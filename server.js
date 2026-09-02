import { createServer } from 'http'
import { parse } from 'url'

const API_KEY = process.env.OPENWEATHER_API_KEY

if (!API_KEY) {
  console.error('Error: OPENWEATHER_API_KEY environment variable is not set')
  process.exit(1)
}

const server = createServer(async (req, res) => {
  const parsedUrl = parse(req.url, true)
  const pathname = parsedUrl.pathname

  if (pathname === '/api/weather' && req.method === 'GET') {
    const { q: city, units, lang } = parsedUrl.query

    if (!city) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'City parameter is required' }))
      return
    }

    try {
      const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=${units || 'metric'}&appid=${API_KEY}&lang=${lang || 'tr'}`

      const response = await fetch(weatherUrl)
      const data = await response.json()

      res.writeHead(response.status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(data))
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Failed to fetch weather data' }))
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Not found' }))
  }
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`Weather API proxy running on port ${PORT}`)
})
