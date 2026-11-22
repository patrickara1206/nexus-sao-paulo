# Dados OpenStreetMap

`src/transport-source.json`, `src/neighbors-source.json`, `src/streets.json`, `src/trianon.json`, `src/masp-source.json`, `src/paulista-landscape.json`, `src/paulista-corridor-data.json`, `public/data/historic.json` e todos os arquivos em `public/data/buildings/` contêm dados derivados do OpenStreetMap, © OpenStreetMap contributors, disponibilizados sob Open Database License (ODbL) 1.0.

https://www.openstreetmap.org/copyright

https://opendatacommons.org/licenses/odbl/1-0/

O banco derivado completo usado pelo jogo é distribuído neste repositório. Modelos estilizados, shaders e código do jogo não são apresentados como dados levantados pelo OpenStreetMap. O projeto não é afiliado ao OpenStreetMap, Google, prefeituras ou clubes mencionados.

## Relevo do Centro

O campo `terrain` de `public/data/historic.json` é derivado de [Mapzen Terrain Tiles](https://registry.opendata.aws/terrain-tiles/). São duas quadrículas Terrarium no nível 14, coluna 6069, linhas 9294 e 9295, reamostradas de 20 em 20 metros. Os dados SRTM são cortesia do U.S. Geological Survey e da NASA. Consulte a [atribuição do conjunto Terrain Tiles](https://github.com/tilezen/joerd/blob/master/docs/attribution.md).
