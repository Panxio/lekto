#!/usr/bin/env bash
# Árbitro de iconos de app de Lekto.  Spec: specs/icon_harness.md
#
#   bash tools/check-icon.sh archivo1.svg [archivo2.svg ...]
#   bash tools/check-icon.sh --artefacto [dir-de-iconos]
#
# POR QUÉ EXISTE: un icono se juzga a 32x32, no a 512. Mirar el SVG grande verifica la
# INTENCIÓN del diseño, no el RESULTADO en la barra de tareas. Esto RASTERIZA de verdad
# con Chrome (el motor que dibuja la app) y mide sobre los píxeles que el usuario ve.
#
# ══════════════════════════════════════════════════════════════════════════════════
# LO QUE ESTE ÁRBITRO **NO** MIDE  (leer antes de creerle un verde)
# ══════════════════════════════════════════════════════════════════════════════════
# NO mide si el icono se lee como UN OBJETO o como piezas sueltas. Los 5 de la ronda 2
# se descartaron por eso ("una L más un triángulo suelto") y este árbitro los aprobó a
# los 5. NO mide si comunica "lector de Markdown", ni si es lindo, ni si se distingue
# de la competencia. Eso es composición: no hay métrica de píxeles que la capture.
# Por eso la salida tiene TRES estados y no dos: VERDE / ROJO / **NO EVALUADO**.
# Un verde de este script significa "no encontré estos defectos", nunca "el icono sirve".
#
# ══════════════════════════════════════════════════════════════════════════════════
# CALIBRACIÓN — los umbrales salen de una muestra congelada, no de la nada
# ══════════════════════════════════════════════════════════════════════════════════
# Muestra y veredictos humanos: tools/iconos-veredictos.tsv (13 con veredicto,
# 4 excluidos por no tenerlo). Matriz de confusión: bash tools/calibrar-icon.sh
#
# ⚠️ S6 (densidad de bordes) FUE ELIMINADA. No estaba desafinada: NO DISCRIMINA.
#    Aceptados 12.6–19.2% vs rechazados 9.0–17.9%: se solapan enteros, y `letra-2`
#    (rechazado) y `opcion-2` (aceptado) miden 12.6% LAS DOS. No hay umbral que separe.
#    Se calibró con n=3 y con 3 puntos cualquier línea parte bien. Reprobaba al icono
#    que está publicado. Ajustarle el umbral para que el ganador pasara habría sido
#    falsear el arnés — REGLA DE ORO. Se borra, no se retoca.
set -uo pipefail

MIN_SUPERVIVENCIA=55.0   # S5: % de figura que sobrevive a erosionar 1px a 32x32.
                         #     Aceptados: 59.1/76.1/76.1 · ilegibles: 45.7/47.5 → 55 cae
                         #     en el hueco. NECESARIA, NO SUFICIENTE (hay rechazados a 96.8%).
MAX_FUERA_SILUETA=0.30   # S7: % de píxeles opacos fuera del squircle rx=112.
                         #     Ruido de antialiasing 0.07% · una esquina rota 1.13% ·
                         #     un lado roto 2.17%. 4.3x sobre el ruido, 3.8x bajo el defecto.
MIN_CONTRASTE_WCAG=3.0   # S8: WCAG 2.1 SC 1.4.11, objetos gráficos no textuales.
                         #     CONSTANTE PRESTADA DE UN ESTÁNDAR EXTERNO, no inventada acá.
# S8 NO TIENE UMBRAL, A PROPÓSITO. Mide "eficiencia óptica" = de los píxeles que el icono
# dibuja, cuántos contrastan >=3:1 con el fondo donde se posa. El criterio 3:1 viene de
# WCAG (estándar externo); el PORCENTAJE mínimo no viene de ninguna parte: la única
# referencia disponible son 2 iconos vecinos en el lanzador real (VLC 83.5%,
# otra app 88.7%) frente a Lekto (34%). n=2 es MENOS muestra que el n=3 que hundió a S6.
# Poner un umbral acá sería repetir el error que este mismo script documenta.
# Por eso S8 SE REPORTA Y NO REPRUEBA: es un número para el ojo humano, no un gate.
MAX_COLORES=3            # S4: colores declarados en el SVG, sin contar transparencia.
BG_OSCURO="#1e1e1e"      # fondo del lanzador de Ubuntu (medido sobre captura real)
BG_CLARO="#fafafa"       # fondo claro de referencia

CHROME="$(command -v google-chrome || command -v google-chrome-stable || command -v chromium)"
[[ -z "$CHROME" ]] && { echo "FALTA: google-chrome"; exit 2; }
command -v magick >/dev/null || { echo "FALTA: ImageMagick (magick)"; exit 2; }
python3 -c "import PIL" 2>/dev/null || { echo "FALTA: python3-pil"; exit 2; }

OUT="${ICON_OUT:-/tmp/lekto-iconos}"
mkdir -p "$OUT"
FALLOS=0
CONTACTO=()

# render TRANSPARENTE. El --default-background-color=00000000 NO es opcional: sin él
# Chrome pinta blanco, y ese es exactamente el bug que publicó el icono con fondo
# blanco opaco. Estuvo faltando en este mismo script hasta que ese defecto lo destapó.
render_alpha() {
  "$CHROME" --headless --disable-gpu --no-sandbox --hide-scrollbars \
    --default-background-color=00000000 \
    --screenshot="$2" --window-size="$3,$3" "file://$1" >/dev/null 2>&1
}
# render sobre BLANCO, solo para S5: preserva bit a bit la calibración original de 55.0%.
# Cambiar el fondo cambiaría los números y dejaría el umbral sin respaldo.
render_blanco() {
  "$CHROME" --headless --disable-gpu --no-sandbox --hide-scrollbars \
    --screenshot="$2" --window-size="$3,$3" "file://$1" >/dev/null 2>&1
}

# ──────────────────── modo --artefacto: juzga lo ENTREGADO ────────────────────
# El árbitro debe correr sobre lo que se ENTREGA. La cadena real es
# SVG -> PNG 1024 -> cargo tauri icon -> 20+ archivos -> .deb, y hasta hoy este script
# solo miraba el PRIMER eslabón: todo lo que se rompiera después era invisible para él.
if [[ "${1:-}" == "--artefacto" ]]; then
  DIR="${2:-src-tauri/icons}"
  echo "=============================================="
  echo "  ARTEFACTO ENTREGADO: $DIR"
  echo "=============================================="
  A_FALLOS=0
  for N in 32x32 48x48 64x64 128x128 128x128@2x 256x256; do
    F="$DIR/$N.png"
    if [[ ! -f "$F" ]]; then
      echo "  $N ............ AUSENTE (GNOME escalará otro y se verá sucio)"; A_FALLOS=$((A_FALLOS+1)); continue
    fi
    P=$(magick "$F" -format '%[pixel:p{0,0}]' info:)
    DIM=$(magick identify -format '%wx%h' "$F")
    if [[ "$P" == *"none"* || "$P" == *",0)"* ]]; then
      echo "  $N .......... esquina transparente OK   ($DIM)"
    else
      echo "  $N .......... FONDO OPACO $P  ($DIM)  <- fondo no transparente"; A_FALLOS=$((A_FALLOS+1))
    fi
  done
  # ── S9: COHERENCIA ENTRE TAMAÑOS ────────────────────────────────────────────
  # POR QUÉ: `cargo tauri icon` NO genera 48x48 ni 256x256. Al cambiar el icono en la
  # en un rediseño esos dos quedaron con el diseño ANTERIOR y este modo los dio VERDE, porque
  # solo miraba la esquina transparente — y la esquina del icono viejo también lo era.
  # 48x48 es justo el tamaño del lanzador de Ubuntu: se habría publicado con el defecto
  # que el rediseño estaba arreglando: el árbitro miraba UN eslabón de la cadena.
  # QUÉ MIDE: todos los tamaños deben venir de la MISMA fuente. Se muestrea el mismo
  # punto relativo (50% ancho, 10% alto) en cada uno y se exige que coincidan.
  # UMBRAL 30 (distancia euclídea RGB), calibrado sobre el set real del rediseño:
  #   ruido de reescalado entre tamaños correctos = 1.4  ·  defecto real medido = 248.3
  #   30 queda 21x sobre el ruido y 8x bajo el defecto. NO es un número inventado.
  COHERENCIA=$(python3 - "$DIR" <<'PYEOF'
import sys, math
from PIL import Image
d = sys.argv[1]
sizes = ["32x32","48x48","64x64","128x128","128x128@2x","256x256"]
vals = {}
for n in sizes:
    try:
        im = Image.open(f"{d}/{n}.png").convert("RGBA"); w,h = im.size
        vals[n] = im.getpixel((w//2, max(1,int(h*0.10))))[:3]
    except Exception:
        pass
if len(vals) < 2:
    print("SKIP faltan tamaños para comparar"); sys.exit()
ref = vals.get("256x256") or list(vals.values())[-1]
malos = [(n,v,math.dist(v,ref)) for n,v in vals.items() if math.dist(v,ref) > 30]
if malos:
    for n,v,dd in malos:
        print(f"FAIL {n} difiere de la fuente (RGB{v} vs RGB{ref}, distancia {dd:.0f})")
else:
    print(f"OK todos los tamaños coinciden con la fuente (RGB{ref}, ruido max <=30)")
PYEOF
)
  if [[ "$COHERENCIA" == OK* ]]; then
    echo "  S9 coherencia .... ${COHERENCIA#OK }"
  elif [[ "$COHERENCIA" == SKIP* ]]; then
    echo "  S9 coherencia .... NO EVALUADA (${COHERENCIA#SKIP })"
  else
    while IFS= read -r L; do echo "  S9 coherencia .... ${L#FAIL }  <- tamaños incoherentes"; done <<< "$COHERENCIA"
    A_FALLOS=$((A_FALLOS+1))
  fi

  # composición sobre color chillón: un fondo que no delata el defecto no es verificación
  magick "$DIR/128x128.png" -background '#c04040' -flatten +repage "$OUT/artefacto-sobre-rojo.png" 2>/dev/null
  echo
  echo "  Compuesto sobre rojo para el ojo: $OUT/artefacto-sobre-rojo.png"
  echo
  if [[ "$A_FALLOS" -eq 0 ]]; then echo "ARTEFACTO: sin defectos de los que este modo mira."; exit 0
  else echo "ARTEFACTO: $A_FALLOS defecto(s)."; exit 1; fi
fi

# máscara squircle de referencia (rect 512 con rx=112, el contenedor base del diseño)
MASK="$OUT/_squircle-mask.png"
magick -size 512x512 xc:black -fill white -draw "roundrectangle 0,0,511,511,112,112" "$MASK"

for SVG in "$@"; do
  BASE="$(basename "$SVG" .svg)"
  ABS="$(cd "$(dirname "$SVG")" && pwd)/$(basename "$SVG")"
  echo "=============================================="
  echo "  $BASE"
  echo "=============================================="
  [[ -f "$ABS" ]] || { echo "  S0 archivo existe .......... false"; FALLOS=$((FALLOS+1)); continue; }

  # ---- S1: XML válido -------------------------------------------------------
  if python3 -c "import xml.dom.minidom;xml.dom.minidom.parse('$ABS')" 2>/dev/null; then
    S1=true; else S1=false; fi
  echo "  S1 XML válido .............. $S1"

  # ---- S2: viewBox 512 y sin width/height fijos -----------------------------
  S2=true
  grep -q 'viewBox="0 0 512 512"' "$ABS" || S2=false
  grep -qE '<svg[^>]*\s(width|height)=' "$ABS" && S2=false
  echo "  S2 viewBox 512, sin w/h .... $S2"

  # ---- S3: sin construcciones prohibidas ------------------------------------
  if grep -qE '<filter|feGaussianBlur|feDropShadow|<image|base64|<text|<foreignObject' "$ABS"; then
    S3=false; else S3=true; fi
  echo "  S3 sin filtros/texto/img ... $S3"

  # ---- S4: paleta acotada ---------------------------------------------------
  NCOL=$(grep -oiE '#[0-9a-f]{6}|#[0-9a-f]{3}\b' "$ABS" | tr 'A-Z' 'a-z' | sort -u | wc -l)
  if [[ "$NCOL" -le "$MAX_COLORES" ]]; then S4=true; else S4=false; fi
  echo "  S4 colores <= $MAX_COLORES ........... $S4 (usa $NCOL)"

  # ---- rasterizado real -----------------------------------------------------
  render_blanco "$ABS" "$OUT/$BASE-32w.png"   32
  render_alpha  "$ABS" "$OUT/$BASE-512.png"  512
  render_alpha  "$ABS" "$OUT/$BASE-128.png"  128
  render_alpha  "$ABS" "$OUT/$BASE-64.png"    64
  render_alpha  "$ABS" "$OUT/$BASE-32.png"    32
  if [[ ! -s "$OUT/$BASE-32w.png" || ! -s "$OUT/$BASE-512.png" ]]; then
    echo "  S5/S7/S8 ................... false (no rasterizó)"
    FALLOS=$((FALLOS+1)); continue
  fi

  # ---- S5: supervivencia a la erosión a 32px (PISO, no aprobación) ----------
  A=$(magick "$OUT/$BASE-32w.png" -colorspace Gray -threshold 35% -format "%[fx:mean]" info:)
  E=$(magick "$OUT/$BASE-32w.png" -colorspace Gray -threshold 35% \
        -morphology Erode Diamond:1 -format "%[fx:mean]" info:)
  SUP=$(python3 -c "print(f'{($E/$A*100) if $A>0 else 0:.1f}')")
  S5=$(python3 -c "print('true' if $SUP >= $MIN_SUPERVIVENCIA else 'false')")
  echo "  S5 sobrevive a 32px ........ $S5 ($SUP% vs piso $MIN_SUPERVIVENCIA%) [necesaria, no suficiente]"

  # ---- S7: la silueta respeta el squircle -----------------------------------
  OP=$(magick "$OUT/$BASE-512.png" -alpha extract -threshold 50% -format "%[fx:mean]" info:)
  FU=$(magick "$OUT/$BASE-512.png" -alpha extract -threshold 50% \
        \( "$MASK" -negate \) -compose Multiply -composite -format "%[fx:mean]" info:)
  SIL=$(python3 -c "print(f'{($FU/$OP*100) if $OP>0 else 0:.2f}')")
  S7=$(python3 -c "print('true' if $SIL <= $MAX_FUERA_SILUETA else 'false')")
  echo "  S7 silueta = squircle ...... $S7 ($SIL% fuera vs máximo $MAX_FUERA_SILUETA%)"

  # ---- S8: eficiencia óptica contra el fondo donde el icono se va a posar ---
  # INFORMATIVA: se imprime, NO suma a FALLOS. Ver la nota de arriba.
  read -r EFOSC EFCLA <<<"$(python3 - "$OUT/$BASE-128.png" "$BG_OSCURO" "$BG_CLARO" \
                             "$MIN_CONTRASTE_WCAG" <<'PY'
import sys
from PIL import Image
f,bgd,bgl,minc = sys.argv[1],sys.argv[2],sys.argv[3],float(sys.argv[4])
def lin(c):
    c/=255
    return c/12.92 if c<=0.04045 else ((c+0.055)/1.055)**2.4
def lum(p): return 0.2126*lin(p[0])+0.7152*lin(p[1])+0.0722*lin(p[2])
def hexrgb(h):
    h=h.lstrip('#'); return tuple(int(h[i:i+2],16) for i in (0,2,4))
im=Image.open(f).convert('RGBA'); W,H=im.size; px=im.load()
def eficiencia(bg):
    # de lo que el icono DIBUJA, qué fracción se ve. Normalizar por los píxeles dibujados
    # y no por el canvas es lo que hace la cifra comparable entre iconos con distinto
    # margen transparente: VLC dibuja con mucho margen y Lekto sin ninguno.
    b=hexrgb(bg); lb=lum(b); n=0; dib=0
    for y in range(H):
        for x in range(W):
            r,g,bl,a=px[x,y]
            if a<8: continue
            dib+=1; k=a/255.0
            # el icono se compone sobre el fondo: alfa parcial acerca el color al fondo
            c=(r*k+b[0]*(1-k), g*k+b[1]*(1-k), bl*k+b[2]*(1-k))
            lc=lum(c); hi,lo=max(lc,lb),min(lc,lb)
            if (hi+0.05)/(lo+0.05) >= minc: n+=1
    return n/dib*100 if dib else 0.0
print(f"{eficiencia(bgd):.1f} {eficiencia(bgl):.1f}")
PY
)"
  echo "  S8 eficiencia óptica ....... [sin umbral] oscuro ${EFOSC}% · claro ${EFCLA}%"
  echo "     referencia de iconos vecinos que SÍ se leen bien: 83.5% y 88.7% (n=2)"

  for s in "$S1" "$S2" "$S3" "$S4" "$S5" "$S7"; do   # S8 NO entra: informativa, no gate
    [[ "$s" == "true" ]] || FALLOS=$((FALLOS+1))
  done

  # tira de contacto sobre ROJO: un fondo que no delata la transparencia no verifica nada
  magick "$OUT/$BASE-512.png" -resize 220x220 +repage "$OUT/_a.png"
  magick "$OUT/$BASE-64.png"  -filter point -resize 220x220 +repage "$OUT/_b.png"
  magick "$OUT/$BASE-32.png"  -filter point -resize 220x220 +repage "$OUT/_c.png"
  magick "$OUT/_a.png" "$OUT/_b.png" "$OUT/_c.png" +append +repage \
    -background '#c04040' -flatten -bordercolor '#c04040' -border 6 "$OUT/$BASE-contacto.png" 2>/dev/null
  CONTACTO+=("$OUT/$BASE-contacto.png")
  echo
done

if [[ ${#CONTACTO[@]} -gt 0 ]]; then
  magick "${CONTACTO[@]}" -background '#c04040' -append +repage "$OUT/hoja-contacto.png" 2>/dev/null
  echo "Hoja de contacto (512 | 64 | 32, sobre rojo): $OUT/hoja-contacto.png"
fi

echo
echo "NO EVALUADO (ninguna señal lo mira, decídelo con el ojo sobre la hoja de contacto):"
echo "  · si se lee como UN OBJETO o como piezas sueltas  <- por esto se cayó la ronda 2 entera"
echo "  · si comunica «lector de Markdown»"
echo "  · si se distingue de los iconos vecinos en el dock"
echo "  · S8 eficiencia óptica: el número está medido, pero NO hay umbral validado"
echo "    (n=2). Compáralo tú contra 83.5%/88.7% y decide."
echo
if [[ "$FALLOS" -eq 0 ]]; then
  echo "RESULTADO: sin defectos de los que este árbitro mira."
  echo "OJO: esto NO dice que el icono sea bueno. Falta el juicio visual humano."
  exit 0
else
  echo "RESULTADO: $FALLOS señal(es) en rojo."
  exit 1
fi
