#!/bin/bash
set -e

API="http://localhost:3101"
TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

echo "========================================="
echo "SMOKE TEST R2 — GodManager"
echo "========================================="

# Gerar 3 imagens JPEG REAIS (não texto)
# Usa ImageMagick se existir, senão usa python+PIL, senão usa base64 de um JPEG mínimo
generate_jpeg() {
  local out=$1
  local size_kb=$2
  if command -v convert >/dev/null 2>&1; then
    convert -size 800x600 xc:lightblue -fill black -pointsize 40 -gravity center -annotate 0 "TEST $size_kb KB" "$out" 2>/dev/null
  elif command -v python3 >/dev/null 2>&1 && python3 -c "import PIL" 2>/dev/null; then
    python3 -c "
from PIL import Image, ImageDraw
img = Image.new('RGB', (800, 600), color=(135, 206, 250))
d = ImageDraw.Draw(img)
d.text((300, 280), 'TEST $size_kb KB', fill=(0, 0, 0))
img.save('$out', 'JPEG', quality=85)
"
  else
    # Fallback: JPEG mínimo válido (1x1) via base64
    echo '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQcJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=' | (base64 -d 2>/dev/null || base64 -D) > "$out"
  fi
  local _sz=$(wc -c < "$out")
  echo "  Gerado: $out (${_sz} bytes)"
}

echo ""
echo "--- 1. Gerar 3 imagens de teste ---"
generate_jpeg "$TMPDIR/small.jpg" 50
generate_jpeg "$TMPDIR/medium.jpg" 200
generate_jpeg "$TMPDIR/large.jpg" 500

PASS=0
FAIL=0

test_upload_cycle() {
  local file=$1
  local label=$2
  echo ""
  echo "--- 2.$label — Testar $file ---"

  local size=$(wc -c < "$file")
  echo "  Tamanho: $size bytes"

  # Pedir presigned URL
  local response=$(curl -s -X POST "$API/api/properties/photos/presigned-url" \
    -H "Content-Type: application/json" \
    -d "{\"propertyId\":\"smoke_$label\",\"contentType\":\"image/jpeg\",\"sizeBytes\":$size,\"originalFilename\":\"$(basename $file)\"}")

  local ok=$(echo "$response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('ok'))" 2>/dev/null)
  if [ "$ok" != "True" ]; then
    echo "  ❌ presigned-url FAIL: $response"
    FAIL=$((FAIL+1))
    return
  fi
  echo "  ✅ presigned-url OK"

  local upload_url=$(echo "$response" | python3 -c "import sys,json; print(json.load(sys.stdin)['uploadUrl'])")
  local public_url=$(echo "$response" | python3 -c "import sys,json; print(json.load(sys.stdin)['publicUrl'])")
  local key=$(echo "$response" | python3 -c "import sys,json; print(json.load(sys.stdin)['key'])")

  # Upload PUT
  local put_status=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$upload_url" \
    -H "Content-Type: image/jpeg" --data-binary "@$file")
  if [ "$put_status" != "200" ]; then
    echo "  ❌ PUT FAIL: HTTP $put_status"
    FAIL=$((FAIL+1))
    return
  fi
  echo "  ✅ PUT R2 OK (HTTP 200)"

  # Verificar público
  local head_status=$(curl -s -o /dev/null -w "%{http_code}" -I "$public_url")
  if [ "$head_status" != "200" ]; then
    echo "  ❌ HEAD público FAIL: HTTP $head_status"
    FAIL=$((FAIL+1))
    return
  fi
  echo "  ✅ HEAD público OK (HTTP 200)"

  # Apagar
  local del_response=$(curl -s -X POST "$API/api/properties/photos/delete" \
    -H "Content-Type: application/json" \
    -d "{\"key\":\"$key\"}")
  local del_ok=$(echo "$del_response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('ok'))" 2>/dev/null)
  if [ "$del_ok" != "True" ]; then
    echo "  ❌ DELETE FAIL: $del_response"
    FAIL=$((FAIL+1))
    return
  fi
  echo "  ✅ DELETE OK"

  # Confirmar 404 após delete
  local after_status=$(curl -s -o /dev/null -w "%{http_code}" -I "$public_url")
  if [ "$after_status" != "404" ]; then
    echo "  ⚠️ esperado 404 após delete, recebeu $after_status (cache R2 pode demorar)"
  else
    echo "  ✅ Confirmado 404 após delete"
  fi

  PASS=$((PASS+1))
}

test_upload_cycle "$TMPDIR/small.jpg" "small"
test_upload_cycle "$TMPDIR/medium.jpg" "medium"
test_upload_cycle "$TMPDIR/large.jpg" "large"

echo ""
echo "========================================="
echo "RESULTADO: $PASS passou, $FAIL falhou"
echo "========================================="

if [ $FAIL -gt 0 ]; then exit 1; fi
exit 0
