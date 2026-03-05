# 🎯 Neon Arsenal Market

**Marketplace de skins CS2** — plataforma full-stack para compra e venda de skins do Counter-Strike 2, com pagamentos via PayPal, sistema de comissões e painel administrativo.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF)](https://vitejs.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## ✨ Funcionalidades

- **Catálogo de listings** — browse por arma, exterior, rarity, StatTrak™, float value
- **Carrinho de compras** — adicionar/remover skins com validação de trade lock
- **Pagamentos PayPal** — checkout seguro com webhook de confirmação e verificação de assinatura
- **Sistema de comissões** — cálculo automático de comissão por transação
- **Painel de vendedores** — inscrição, aprovação, histórico e saldo
- **Painel administrativo** — gerenciamento de usuários, sellers e pedidos
- **Autenticação JWT** — access + refresh token, blacklist por logout (RevokedToken)
- **Rate limiting** — proteção contra brute force por IP e por rota
- **API documentada** — Swagger UI disponível em `/api-docs`
- **Docker ready** — `Dockerfile` multi-stage + `docker-compose.yml`

---

## 🏗️ Arquitetura

### Frontend (React + Vite)

```
src/
├── api/            # Clientes HTTP por domínio (listings, orders, auth...)
├── components/     # Componentes reutilizáveis (ListingCard, ui/*)
├── contexts/       # Context API (CartContext, AuthContext)
├── hooks/          # Hooks customizados (use-toast)
├── layouts/        # Layouts compartilhados (MainLayout, AdminLayout)
├── pages/          # Páginas roteadas (React Router v6)
│   ├── admin/      # Dashboard admin
│   └── seller/     # Dashboard seller
├── services/       # Serviços de negócio (auth, storage)
├── test/           # Setup de testes (vitest + jest-dom)
└── types/          # Tipos TypeScript (api.ts)
```

### Backend (Node.js + Express)

```
server/src/
├── modules/        # Módulos por domínio (Controller → Service → Repository → DTO)
│   ├── auth/       # JWT, refresh token, registro, login, logout
│   ├── orders/     # Criação, status, rastreamento
│   ├── payments/   # PayPal, webhook com verificação de assinatura
│   ├── listings/   # CRUD de listings, histórico de preços
│   ├── products/   # Catálogo base de skins
│   ├── sellers/    # Inscrição, aprovação, perfil
│   ├── commissions/# Transações e saldo de sellers
│   ├── users/      # Gerenciamento de usuários (admin)
│   └── reviews/    # Avaliações por produto
└── shared/         # Utilitários compartilhados
    ├── database/   # Prisma client singleton
    ├── errors/     # AppError + handler global
    ├── middleware/ # Auth, rate limit, validation
    └── utils/      # PayPal SDK, email (Resend), JWT, bcrypt
```

---

## 🛠️ Stack Tecnológica

| Camada         | Tecnologias                                              |
|----------------|----------------------------------------------------------|
| **Frontend**   | React 18, Vite 5, TypeScript 5, TailwindCSS, shadcn/ui  |
| **Estado**     | Context API (Cart, Auth), TanStack Query (servidor)      |
| **Roteamento** | React Router v6                                          |
| **Backend**    | Node.js 18+, Express 4, TypeScript ESM                   |
| **ORM**        | Prisma 5 + PostgreSQL 16 (SQLite opcional para dev)      |
| **Auth**       | JWT (jsonwebtoken), bcrypt, refresh token blacklist      |
| **Pagamento**  | PayPal Checkout SDK + Webhooks + verificação de assinatura|
| **Email**      | Resend API                                               |
| **Logs**       | Pino + pino-pretty                                       |
| **Docs**       | Swagger UI + OpenAPI 3.0 spec                            |
| **Testes**     | Vitest, @testing-library/react, jest-dom                 |
| **CI/CD**      | GitHub Actions                                           |
| **Infra**      | Docker (multi-stage), docker-compose                     |
| **Hooks**      | Husky + lint-staged (pre-commit)                         |

---

## 🚀 Como Executar

### Pré-requisitos

- Node.js 18+
- npm 9+

### Instalação

```bash
git clone https://github.com/user/neon-arsenal-market.git
cd neon-arsenal-market
npm install
cd server && npm install && cd ..
```

### Variáveis de Ambiente

Crie `server/.env` com base no `server/.env.example`:

```env
# Banco de dados (SQLite)
DATABASE_URL="file:./dev.db"

# JWT
JWT_SECRET=seu_secret_aqui
JWT_REFRESH_SECRET=seu_refresh_secret_aqui
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# PayPal (Sandbox)
PAYPAL_CLIENT_ID=seu_client_id
PAYPAL_SECRET=seu_client_secret
PAYPAL_MODE=sandbox
PAYPAL_WEBHOOK_ID=seu_webhook_id

# Servidor
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

### Banco de Dados

O projeto usa **PostgreSQL** em produção. Para desenvolvimento local, use Docker:

```bash
# Sobe apenas o PostgreSQL
docker compose up db -d

# Aplica as migrations e popula com dados de demo
cd server
npx prisma migrate deploy
npx prisma db seed
```

Defina a variável `DATABASE_URL` em `server/.env` apontando para o banco local:
```
DATABASE_URL="postgresql://neon:changeme@localhost:5432/neon_arsenal"
```

### Desenvolvimento

```bash
# Rodar frontend + backend simultaneamente
npm run dev:fullstack

# Apenas frontend (porta 5173)
npm run dev:client

# Apenas backend (porta 3001)
npm run dev:server
```

### Testes

```bash
# Testes frontend
npm test

# Testes backend
cd server && npm test
```

### Documentação da API

Com o servidor rodando, acesse: [http://localhost:3001/api-docs](http://localhost:3001/api-docs)

---

## 🐳 Docker (desenvolvimento local)

```bash
# Copie o arquivo de variáveis de ambiente
cp .env.example .env
# Edite .env e defina POSTGRES_PASSWORD, JWT_SECRET e JWT_REFRESH_SECRET

# Sobe banco + API
docker compose up --build

# Inclui frontend com HMR
docker compose --profile dev up --build
```

O entrypoint do container executa `prisma migrate deploy` automaticamente antes de iniciar o servidor.

## ☁️ Deploy em produção

### Railway (recomendado)

1. Crie um projeto no [Railway](https://railway.app) e conecte o repositório
2. Adicione um serviço **PostgreSQL** ao projeto — o Railway provisiona automaticamente
3. Na aba *Variables* do serviço API, defina:
   ```
   JWT_SECRET, JWT_REFRESH_SECRET, PAYPAL_CLIENT_ID, PAYPAL_SECRET,
   PAYPAL_WEBHOOK_ID, FRONTEND_URL
   ```
4. O `railway.json` na raiz do projeto já configura o build e o healthcheck

### Render

1. Crie uma conta em [Render](https://render.com) e conecte o repositório
2. Na dashboard, clique em **New > Blueprint** e aponte para o arquivo `render.yaml`
3. Render provisionará o banco PostgreSQL e o web service automaticamente
4. Preencha as variáveis marcadas como `sync: false` nas configurações do serviço

---

## 👤 Contas de Demonstração

Após executar o seed (`npx prisma db seed` dentro de `server/`):

| E-mail                          | Senha      | Papel    |
|---------------------------------|------------|----------|
| admin@skinmarket.gg             | admin123   | Admin    |
| seller@skinmarket.gg            | seller123  | Seller ✅ aprovado |
| pro_trader@skinmarket.gg        | seller456  | Seller ✅ aprovado |
| buyer@skinmarket.gg             | buyer123   | Customer |

O seed popula **20 skins** do catálogo CS2 (AK-47, AWP, M4A4, facas…), **34 listings** ativos e **6 reviews**.

---

## 📊 Modelo de Dados

```
User ──────┬── Seller ──┬── Listing ──┬── OrderItem ──── Order
           │            │             └── PriceHistory    │
           │            └── SellerTransaction ────────────┘
           └── Order (CustomerOrders)
           └── Review

Product ───── Listing

RevokedToken  (blacklist de refresh tokens por logout)
```

**Regras de negócio principais:**
- Cada `Listing` representa um item físico único (float value individual)
- `Order` reserva o listing (`RESERVED`) e ao confirmar pagamento marca `SOLD`
- `SellerTransaction` calcula comissão automaticamente (`grossAmount × commissionRate`)
- Sellers precisam de aprovação admin para publicar listings
- Logout revoga o refresh token via `RevokedToken`

---

## 🔒 Segurança

- **Rate limiting** — 100 req/15min (global), 5 tentativas de login por IP
- **Validação** — Zod em todos os endpoints de entrada
- **CORS** — restrito à origem do frontend (`FRONTEND_URL`)
- **Senhas** — bcrypt com 12 salt rounds
- **Tokens** — JWT com expiração curta (15min), refresh tokens com blacklist por logout
- **Webhooks** — verificação de assinatura PayPal via API oficial

---

## 📁 Sprints

| Sprint | Tema                                              | Status       |
|--------|---------------------------------------------------|--------------|
| 0      | Setup & Scaffolding                               | ✅ Concluído |
| 1      | Auth + Sellers + Listings                         | ✅ Concluído |
| 2      | Orders + Payments (PayPal)                        | ✅ Concluído |
| 3      | Frontend + Commissions + Reviews                  | ✅ Concluído |
| 4      | Rate Limiting + Admin + Refinements               | ✅ Concluído |
| 5      | Testes + README + CI/CD                           | ✅ Concluído |
| 6      | Segurança + Infra (CORS, Docker, Docs)            | ✅ Concluído |
| 7      | PostgreSQL + Deploy (Railway / Render)            | ✅ Concluído |

---

## 🤝 Contribuindo

1. Fork o repositório
2. Crie uma branch: `git checkout -b feat/nova-funcionalidade`
3. Commit suas mudanças: `git commit -m 'feat: adiciona nova funcionalidade'`
4. Push para a branch: `git push origin feat/nova-funcionalidade`
5. Abra um Pull Request

---

## 📄 Licença

Este projeto está licenciado sob a MIT License — veja [LICENSE](LICENSE) para detalhes.

---

*Desenvolvido como projeto de portfólio — marketplace CS2 skin com arquitetura full-stack TypeScript*
