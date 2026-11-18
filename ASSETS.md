# Fontes dos recursos — versão solo

## MakeHuman — CC0 1.0

Base `makehuman/data/3dobjs/base.obj` e alvos adultos de morfologia do repositório oficial:

- https://github.com/makehumancommunity/makehuman
- https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.md
- https://www.makehumancommunity.org/about/license.html

O cabeçalho do OBJ declara explicitamente a liberação CC0 em setembro de 2020. `tools/prepare-human.mjs` seleciona a superfície `body`, converte unidades e orientação, combina alvos adultos e gera `public/assets/human/adult.glb`. Código do MakeHuman não é incorporado ao runtime: apenas os recursos gráficos CC0 e a saída derivada.

O personagem usa materiais e movimento próprios do NEXUS. A roupa é apresentada como material de demonstração; a região íntima permanece coberta. O valor de preferência de pelos púbicos é persistido, mas não gera visualização íntima nesta entrega.

## Poly Haven — CC0 1.0

Materiais fotográficos em 1K:

- https://polyhaven.com/a/asphalt_02
- https://polyhaven.com/a/concrete_pavement
- https://polyhaven.com/a/brick_wall_001

Objetos 3D:

- https://polyhaven.com/a/tree_small_02
- https://polyhaven.com/a/street_lamp_02
- https://polyhaven.com/a/painted_wooden_bench
- https://polyhaven.com/a/CoffeeCart_01

Licença geral: https://polyhaven.com/license

As origens e metadados foram consultados pela API oficial `https://api.polyhaven.com/files/<id>`. Os arquivos foram baixados do servidor oficial `dl.polyhaven.org`. `tools/download-polyhaven.mjs` guarda as dependências originais em área de trabalho; `tools/optimize-props.mjs` deduplica e reduz geometria antes de gerar os GLBs distribuídos. A árvore foi simplificada para uso em tempo real. Não é afirmado que esses objetos sejam modelos de exemplares reais específicos de São Paulo.

## OpenStreetMap — ODbL 1.0

Ruas e banco derivado de contornos: https://www.openstreetmap.org/copyright. Consulte `DATA-LICENSE.md`.

## Google Maps 3D — integração preparada, conteúdo ausente

Não há tiles Google incorporados nos recursos do repositório. O adaptador só pede conteúdo quando uma chave de navegador própria é configurada no servidor. O provedor e seus detentores de dados seriam creditados em tela. Nenhuma imagem de Street View ou modelo do Google Earth foi extraído.

## Draco e bibliotecas

Os decodificadores Draco são distribuídos a partir de `three/examples/jsm/libs/draco/gltf`, sob os termos do projeto Draco: https://github.com/google/draco/blob/main/LICENSE. Three.js e as demais bibliotecas mantêm suas licenças originais. 3D Tiles Renderer: https://github.com/NASA-AMMOS/3DTilesRendererJS.

## Reconstrução do MASP e Trianon

Contorno e dimensões: https://www.openstreetmap.org/way/1370081491. Parque: https://www.openstreetmap.org/relation/7398292. Referência fotográfica CC0 de Wilfredor: https://commons.wikimedia.org/wiki/File:MASP_Brazil.jpg (consulta visual; imagem não incorporada). Descrição arquitetônica da Câmara Municipal: https://www.saopaulo.sp.leg.br/iah/fulltext/projeto/PL0098-1992.pdf. Materiais e detalhes são reconstruções sujeitas a revisão, não uma captura fotogramétrica.
