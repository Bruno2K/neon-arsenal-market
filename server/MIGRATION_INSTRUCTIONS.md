# Instruções para Aplicar a Migration

O banco de dados precisa ser atualizado para o novo schema de marketplace CS. 

## Problema Atual

O erro indica que a tabela `User` não existe porque as migrations não foram aplicadas ao banco de dados.

## Solução Rápida

Execute no terminal, no diretório `server`:

```bash
npm run db:push
```

Isso aplicará o schema diretamente ao banco de dados sem usar migrations.

## Solução Completa (Recomendada para Produção)

Se preferir usar migrations:

```bash
# 1. Marcar migration antiga como aplicada (se necessário)
npm run db:migrate:deploy

# 2. Gerar Prisma Client atualizado
npm run db:generate

# 3. Popular banco com dados de exemplo
npm run db:seed
```

## Alternativa: Reset Completo

Se não houver dados importantes no banco:

```bash
npm run db:reset
npm run db:seed
```

Isso irá:
1. Deletar o banco atual
2. Aplicar todas as migrations
3. Popular com dados de exemplo

## Verificar se Funcionou

Após aplicar, o servidor deve iniciar sem erros e você poderá fazer login normalmente.
