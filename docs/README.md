# Documentação do ZippiCRM

Este diretório reúne documentação técnica e operacional. O código e os testes continuam sendo a fonte de verdade do comportamento executável.

## Stack atual

- Node.js 20.19.x e npm 10.8.x;
- React 19, Vite 8 e Tailwind CSS 4 no frontend;
- Express 4 e TypeScript no backend;
- Drizzle ORM com SQLite (`better-sqlite3`);
- sessões persistidas em SQLite;
- Vitest, Testing Library, ESLint e Prettier para qualidade.

Consulte o [README principal](../README.md) para instalação e comandos do projeto.

## Índice e estado dos documentos

Contagens de linhas foram removidas deste índice porque mudam sem representar cobertura ou completude.

| Documento                                                  | Estado verificável                                                    | Uso recomendado                                                        |
| ---------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [openapi.yaml](./openapi.yaml)                             | Especificação OpenAPI parcial; não cobre todas as rotas implementadas | Importação em editores OpenAPI e referência dos contratos já descritos |
| [API_README.md](./API_README.md)                           | Guia parcial da API                                                   | Introdução aos endpoints documentados                                  |
| [API_QUICK_REFERENCE.md](./API_QUICK_REFERENCE.md)         | Referência rápida parcial                                             | Consulta durante desenvolvimento, confirmando detalhes no código       |
| [DATABASE.md](./DATABASE.md)                               | Snapshot resumido do schema                                           | Visão inicial do modelo; confirmar migrations e `shared/schema.ts`     |
| [PROJECT_COMPLETION_PLAN.md](./PROJECT_COMPLETION_PLAN.md) | Plano e backlog; não descreve necessariamente o código já entregue    | Planejamento e retomada                                                |
| [DEPLOY.md](../DEPLOY.md)                                  | Procedimento operacional                                              | Preparação e execução de deploy                                        |
| [BACKUP_RESTORE.md](../BACKUP_RESTORE.md)                  | Procedimento operacional                                              | Backup, verificação e restauração do SQLite                            |
| [RUNBOOK_PRODUCAO.md](../RUNBOOK_PRODUCAO.md)              | Procedimento operacional                                              | Operação, diagnóstico e resposta a incidentes                          |
| [GO_LIVE_CHECKLIST.md](../GO_LIVE_CHECKLIST.md)            | Gate operacional                                                      | Verificações antes da publicação                                       |

O OpenAPI cobre apenas parte do conjunto de rotas em `server/routes.ts`. Portanto, não use a especificação atual para gerar um cliente completo nem para provar cobertura da API.

## Arquitetura da API

- Base local padrão: `http://localhost:5000`;
- API versionada: `/api/v1/*`;
- health check: `/api/health`;
- autenticação: sessão de servidor com cookie `zippcrm.sid` HTTP-only;
- autorização: papéis `super_admin`, `manager` e `seller`, combinados com associação ao tenant;
- payloads: JSON;
- mutações privadas: token CSRF enviado no header `X-CSRF-Token`.

O backend contém rotas para autenticação, administração de tenants e usuários, equipe, configurações, dashboard, clientes, produtos, pedidos, cashback, campanhas, automações, agenda e metas de vendedores, interações, relatórios, importação, exportação e notificações. Os três documentos de API acima ainda não cobrem esse conjunto integralmente.

## Fluxo de autenticação e CSRF

1. Faça login em `POST /api/v1/auth/login` e preserve o cookie recebido.
2. Consulte `GET /api/v1/csrf-token` usando a sessão autenticada.
3. Envie o valor retornado em `X-CSRF-Token` nas requisições privadas `POST`, `PUT`, `PATCH` e `DELETE`.
4. Use `POST /api/v1/auth/logout` com cookie e token para encerrar a sessão.

Exemplo local, sem credenciais reais:

```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"usuario@example.com","password":"senha-local"}' \
  -c cookies.txt

curl http://localhost:5000/api/v1/csrf-token \
  -b cookies.txt

# Substitua TOKEN_CSRF pelo valor retornado acima.
curl -X POST http://localhost:5000/api/v1/customers \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: TOKEN_CSRF" \
  -b cookies.txt \
  -d '{"name":"Maria Silva","email":"maria@example.com","segment":"VIP"}'
```

Não use credenciais de produção em exemplos, documentação ou arquivos versionados.

## Autorização e multi-tenancy

Papéis e tenant ativo são obtidos da sessão e verificados no servidor nas rotas protegidas. Isso não permite presumir que qualquer endpoint novo esteja automaticamente isolado: mudanças em leitura, escrita, exportação, cache, jobs ou integrações devem incluir validação positiva e negativa entre tenants.

As permissões variam por recurso e operação. Confirme o middleware aplicado à rota em `server/routes.ts`; as tabelas dos guias parciais podem ficar defasadas.

## OpenAPI e ferramentas externas

O servidor atual não monta Swagger UI em `/api-docs`. Para inspecionar o snapshot disponível, abra [openapi.yaml](./openapi.yaml) em uma ferramenta compatível, como Swagger Editor, Redocly ou Postman.

Não instale dependências no projeto apenas para visualizar o arquivo. Ao gerar tipos ou clientes, limite o uso aos caminhos descritos e faça revisão contra as rotas e schemas atuais.

## Erros

O formato mais comum é:

```json
{
  "error": "Mensagem de erro",
  "code": "CODIGO_OPCIONAL",
  "details": {}
}
```

`code` e `details` são opcionais, e handlers mais antigos podem responder com estruturas específicas. Consumidores devem tratar o status HTTP como sinal principal e não presumir uniformidade além do contrato verificado para cada rota.

Status frequentes: `200`, `201`, `400`, `401`, `403`, `404`, `409`, `429`, `500` e `503`.

## Manutenção da documentação

Ao mudar comportamento ou contrato:

1. atualize o schema compartilhado e as migrations quando aplicável;
2. atualize o OpenAPI e os guias afetados no mesmo lote;
3. adicione ou ajuste testes de contrato, autorização e isolamento por tenant;
4. valide todos os links locais deste índice;
5. não marque um documento como completo sem comparar sua cobertura com o código.

Não há um contato de suporte público configurado neste repositório. Use o canal privado definido pelos mantenedores para dúvidas ou incidentes.

---

Última revisão factual deste índice: 29 de agosto de 2026.
