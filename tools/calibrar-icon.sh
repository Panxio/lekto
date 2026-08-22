#!/usr/bin/env bash
# CALIBRACIÓN DEL ÁRBITRO DE ICONOS — el arnés que audita al arnés.
#
#   bash tools/calibrar-icon.sh
#
# POR QUÉ EXISTE: un árbitro también es código, y nadie lo estaba probando. El de iconos
# se calibró en la ronda 1 con n=3 y nadie volvió a mirarlo; al revisarlo acertaba
# 3 de 13 y reprobaba al icono que estaba publicado. Un umbral sin una muestra que lo
# respalde es folclore.
#
# Corre `check-icon.sh` contra la muestra CONGELADA de veredictos humanos y saca la
# matriz de confusión. Los 'excluido' NO entran: un veredicto que nadie emitió
# no se infiere ni se rellena (REGLA DE ORO).
set -uo pipefail
cd "$(dirname "$0")/.."

TSV="tools/iconos-veredictos.tsv"

# La muestra congelada es el ÁRBITRO de este script. Sin ella no hay "verde": hay
# NO EVALUADO. Sin esta guarda, un TSV ausente deja el `while` sin ejecutar el cuerpo
# ni una vez y el script llega igual al final imprimiendo "sin falsos rojos" con exit 0
# y n=0 -- verde sobre lo que no se miró, dentro del arnés que audita al arnés.
if [[ ! -f "$TSV" ]]; then
  echo "NO EVALUADO: falta la muestra congelada en $TSV (cwd: $PWD)" >&2
  exit 2
fi
export ICON_OUT="${ICON_OUT:-/tmp/lekto-calibracion}"
mkdir -p "$ICON_OUT"

VP=0; VN=0; FP=0; FN=0; EX=0
declare -a LIN_FP=() LIN_FN=()

printf "%-14s %-11s %-9s %s\n" "ICONO" "EL OJO" "ÁRBITRO" "SEÑALES EN ROJO"
printf "%s\n" "--------------------------------------------------------------------------"

while IFS=$'\t' read -r RUTA VER _; do
  [[ -z "${RUTA:-}" || "$RUTA" == \#* ]] && continue
  B="$(basename "$RUTA" .svg)"
  if [[ "$VER" == "excluido" ]]; then
    EX=$((EX+1))
    printf "%-14s %-11s %-9s %s\n" "$B" "(sin dato)" "—" "excluido de la matriz"
    continue
  fi
  SALIDA="$(bash tools/check-icon.sh "$RUTA" 2>&1)"
  ROJAS="$(echo "$SALIDA" | grep -oE '  S[0-9] [^.]*\.* false' | grep -oE '^  S[0-9]' | tr -d ' ' | paste -sd, -)"
  if [[ -z "$ROJAS" ]]; then ARB="verde"; else ARB="rojo"; fi

  case "$VER/$ARB" in
    aceptable/verde) VP=$((VP+1)) ;;
    rechazado/rojo)  VN=$((VN+1)) ;;
    rechazado/verde) FP=$((FP+1)); LIN_FP+=("$B") ;;
    aceptable/rojo)  FN=$((FN+1)); LIN_FN+=("$B  [$ROJAS]") ;;
  esac
  printf "%-14s %-11s %-9s %s\n" "$B" "$VER" "$ARB" "${ROJAS:-—}"
done < "$TSV"

TOT=$((VP+VN+FP+FN))

# Segunda guarda, independiente de la primera: el TSV puede existir y aun así no
# aportar ni una fila evaluable (todas comentadas, todas `excluido`, columnas rotas).
# 0/0 no es un acierto perfecto: es que no se midió nada.
if [[ "$TOT" -eq 0 ]]; then
  echo >&2
  echo "NO EVALUADO: 0 iconos con veredicto en $TSV. Sin muestra no hay matriz." >&2
  exit 2
fi
echo
echo "=========================================================================="
echo "  MATRIZ DE CONFUSIÓN  (n=$TOT con veredicto · $EX excluidos sin veredicto)"
echo "=========================================================================="
printf "                    %-16s %s\n" "el ojo dijo SÍ" "el ojo dijo NO"
printf "  árbitro: verde    %-16s %s\n" "$VP" "$FP   <- falsos verdes"
printf "  árbitro: rojo     %-16s %s\n" "$FN   <- falsos rojos" "$VN"
echo
echo "  Aciertos: $((VP+VN))/$TOT"
if [[ ${#LIN_FN[@]} -gt 0 ]]; then
  echo
  echo "  🔴 FALSOS ROJOS (el árbitro reprueba lo que el ojo aprobó) — lo más grave:"
  for l in "${LIN_FN[@]}"; do echo "     · $l"; done
fi
if [[ ${#LIN_FP[@]} -gt 0 ]]; then
  echo
  echo "  ⚠️  FALSOS VERDES (el árbitro aprueba lo que el ojo descartó):"
  for l in "${LIN_FP[@]}"; do echo "     · $l"; done
  echo "     Recordar: muchos de estos se descartaron por COMPOSICIÓN, que ninguna"
  echo "     señal mide ni puede medir. Un falso verde acá no siempre es un defecto"
  echo "     del árbitro: puede ser el límite honesto de lo que un árbitro automático ve."
fi
echo
[[ $FN -eq 0 ]] || { echo "VEREDICTO: hay falsos rojos. El árbitro reprueba iconos válidos: NO usar para descartar."; exit 1; }
echo "VEREDICTO: sin falsos rojos. El árbitro no descarta nada que el ojo haya aprobado."
