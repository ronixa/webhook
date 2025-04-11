#!/bin/bash

curl -X POST http://localhost:4242/publish \
  -H "Content-Type: application/json" \
  -d '{"url":"http://localhost:9000/webhook","payload":{"hello":"world"}}'
