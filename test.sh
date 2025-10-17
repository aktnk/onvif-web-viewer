/bin/sh

curl -X POST http://localhost:3001/api/cameras \
-H "Content-Type: application/json" \
-d '{
  "name": "Tapo_C110_068A",
  "host": "192.168.0.209",
  "port": 554,
  "user": "akrtnk",
  "pass": "!akr_tnk@"
}'
