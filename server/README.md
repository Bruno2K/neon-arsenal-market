# Neon Arsenal Market — API

API REST em Node.js + Express + Prisma + SQLite para o marketplace multi-vendedores.

## Pré-requisitos

- Node.js 18+
- Conta PayPal (sandbox para desenvolvimento) — opcional para testar pagamentos

## Banco de dados (SQLite)

O projeto usa **SQLite** com um único arquivo `.db`. Não é necessário instalar PostgreSQL nem Docker.

O arquivo do banco fica em `prisma/dev.db` (criado na primeira migração). O `.env` já vem com:

```
DATABASE_URL="file:./dev.db"
```

(O caminho é relativo à pasta `prisma/`.)

## Configuração

1. Na pasta `server/`, copie `.env.example` para `.env` (se ainda não tiver) e ajuste JWT e PayPal se quiser.
2. Rode as migrações (cria o arquivo `prisma/dev.db` e as tabelas):

```bash
npm run db:migrate
```

Se aparecer erro por causa de migração antiga (PostgreSQL), apague a pasta `prisma/migrations/20250216000000_init` se existir e rode `npm run db:migrate` de novo.

3. Inicie o servidor:

```bash
npm run dev
```

A API ficará disponível em `http://localhost:3001` (ou a porta definida em `PORT`).

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

Para inspecionar o banco SQLite:

```bash
npm run db:studio
```
