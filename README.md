# PrintWatch

Sistema web para monitoramento de impressoras em rede, desenvolvido como Trabalho de Conclusão de Curso por João Pedro Lange (orientador: André de Freitas Smaira).

O PrintWatch centraliza o cadastro de impressoras, o status operacional, os contadores de páginas, os níveis de toner, os eventos técnicos, os chamados de manutenção e o controle de suprimentos, e gera alertas de toner baixo e de impressora offline.

> **Estado atual:** o status e o nível de toner são informados pelo usuário, simulando os dados que serão obtidos por SNMP. A coleta automática por SNMP ainda não está implementada (veja [Limitações](#limitações-conhecidas) e [Próximas etapas](#próximas-etapas)).

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Front-end | React 19 e Vite 8 |
| Back-end | Node.js e Express 5 (API REST), com CORS liberado |
| Banco de dados | SQLite, pelo módulo nativo `node:sqlite` do Node.js (sem ORM) |

O front-end e o back-end compartilham um único `package.json`.

## Como executar

**Requisitos:** Node.js 22.13 ou superior (o módulo `node:sqlite` exige uma versão recente; confirme com `node -v`). O Node exibe o aviso `ExperimentalWarning: SQLite is an experimental feature`, que é esperado.

```bash
npm install

# Terminal 1: API em http://localhost:3001 (porta alterável pela variável PORT)
npm run dev:server

# Terminal 2: interface em http://localhost:5173 (repassa /api para a porta 3001)
npm run dev
```

### Modo de demonstração (`--fake`)

```bash
npm run dev:server -- --fake
```

Usa uma base separada (`server/data/printwatch.fake.db`), sem alterar a base normal (`server/data/printwatch.db`). Os arquivos `.db` são criados em tempo de execução e ignorados pelo Git. Os dados só são inseridos quando as tabelas estão vazias.

| Dado | Conteúdo da demonstração |
|---|---|
| Impressoras | 4: HP LaserJet Pro M404 (Administrativo, online, toner 78%, 12.480 páginas); Brother DCP-L2540DW (Financeiro, atenção, toner 18%, 8.914 páginas); Epson EcoTank L6270 (Recepção, online, toner 63%, 5.329 páginas); Samsung M4070FR (Almoxarifado, offline, toner indisponível, 21.763 páginas) |
| Clientes e unidades | 1 cliente ("Empresa Demonstração") e 1 unidade ("Matriz", São Paulo/SP), vinculados às 4 impressoras |
| Leituras | 3 por impressora com toner informado (9 no total): consumo de 2 pontos de toner e 85 páginas por dia |
| Materiais, estoque, eventos, chamados e histórico | Vazios (cadastre pela interface) |

Para recomeçar a demonstração do zero, apague `server/data/printwatch.fake.db` e reinicie o servidor.

> **Atenção:** o botão "Restaurar dados de demonstração" (rota `POST /api/demo/reset`) recria as 4 impressoras **sem cliente e sem unidade** e apaga histórico, leituras, eventos e chamados. Ele funciona também fora do modo `--fake` e afeta a base real.

## Estrutura do projeto

```
server/index.js     Back-end completo: schema, dados de demonstração e rotas REST
server/data/        Bancos SQLite (criada em tempo de execução)
src/                Front-end React (App.jsx, telas e modais, um CSS por componente)
src/data/           Impressoras estáticas usadas se a API estiver indisponível
public/             Arquivos estáticos
```

## Funcionalidades

- Cadastro, edição e exclusão de impressoras, com cliente, unidade e número de série.
- Painel com indicadores, busca por nome ou setor e filtro por status (Todas, Online, Atenção, Offline).
- Alertas automáticos de toner baixo e de impressora offline.
- Previsão de duração do toner.
- Eventos técnicos e chamados de manutenção por impressora.
- Controle de materiais e estoque (entradas e saídas).
- Relatórios consolidados e histórico de ações.
- Configurações do limite de alerta e dos parâmetros SNMP.
- Cadastro de clientes e unidades.

## Regras de negócio

**Alertas.** Existem duas regras, calculadas no front-end (não são persistidas):
- Impressora com status `offline`: gravidade **Crítico**.
- Impressora com toner **menor** que o limite: gravidade **Atenção**. O limite padrão é 20%, configurável (1 a 99) e salvo na tabela `settings`. O toner igual ao limite não gera alerta.

Uma impressora gera no máximo um alerta (offline tem prioridade sobre toner baixo).

**Status.** Os valores são `online`, `warning` (exibido como "Atenção") e `offline`, escolhidos manualmente no formulário. Nada os calcula automaticamente.

**Previsão de toner** (`GET /api/printers/:id/forecast`).
- Consumo médio diário = (toner da primeira leitura − toner da última leitura) ÷ dias entre as duas.
- Dias restantes = parte inteira de (toner atual ÷ consumo médio diário).
- Exige pelo menos 2 leituras. Se o consumo for menor ou igual a zero, a previsão fica indisponível.
- Uma leitura é criada no cadastro e em toda edição da impressora, além de `POST /api/printers/:id/readings`.

**Estoque.** Cada movimentação (`entry` ou `exit`) atualiza `stock_items.quantity`. Uma saída maior que o saldo é rejeitada com HTTP 400 e a mensagem `Estoque insuficiente.`. Materiais com quantidade igual ou menor que o mínimo são destacados na lista (não geram alerta).

**Chamados.** Fluxo `open` → `in_progress` → `resolved`. Ao resolver, a API calcula `resolutionMinutes` (resolução menos abertura) na resposta do `PUT`; o valor não é gravado nem exibido na tela.

**Histórico.** Registra automaticamente: cadastro, edição e exclusão de impressoras, eventos técnicos e abertura de chamados. Não registra clientes, estoque, configurações, leituras nem usuário.

**Relatórios.** Calculados no navegador: total de impressoras, contadores somados (campo `pages` atual), setores distintos, uso por setor e as 8 entradas mais recentes do histórico.

## Banco de dados

13 tabelas, criadas automaticamente na inicialização. As chaves estrangeiras estão ativas, com `ON DELETE CASCADE` em sites, eventos, chamados, leituras, itens de estoque e movimentações.

| Tabela | Descrição |
|---|---|
| `clients`, `sites` | Clientes e suas unidades (`sites.client_id` com FK) |
| `printers` | Impressoras (`ip` único; `client_id` e `site_id` **sem FK declarada**) |
| `printer_readings` | Série histórica de toner e páginas |
| `printer_events` | Eventos técnicos |
| `maintenance_tickets` | Chamados de manutenção |
| `materials` | Materiais com estoque mínimo |
| `stock_items` | Saldo atual (1 por material) |
| `stock_movements` | Entradas e saídas |
| `material_compatibility` | Modelos de impressora compatíveis, em texto livre (**sem FK**) |
| `replenishment_requests` | Solicitações de reposição (**sem FK**) |
| `history` | Registro de ações do sistema |
| `settings` | Configurações em chave-valor (`tonerThreshold`, `snmpVersion`, `community`) |

## API REST

Todas as rotas começam com `/api`. O corpo é JSON. Não há autenticação.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Verifica se a API está no ar |
| GET | `/printers` | Lista impressoras |
| POST | `/printers` | Cadastra impressora (obrigatórios: name, model, sector, ip) |
| PUT | `/printers/:id` | Edita impressora (envie todos os campos) |
| DELETE | `/printers/:id` | Exclui impressora, com leituras, eventos e chamados |
| POST | `/printers/:id/readings` | Registra leitura (toner e pages) |
| GET | `/printers/:id/forecast` | Previsão de duração do toner |
| GET, POST | `/printers/:id/events` | Lista e registra eventos técnicos (type e severity obrigatórios) |
| GET, POST | `/printers/:id/tickets` | Lista e abre chamados (title obrigatório) |
| PUT | `/tickets/:id` | Atualiza chamado (status, technician, priority, resolution) |
| GET, POST | `/clients` | Lista (com unidades) e cadastra clientes |
| POST | `/clients/:id/sites` | Cadastra unidade de um cliente |
| GET, POST | `/materials` | Lista (com saldo e modelos compatíveis) e cadastra materiais |
| POST | `/materials/:id/movements` | Registra entrada ou saída (`type`: `entry` ou `exit`) |
| GET | `/materials/:id/movements` | Lista movimentações |
| POST | `/materials/:id/compatibility` | Registra modelo compatível (409 se duplicado) |
| POST | `/replenishment-requests` | Registra solicitação de reposição |
| GET | `/history` | Lista o histórico |
| GET, PUT | `/settings` | Lê e atualiza as configurações |
| POST | `/demo/reset` | Restaura os dados de demonstração (veja o aviso acima) |

## Limitações conhecidas

- Sem coleta SNMP: status e toner são digitados; o painel só atualiza ao abrir a página ou clicar em "Atualizar dados" (sem atualização periódica).
- Sem autenticação nem perfis de usuário; o CORS está liberado.
- Sem testes automatizados.
- Validações do servidor limitadas: não verifica formato de IP, valores de status, faixa do toner nem existência do cliente. Uma quantidade negativa em movimentação de estoque não é bloqueada.
- Compatibilidade de materiais e solicitações de reposição existem só na API (sem tela, sem listagem).
- O histórico não guarda usuário nem valores anteriores, e as movimentações de estoque não aparecem na interface.
- Só impressoras têm edição e exclusão completas; clientes, unidades, materiais, eventos e chamados não podem ser editados ou excluídos.
- O texto "Toner abaixo de 20%" na tela de alertas é fixo e não acompanha o limite configurado.

## Próximas etapas

- Coletor SNMP (por exemplo com a biblioteca `net-snmp`) que consulte as impressoras periodicamente, grave leituras automaticamente e derive o status por tempo de resposta e erro. Campos para SNMP v3 também serão necessários.
- Mapeamento dos OIDs da Printer-MIB e da Host-Resources-MIB, por exemplo nível de suprimento (`1.3.6.1.2.1.43.11.1.1.9`), capacidade (`1.3.6.1.2.1.43.11.1.1.8`), contador de páginas (`1.3.6.1.2.1.43.10.2.1.4`), status (`1.3.6.1.2.1.25.3.5.1.1`) e número de série (`1.3.6.1.2.1.43.5.1.1.17`). Valide cada OID no equipamento real.
- Autenticação com perfis de usuário.
- Atualização periódica dos dados.
- Telas de compatibilidade e de reposição, e alerta de estoque mínimo.
- Notificações por canais de mensagem e visualização de ocorrências em mapa.
