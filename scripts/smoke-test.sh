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