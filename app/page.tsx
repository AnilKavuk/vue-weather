'use client'

import { useState } from 'react'

import WeatherDisplay from '@/components/WeatherDisplay'
import WeatherSearch from '@/components/WeatherSearch'
import type { WeatherData } from '@/lib/weather'

export default function WeatherPage() {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [date, setDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function fetchWeather(city: string, lang: string) {
    setLoading(true)
    setMessage('')

    try {
      // Tarayıcı yalnızca kendi backend'imize şehir ve dil gönderir; API anahtarı içermez.
      const response = await fetch('/api/weather', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, lang }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(
          typeof error?.message === 'string' ? error.message : 'Hava durumu alınamadı.',
        )
      }

      const data: WeatherData = await response.json()
      // Başarılı JSON yanıtını state'e yazarak ekranda göster.
      setWeather(data)
      setDate(new Intl.DateTimeFormat(lang === 'tr' ? 'tr-TR' : 'en-US', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date()))
    } catch (error) {
      setWeather(null)
      setMessage(error instanceof Error ? error.message : 'Hava durumu alınamadı.')
    } finally {
      // İstek başarılı olsa da hata verse de yükleme durumunu kapat.
      setLoading(false)
    }
  }

  return (
    <div id="app" className={weather && weather.temperature > 16 ? 'warm' : undefined}>
      <main>
        <h1 className="sr-only">Hava durumu</h1>
        <WeatherSearch loading={loading} onSearch={fetchWeather} />
        <p className="status" role="status">{loading ? 'Hava durumu yükleniyor...' : message}</p>
        <div aria-live="polite" aria-busy={loading}>
          {weather && <WeatherDisplay weather={weather} date={date} />}
        </div>
      </main>
    </div>
  )
}
