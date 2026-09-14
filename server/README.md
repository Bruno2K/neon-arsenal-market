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

## Catálogo cs2.sh (opcional)

`npm run import:cs2sh` (local) or `POST /admin/catalog/cs2sh-import` (ADMIN; Render has no shell) busca o schema e o snapshot de preços da [cs2.sh](https://cs2.sh/docs/schema) e faz upsert de `Product` (skins tradable) mais um conjunto pequeno de listings demo. Exige `CS2SH_API_KEY`. Sem a key o script sai com código 1 e o POST responde 503; nenhum dos dois toca o banco. `CS2SH_IMPORT=true` agenda o import **depois** de `listen` para não bloquear `/ready`; a API sobe mesmo se o import falhar. Ver `docs/adr/0014-cs2sh-catalog-import.md` e `docs/operations/runbook.md`.

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
| `GET /sellers`, `GET /sellers/:id` | Público, sem auth. Sempre `isApproved: true` (sem filtro do cliente) e projeção estreita `{ id, storeName, rating, user: { id, name } }` — nunca `email`, `balance`, `commissionRate` ou `isApproved` (AUD-008). `:id` de vendedor pendente/inexistente é 404 em ambos os casos. |
| `GET /sellers/me`     | Linha completa do próprio vendedor autenticado |
| `POST /sellers/apply` | Virar vendedor (auth). `commissionRate` não é aceito; novo vendedor usa o default do banco (0.1) e não é controlável por nenhuma API (AUD-005) |
| `PATCH /sellers/:id`  | Atualizar `storeName` (dono ou ADMIN). `commissionRate` não é um campo aceito |
| `PATCH /sellers/:id/approve`, `PATCH /admin/sellers/:id/approve` | Aprovar/suspender vendedor (ADMIN) — dois caminhos equivalentes no surface atual |
| `GET /admin/sellers`  | Linhas completas de todo vendedor, qualquer status (ADMIN) — usado pelas telas de admin desde que `GET /sellers` público ficou restrito (AUD-008) |
| `GET /products`       | Listar produtos (query: game, weapon, search, page, limit, cursor) |
| `GET /listings`       | Listar listings (query: status, filtros, page, limit, cursor). Sem `cursor`: `{ items, total, page, limit }`. Com `cursor`: `{ items, limit, nextCursor }`, ordem `createdAt DESC, id DESC`. |
| `POST /listings`      | Criar listing (SELLER aprovado; 403 se o vendedor ainda não foi aprovado — AUD-009) |
| `GET /listings/:id`, `PATCH /listings/:id` | Detalhe / atualizar `tradeLockUntil` (dono ou ADMIN). `price` no body é **rejeitado com 400** (não silenciosamente ignorado) — o único caminho válido é `PATCH /listings/:id/price` (AUD-015) |
| `PATCH /listings/:id/price` | Único caminho de mutação de preço: atualiza `Listing.price`, `PriceHistory` e `AuditLog` na mesma transação |
| `POST /listings/:id/reserve`, `/mark-sold`, `/cancel` | Ciclo de vida da reserva/venda/cancelamento |
| `GET /listings/seller/my-listings` | Listings do vendedor autenticado, qualquer status |
| `GET /listings/:listingId/price-history` | Histórico de preço do listing |
| `GET/POST/PATCH/DELETE /products` | CRUD (POST/PATCH/DELETE = ADMIN) |
| `POST /orders`        | Criar pedido (CUSTOMER, body: `items: [{ listingId }]`; header `Idempotency-Key` obrigatório) |
| `GET /orders`, `GET /orders/:id` | Listar/detalhe (auth; escopo por papel) |
| `PATCH /orders/:id/status` | Transição explícita (CUSTOMER: cancelar PENDING/CONFIRMED ou SHIPPED→DELIVERED; ADMIN: grafo completo; SELLER: 403). Terminais: DELIVERED, CANCELLED |
| `PATCH /orders/:id/tracking` | Código/transportadora de rastreio (SELLER envolvido ou ADMIN) |
| `POST /payments/create` | Link PayPal (body: orderId) (auth)  |
| `POST /payments/capture` | Captura PayPal após aprovação (auth, dono do pedido) |
| `POST /payments/webhook` | Webhook PayPal (sem auth)        |
| `GET /commissions/transactions` | Transações (SELLER/ADMIN)   |
| `GET /commissions/balance` | Saldo (SELLER)                 |
| `GET /reviews/product/:productId` | Reviews do produto        |
| `GET/POST/PATCH/DELETE /reviews` | CRUD reviews (auth; dono do review para PATCH/DELETE) |
| `GET /admin/users`     | Listar usuários (ADMIN)            |
| `GET /admin/orders`    | Listar pedidos (ADMIN)             |
| `GET /admin/audit-logs` | Trilha de auditoria (ADMIN)       |

## Roles

- **ADMIN** — Aprovar vendedores, listar usuários/pedidos/vendedores completos, CRUD do catálogo de produtos, grafo completo de status de pedido.
- **SELLER** — Aplicar como vendedor (após aprovação), CRUD dos próprios listings (não do catálogo de produtos), ver pedidos em que participa, transações e saldo.
- **CUSTOMER** — Criar pedidos, ver próprios pedidos, atualizar status (ex.: cancelar), reviews.

## Prisma Studio

Para inspecionar o banco PostgreSQL:

```bash
npm run db:studio
```
