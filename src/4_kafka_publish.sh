#!/bin/bash

  for i in {1..50}; do
    echo "Iteration $i"
    curl -X POST http://localhost:4242/publish \
    -H "Content-Type: application/json" \
    -d '{"url":"http://localhost:9000/webhook","target":"customer-1","payload":{"hello":"world"}}'

done

for i in {1..15}; do
    echo "Iteration $i"
    curl -X POST http://localhost:4242/publish \
    -H "Content-Type: application/json" \
    -d '{"url":"http://localhost:9000/webhook","target":"customer-2","payload":{"hello":"world"}}'
done

for i in {1..30}; do
    echo "Iteration $i"
    curl -X POST http://localhost:4242/publish \
    -H "Content-Type: application/json" \
    -d '{"url":"http://localhost:9000/webhook","target":"customer-3","payload":{"hello":"world"}}'
done

for i in {1..5}; do
    echo "Iteration $i"
    curl -X POST http://localhost:4242/publish \
    -H "Content-Type: application/json" \
    -d '{"url":"http://localhost:9000/webhook","target":"customer-4","payload":{"hello":"world"}}'
done

for i in {1..50}; do
    echo "Iteration $i"
    curl -X POST http://localhost:4242/publish \
    -H "Content-Type: application/json" \
    -d '{"url":"http://localhost:9000/webhook","target":"customer-5","payload":{"hello":"world"}}'
done
