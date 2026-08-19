# PrintWatch

Sistema web para monitoramento de impressoras em rede, criado como projeto de TCC. Centraliza inventário, status, níveis de toner, alertas e informações operacionais para apoiar manutenção preventiva.

## Funcionalidades atuais

- Cadastro, edição e exclusão de impressoras
- Cliente, site/unidade e número de série por equipamento
- Status, contador, toner e parâmetros SNMP
- Alertas automáticos para toner baixo e impressora offline
- Histórico de alterações e relatórios por setor
- Configurações de alertas e SNMP
- API REST em Express com banco SQLite

## Tecnologias

- React e Vite
- Node.js e Express
- SQLite

## Como executar

Em dois terminais, na pasta do projeto:

```powershell
npm.cmd run dev:server
```

```powershell
npm.cmd run dev
```

O painel estará no endereço indicado pelo Vite. A API responde em `http://localhost:3001`.

## Próximas etapas

- Eventos técnicos e chamados de manutenção
- Estoque e reposição de suprimentos
- Coleta automática por SNMP
- Usuários, permissões e relatórios avançados
