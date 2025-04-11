<div align="center">

<h2>Secure, Multi-Tenant Webhook System</h2>

<p align="center">
  <a href="https://github.com/studiowebux/webhook/issues">Report Bug</a>
  ·
  <a href="https://github.com/studiowebux/webhook/issues">Request Feature</a>
</p>
</div>

---

This system ensures secure, isolated communication channels for each client through encrypted webhooks. Each tenant has a unique encryption setup, enhancing data privacy and security across all interactions. Additionally, it incorporates exponential backoff strategies to manage retries efficiently, optimizing reliability and performance during transient failures.

## Usage

**Terminal #1**

```bash
deno run -A 1_generate_keys.ts
```

**Terminal #2**

```bash
deno run -A 2_publisher.ts
```

**Terminal #3**

```bash
deno run -A 3_consume.ts
```

**Back in Terminal #1**

```bash
bash 4_publish.sh
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
