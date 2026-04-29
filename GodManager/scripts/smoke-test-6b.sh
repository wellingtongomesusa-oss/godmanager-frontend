#!/bin/bash
set -e
API="http://localhost:3101"

if [ -z "$1" ]; then
  echo "Uso: $0 '<COOKIE_HEADER>'"
  echo ""
  echo "Para obter o cookie:"
  echo "1. Abre $API/GodManager_Premium.html no browser e faz login"
  echo "2. Abre DevTools (F12) > Application > Cookies > localhost:3101"
  echo "3. Copia o valor do cookie de sessão (ex: 'session=...; another=...')"
  echo "4. Re-corre: $0 'session=VALOR_COMPLETO'"
  exit 1
fi

COOKIE="$1"
TS=$(date +%s)
TEST_CODE="SMOKE_$TS"
echo "=== Smoke test 6B com property code: $TEST_CODE ==="

# 1. Pedir presigned URLs para 2 fotos fake
echo ""
echo "--- 1. Pedir 2 presigned URLs ---"
P1=$(curl -s -X POST "$API/api/properties/photos/presigned-url" \
  -H "Content-Type: application/json" \
  -H "Cookie: $COOKIE" \
  -d "{\"propertyId\":\"$TEST_CODE\",\"contentType\":\"image/jpeg\",\"sizeBytes\":1024,\"originalFilename\":\"foto1.jpg\"}")
P2=$(curl -s -X POST "$API/api/properties/photos/presigned-url" \
  -H "Content-Type: application/json" \
  -H "Cookie: $COOKIE" \
  -d "{\"propertyId\":\"$TEST_CODE\",\"contentType\":\"image/jpeg\",\"sizeBytes\":2048,\"originalFilename\":\"foto2.jpg\"}")

PUB1=$(echo "$P1" | python3 -c "import sys,json;print(json.load(sys.stdin)['publicUrl'])")
KEY1=$(echo "$P1" | python3 -c "import sys,json;print(json.load(sys.stdin)['key'])")
PUB2=$(echo "$P2" | python3 -c "import sys,json;print(json.load(sys.stdin)['publicUrl'])")
KEY2=$(echo "$P2" | python3 -c "import sys,json;print(json.load(sys.stdin)['key'])")
echo "  KEY1: $KEY1"
echo "  KEY2: $KEY2"

# 2. POST property com photos
echo ""
echo "--- 2. POST /api/properties com 2 photos ---"
POST_BODY=$(cat <<EOF
{
  "code": "$TEST_CODE",
  "address": "123 Smoke Test Ave",
  "rent": 1500,
  "deposit": 1500,
  "metadata": {
    "source": "smoke_test_6b",
    "photos": [
      {"publicUrl":"$PUB1","key":"$KEY1","name":"foto1.jpg","type":"image/jpeg","size":1024,"isPrimary":true},
      {"publicUrl":"$PUB2","key":"$KEY2","name":"foto2.jpg","type":"image/jpeg","size":2048,"isPrimary":false}
    ],
    "primaryPhotoIndex": 0
  }
}
EOF
)
POST_RES=$(curl -s -X POST "$API/api/properties" \
  -H "Content-Type: application/json" \
  -H "Cookie: $COOKIE" \
  -d "$POST_BODY")
echo "$POST_RES" | python3 -m json.tool || echo "$POST_RES"
APIID=$(echo "$POST_RES" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('property',{}).get('id',''))")
if [ -z "$APIID" ]; then echo "❌ FAIL: sem id no POST"; exit 1; fi
echo "  apiId: $APIID"

# 3. GET e verificar photos
echo ""
echo "--- 3. GET /api/properties e verificar photos ---"
GET_RES=$(curl -s -H "Cookie: $COOKIE" "$API/api/properties")
PHOTOS_COUNT=$(echo "$GET_RES" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for p in d.get('properties',[]):
  if p.get('code')=='$TEST_CODE':
    photos=(p.get('metadata') or {}).get('photos') or []
    print(len(photos))
    for ph in photos: print(' ',ph.get('key'),'isPrimary=',ph.get('isPrimary'))
    break
" 2>&1 | head -1)
echo "  Photos encontradas no GET: $PHOTOS_COUNT"
if [ "$PHOTOS_COUNT" != "2" ]; then echo "❌ FAIL: esperava 2 photos"; exit 1; fi
echo "  ✅ 2 photos persistidas"

# 4. PATCH com 1 photo nova (substitui as 2)
echo ""
echo "--- 4. PATCH com photos diferentes ---"
P3=$(curl -s -X POST "$API/api/properties/photos/presigned-url" \
  -H "Content-Type: application/json" -H "Cookie: $COOKIE" \
  -d "{\"propertyId\":\"$TEST_CODE\",\"contentType\":\"image/jpeg\",\"sizeBytes\":3000,\"originalFilename\":\"foto3.jpg\"}")
PUB3=$(echo "$P3" | python3 -c "import sys,json;print(json.load(sys.stdin)['publicUrl'])")
KEY3=$(echo "$P3" | python3 -c "import sys,json;print(json.load(sys.stdin)['key'])")
PATCH_BODY=$(cat <<EOF
{"metadata":{"source":"smoke_test_6b","photos":[{"publicUrl":"$PUB3","key":"$KEY3","name":"foto3.jpg","type":"image/jpeg","size":3000,"isPrimary":true}],"primaryPhotoIndex":0}}
EOF
)
PATCH_RES=$(curl -s -X PATCH "$API/api/properties/$APIID" \
  -H "Content-Type: application/json" -H "Cookie: $COOKIE" \
  -d "$PATCH_BODY")
PATCH_OK=$(echo "$PATCH_RES" | python3 -c "import sys,json;print(json.load(sys.stdin).get('ok'))")
if [ "$PATCH_OK" != "True" ]; then echo "❌ PATCH FAIL: $PATCH_RES"; exit 1; fi
echo "  ✅ PATCH OK"

# 5. GET de novo, deve ter só 1 photo
echo ""
echo "--- 5. GET após PATCH ---"
GET2=$(curl -s -H "Cookie: $COOKIE" "$API/api/properties")
COUNT2=$(echo "$GET2" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for p in d.get('properties',[]):
  if p.get('code')=='$TEST_CODE':
    print(len((p.get('metadata') or {}).get('photos') or []))
    break
")
echo "  Photos após PATCH: $COUNT2"
if [ "$COUNT2" != "1" ]; then echo "❌ esperava 1 photo após PATCH"; exit 1; fi
echo "  ✅ 1 photo após PATCH (substituição funcionou)"

# 6. Teste defesa: PATCH com photos inválidas (deve normalizar para [])
echo ""
echo "--- 6. PATCH defensivo com photos inválidas ---"
BAD_BODY='{"metadata":{"photos":[{"publicUrl":"http://insecure.com/x","key":"properties/x"},{"key":"../escape"},{"publicUrl":"https://ok.com/y","key":"jobs/y"},"not-an-object"]}}'
BAD_RES=$(curl -s -X PATCH "$API/api/properties/$APIID" \
  -H "Content-Type: application/json" -H "Cookie: $COOKIE" \
  -d "$BAD_BODY")
echo "$BAD_RES" | python3 -m json.tool | grep -A 2 photos || echo "$BAD_RES"
GET3=$(curl -s -H "Cookie: $COOKIE" "$API/api/properties")
COUNT3=$(echo "$GET3" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for p in d.get('properties',[]):
  if p.get('code')=='$TEST_CODE':
    print(len((p.get('metadata') or {}).get('photos') or []))
    break
")
echo "  Photos após PATCH inválido: $COUNT3 (esperado: 0 — todas filtradas)"
if [ "$COUNT3" != "0" ]; then echo "⚠️ defesa permitiu photo inválida"; fi

# 7. Limpeza: apagar property + photos R2
echo ""
echo "--- 7. Cleanup ---"
curl -s -X POST "$API/api/properties/photos/delete" -H "Content-Type: application/json" -H "Cookie: $COOKIE" -d "{\"key\":\"$KEY1\"}" >/dev/null
curl -s -X POST "$API/api/properties/photos/delete" -H "Content-Type: application/json" -H "Cookie: $COOKIE" -d "{\"key\":\"$KEY2\"}" >/dev/null
curl -s -X POST "$API/api/properties/photos/delete" -H "Content-Type: application/json" -H "Cookie: $COOKIE" -d "{\"key\":\"$KEY3\"}" >/dev/null
DEL=$(curl -s -X DELETE -H "Cookie: $COOKIE" "$API/api/properties/$APIID")
echo "  Cleanup: $DEL"
echo ""
echo "========================================="
echo "✅ SMOKE TEST 6B COMPLETO"
echo "========================================="
