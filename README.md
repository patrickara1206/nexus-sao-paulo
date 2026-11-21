# NEXUS — São Paulo / Solo

**Versão 0.7 — personagem e personalização revisados. O trecho jogável continua concentrado no entorno do MASP/Trianon.**

O projeto mudou de direção: jogo solo com NPCs, histórias, modo livre e personalização, com prioridade para fachadas e lugares reais. A maquete com fachadas procedurais da versão 0.1 foi retirada da experiência principal. O histórico Git conserva a versão anterior.

## Personagem na versão 0.7

- Camiseta, calça, tênis e cabelo em malhas 3D. A roupa acompanha a morfologia, o porte, a altura e as cores do personagem na prévia e no jogo. O tom escolhido mantém os detalhes da textura de pele.
- Prévia em três quartos com iluminação de estúdio, fundo neutro e rotação por arraste ou pelas setas do teclado. A tecla **Home** restaura a vista inicial.

## Exploração na versão 0.6

- Use **M** ou clique no minimapa para marcar um destino. A seta indica a direção e a distância em linha reta. Na história, o objetivo atual aparece automaticamente.
- A visão geral distingue os locais jogáveis dos pontos de referência. A roda do mouse ajusta a distância da câmera e **C** alterna a vista panorâmica na superfície.
- Os pedestres percorrem trajetos junto às calçadas. Cruzamentos da Paulista receberam faixas, guias e semáforos ligados ao trânsito do jogo.
- A estação ganhou letreiros de chegada, sinalização e trens com interiores visíveis quando as portas abrem. A geometria dos túneis acompanha o traçado mapeado, com pavimento contínuo, faixas e iluminação ao longo das curvas.

## Revisão visual 0.5

- Reflexos do céu calculados no carregamento para dar leitura aos vidros, pintura e metais; sol, exposição e sombras revistos.
- Luz da superfície desligada nos espaços subterrâneos. Estação com luz própria, piso/concreto fotográficos, juntas de painéis e piso tátil instanciado.
- Interface compacta, novas telas e menos painéis sobre o cenário no modo livre. Câmera permite olhar mais para cima; posição vertical protegida contra atravessar o chão.
- Postura dos braços, gola e cobertura das mangas revistas. Cobertura dos pés e postura revistas, acompanhando a animação procedural existente. Ainda não é um personagem com rig/animação de produção.
- Guias, faixas, postes e bancos adicionados ao trecho. Posições e detalhes são indicativos, sem levantamento de mobiliário ou sinalização. As fachadas ausentes e o relevo completo continuam pendentes.

## Mobilidade Web


- Carro original sem marca, com modelo CC0 detalhado, aceleração, direção, freio e ré. Saída só com o veículo parado; respeita vias, limites e obstáculos do trecho.
- Doze veículos nas duas pistas mapeadas da Paulista, com frenagem por proximidade e ciclo de semáforo. Rotas de tráfego seguem o OSM; posicionamento dos semáforos e comportamento são aproximações de gameplay.
- Plataforma central e dois mezaninos do Trianon–Masp, com limites que impedem caminhar nos trilhos. Dois trens de seis carros chegam, abrem portas enquanto parados e partem. Não há embarque nem viagem entre estações.
- As duas pistas do Túnel Nove de Julho seguem as linhas do OSM. São exploráveis a pé; também é possível entrar com o carro pelos portais. Seção, cotas, luminárias e acessos ainda são aproximações. Entrada/saída por transição, sem rampas contínuas.
- Paulista Corporate: contorno OSM, altura mapeada de 66 m, características de fachada reconstruídas por fotografia de Sergio Brisola e referência técnica da CBRE. Não é escaneamento e precisa de revisão de detalhes. Fotografia não redistribuída nem aplicada como textura.
- Menu **Carro, metrô e túneis** permite acesso rápido às prévias. Na rua, aproxime-se dos acessos e use E. No carro: W acelerar, S frear/ré, A/D virar, Espaço frear e E sair. No celular: joystick e botão de freio.
- A história **Circuito da Paulista** substitui a entrega que exigia uma Sé ainda não construída. Apenas o progresso incompleto dessa história antiga é reiniciado; saldo, aparência e demais histórias são preservados.
- Geometrias estáticas agrupadas por material, portas dos trens instanciadas, árvores simplificadas e somente três luzes locais nos túneis. Qualidade inicial equilibrada no PC e leve no celular. Desempenho varia por equipamento.

Fontes: `src/transport-source.json`, `src/neighbors-source.json`, ASSETS.md. A versão nativa foi pausada a pedido do usuário; o produto principal continua Web.

## Trecho reconstruído nesta atualização

O jogo inicia no entorno do MASP, em uma reconstrução parcial, e permite caminhar até o perímetro/caminhos do Trianon. O laboratório de lojas e interiores permanece separado, no menu.

- MASP: contorno do OSM way 1370081491; envoltória de aproximadamente 77,8 × 30 m, altura mapeada de 24,75 m e vão inferior de 8,4 m. Pilares, vigas e caixilharia foram modelados por referências. Não é um escaneamento nem um levantamento arquitetônico completo.
- Trianon: polígonos da relação OSM 7398292, caminhos públicos presentes na resposta do mapa e entrada no nó 2081876330. Árvores com posições mapeadas são complementadas por vegetação indicativa; espécies e densidade não são levantamento fiel.
- Vias superficiais próximas são renderizadas pelo traçado do OSM. Túneis são excluídos da superfície e da identificação de rua atual. Larguras, materiais e cotas ainda são aproximações.
- O Paulista Corporate é o primeiro prédio vizinho reconstruído por referência. As outras lacunas permanecem visíveis. O edifício Pietro Maria Bardi e o desnível para a Nove de Julho ainda não foram reconstruídos.
- Reconstrução limita-se ao trecho: os destinos do Centro Histórico continuam no atlas para orientar a expansão, sem serem declarados prontos.

Fontes e limitações estão em `src/masp-source.json`, `src/trianon.json` e `src/paulista-landscape.json`.

## Implementado e utilizável

- Criação e edição de personagem adulto: nome, gênero independente da apresentação corporal, morfologia, porte, altura, tom de pele, cabelo, cores das roupas e pelos corporais.
- Base humana MakeHuman CC0 com 14.517 vértices e 26.756 triângulos antes de ocultar a superfície sob as roupas. A locomoção usa movimento procedural. Rig e animações de produção seguem pendentes.
- Preferência de pelos púbicos salva. **A região permanece coberta; não existe visualização íntima nesta versão.**
- Exploração em terceira pessoa com câmera por arraste, caminhada, corrida, pulo e controles de toque.
- NPCs locais com conversa e movimentação simples, sem pessoas online nem jogadores simulados.
- Três histórias com objetivos, progressão, recompensa em moeda do jogo e proteção contra recompensa duplicada.
- Modo livre sem progresso obrigatório de história.
- Loja de roupas com compra/equipamento, guarda-roupa persistente e validação de saldo. Os conjuntos alteram as cores e os materiais; ainda não são peças de alfaiataria digital distintas.
- Lanchonete com compra de refeição e recuperação de saúde; apartamento com descanso e acesso à personalização. Os três interiores são **ambientes de teste de mecânicas**, não interiores levantados de edifícios reais.
- Mapa vetorial com posição do personagem e nome da rua atual, calculado sobre 6.133 trechos reais do OpenStreetMap. No trecho externo, a posição corresponde ao mapa; o laboratório separado mantém sua indicação de cenário de testes.
- Perfil, saldo, peças compradas e missões salvos no navegador. Não há servidor de contas nem sincronização entre aparelhos.
- Materiais fotográficos PBR e modelos CC0 de árvore, poste, banco e café em um laboratório separado. Esses objetos não são apresentados como levantamento de uma praça real de São Paulo.

## Situação da cidade real

A integração de transmissão de Google Maps Photorealistic 3D Tiles está implementada em `src/photoreal-city.js`, com georreferenciamento WGS84, decodificador Draco e atribuições de fonte. **Não foi ativada nem validada com a cidade real por falta de configuração autorizada do provedor.**

Sem uma chave configurada, o jogo não faz chamadas ao serviço de mapas 3D e abre o trecho parcial reconstruído com fontes abertas; o laboratório de mecânicas fica no menu. Não substitui fachadas faltantes por edifícios inventados.

O Centro Histórico está no escopo completo. O atlas já referencia Sé, Pátio do Colégio, São Bento, Anhangabaú, Theatro Municipal, República, Copan, Itália, Martinelli, Biblioteca Mário de Andrade, Luz e Pinacoteca. Essa lista **não prova que cada prédio, fachada, parque, rua ou interior foi reconstruído**. A cobertura e a resolução precisam ser inspecionadas com a fonte conectada.

Fotogrametria é uma captura datada: não garante fachadas atuais, qualidade de perto, objetos separados, tráfego, colisões perfeitas ou interiores acessíveis. Esses itens exigem trabalho e validação adicionais. Os interiores de gameplay continuam separados dos imóveis reais até existir levantamento autorizado de cada um.

## Executar

Node.js 22+ e pnpm:

```sh
pnpm install
pnpm test
pnpm build
pnpm dev
```

O Vite permite testar o personagem e o laboratório. Para testar o Worker e `/api/config`, use `pnpm dev:online` após o build.

WASD/setas para mover; Shift para correr; Espaço para pular; arraste para olhar; E para conversar/interagir; J para histórias; M para mapa; C para câmera panorâmica. Os pontos de serviço do laboratório ficam próximos ao início. O botão “Ir ao objetivo · teste” é exclusivo do laboratório e facilita validar os fluxos; não aparece no modo conectado à cidade real.

## Publicação

Repositório: https://github.com/patrickara1206/nexus-sao-paulo

Hospedagem: https://nexus-sao-paulo.patrickara2006.workers.dev/

Cloudflare Workers Static Assets, com build automático conectado à branch `main`. Build `pnpm build`, publicação `npx wrangler deploy`. O endpoint `/api/room` responde 410: multiplayer foi desativado. A exportação mínima da classe `Room` existe somente para compatibilidade com a migração já aplicada na versão anterior; não cria novas salas.

## Ativar a fonte real, quando autorizado

1. Usar um projeto próprio do Google Maps Platform; revisar requisitos de faturamento, termos, cobertura e cotas.
2. Habilitar Map Tiles API e criar uma chave de **navegador**, limitada a essa API e aos referenciadores HTTPS do domínio do jogo. Nunca usar chave de conta de serviço ou credencial administrativa nesse campo.
3. Configurar cotas rígidas apropriadas antes de qualquer teste. Alertas de orçamento não são limites automáticos de gasto.
4. Inserir a chave em `GOOGLE_MAPS_BROWSER_KEY` nas variáveis do Worker, pelo painel ou mecanismo seguro de configuração. Não colocar em commits, documentos ou conversas.
5. Publicar, testar o carregamento e inspecionar o alinhamento e a cobertura do trecho inicial e do Centro Histórico. Verificar requisitos adicionais de termos de uso e privacidade antes de abrir o modo fotogramétrico ao público.

A chave de navegador precisa chegar ao cliente para autenticar pedidos de tiles; `/api/config` a fornece somente se configurada. As restrições de domínio e API são essenciais para esse tipo de chave. Atualmente a chave está ausente. Não foram ativados faturamento ou créditos do Google Cloud.

Não são feitos downloads em massa nem exportação de conteúdo Google. A base seria consumida por transmissão, com as atribuições em tela, conforme os requisitos do provedor. Fontes: [configuração](https://developers.google.com/maps/documentation/tile/get-api-key), [políticas](https://developers.google.com/maps/documentation/tile/policies), [preços e cotas](https://developers.google.com/maps/documentation/tile/usage-and-billing).

## Dados e licenças

Ruas e banco de contornos derivados do OpenStreetMap: © OpenStreetMap contributors, ODbL 1.0. O banco de 71.985 contornos, em 166 setores, continua no repositório como insumo de geografia/validação; **não é renderizado com fachadas genéricas no jogo atual**. Consulte `DATA-LICENSE.md`.

Modelos humanos, materiais PBR e objetos: consulte `ASSETS.md`. As ferramentas em `tools/` documentam as transformações. Modelos de museus, marcas e clubes não são declarados oficiais; os dioramas regionais inventados da versão 0.1 não fazem parte da experiência principal atual.

## Próximas entregas necessárias

1. Autorizar e configurar a fonte 3D real, validar custos/cotas e inspecionar cobertura do Centro Histórico.
2. Corrigir georreferenciamento, altura do chão, colisão, nível da rua, oclusão e câmera contra a geometria real; testar em GPUs e aparelhos físicos.
3. Levantar interiores acessíveis, mobiliário e fachadas ausentes com material autorizado, sem completar lacunas com prédios fictícios apresentados como reais.
4. Evoluir rig, cabelo, pele, roupas e animações, além de comportamento de pedestres e veículos.
5. Transferir e revisar as histórias do laboratório para os locais reais, com circulação e interações validadas.
6. Expandir ABC, Serra do Mar e Baixada por áreas, mantendo o mesmo critério de fontes reais e inspeção. Vila Belmiro exige geometria e acesso próprios, não um estádio genérico com o nome trocado.
