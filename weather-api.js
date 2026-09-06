const OPENWEATHER_URL = 'https://api.openweathermap.org/data/2.5/weather'

const STATUS_MESSAGES = {
  401: 'Geçersiz OpenWeather API anahtarı.',
  404: 'Şehir bulunamadı.',
  429: 'OpenWeather API kullanım limiti aşıldı.',
}

async function parseJson(response) {
  const responseText = await response.text()

  if (!responseText) {
    return null
  }

  try {
    return JSON.parse(responseText)
  } catch {
    return null
  }
}

export async function fetchCurrentWeather(city, { apiKey, fetchImpl = fetch } = {}) {
  const normalizedApiKey = apiKey?.trim()
  const normalizedCity = city?.trim()

  if (!normalizedApiKey) {
    throw new Error('OpenWeather API anahtarı build sırasında tanımlanmamış.')
  }

  if (!normalizedCity) {
    throw new Error('Şehir parametresi gerekli.')
  }

  const weatherParams = new URLSearchParams({
    q: normalizedCity,
    units: 'metric',
    appid: normalizedApiKey,
    lang: 'tr',
  })

  let response

  try {
    response = await fetchImpl(`${OPENWEATHER_URL}?${weatherParams}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    throw new Error('OpenWeather servisine bağlanılamadı.')
  }

  const data = await parseJson(response)

  if (!response.ok) {
    throw new Error(
      STATUS_MESSAGES[response.status]
        || data?.message
        || 'Hava durumu alınamadı.',
    )
  }

  if (!data) {
    throw new Error('OpenWeather geçersiz veya boş bir yanıt döndürdü.')
  }

  return data
}
