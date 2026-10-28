# PrintWatch

Sistema web de monitoramento de impressoras em rede, desenvolvido como TCC.

## Tecnologias

- React e Vite
- Node.js e Express
- SQLite

## Windows

Instale o [Node.js LTS](https://nodejs.org/). Abra dois terminais na pasta do projeto.

```powershell
npm.cmd install
npm.cmd run dev:server
```

No segundo terminal:

```powershell
npm.cmd run dev
```

Abra o endereço exibido pelo Vite, normalmente `http://localhost:5173`.

## Linux

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install --lts
nvm use --lts
npm install
npm run dev:server
```

No segundo terminal:

```bash
npm run dev
```

## Dados fictícios para demonstração

Por padrão, a API usa a base local real e não cria registros fictícios. Para uma demonstração isolada, inicie a API com:

```powershell
npm.cmd run dev:server -- --fake
```

No Linux:

```bash
npm run dev:server -- --fake
```

O modo `--fake` usa `server/data/printwatch.fake.db`, separado da base real.

## Funcionalidades

- Inventário de impressoras, clientes, sites e número de série
- Alertas, eventos e chamados de manutenção
- Suprimentos, estoque e movimentações
- Configurações SNMP preparadas para integração futura

## Próximas etapas

- Alertas por mensageria
- Previsão de consumo de toner
- Mapa de equipamentos com problemas
- Coleta automática por SNMP
