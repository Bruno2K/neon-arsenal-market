# Como Aplicar a Migration

O banco de dados precisa ser atualizado para o novo schema. Execute os seguintes comandos no diretório `server`:

## Opção 1: Usar Prisma Migrate (Recomendado)

```bash
cd server
npx prisma migrate deploy
```

Se houver erro sobre migration faltante, execute:

```bash
npx prisma migrate resolve --applied 20250216120000_init_sqlite
npx prisma migrate deploy
```

## Opção 2: Usar Prisma DB Push (Desenvolvimento)

```bash
cd server
npx prisma db push --accept-data-loss
```

Isso aplicará o schema diretamente sem usar migrations.

## Opção 3: Aplicar SQL Manualmente

Se as opções acima não funcionarem, você pode aplicar o SQL manualmente usando um cliente SQLite:

```bash
cd server
sqlite3 prisma/dev.db < prisma/migrations/20250220000000_migrate_to_cs_marketplace/migration.sql
```

## Após Aplicar

Depois de aplicar a migration, execute:

```bash
cd server
npx prisma generate
npm run seed
```

Isso irá:
1. Gerar o Prisma Client atualizado
2. Popular o banco com dados de exemplo (produtos CS e listings)
