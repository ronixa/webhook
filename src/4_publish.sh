#!/bin/bash

for i in {1..100}; do
    echo "Iteration $i"
    curl -X POST http://localhost:4242/publish \
      -H "Content-Type: application/json" \
      -d '{"url":"http://localhost:9000/webhook","payload":{"hello":"world", "id": "'$i'"}}'
done
