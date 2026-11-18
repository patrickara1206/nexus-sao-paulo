# NEXUS — São Paulo, por dentro

Protótipo jogável Web 3D para apresentar o conceito de um mundo aberto multiplayer inspirado em São Paulo. **Versão 0.1: exploração e direção artística inicial, não uma reprodução fotográfica da cidade.**

## O que está implementado

- Terceira pessoa, personagem humano estilizado com caminhada animada, corrida e pulo.
- Veículo controlável, câmera por arraste e recuperação para a Paulista.
- Área inicial contínua: Paulista, Centro e Ibirapuera, com projeção local em metros reais e 6.133 trechos de vias importados do OpenStreetMap.
- 71.985 contornos de edifícios distribuídos em 166 setores de 500 m; carregamento dos setores próximos ao jogador. 69.813 registros têm altura ou número de pavimentos informado. Alturas derivadas de pavimentos usam 3,1 m/pavimento; ausentes usam 12 m. Os contornos são reais do mapa, mas alturas, fachadas e materiais não equivalem a levantamento arquitetônico.
- 12 pontos de descoberta com modelos próprios e estilizados: MASP, Casa das Rosas, Japan House, Copan, Itália, Theatro Municipal, Catedral da Sé, Estação da Luz, Ibirapuera, Oca, Auditório Ibirapuera e Monumento às Bandeiras. Dimensões e detalhes desses modelos são aproximações artísticas.
- Prévias isoladas e autorais de São Caetano, São Bernardo, orla de Santos e Vila Belmiro. São estudos conceituais com âncoras geográficas aproximadas, não bairros completos nem plantas fiéis de seus edifícios/estádio. Use Mapa → Prévias da proposta para viajar.
- Asfalto, sinalização central das vias principais, árvores, céu e nuvens, fachadas procedurais com janelas e sombras em qualidade alta.
- Minimapa, atlas, destinos, progresso local, modo leve e controles de toque.
- Salas WebSocket para até 16 jogadores com Cloudflare Durable Objects. Compartilha nome, posição, direção e modo a pé/veículo. Não usa jogadores falsos.

## Executar

Requer Node.js 22+ e pnpm.

```sh
pnpm install
pnpm test
pnpm build
pnpm dev:online
```

Abra a URL local informada pelo Wrangler. Para desenvolvimento somente visual: `pnpm dev` (Vite); multiplayer exige Wrangler, pois Vite não implementa `/api/room`.

PC: WASD/setas, arraste para olhar, Shift para correr, Espaço para pular/frear, E para veículo, M para mapa. No celular: joystick, arraste à direita e botões de ação.

## Cloudflare

O projeto usa **Workers Static Assets + Durable Objects**, reunindo o jogo e as salas no mesmo domínio. A configuração é `wrangler.jsonc`.

```sh
pnpm build
pnpm exec wrangler login
pnpm exec wrangler deploy
```

Também pode ser publicado por Workers Builds conectado ao repositório: comando de build `pnpm build`, deploy `npx wrangler deploy`, raiz do repositório e branch `main`. A primeira publicação aplica a migração SQLite `v1` para a classe `Room`. Não há segredos de aplicação no código.

## Fontes e licenças

Dados de ruas e edifícios: **© OpenStreetMap contributors**, ODbL 1.0. A atribuição aparece no jogo. Veja [copyright](https://www.openstreetmap.org/copyright) e [licença ODbL](https://opendatacommons.org/licenses/odbl/1-0/).

- `src/streets.json`: subconjunto viário e metadados da consulta.
- `public/data/buildings/`: banco derivado dos contornos e alturas; `manifest.json` contém data da base e totais. Esses arquivos são distribuídos sob ODbL 1.0.
- `tools/import-osm.mjs` e `tools/tile-buildings.mjs`: conversores reproduzíveis para respostas Overpass `out geom`.
- Não contém imagens extraídas de Street View, modelos do Google Earth, texturas fotográficas de terceiros nem logotipos oficiais de clubes. Modelos e materiais são autorais/procedurais.
- Three.js, Vite, Wrangler e suas dependências mantêm suas próprias licenças.

## Limites desta entrega

Sem interiores, pedestres/NPCs, trânsito, economia, construção, contas ou persistência de mundo no servidor. O relevo é uma superfície aproximada. Vias elevadas, túneis e níveis sobrepostos do OSM aparecem na mesma superfície; não constituem uma simulação completa de tráfego. Não foi feito levantamento de acessibilidade nem verificação rua a rua. Elementos temporários do mapa real podem estar desatualizados.

As colisões de prédios carregados usam seus polígonos, mas o carregamento é assíncrono. A posição multiplayer é validada por tipo, limites e velocidade; o servidor ainda não valida todas as colisões contra a geometria. É um protótipo social sem competição, não um servidor com proteção completa contra trapaças.

No celular, a qualidade automática reduz resolução e desativa sombras. A compatibilidade foi projetada para WebGL 2; validação em aparelho físico ainda é necessária. Desempenho varia conforme GPU e navegador.

## Próximos passos

1. Revisar a pé o percurso Paulista → Centro → Ibirapuera e corrigir acessos, orientação, níveis e dimensões dos 12 marcos com fontes abertas/levantamentos licenciados.
2. Substituir as fachadas genéricas por conjuntos de fachadas e materiais próprios baseados em referências autorizadas; detalhar calçadas, travessias, mobiliário, vegetação e iluminação.
3. Melhorar anatomia, roupa, rig e animações do personagem; colisão e câmera por volume.
4. Importar relevo, pontes e túneis; acrescentar streaming viário, LODs, oclusão e orçamento por aparelho.
5. Expandir São Caetano e São Bernardo com dados reais e modelos revisados; depois Anchieta/Imigrantes, Serra do Mar e Baixada. Converter as prévias da orla e Vila Belmiro em áreas completas somente após pesquisa de geometria e acesso.
6. Evoluir salas com autoridade de movimento, reconexão, regiões, interpolação e teste de carga; persistência apenas quando houver mecânicas que precisem dela.

Não declarar cidade completa ou fidelidade fotográfica com base neste protótipo. Para apresentação, utilizar imagens reais do jogo e identificar as prévias como conceitos.
