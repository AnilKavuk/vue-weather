# Vue Weather

Weather project made using OpenWeather API with Vue.js and Vite.

## Setup

1. Create a `.env` file and add your OpenWeather API key:

```env
OPENWEATHER_API_KEY=your_openweather_key
```

2. Install dependencies:

```sh
npm install
```

## Scripts

Start the API proxy server and development server in separate terminals:

```sh
# Terminal 1: Start the API proxy (server-side, protects your API key)
npm run server

# Terminal 2: Start the Vue development server
npm run dev
```

Other commands:

```sh
npm run build
npm run optimize:images
npm run lint
```

## Security Notes

- The API key is kept server-side via the proxy (server.js)
- Never commit real API keys to version control
- Use `.env.local` for local development keys (it's in .gitignore)
- `.tgz` files are ignored to prevent package archives from being committed
- If a key was previously exposed in git history, rotate it in OpenWeather

![cold-weather](https://user-images.githubusercontent.com/36512716/175110837-003c4a7b-4713-4b67-9358-ecee9a087278.png)
![warm-weather](https://user-images.githubusercontent.com/36512716/175110849-72277c69-02a2-4541-8735-77ebd4dad61e.png)
