'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'

type WeatherSearchProps = {
  loading: boolean
  onSearch: (city: string, lang: string) => Promise<void>
}

export default function WeatherSearch({ loading, onSearch }: WeatherSearchProps) {
  const [query, setQuery] = useState('')
  // Dil kodu da şehir adı gibi UI'dan backend'e gönderilir.
  const [lang, setLang] = useState('tr')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const city = query.trim()

    if (city && !loading) {
      void onSearch(city, lang)
    }
  }

  return (
    <form className="search-box" onSubmit={handleSubmit} role="search">
      <div className="language-field">
        <label htmlFor="lang">Hava durumu dili</label>
        <select
          id="lang"
          name="lang"
          value={lang}
          onChange={(event) => setLang(event.target.value)}
          disabled={loading}
        >
          <option value="tr">Türkçe</option>
          <option value="en">English</option>
        </select>
      </div>
      <label className="sr-only" htmlFor="city">Şehir ara</label>
      <input
        id="city"
        name="city"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        type="search"
        className="search-bar"
        placeholder="Şehir ara..."
        autoComplete="off"
        maxLength={100}
        disabled={loading}
      />
      <button className="search-button" type="submit" disabled={loading || !query.trim()}>
        {loading ? 'Aranıyor' : 'Ara'}
      </button>
    </form>
  )
}
