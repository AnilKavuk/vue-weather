import type { WeatherData } from '@/lib/weather'

type WeatherDisplayProps = {
  weather: WeatherData
  date: string
}

export default function WeatherDisplay({ weather, date }: WeatherDisplayProps) {
  return (
    <div className="weather-wrap">
      <div className="location-box">
        <div className="location">{weather.name}, {weather.country}</div>
        <div className="date">{date}</div>
      </div>
      <div className="weather-box">
        <div className="temp">{Math.round(weather.temperature)}&deg;C</div>
        <div className="weather">{weather.description}</div>
      </div>
    </div>
  )
}
