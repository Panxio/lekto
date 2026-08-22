# Spec — Árbitro de iconos (`check-icon.sh`), recalibración

> 2026-08-21. Salda una deuda declarada del arnés: *"`check-icon.sh` evalúa el SVG y no
> el artefacto, y no mide que la silueta se respete"*.
> Método: la muestra y los veredictos se CONGELAN antes de tocar un umbral.

## 1. Problema (medido, no supuesto)

El árbitro se calibró en la ronda 1 con **n=3**. Corrido hoy contra la muestra completa
—17 SVG de 5 rondas, de los cuales **13 tienen veredicto humano registrado**— acierta
**3 de 13**:

| | el ojo dijo SÍ | el ojo dijo NO |
|---|---|---|
| árbitro: verde | 1 | **8** |
| árbitro: rojo | **2** | 2 |

Los 2 falsos rojos son `a-marcador` y `a-actual`: **el icono que está publicado en la app.**

## 2. Qué se hace con cada señal

### S6 (densidad de bordes) — SE ELIMINA
No está desafinada: **no discrimina**. Sobre la muestra congelada los rangos se solapan
por completo (aceptados 12.6–19.2%, rechazados 9.0–17.9%) y hay un empate exacto con
veredicto opuesto: `letra-2` (rechazado) y `opcion-2` (aceptado) miden **12.6% las dos**.
No existe umbral que las separe. Con n=3 cualquier línea parte bien; por eso parecía servir.
**Retocarle el umbral para que el ganador pase sería falsear el arnés (REGLA DE ORO).**

### S5 (supervivencia a la erosión, 32px) — SE MANTIENE EN 55.0%, RECLASIFICADA
Aceptados: 59.1 / 76.1 / 76.1. Ilegibles declarados: 45.7 / 47.5. El umbral 55.0 cae en el
hueco. Pero hay rechazados de hasta 96.8% → **S5 es condición NECESARIA, NO SUFICIENTE:
puede reprobar, jamás aprobar.** El script lo dice en la salida.

### S7 (conformidad de silueta) — NUEVA. Umbral: 0.30%
Mide el % de píxeles opacos que caen FUERA del squircle de referencia (`rx=112` sobre 512).
Reproduce numéricamente el diagnóstico visual que motivó el arnés:
- **0.07%** — línea base de antialiasing (squircle intacto), 11 iconos.
- **1.13%** — una esquina cuadrada (`pagina-1`, `pagina-2`, `propuesta-1`, `propuesta-3`).
- **2.17%** — todo el lado izquierdo cuadrado (`propuesta-2`).

Umbral **0.30%**: 4.3× sobre el ruido y 3.8× bajo el defecto más chico. Separa sin ambigüedad.

### S8 (eficiencia óptica contra el fondo de destino) — NUEVA, **INFORMATIVA, SIN UMBRAL**
Nace de un defecto reportado a ojo: *"en la barra lanzadora se ve un poco más pequeña que
las otras apps"*. Medido sobre una captura real del lanzador:

| | dibuja | contrasta |
|---|---|---|
| VLC | 24.1% del casillero | 23.6% |
| tercera app | 36.7% | 36.7% |
| **Lekto** | **87.6%** | **18.0%** |

Lekto ocupa más casillero que nadie y se ve más chico que nadie. Causa: el contenedor
`#161b22` contra el lanzador `#1e1e1e` da **1.04:1** de contraste WCAG. Es invisible: el
70% de lo que dibuja no aporta nada al ojo.

**Corrección de esta misma spec, durante su desarrollo.** La primera versión normalizaba la
masa por el "casillero" del lanzador y gateaba en 20%. Dos errores, ambos hallados midiendo:
1. **La normalización era arbitraria.** VLC dibuja con mucho margen transparente y Lekto sin
   ninguno; dividir a ambos por el mismo casillero compara peras con manzanas. La métrica
   correcta es **eficiencia óptica = píxeles que contrastan ≥3:1 / píxeles que el icono
   DIBUJA**, que se normaliza sola. Con ella: VLC **83.5%**, tercera app **88.7%**,
   Lekto **34%**.
2. **El umbral de 20% se apoyaba en n=3** — exactamente el pecado por el que se eliminó S6,
   cometido tres párrafos más abajo en el mismo archivo. Con la métrica corregida la
   referencia baja a **n=2**. Poner un umbral ahí sería repetir el error documentado.

Por eso **S8 se reporta y NO reprueba**. El criterio **3:1** sí se mantiene, porque viene de
WCAG 2.1 SC 1.4.11 (estándar externo) y define qué píxel cuenta como visible; lo que no
existe es un porcentaje mínimo con respaldo. El número se imprime junto a las referencias
83.5% / 88.7% para que lo juzgue un humano.

**Límite declarado de la evidencia:** en la captura del lanzador Lekto mide 18.6% y en el
archivo instalado 34%. La eficiencia es estable entre 24px y 256px (34.2 / 34.1 / 34.9 /
33.6 / 34.3 / 34.5 / 36.9%), así que el escalado NO explica la diferencia: la captura llegó
recomprimida y de procedencia incierta. **Se reporta el número que menos favorece al
hallazgo (34%), no el que más.** La dirección y el orden se sostienen igual: 2.5× menos
eficiente que sus vecinos. La magnitud exacta, no.

### S9 (artefacto entregado) — NUEVA, modo aparte
El árbitro miraba el primer eslabón de la cadena `SVG → PNG 1024 → cargo tauri icon → .deb`.
Modo `--artefacto`: verifica los PNG que se instalan de verdad — esquina transparente en los
4 tamaños clave, y que estén los tamaños que GNOME usa en el grid (48, 64).
**Defecto vivo hallado de paso:** el propio `check-icon.sh` rasterizaba SIN
`--default-background-color=00000000` — el mismo defecto de fondo opaco que debía atrapar,
todavía dentro del árbitro. Corregido.

## 3. Resultado medido de la recalibración

| | antes | después |
|---|---|---|
| Aciertos sobre la muestra congelada | **3/13** | **10/13** |
| Falsos rojos (reprueba lo válido) | **2** — incluido el icono publicado | **0** |
| Falsos verdes | 8 | 3 |

Los 3 falsos verdes que quedan son `letra-1`, `letra-2` y `libre`: los tres de la ronda 2
cuyo motivo de rechazo registrado es **composición** ("una L más un triángulo suelto").
Es decir: **el árbitro ahora atrapa todo defecto de los que dice medir, y se le escapa
exactamente la clase que declara por escrito que no puede ver.** Eso es un límite
declarado, no un fallo silencioso — que es toda la diferencia.

Reproducir: `bash tools/calibrar-icon.sh`

## 4. Invariantes
- La muestra y los veredictos viven en `iconos-veredictos.tsv` y **se congelan antes** de
  tocar umbrales. Los 4 SVG sin veredicto humano registrado se marcan `excluido` y **no
  entran en la matriz** — un veredicto que no se emitió no se infiere.
- Ninguna señal se ajusta para que un icono concreto pase.
- La salida tiene **tres estados: VERDE / ROJO / NO EVALUADO.** Lo que el arnés no mira se
  declara como no mirado. Un verde nunca debe poder significar "nadie miró".
- `calibrar-icon.sh` reproduce la matriz de confusión: el arnés que audita al arnés.

## 5. Lo que este arnés NO mide, y ningún píxel puede
Los 5 de la ronda 2 se descartaron porque *"se leen como una L más un triángulo suelto"*:
fragmentos en vez de un objeto. Eso es composición, y no hay métrica de píxeles que la
capture. Va en NO EVALUADO y lo decide un humano sobre la hoja de contacto.
