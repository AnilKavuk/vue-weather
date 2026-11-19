# Troubleshooting Guide: Next.js Weather App Deployment (vue-weather.flyingsycamore.com.tr)

> **Not:** Bu rehber `vue-weather.flyingsycamore.com.tr` domaininde 404 → 502 geçişi yaşanan Next.js uygulaması için hazırlanmıştır. Cloudflare proxy (turuncu bulut) aktif varsayılmıştır.

---

## 1. Doğrulama Katmanı — Her Katmanı İzole Ederek Test Etme

### 1.1 Cloudflare Edge (DNS + Proxy)
```bash
# DNS çözümlemesi - Cloudflare IP'si mi dönüyor?
dig +short vue-weather.flyingsycamore.com.tr
# Beklenen: 2606:4700:3035::6815:456a gibi Cloudflare IPv6 aralığı (2606:4700::/32)
# VEYA 104.x.x.x / 172.64.x.x gibi Cloudflare IPv4 aralıkları

# HTTP başlıklarını kontrol et (CF-RAY, Server header)
curl -I https://vue-weather.flyingsycamore.com.tr/
# Beklenen: 
#   HTTP/2 200/404/502
#   cf-ray: <ray-id>
#   server: cloudflare
#   x-content-type-options: nosniff
```

### 1.2 Cloudflare → Origin Bağlantısı (Bypass Test)
```bash
# Origin IP'sini biliyorsanız (örn. 1.2.3.4) Host header ile doğrudan test:
curl -v -H "Host: vue-weather.flyingsycamore.com.tr" http://ORIGIN_IP/
# Veya HTTPS origin ise:
curl -vk -H "Host: vue-weather.flyingsycamore.com.tr" https://ORIGIN_IP/

# Beklenen çıktılar:
#   200 OK + HTML içeriği → Origin ayakta, Cloudflare konfig sorunu
#   404 Not Found → Origin'de route/build yolu yanlış (try_files eksik)
#   502 Bad Gateway → Origin (nginx/container) ayakta DEĞİL
#   504 Gateway Timeout → Origin cevap vermiyor (timeout)
#   TLS hatası (SSL handshake) → Cloudflare "Full (strict)" + self-signed sertifika
```

### 1.3 Load Balancer / Reverse Proxy (nginx, Traefik, Caddy vb.)
```bash
# Sunucu üzerinde nginx konfigürasyon testi
nginx -t
# Beklenen: "syntax is ok" + "test is successful"

# nginx erişim logları (son 50 satır)
tail -50 /var/log/nginx/access.log
# Hata logları
tail -50 /var/log/nginx/error.log

# nginx upstream durumu (status modülü açıksa)
curl http://localhost/nginx_status
```

### 1.4 Container / Process Seviyesi
```bash
# Docker Compose
docker compose ps
# Beklenen: STATUS "Up" (healthy varsa "healthy")
docker compose logs --tail=100 <service-name>

# Kubernetes
kubectl get pods -n <namespace> -l app=vue-weather
kubectl describe pod <pod-name> -n <namespace>
kubectl logs <pod-name> -n <namespace> --tail=100
kubectl exec -it <pod-name> -n <namespace> -- wget -qO- http://localhost:3000/

# Systemd / Bare metal
systemctl status <service-name>
journalctl -u <service-name> -n 100 --no-pager
```

### 1.5 Uygulama Seviyesi (Next.js)
```bash
# Container içinde veya sunucuda doğrudan
curl -v http://localhost:3000/
# Beklenen: 200 OK + HTML (Next.js render edilmiş sayfa)

# Health check endpoint'i varsa
curl http://localhost:3000/api/health
# Next.js'de varsayılan yok, custom eklenmeli
```

### 1.6 SSL/TLS Doğrulama (Cloudflare "Full (strict)" modunda kritik)
```bash
# Origin sertifikasını test et
openssl s_client -connect ORIGIN_IP:443 -servername vue-weather.flyingsycamore.com.tr -showcerts </dev/null
# Beklenen: 
#   Verify return code: 0 (ok) → Geçerli CA imzalı sertifika
#   Verify return code: 18/19/20 → Self-signed / expired / CN mismatch → 502 sebebi

# Cloudflare Origin CA sertifikası mı kullanıyorsunuz?
#   Evet → "Full (strict)" çalışır
#   Hayır (Let's Encrypt, self-signed) → "Full" (strict olmadan) veya "Flexible" kullanın
```

---

## 2. 404 Analizi (Next.js SPA / Static Export Özelinde)

> **Önemli:** Bu proje **Next.js App Router** kullanıyor ve `next.config.js` içinde `output: 'export'` YOK. Bu yüzden **static export DEĞİL**, Node.js sunucusu gerektiren **standalone/SSR** modunda çalışıyor. `npm start` ile çalıştırılır.

### 2.1 nginx `try_files` Konfigürasyonu (Reverse Proxy Senaryosu)
```nginx
# Eğer nginx reverse proxy olarak Next.js'e (localhost:3000) yönlendiriyorsa:
location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    proxy_read_timeout 60s;
    proxy_send_timeout 60s;
}

# STATIC EXPORT (out/ klasörü) kullanıyorsanız try_files GEREKLİ:
# location / {
#     root /var/www/html;
#     try_files $uri $uri/ /index.html;
# }
```

### 2.2 Subpath Deploy (`vue-weather` alt yolunda) — **Bu Proje İçin UYGULANABİLİR**
Eğer domain `https://vue-weather.flyingsycamore.com.tr/` **veya** `https://example.com/vue-weather/` alt yolunda servis ediliyorsa:

**next.config.js güncellemesi:**
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Alt path deploy için (örn. /vue-weather/)
  basePath: '/vue-weather',
  // Asset prefix de aynı olmalı (CDN/static dosyalar için)
  assetPrefix: '/vue-weather',
  // Output standalone Docker için önerilir
  output: 'standalone',
}

export default nextConfig
```

**nginx'de basePath için rewrite (eğer reverse proxy ise):**
```nginx
location /vue-weather/ {
    proxy_pass http://localhost:3000/vue-weather/;  # trailing slash önemli!
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Prefix /vue-weather;
    # ... diğer proxy header'ları
}

# Kök / isteğini /vue-weather/ yönlendirmek isterseniz:
location = / {
    return 302 /vue-weather/;
}
```

### 2.3 `dist/` / `.next/standalone` Doğrulama
```bash
# Build sonrası çıktıları kontrol et
ls -la .next/
# Beklenen: 
#   standalone/          (output: 'standalone' ise)
#   static/              (static assets)
#   server/              (server bundle)

# Docker build context'inde COPY doğru mu?
# Dockerfile örneği:
# COPY --from=builder /app/.next/standalone ./
# COPY --from=builder /app/.next/static ./.next/static
# COPY --from=builder /app/public ./public

# Container içinde doğrulama:
docker exec <container> ls -la /app/.next/standalone/
docker exec <container> ls -la /app/.next/static/
```

---

## 3. 502 Analizi

### 3.1 Cloudflare 502 Verirken Origin'e Doğrudan Erişim Testi
```bash
# YÖNTEM 1: Host header ile IP'ye curl (en yaygın)
curl -v -H "Host: vue-weather.flyingsycamore.com.tr" http://ORIGIN_IP:PORT/
curl -vk -H "Host: vue-weather.flyingsycamore.com.tr" https://ORIGIN_IP:PORT/

# YÖNTEM 2: /etc/hosts ile DNS bypass (yerel test)
echo "ORIGIN_IP vue-weather.flyingsycamore.com.tr" >> /etc/hosts
curl -v https://vue-weather.flyingsycamore.com.tr/
# Test bitince /etc/hosts satırını silin

# YÖNTEM 3: Cloudflare Tunnel / TryCloudflare (geçici public URL)
cloudflared tunnel --url http://localhost:3000
# Verdiği *.trycloudflare.com URL'i ile test edin
```

### 3.2 nginx Upstream / Container Port Eşleşmesi Kontrol Listesi
| Kontrol | Komut | Beklenen |
|----------|-------|----------|
| nginx upstream port | `grep -r proxy_pass /etc/nginx/` | `http://localhost:3000` veya `http://app:3000` |
| Container port expose | `docker compose ps` / `docker inspect` | `3000/tcp` listed |
| Next.js port | `grep -r "port" next.config.js` / `process.env.PORT` | `3000` (varsayılan) |
| Health check | `curl http://localhost:3000/api/health` | 200 OK (custom endpoint gerekir) |
| Network (Docker) | `docker network inspect <network>` | Container'lar aynı network'te |
| Network (K8s) | `kubectl get svc -n <ns>` | Service port 3000 → targetPort 3000 |

### 3.3 Cloudflare "Full (strict)" SSL Modunda Origin Sertifika Sorunları
```bash
# Cloudflare SSL/TLS → Overview sekmesinde:
#   - "Full (strict)" → Origin'de GEÇERLİ CA imzalı sertifika ZORUNLU
#   - "Full" → Self-signed da kabul edilir (ancak MITM riski)
#   - "Flexible" → Cloudflare → Origin HTTP, sadece Client → Cloudflare HTTPS

# 502 alıyorsanız ve "Full (strict)" kullanıyorsanız:
# 1. Origin sertifikası geçerli mi? (openssl test yukarıda)
# 2. Cloudflare Origin CA sertifikası mı kullanıyorsunuz?
#    - Evet: Cloudflare dashboard → SSL/TLS → Origin Server → Create Certificate
#    - Hayır: Let's Encrypt / self-signed → "Full" moduna düşürün
```

### 3.4 Docker Compose / Kubernetes Özel Kontroller
```yaml
# compose.yaml örneği (projenin gerçek dosyası için bkz. 5.5)
services:
  app:
    build: .
    ports:
      - "3000:3000"          # Host:Container
    environment:
      - PORT=3000            # Next.js PORT env'ini okur
      - VITE_OPENWEATHER_API_KEY=${VITE_OPENWEATHER_API_KEY}
    healthcheck:
      # 127.0.0.1: `localhost` ::1'e çözülebilir, Next.js IPv4'e bind olur.
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    networks:
      - app-network

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      app:
        condition: service_healthy
    networks:
      - app-network

networks:
  app-network:
    driver: bridge
```

```yaml
# Kubernetes Deployment + Service örneği
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vue-weather
spec:
  replicas: 2
  selector:
    matchLabels:
      app: vue-weather
  template:
    metadata:
      labels:
        app: vue-weather
    spec:
      containers:
      - name: app
        image: your-registry/vue-weather:latest
        ports:
        - containerPort: 3000
        env:
        - name: PORT
          value: "3000"
        - name: VITE_OPENWEATHER_API_KEY
          valueFrom:
            secretKeyRef:
              name: weather-secrets
              key: openweather-api-key
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 10
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 15
          periodSeconds: 20
---
apiVersion: v1
kind: Service
metadata:
  name: vue-weather
spec:
  selector:
    app: vue-weather
  ports:
  - port: 3000
    targetPort: 3000
  type: ClusterIP
```

---

## 4. Kök Neden Olasılıkları (404 → 502 Geçişini Açıklayan Senaryolar)

| # | Senaryo | Açıklama | Doğrulama Komutu (Tek Satır) |
|---|---------|----------|------------------------------|
| **1** | **Deploy sırası: Container önce ayaklanıyor, nginx henüz hazır değil** | İlk istek nginx'e düşer, upstream (container) henüz listening değil → 502. Sonra container hazır olur ama nginx cache'lenmiş 502 döner veya config reload olmaz. | `docker compose logs nginx --since=2m \| grep -E "(upstream|connect|502)"` |
| **2** | **Health check yok → Container "healthy" sayılıyor ama uygulama crash loop** | Container çalışıyor (process var) ama Next.js crashlıyor. Docker/K8s process var diye "Up" gösterir. İlk istek 404 (build yok), sonra crash → 502. | `docker compose logs app --since=2m \| tail -30` |
| **3** | **Next.js `output: 'standalone'` eksik / yanlış COPY** | Build output `.next/standalone` kopyalanmamış. Container boş çalışır → 404 (static yok), sonra process çöküyor → 502. | `docker exec <container> ls -la /app/.next/standalone/server.js` |
| **4** | **Cloudflare "Full (strict)" + Self-signed/expired sertifika** | İlk istek SSL handshake başarısız → 502. Bazen Cloudflare 404 cache'ler, sonra 502 döner. | `openssl s_client -connect ORIGIN_IP:443 -servername vue-weather.flyingsycamore.com.tr </dev/null \| grep "Verify return code"` |
| **5** | **Port mismatch: nginx→3000, Container→8080 veya PORT env yok** | Next.js `process.env.PORT` okumuyorsa 3000 dinler, nginx 8080'e gönderir → 502. | `docker exec <container> netstat -tlnp \| grep :3000` |
| **6** | **BasePath/assetPrefix yanlış → 404, sonra nginx upstream timeout → 502** | Subpath deployda `basePath` eksik. Statik dosyalar 404, sayfa yüklenemez, sonra upstream timeout. | `curl -I https://vue-weather.flyingsycamore.com.tr/_next/static/...` |

> **En Olası 3 Senaryo (Bu Proje İçin):**
> 1. **#3** - Next.js standalone output eksik/yanlış Docker COPY
> 2. **#5** - PORT environment variable / port mapping mismatch
> 3. **#2** - Health check yok, crash loopundetected

---

## 5. Kalıcı Düzeltme — Config, Dockerfile, CI/CD Örnekleri

### 5.1 next.config.js (Production Ready)
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Docker standalone output için GEREKLİ
  output: 'standalone',
  
  // Subpath deploy ise (örn. /vue-weather/):
  // basePath: '/vue-weather',
  // assetPrefix: '/vue-weather',
  
  // Güvenlik başlıkları
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
  
  // Image optimization (standalone'da sharp gerekir)
  images: {
    unoptimized: false, // true yaparsanız standalone boyutu küçülür ama optimize edilmez
  },
}

export default nextConfig
```

### 5.2 Dockerfile (Multi-stage, Production Optimized)
```dockerfile
# ------------------------------------------------------------
# Stage 1: Builder (dependencies + build)
# ------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Package files first (cache layer)
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# Source copy — host node_modules/.next/.env* icin .dockerignore'a bakin
COPY . .

# Build (standalone output üretir)
RUN npm run build

# ------------------------------------------------------------
# Stage 2: Runner (production only)
# ------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
# Next.js PORT env'ini okur, default 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

# Non-root user
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Standalone output + static assets + public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Next.js runtime'da .next/cache'e yazar; standalone cikti bu dizini icermez
# ve container non-root calistigi icin dizin onceden olusturulmali.
RUN mkdir -p .next/cache \
    && chown nextjs:nodejs .next .next/cache

USER nextjs

EXPOSE 3000

# Health check endpoint: app/api/health/route.ts
# Not: busybox wget `--no-verbose` / `--tries` bayraklarini desteklemez, bu yuzden
# probe node'un global fetch'i ile yapiliyor. Ayrica `localhost` ::1'e cozulebilir,
# Next.js ise IPv4'e bind oldugundan adres 127.0.0.1 olarak sabit.
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "server.js"]
```

> `.dockerignore` zorunludur: `COPY . .` satiri `npm ci`den sonra calistigi icin,
> filtre olmadan host'un `node_modules`'u imajdaki Alpine kurulumunu ezer
> (Windows/macOS binary'leri Linux imajinda) ve `.git`, `.next`, `.env.local`
> imaja gomulur.

### 5.3 Health Check Endpoint (app/api/health/route.ts)
```typescript
// app/api/health/route.ts
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json(
    { status: 'ok', timestamp: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
```

### 5.4 nginx.conf (Reverse Proxy + SSL)
```nginx
# /etc/nginx/nginx.conf (veya sites-enabled/ default)
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    access_log /var/log/nginx/access.log main;
    
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    
    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    
    # Upstream (Docker Compose: service name; K8s: service name)
    upstream nextjs {
        server app:3000;  # Docker Compose service name
        # server vue-weather:3000;  # K8s service name
        keepalive 32;
    }
    
    # HTTP → HTTPS redirect
    server {
        listen 80;
        server_name vue-weather.flyingsycamore.com.tr;

        # Container healthcheck'i buraya düşer: redirect'ten muaf, TLS gerektirmez.
        location /nginx-health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }

        location / {
            return 301 https://$server_name$request_uri;
        }
    }
    
    # HTTPS Server
    server {
        listen 443 ssl http2;
        server_name vue-weather.flyingsycamore.com.tr;
        
        # SSL Sertifikaları (Cloudflare Origin CA veya Let's Encrypt)
        ssl_certificate /etc/nginx/certs/fullchain.pem;
        ssl_certificate_key /etc/nginx/certs/privkey.pem;
        
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
        ssl_prefer_server_ciphers off;
        
        # Security headers
        add_header X-Content-Type-Options nosniff;
        add_header X-Frame-Options DENY;
        add_header X-XSS-Protection "1; mode=block";
        add_header Referrer-Policy strict-origin-when-cross-origin;
        
        # Proxy to Next.js
        location / {
            proxy_pass http://nextjs;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            
            # Timeouts
            proxy_connect_timeout 10s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
            
            # Buffering
            proxy_buffering on;
            proxy_buffer_size 128k;
            proxy_buffers 4 256k;
            proxy_busy_buffers_size 256k;
        }
        
        # Health check (nginx'in kendi health'i için)
        location /nginx-health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
}
```

### 5.5 compose.yaml (Production)
Dosya adi `compose.yaml`; `docker compose` bunu `docker-compose.yml`den once
bulur, bu yuzden CI/sunucu tarafinda `-f` bayragi gerekmez.

```yaml
# compose.yaml
name: vue-weather

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: runner
    # Registry'den deploy icin: APP_IMAGE=ghcr.io/<owner>/<repo> APP_TAG=<sha>
    image: ${APP_IMAGE:-vue-weather}:${APP_TAG:-latest}
    container_name: vue-weather-app
    environment:
      NODE_ENV: production
      PORT: "3000"
      HOSTNAME: 0.0.0.0
      # `:?` ile tanimsiz anahtar `up` sirasinda hata verir; aksi halde bos
      # string gecer ve hata ancak istek aninda 500 olarak gorunur.
      VITE_OPENWEATHER_API_KEY: ${VITE_OPENWEATHER_API_KEY:?VITE_OPENWEATHER_API_KEY tanimli degil (.env dosyasina ekleyin)}
    # nginx uygulamaya app-network uzerinden erisir; bu eslemenin tek amaci
    # TLS/nginx devre disi kaldiginda sunucuda dogrudan tani yapabilmek.
    ports:
      - "127.0.0.1:3000:3000"
    networks:
      - app-network
    restart: unless-stopped
    # Healthcheck imajda tanimli (Dockerfile HEALTHCHECK). Tek yerde tutuldu;
    # boylece `docker run` ve CI smoke test de ayni probe'u kullanir.
    # Resource limits (production için önerilir)
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M

  nginx:
    image: nginx:alpine
    container_name: vue-weather-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
      - nginx-cache:/var/cache/nginx
    depends_on:
      app:
        condition: service_healthy
    networks:
      - app-network
    restart: unless-stopped
    healthcheck:
      # 80 portundaki /nginx-health, TLS ve redirect'e bagli olmayan tek probe.
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1/nginx-health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 5s

networks:
  app-network:
    driver: bridge

volumes:
  nginx-cache:
```

**Deploy oncesi iki zorunlu kosul:**
1. `.env` dosyasinda `VITE_OPENWEATHER_API_KEY` tanimli (yoksa `up` hata verir).
2. `./certs/fullchain.pem` ve `./certs/privkey.pem` mevcut. Bu dosyalar olmadan
   nginx `ssl_certificate` satirinda ayaga kalkmaz; app healthy olsa bile
   80/443'te dinleyen hicbir sey olmaz. Tani: `docker compose logs nginx` ve
   `curl -f http://127.0.0.1:3000/api/health` (app portu localhost'a aciktir).

### 5.6 CI/CD Pipeline (GitHub Actions Örneği)
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci --include=dev
      
      - name: Typecheck
        run: npm run typecheck
      
      - name: Lint
        run: npm run lint
      
      - name: Test
        run: npm test
      
      - name: Build
        run: npm run build
        env:
          VITE_OPENWEATHER_API_KEY: ${{ secrets.VITE_OPENWEATHER_API_KEY }}
      
      # Docker build test (local build doğrulaması)
      - name: Build Docker image
        run: |
          docker build -t ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:test .
      
      # Smoke test: container başlat + health check
      - name: Smoke test container
        run: |
          docker run -d --name smoke-test -p 3000:3000 \
            -e VITE_OPENWEATHER_API_KEY=${{ secrets.VITE_OPENWEATHER_API_KEY }} \
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:test
          sleep 10
          curl -f http://localhost:3000/api/health
          curl -f http://localhost:3000/
          docker stop smoke-test && docker rm smoke-test

  deploy:
    needs: build-and-test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      
      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
      
      - name: Deploy to server (SSH)
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            cd /opt/vue-weather
            docker compose pull
            docker compose up -d --remove-orphans
            # Health check bekle
            sleep 15
            curl -f https://vue-weather.flyingsycamore.com.tr/api/health
            curl -f https://vue-weather.flyingsycamore.com.tr/
```

### 5.7 Smoke Test Script (Deploy Sonrası Çalıştırılacak)
```bash
#!/bin/bash
# scripts/smoke-test.sh
# Deploy sonrası: ./scripts/smoke-test.sh

set -e

DOMAIN="https://vue-weather.flyingsycamore.com.tr"
ORIGIN_IP="ORIGIN_IP_BURAYA"  # Cloudflare bypass için

echo "🔍 Smoke test başlıyor: $DOMAIN"

# 1. Cloudflare üzerinden
echo "1. Cloudflare proxy test..."
curl -sf -o /dev/null -w "%{http_code}" "$DOMAIN/" | grep -q "200" && echo "✅ Ana sayfa: 200" || echo "❌ Ana sayfa: FAIL"
curl -sf -o /dev/null -w "%{http_code}" "$DOMAIN/api/health" | grep -q "200" && echo "✅ Health check: 200" || echo "❌ Health check: FAIL"

# 2. Origin'e direkt (Cloudflare bypass)
echo "2. Origin direct test (Host header)..."
curl -sf -H "Host: vue-weather.flyingsycamore.com.tr" -o /dev/null -w "%{http_code}" "http://$ORIGIN_IP/" | grep -q "200" && echo "✅ Origin HTTP: 200" || echo "❌ Origin HTTP: FAIL"
curl -skf -H "Host: vue-weather.flyingsycamore.com.tr" -o /dev/null -w "%{http_code}" "https://$ORIGIN_IP/" | grep -q "200" && echo "✅ Origin HTTPS: 200" || echo "❌ Origin HTTPS: FAIL"

# 3. SSL sertifika
echo "3. SSL sertifika doğrulama..."
openssl s_client -connect "$ORIGIN_IP:443" -servername vue-weather.flyingsycamore.com.tr </dev/null 2>&1 | grep -q "Verify return code: 0" && echo "✅ SSL: Geçerli" || echo "⚠️ SSL: Self-signed/Expired (Cloudflare 'Full' modunda olmalı)"

# 4. Static assets
echo "4. Static asset test..."
curl -sf -o /dev/null -w "%{http_code}" "$DOMAIN/_next/static/css/" | grep -q "200\|304\|404" && echo "✅ Static assets erişilebilir" || echo "❌ Static assets: FAIL"

echo "🏁 Smoke test tamamlandı"
```

---

## 📋 Hızlı Debug Checklist (Sıralı Çalıştırın)

```bash
# 1. DNS + Cloudflare
dig +short vue-weather.flyingsycamore.com.tr
curl -I https://vue-weather.flyingsycamore.com.tr/

# 2. Origin direct (Host header)
curl -v -H "Host: vue-weather.flyingsycamore.com.tr" http://ORIGIN_IP:3000/

# 3. Container logları
docker compose logs app --tail=50
docker compose logs nginx --tail=50

# 4. Container içinde test
docker exec <app-container> wget -qO- http://localhost:3000/api/health
docker exec <app-container> wget -qO- http://localhost:3000/

# 5. Port dinleme
docker exec <app-container> netstat -tlnp

# 6. nginx config
docker exec <nginx-container> nginx -t

# 7. SSL sertifika
openssl s_client -connect ORIGIN_IP:443 -servername vue-weather.flyingsycamore.com.tr </dev/null | grep "Verify return code"

# 8. Build output doğrulama
docker exec <app-container> ls -la /app/.next/standalone/
```

---

## 🎯 Özet: 404 → 502 Geçişi Genellikle Şunlardan Biridir

1. **Container crash loop** (health check yok) → İlk istek 404 (build yok), sonra container ölür → 502
2. **Standalone output kopyalanmamış** → Next.js server.js yok → Process hemen çıkar → 502
3. **PORT env / port mapping mismatch** → nginx yanlış porta istek atar → 502
4. **Cloudflare "Full (strict)" + geçersiz sertifika** → SSL handshake fail → 502

**Öncelik sırası:** Container logları → Health check endpoint → Dockerfile COPY → Port mapping → SSL modu

---

*Bu rehber `vue-weather.flyingsycamore.com.tr` için özelleştirilmiştir. Çıktıları paylaşırsanız sonraki adımda yardımcı olabilirim.*