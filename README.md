# Next Weather

Next.js App Router + React + TypeScript weather application using the [OpenWeather API](https://openweathermap.org/api). The Turkish interface, Celsius temperatures, and warm/cold backgrounds are preserved from the Vue application.

## Setup

Use Node.js 22.12 or newer.

TypeScript and the React/Node type packages are regular dependencies because `next build` needs them even when dependencies are installed with `NODE_ENV=production` or `--omit=dev`. Install development dependencies with `npm install --include=dev` to run linting and image optimization.

1. Copy `.env.example` to `.env.local` and add your OpenWeather API key:

```env
# .env.local — xxx yerine kendi OpenWeather API anahtarınızı yazın.
VITE_OPENWEATHER_API_KEY=xxx
```

The Next.js backend reads `process.env.VITE_OPENWEATHER_API_KEY` at request time. Keep it in `.env.local` for development and configure it as a server environment variable on your deployment platform. Restart the server after changing the key. A key is not required to build or run the mocked tests.

2. Install dependencies and start the development server:

```sh
npm install
npm run dev
```

Open `http://localhost:3000`.

## Weather requests

The browser sends the city and the language selected in the UI to the same-origin Next.js endpoint. The UI offers Turkish (`tr`, the default) and English (`en`):

```http
POST /api/weather
Content-Type: application/json

{"city":"İstanbul","lang":"tr"}
```

The server calls `https://api.openweathermap.org/data/2.5/weather` over HTTPS with `q=city`, `units=metric`, `appid=API_KEY`, and `lang=lang`. City and language values are encoded using `URLSearchParams`. A successful response contains only the weather fields displayed in the UI:

```json
{"name":"İstanbul","country":"TR","temperature":18.4,"description":"açık"}
```

Errors return Turkish messages as `{"message":"..."}` with status 400 for malformed JSON, invalid city/language input, or an upstream bad request; 404 for an unknown city; and 500 for a missing server key, provider quota/authentication failures, invalid provider responses, or network failures. Both `city` and `lang` are required strings. Cities are trimmed and limited to 100 characters. Languages are trimmed, lowercased, and accept two-letter codes with an optional region such as `pt_br` or `zh_cn`. Upstream requests time out after 10 seconds. Responses are not cached, and raw provider error bodies are never forwarded. Methods other than POST receive Next.js's automatic 405 response.

The API key stays in the `server-only` route. In Next.js, the `VITE_` prefix does not expose a variable to the client. Do not give it a `NEXT_PUBLIC_` prefix or put it in `next.config.js` under `env`: those approaches expose values to the browser. See the official [Next.js environment variable guide](https://nextjs.org/docs/app/guides/environment-variables). Use your existing OpenWeather account to obtain the key; Next.js does not issue an OpenWeather token. Rotate any key previously exposed in a browser bundle.

### React + TypeScript implementation

The complete, commented API handler is in [app/api/weather/route.ts](app/api/weather/route.ts). The client component in [app/page.tsx](app/page.tsx) stores the successful response in state and manages loading and Turkish error messages. [components/WeatherSearch.tsx](components/WeatherSearch.tsx) supplies the city and selected language; [components/WeatherDisplay.tsx](components/WeatherDisplay.tsx) renders the data typed in [lib/weather.ts](lib/weather.ts). Inputs are disabled while a request is in progress.

### Example fetch call

Use this in a client component or another same-origin browser handler:

```ts
import type { WeatherData } from '@/lib/weather'

async function getWeather(city: string, lang: string): Promise<WeatherData> {
  // API anahtarı gönderilmez; yalnızca şehir ve dil backend'e iletilir.
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

  return response.json()
}

// Bir async olay işleyicisi içinde çağırın; hatayı UI'ın error state'inde yönetin.
const weather = await getWeather('İstanbul', 'tr')
console.log(weather.temperature)
```

## Commands

```sh
npm run build          # Build for production
npm start              # Serve the production build
npm run typecheck      # Check TypeScript
npm run lint           # Check Next.js, React, and TypeScript rules
npm test               # Test the POST handler with mocked OpenWeather responses
npm run optimize:images
```

Deploy to a host that supports the Next.js server or run `npm run build` followed by `npm start` on Node.js. The POST backend requires a running server; a static export cannot handle weather requests. `PORT` can be configured in the server environment.

The tests use Node's built-in TypeScript stripping and the `react-server` condition for the `server-only` import. They require no real key or network access. They cover city/language validation, language forwarding and normalization, runtime credentials, query encoding, response filtering, upstream status codes, malformed responses, and network/timeout failures.

Background images are in `public/images`. `npm run optimize:images` refreshes the AVIF versions and optimizes large JPEGs.

![cold-weather](https://user-images.githubusercontent.com/36512716/175110837-003c4a7b-4713-4b67-9358-ecee9a087278.png)
![warm-weather](https://user-images.githubusercontent.com/36512716/175110849-72277c69-02a2-4541-8735-77ebd4dad61e.png)
