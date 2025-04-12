<div align="center">

<h2>Secure, Multi-Tenant Webhook System</h2>

<p align="center">
  <a href="https://github.com/studiowebux/webhook/issues">Report Bug</a>
  ·
  <a href="https://github.com/studiowebux/webhook/issues">Request Feature</a>
</p>
</div>

---

This system ensures secure, isolated communication channels for each client
through encrypted webhooks. Each tenant has a unique encryption setup, enhancing
data privacy and security across all interactions. Additionally, it incorporates
exponential backoff strategies to manage retries efficiently, optimizing
reliability and performance during transient failures.

## Usage

**Terminal #1**

```bash
deno run -A 1_generate_keys.ts
```

**Terminal #2**

_In Memory_

```bash
deno run -A 2_publisher.ts
```

OR

_Note: FIFO by default (RPUSH/LPOP), but retries are NOT FIFO._

```bash
deno run -A 2_redis_publisher.ts
```

_If sequential retries are required, you must handle them in-code and block the
processing until the message is successfully processed or dropped_

```bash
deno run -A 2_redis_seq_publisher.ts
```

_If sequential retries are required, you must handle them in-code and block the
processing until the message is successfully processed or dropped_

```bash
deno run -A 2_kafka_publisher.ts
```

You can start multiple consumers (I tested with 3 consumers and 3CC each), this
way it can process your customer(s) in parallel and each partition is processed
sequentially. (the `key` is used for partitioning, in these example I used
`customer-X`)

```bash
deno run -A 2_kafka_consume.ts
```

**Terminal #3**

This server simulate a customer (Will probably not run in your local
infrastructure) This is the endpoint we (the provider) send encrypted message
to, that consumer has to decrypt the message using its private key.

```bash
deno run -A 3_consume.ts
```

**Back in Terminal #1**

_To test in-memory and redis_

```bash
bash 4_publish.sh
```

_To test kafka_

```bash
bash 4_kafka_publish.sh
```

## Architecture

### General Flow


<details>

<summary>PlantUML Code</summary>

```plantuml
@startuml
Customer -> Provider: 1. Subscribe
Provider -> Infrastructure: 2. Generate API Key
Provider -> Customer: 3. Send API key

Customer -> Customer: 4. Generate RSA Key
Customer -> Provider: 5. Send public key using API Key
Provider -> Infrastructure: 6. Store Public key with API Key

Customer -> Provider: 7. Configure events to subscribe
Customer -> Provider: 8. Configure webhook url

Infrastructure -> Infrastructure: 9. Listen for configured events
Infrastructure -> Infrastructure: 10. Encrypt payload
Infrastructure -> Customer: 11. Send encrypted payload to customer webhook


Customer -> Infrastructure: 12. Acknowledged reception
Infrastructure -> Infrastructure: 12.1 Exponential Backoff Retry (until max retries, then send to DLQ*)
Infrastructure -> Customer: 12.2 Resend encrypted payload
@enduml
```

</details>

![](./docs/general.png)

### In Memory

<details>

<summary>PlantUML Code</summary>

```plantuml
@startuml
2_publisher.ts -> 2_publisher.ts: Listen on 0.0.0.0:4242/publish
events -> 2_publisher.ts: An event is generated (from any sources)

2_publisher.ts -> 2_publisher.ts: Extract API Key from Headers
2_publisher.ts -> 2_publisher.ts: Fetch Customer configurations to determine if we need to send the event
loop each relevant customers
  2_publisher.ts -> provider_database: Fetch Public Key and webhook url
  2_publisher.ts <-- provider_database
  2_publisher.ts -> 2_publisher.ts: Prepare message
end
2_publisher.ts -> enqueue: Enqueue message(s) for processing


loop while true
  enqueue -> processMessage: Process enqueued message (background/FIFO)
  processMessage -> processMessage: Encrypt message
  processMessage -> 3_consume.ts: Send Encrypted message to customer Webhook
  processMessage <-- 3_consume.ts: if no ACK, the message is placed back at the end of the local queue.
  note right
    It causes the message processing to NOT be sequential.
  end note
  processMessage -> processMessage: Process next message
end
@enduml
```

</details>

![](./docs/2_publisher.png)

### Redis

The `2_redis_publisher.ts` is exactly the same flow as the `2_publisher.ts`, with the exception that the data is persisted when the server restarts.

**Sequential processing**

<details>

<summary>PlantUML Code</summary>

```plantuml
@startuml
2_redis_seq_publisher.ts -> 2_redis_seq_publisher.ts: Listen on 0.0.0.0:4242/publish
events -> 2_redis_seq_publisher.ts: An event is generated (from any sources)

2_redis_seq_publisher.ts -> 2_redis_seq_publisher.ts: Extract API Key from Headers
2_redis_seq_publisher.ts -> 2_redis_seq_publisher.ts: Fetch Customer configurations to determine if we need to send the event
loop each relevant customers
  2_redis_seq_publisher.ts -> provider_database: Fetch Public Key and webhook url
  2_redis_seq_publisher.ts <-- provider_database
  2_redis_seq_publisher.ts -> 2_redis_seq_publisher.ts: Prepare message
end
2_redis_seq_publisher.ts -> enqueue: Enqueue message(s) for processing

loop while true
  enqueue -> processMessage: Process enqueued message (background/FIFO)
  processMessage -> processMessage: Encrypt message
  processMessage -> 3_consume.ts: Send Encrypted message to customer Webhook
  loop retries < max_retries
    processMessage <-- 3_consume.ts: if no ACK, the message is retried using the exponential backoff strategy
    note right
      It forces the message to be processed sequentially,
      but it blocks ALL enqueued messages to be processed.
    end note
  end
  processMessage -> processMessage: Exhausted retries will drop the message, can be move in a DLQ*

  processMessage -> processMessage: Process next message
end
@enduml
```

</details>

![](./docs/2_redis_seq_publisher.png)

### Kafka

`0_kafka_setup.ts` is required to setup the partitions.

<details>

<summary>PlantUML Code</summary>

```plantuml
@startuml
2_kafka_publisher.ts -> 2_kafka_publisher.ts: Listen on 0.0.0.0:4242/publish
events -> 2_kafka_publisher.ts: An event is generated (from any sources)

2_kafka_publisher.ts -> 2_kafka_publisher.ts: Extract API Key from Headers
2_kafka_publisher.ts -> 2_kafka_publisher.ts: Fetch Customer configurations to determine if we need to send the event
loop each relevant customers
  2_kafka_publisher.ts -> provider_database: Fetch Public Key and webhook url
  2_kafka_publisher.ts <-- provider_database
  2_kafka_publisher.ts -> 2_kafka_publisher.ts: Prepare message, set the key using the customer id to optimize the partitions
end
2_kafka_publisher.ts -> sendMessage: Send message to 'webhook' topics

note over 2_kafka_publisher
  This strategy is flexible,
  you can configure your partitions and consumers
  to process messages in parallel.
  You can start many consumers
  to handle all partitions in parallel.
end note
@enduml
```

</details>

![](./docs/2_kafka_publisher.png)

<details>

<summary>PlantUML Code</summary>

```plantuml
@startuml
loop listen for messages
  2_kafka_consumer.ts -> 2_kafka_consumer.ts
  eachMessage -> processMessage: Encrypt message
  processMessage -> 3_consume.ts: Send Encrypted message to customer webhook
  loop retries < max_retries
    processMessage <-- 3_consume.ts: if no ACK, the message is retried using the exponential backoff strategy
    note right
      It forces the message to be processed sequentially,
      but it blocks ALL messages from that **partition** to be processed.
    end note
  end
  processMessage -> processMessage: Exhausted retries will drop the message (commit), can be move in a DLQ*

  processMessage -> processMessage: Process next message
end
@enduml
```

</details>

![](./docs/2_kafka_consumer.png)

## Deno OTEL

```bash
OTEL_DENO=true deno run --unstable-otel ...
```

## Distributed System (Optional)

```bash
docker run --restart always --name webhook -p 6379:6379 -d redis redis-server --save 60 1 --loglevel warning
```

```bash
docker run -d \
--name=kafka-kraft \
-h kafka-kraft \
-p 9092:9092 \
-e KAFKA_NODE_ID=1 \
-e KAFKA_LISTENER_SECURITY_PROTOCOL_MAP='CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT' \
-e KAFKA_ADVERTISED_LISTENERS='PLAINTEXT://kafka-kraft:29092,PLAINTEXT_HOST://localhost:9092' \
-e KAFKA_JMX_PORT=9101 \
-e KAFKA_JMX_HOSTNAME=localhost \
-e KAFKA_PROCESS_ROLES='broker,controller' \
-e KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1 \
-e KAFKA_CONTROLLER_QUORUM_VOTERS='1@kafka-kraft:29093' \
-e KAFKA_LISTENERS='PLAINTEXT://kafka-kraft:29092,CONTROLLER://kafka-kraft:29093,PLAINTEXT_HOST://0.0.0.0:9092' \
-e KAFKA_INTER_BROKER_LISTENER_NAME='PLAINTEXT' \
-e KAFKA_CONTROLLER_LISTENER_NAMES='CONTROLLER' \
-e CLUSTER_ID='MkU3OEVBNTcwNTJENDM2Qk' \
confluentinc/cp-kafka:7.9.0
```

Then Setup your kafka partitions:

```bash
# Yes, the script hangs from time to time...
deno run -A 0_kafka_setup.ts

kafka-topics --bootstrap-server localhost:9092 --describe --topic events
```

## Observability

```bash
docker run --name lgtm -p 3000:3000 -p 4317:4317 -p 4318:4318 -d \
	-v "$PWD"/lgtm/grafana:/data/grafana \
	-v "$PWD"/lgtm/prometheus:/data/prometheus \
	-v "$PWD"/lgtm/loki:/data/loki \
	-e GF_PATHS_DATA=/data/grafana \
	docker.io/grafana/otel-lgtm:0.10.0
```

## License

Distributed under the MIT License. See LICENSE for more information.

## Contact

- Tommy Gingras @ tommy@studiowebux.com

---

<a href="https://www.buymeacoffee.com/studiowebux" target="_blank"
        ><img
          src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
          alt="Buy Me A Coffee"
          style="height: 30px !important; width: 105px !important"
      /></a>
