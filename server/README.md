# Neon Arsenal Market — API

API REST em Node.js + Express + Prisma + PostgreSQL para o marketplace multi-vendedores.

## Pré-requisitos

- Node.js 18+
- PostgreSQL 16 (Docker Compose no repositório, ou instância local)
- Conta PayPal (sandbox para desenvolvimento) — opcional para testar pagamentos

## Banco de dados (PostgreSQL)

O projeto usa **PostgreSQL**. SQLite não é suportado.

1. Suba o banco: `docker compose up db -d` na raiz do repositório.
2. Copie `server/.env.example` para `server/.env` e ajuste `DATABASE_URL`.
3. Aplique as migrations reais:

```bash
npm run db:migrate:deploy
```

Para desenvolvimento iterativo de schema, use `npm run db:migrate`.

## Configuração

1. Na pasta `server/`, copie `.env.example` para `.env` e ajuste JWT e PayPal se quiser.
2. Aplique as migrations (`npm run db:migrate:deploy` ou `npm run db:migrate`).
3. Inicie o servidor:

```bash
npm run dev
```

A API ficará disponível em `http://localhost:3001` (ou a porta definida em `PORT`).

## Testes

Ver `docs/testing.md`.

```bash
npm run test:unit            # sem PostgreSQL
npm run test:integration     # exige DATABASE_URL/TEST_DATABASE_URL PostgreSQL
npm run test:all             # unit + integration
```

Integração local isolada:

```bash
docker compose --profile test up db-test -d
export TEST_DATABASE_URL="postgresql://neon:test@localhost:5433/neon_arsenal_test"
export DATABASE_URL="$TEST_DATABASE_URL"
npm run test:db:prepare
npm run test:integration
```

A suíte de integração **não é skipped** se o banco estiver ausente — ela falha.

## Observabilidade

OpenTelemetry fica desligado por padrão. `npm run dev` não precisa de collector.

```bash
OTEL_ENABLED=true OTEL_EXPORTER=console npm run dev
```

Variáveis: `OTEL_ENABLED`, `OTEL_EXPORTER` (`none` | `console` | `otlp`), `OTEL_SERVICE_NAME`, `OTEL_EXPORTER_OTLP_*`. Ver `docs/observability.md`.

## Estrutura

- `src/modules/` — Módulos por domínio (auth, users, sellers, products, orders, payments, commissions, reviews, admin).
- `src/shared/` — Database (Prisma), errors, middlewares, utils, types.
- Cada módulo segue: routes → controller → service → repository; DTOs com Zod.

## Endpoints principais

| Prefixo        | Descrição                          |
|----------------|------------------------------------|
| `POST /auth/register` | Registro (name, email, password, role?) |
| `POST /auth/login`    | Login                              |
| `POST /auth/refresh`  | Renovar tokens                     |
| `GET /auth/me`        | Usuário atual (Bearer)             |
| `GET/PATCH /users/me` | Perfil (auth)                      |
| `GET /sellers`        | Listar vendedores                  |
| `POST /sellers/apply` | Virar vendedor (auth)              |
| `GET/PATCH /sellers/:id` | Detalhe/atualizar (auth)        |
| `PATCH /sellers/:id/approve` | Aprovar (ADMIN)                |
| `GET /products`       | Listar produtos (query: sellerId, isActive, search, page, limit) |
| `GET/POST/PATCH/DELETE /products` | CRUD (POST/PATCH/DELETE = SELLER/ADMIN) |
| `POST /orders`        | Criar pedido (CUSTOMER, body: items: [{ productId, quantity }]) |
| `GET /orders`, `GET /orders/:id` | Listar/detalhe (auth)        |
| `PATCH /orders/:id/status` | Atualizar status (CUSTOMER/ADMIN, não SELLER) |
| `POST /payments/create` | Link PayPal (body: orderId) (auth)  |
| `POST /payments/webhook` | Webhook PayPal (sem auth)        |
| `GET /commissions/transactions` | Transações (SELLER/ADMIN)   |
| `GET /commissions/balance` | Saldo (SELLER)                 |
| `GET /reviews/product/:productId` | Reviews do produto        |
| `GET/POST/PATCH/DELETE /reviews` | CRUD reviews (auth)       |
| `GET /admin/users`     | Listar usuários (ADMIN)            |
| `GET /admin/orders`    | Listar pedidos (ADMIN)             |
| `PATCH /admin/sellers/:id/approve` | Aprovar vendedor (ADMIN)  |

## Roles

- **ADMIN** — Aprovar vendedores, listar usuários e pedidos, editar produtos de qualquer loja.
- **SELLER** — Aplicar como vendedor, CRUD próprios produtos, ver pedidos em que participa, transações e saldo.
- **CUSTOMER** — Criar pedidos, ver próprios pedidos, atualizar status (ex.: cancelar), reviews.

## Prisma Studio

Para inspecionar o banco PostgreSQL:

```bash
npm run db:studio
```
