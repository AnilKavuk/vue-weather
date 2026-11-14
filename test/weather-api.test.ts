import assert from 'node:assert/strict'
import test, { afterEach, beforeEach, mock } from 'node:test'

import { POST } from '../app/api/weather/route.ts'

const serverKey = 'server-only-test-secret'
const originalApiKey = process.env.OPENWEATHER_API_KEY
const providerWeather = {
  main: { temp: 18.4 },
  name: 'Trabzon',
  sys: { country: 'TR' },
  weather: [{ description: 'açık', main: 'Clear' }],
}

beforeEach(() => {
  process.env.OPENWEATHER_API_KEY = ` ${serverKey} `
})

afterEach(() => {
  mock.restoreAll()
  if (originalApiKey === undefined) {
    delete process.env.OPENWEATHER_API_KEY
  } else {
    process.env.OPENWEATHER_API_KEY = originalApiKey
  }
})

function weatherRequest(body: unknown) {
  return new Request('http://localhost:3000/api/weather', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

test('POST proxies the trimmed city with the server key and returns only weather fields', async () => {
  const upstream = mock.method(globalThis, 'fetch', async () => Response.json({
    ...providerWeather,
    appid: serverKey,
    message: `https://api.openweathermap.org/?appid=${serverKey}`,
  }))

  const response = await POST(weatherRequest({ city: ' Trabzon ', apiKey: 'browser-key' }))

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.deepEqual(await response.json(), {
    name: 'Trabzon', country: 'TR', temperature: 18.4, description: 'açık',
  })
  assert.equal(upstream.mock.callCount(), 1)
  const [input, options] = upstream.mock.calls[0].arguments
  const url = new URL(String(input))
  assert.equal(url.origin + url.pathname, 'https://api.openweathermap.org/data/2.5/weather')
  assert.equal(url.searchParams.get('q'), 'Trabzon')
  assert.equal(url.searchParams.get('units'), 'metric')
  assert.equal(url.searchParams.get('lang'), 'tr')
  assert.equal(url.searchParams.get('appid'), serverKey)
  assert.equal(new Headers(options?.headers).get('Accept'), 'application/json')
  assert.equal(options?.cache, 'no-store')
  assert.ok(options?.signal instanceof AbortSignal)
})

test('the server key is read at request time, so a build-time value is unnecessary', async () => {
  const upstream = mock.method(globalThis, 'fetch', async () => Response.json(providerWeather))
  process.env.OPENWEATHER_API_KEY = 'rotated-runtime-key'
  const response = await POST(weatherRequest({ city: 'Trabzon' }))
  assert.equal(response.status, 200)
  assert.equal(new URL(String(upstream.mock.calls[0].arguments[0])).searchParams.get('appid'), 'rotated-runtime-key')
})

test('query characters in a city cannot replace the server API key', async () => {
  const upstream = mock.method(globalThis, 'fetch', async () => Response.json(providerWeather))
  const city = 'İstanbul &appid=browser-key'
  await POST(weatherRequest({ city }))
  const url = new URL(String(upstream.mock.calls[0].arguments[0]))
  assert.equal(url.searchParams.get('q'), city)
  assert.deepEqual(url.searchParams.getAll('appid'), [serverKey])
})

test('missing and blank server keys return 503 without an upstream request', async () => {
  const upstream = mock.method(globalThis, 'fetch', async () => Response.json(providerWeather))
  for (const key of [undefined, '', '   ']) {
    if (key === undefined) delete process.env.OPENWEATHER_API_KEY
    else process.env.OPENWEATHER_API_KEY = key
    const response = await POST(weatherRequest({ city: 'Ankara' }))
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { message: 'Hava durumu servisi henüz yapılandırılmamış.' })
  }
  assert.equal(upstream.mock.callCount(), 0)
})

test('invalid cities and non-object bodies return 400 without an upstream request', async () => {
  const upstream = mock.method(globalThis, 'fetch', async () => Response.json(providerWeather))
  for (const body of [null, [], 'Ankara', {}, { city: 42 }, { city: [] }, { city: {} }, { city: '' }, { city: '   ' }, { city: 'a'.repeat(101) }]) {
    const response = await POST(weatherRequest(body))
    assert.equal(response.status, 400, JSON.stringify(body))
    assert.equal(typeof (await response.json()).message, 'string')
  }
  assert.equal(upstream.mock.callCount(), 0)
})

test('malformed JSON returns 400 without an upstream request', async () => {
  const upstream = mock.method(globalThis, 'fetch', async () => Response.json(providerWeather))
  const response = await POST(new Request('http://localhost/api/weather', { method: 'POST', body: '{' }))
  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { message: 'Geçerli bir JSON gövdesi gönderin.' })
  assert.equal(upstream.mock.callCount(), 0)
})

for (const [providerStatus, status] of [[404, 404], [429, 429], [401, 502], [403, 502], [500, 502]]) {
  test(`upstream ${providerStatus} returns ${status} without disclosing provider errors or credentials`, async () => {
    mock.method(globalThis, 'fetch', async () => Response.json({ message: `Provider error: appid=${serverKey}` }, { status: providerStatus }))
    const response = await POST(weatherRequest({ city: 'Ankara' }))
    assert.equal(response.status, status)
    const text = await response.text()
    assert.equal(text.includes(serverKey), false)
    assert.equal(text.includes('appid'), false)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.equal(typeof JSON.parse(text).message, 'string')
    if (providerStatus === 404) assert.equal(JSON.parse(text).message, 'Şehir bulunamadı.')
  })
}

test('network errors and timeouts never expose the upstream URL or key', async () => {
  for (const error of [
    new TypeError(`Failed to fetch https://api.openweathermap.org/?appid=${serverKey}`),
    new DOMException(`appid=${serverKey}`, 'TimeoutError'),
  ]) {
    mock.method(globalThis, 'fetch', async () => { throw error })
    const response = await POST(weatherRequest({ city: 'Ankara' }))
    assert.equal(response.status, 502)
    assert.deepEqual(await response.json(), { message: 'Hava durumu servisine bağlanılamadı.' })
  }
})

test('invalid or empty upstream JSON returns a safe 502', async () => {
  for (const body of ['', 'not json', 'null', '{}', JSON.stringify({ ...providerWeather, main: { temp: '18' } }), JSON.stringify({ ...providerWeather, weather: [] })]) {
    mock.method(globalThis, 'fetch', async () => new Response(body))
    const response = await POST(weatherRequest({ city: 'Ankara' }))
    assert.equal(response.status, 502)
    assert.equal(typeof (await response.json()).message, 'string')
  }
})

test('the weather condition falls back to main when its description is unavailable', async () => {
  mock.method(globalThis, 'fetch', async () => Response.json({ ...providerWeather, weather: [{ main: 'Clear' }] }))
  const response = await POST(weatherRequest({ city: 'Ankara' }))
  assert.equal(response.status, 200)
  assert.equal((await response.json()).description, 'Clear')
})
