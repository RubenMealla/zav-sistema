# Catálogo fotográfico original ZAV

**Estado:** CÓDIGO PREPARADO Y ORIGINALES VERIFICADOS; PENDIENTE ÚNICAMENTE LA TRANSFERENCIA DE LOS 13 BINARIOS PNG AL REPOSITORIO.

La landing está preparada para servir 13 PNG originales desde `apps/web/public/catalogo-original/`.  
Los PNG deben incorporarse con los bytes originales entregados: no se convierten a WebP/JPG, no se recomprimen, no se retocan y no se regeneran. El tamaño visual se controla con CSS mediante `object-fit: contain`, sin recortar el producto.

Mientras los archivos no estén presentes, la interfaz conserva temporalmente el sprite anterior como fallback para no romper el Preview. Se añadió `scripts/incorporar-catalogo-original.ps1`, que localiza las imágenes dentro del ZIP por SHA-256 (no por nombre), las copia con nombres estables y vuelve a verificar 13/13 hashes antes de terminar.

| Archivo esperado | Bytes | SHA-256 del PNG entregado |
| --- | ---: | --- |
| chorizo-coctelero.png | 2797543 | 083288f88e6b2efbf89d1962ca9d761caa64b3d96a63a0dec2f9957c0bf4ab95 |
| chorizo-parrillero.png | 2957964 | e25eea18bda040bf79016ade8f4de1e10dece42f3f04a20e32bcfc8353270a66 |
| chorizo-precocido.png | 2601986 | e9b85fedb35dd52cddce38dbaef3dad6bdd5953cb871ac818b2dd369d697df7a |
| chorizo-tipo-espanol.png | 2838367 | 9a7a743d4f9b7531ed07dd45f76e5bb557e6bc1a742071ad52c15a0f9c0d196d |
| jamon-cocido-light.png | 2616459 | ce338a28dd3b93269503a30c903a3530c99d3a59b7c99935d0412d9924ffd882 |
| morcilla-artesanal.png | 3043508 | c971d0e386ea5d64286fc33ef6733b5c9139f91820558fca098824d98f148c15 |
| mortadela-jamonada.png | 2911348 | 19277c5585983881ae3de6baf20be6c192ce29fd86eb01f8218585f91aa93ab3 |
| mortadela-primavera.png | 2828530 | bf655eba9d41d298f83dd710e9658359f2d7dac079c98c114955be698bc716ef |
| mortadela-tradicional.png | 2661586 | 376f0ba872f33aa5daf039dc4069a18c434693e5e4ccb2edfee4989ee35e2f2e |
| queso-de-chancho.png | 2860140 | 41fec00c48789346b0934a93cb5b934f305b187478b267523d33f456b134f8e2 |
| salchicha-tipo-super-pancho.png | 2723934 | bde86ffa121b79aeb77120be47a0729de37dc45dd7fd68474558846743a7ead3 |
| salchicha-tipo-viena.png | 2842675 | 1b3fb4f07cd4296eeee283c17e6f1aec14df47614a0e3a74e0f5314ae40bd354 |
| tocino-ahumado.png | 2949258 | 88d67e8f29272d710d513e4d521000fa79747546e523e9ca2b568d2a06b2f390 |

Los hashes permiten demostrar que el archivo usado corresponde al PNG original entregado.


## Verificación del material recibido

Los 13 originales entregados fueron comprobados fuera del repositorio: cada archivo es PNG RGBA de 1254 × 1254 px y los SHA-256 coinciden con esta tabla. También existen derivados de prueba redimensionados, pero **no se usarán como fuente canónica** mientras los originales puedan incorporarse sin modificación.

La transferencia binaria debe conservar exactamente estos hashes. Si cualquiera cambia, el estado vuelve a **PENDIENTE DE VALIDAR** y no debe afirmarse que se usa el original.
