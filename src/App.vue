<template>
  <div id="app" :class="{ warm: isWarm }">
    <main>
      <form class="search-box" @submit.prevent="fetchWeather">
        <input
          v-model.trim="query"
          type="search"
          class="search-bar"
          placeholder="Şehir ara..."
          autocomplete="off"
          :disabled="loading"
        />
        <button class="search-button" type="submit" :disabled="loading || !query">
          {{ loading ? 'Aranıyor' : 'Ara' }}
        </button>
      </form>

      <p v-if="message" class="status">{{ message }}</p>

      <div v-if="hasWeather" class="weather-wrap">
        <div class="location-box">
          <div class="location">{{ weather.name }}, {{ weather.sys.country }}</div>
          <div class="date">{{ formattedDate }}</div>
        </div>

        <div class="weather-box">
          <div class="temp">{{ roundedTemp }}&deg;C</div>
          <div class="weather">{{ weather.weather[0].description || weather.weather[0].main }}</div>
        </div>
      </div>
    </main>
  </div>
</template>

<script>
// Uses server-side proxy (server.js) to protect API key
const WEATHER_API_URL = '/api/weather'

export default {
  name: 'App',
  data() {
    return {
      query: '',
      weather: null,
      loading: false,
      message: '',
    }
  },
  computed: {
    hasWeather() {
      return Boolean(this.weather?.main && this.weather?.sys && this.weather?.weather?.length)
    },
    isWarm() {
      return this.hasWeather && this.weather.main.temp > 16
    },
    roundedTemp() {
      return this.hasWeather ? Math.round(this.weather.main.temp) : ''
    },
    formattedDate() {
      return new Intl.DateTimeFormat('tr-TR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date())
    },
  },
  methods: {
    async fetchWeather() {
      const city = this.query.trim()

      if (!city) {
        return
      }

      this.loading = true
      this.message = ''

      try {
        const params = new URLSearchParams({
          q: city,
          units: 'metric',
          lang: 'tr',
        })
        const response = await fetch(`${WEATHER_API_URL}?${params.toString()}`)
        const results = await response.json()

        if (!response.ok) {
          throw new Error(results.message || 'Hava durumu alınamadı.')
        }

        this.weather = results
      } catch (error) {
        this.weather = null
        this.message = error instanceof Error ? error.message : 'Hava durumu alınamadı.'
      } finally {
        this.loading = false
      }
    },
  },
}
</script>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: Montserrat, Arial, sans-serif;
}

button,
input {
  font: inherit;
}

#app {
  min-width: 100%;
  min-height: 100vh;
  background-image: url('./assets/cold-bg.jpeg');
  background-image: image-set(
    url('./assets/cold-bg.avif') type('image/avif'),
    url('./assets/cold-bg.jpeg') type('image/jpeg')
  );
  background-position: bottom;
  background-size: cover;
  transition: 0.4s;
}

#app.warm {
  background-image: url('./assets/warm-bg.jpeg');
  background-image: image-set(
    url('./assets/warm-bg.avif') type('image/avif'),
    url('./assets/warm-bg.jpeg') type('image/jpeg')
  );
}

main {
  min-height: 100vh;
  padding: 25px;
  background-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.25), rgba(0, 0, 0, 0.75));
}

.search-box {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  width: min(100%, 720px);
  margin: 0 auto 30px;
}

.search-bar {
  display: block;
  width: 100%;
  min-width: 0;
  padding: 15px;
  color: #313131;
  font-size: 20px;
  appearance: none;
  border: none;
  border-radius: 0 16px;
  outline: none;
  background: rgba(255, 255, 255, 0.25);
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.25);
  transition: 0.4s;
}

.search-bar:focus {
  border-radius: 16px 0;
  background-color: rgba(255, 255, 255, 0.85);
  box-shadow: 0 0 16px rgba(0, 0, 0, 0.25);
}

.search-button {
  min-width: 92px;
  padding: 0 18px;
  color: #111827;
  font-weight: 700;
  border: none;
  border-radius: 0 16px;
  background: rgba(255, 255, 255, 0.85);
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.25);
  cursor: pointer;
  transition: 0.2s;
}

.search-button:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.status {
  width: min(100%, 720px);
  margin: 0 auto 24px;
  color: #fff;
  font-size: 18px;
  font-weight: 600;
  text-align: center;
  text-shadow: 1px 2px rgba(0, 0, 0, 0.25);
}

.location-box .location {
  color: #fff;
  font-size: 32px;
  font-weight: 500;
  text-align: center;
  text-shadow: 1px 3px rgba(0, 0, 0, 0.25);
}

.location-box .date {
  color: #fff;
  font-size: 20px;
  font-style: italic;
  font-weight: 300;
  text-align: center;
}

.weather-box {
  text-align: center;
}

.weather-box .temp {
  display: inline-block;
  max-width: 100%;
  margin: 30px 0;
  padding: 10px 25px;
  color: #fff;
  font-size: clamp(70px, 14vw, 102px);
  font-weight: 900;
  background-color: rgba(255, 255, 255, 0.25);
  border-radius: 16px;
  box-shadow: 3px 6px rgba(0, 0, 0, 0.25);
  text-shadow: 3px 6px rgba(0, 0, 0, 0.25);
}

.weather-box .weather {
  color: #fff;
  font-size: clamp(34px, 8vw, 48px);
  font-style: italic;
  font-weight: 900;
  text-transform: capitalize;
  text-shadow: 3px 6px rgba(0, 0, 0, 0.25);
}

@media (max-width: 520px) {
  main {
    padding: 18px;
  }

  .search-box {
    grid-template-columns: 1fr;
  }

  .search-button {
    min-height: 48px;
  }
}
</style>
