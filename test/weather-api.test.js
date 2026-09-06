import assert from 'node:assert/strict'
import test from 'node:test'

import { fetchCurrentWeather } from '../weather-api.js'

test('build-time API anahtarı eksikse istek göndermeden hata verir', async () => {
  let fetchCalled = false

  await assert.rejects(
    fetchCurrentWeather('Trabzon', {
      fetchImpl: async () => {
        fetchCalled = true
      },
    }),
    { message: 'OpenWeather API anahtarı build sırasında tanımlanmamış.' },
  )

  assert.equal(fetchCalled, false)
})

test('şehir sorgusunu doğrudan OpenWeather isteğine dönüştürür', async () => {
  let calledUrl
  let calledOptions
  const weather = {
    main: { temp: 18.4 },
    name: 'Trabzon',
    sys: { country: 'TR' },
    weather: [{ description: 'açık' }],
  }

  const result = await fetchCurrentWeather(' Trabzon ', {
    apiKey: ' build-key ',
    fetchImpl: async (url, options) => {
      calledUrl = new URL(url)
      calledOptions = options
      return new Response(JSON.stringify(weather), { status: 200 })
    },
  })

  assert.deepEqual(result, weather)
  assert.equal(calledUrl.origin + calledUrl.pathname, 'https://api.openweathermap.org/data/2.5/weather')
  assert.equal(calledUrl.searchParams.get('q'), 'Trabzon')
  assert.equal(calledUrl.searchParams.get('units'), 'metric')
  assert.equal(calledUrl.searchParams.get('lang'), 'tr')
  assert.equal(calledUrl.searchParams.get('appid'), 'build-key')
  assert.equal(calledOptions.headers.Accept, 'application/json')
  assert.ok(calledOptions.signal instanceof AbortSignal)
})

test('OpenWeather hatalarını kullanıcı mesajına dönüştürür', async () => {
  await assert.rejects(
    fetchCurrentWeather('Ankara', {
      apiKey: 'invalid-key',
      fetchImpl: async () => new Response('', { status: 401 }),
    }),
    { message: 'Geçersiz OpenWeather API anahtarı.' },
  )
})
