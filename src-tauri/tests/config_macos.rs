//! Arnés: impide que `tauri.macos.conf.json` diverja de `tauri.conf.json`.
//!
//! POR QUÉ EXISTE ESTE TEST
//! El merge de configuración por plataforma de Tauri **REEMPLAZA el array
//! `app.windows` completo**; no fusiona campo a campo. Comprobado empíricamente en
//! Linux: un `tauri.linux.conf.json` que solo traía `title` hizo reaparecer la barra
//! de título nativa, porque `decorations: false` del archivo base se perdió.
//!
//! Consecuencia: el archivo de macOS está OBLIGADO a repetir la ventana entera. Eso
//! es duplicación, y la duplicación diverge en silencio: el día que alguien cambie
//! `minWidth` en el base, macOS se queda con el valor viejo y NADA falla — ni el
//! build, ni clippy, ni el CI, porque el `.dmg` compila igual. El defecto solo
//! aparecería en la pantalla de otra persona, en otro país, días después.
//!
//! Este test es el árbitro que falta: obliga a que ambos archivos coincidan en TODO
//! salvo la lista explícita de diferencias que macOS necesita.

use std::collections::BTreeSet;
use std::path::Path;

/// Únicos campos que pueden diferir entre el archivo base y el de macOS.
/// Agregar uno acá es una decisión deliberada, no un descuido.
const DIFERENCIAS_PERMITIDAS: &[&str] = &[
    // macOS necesita las decoraciones VIVAS para conservar el semáforo nativo
    // (cerrar/minimizar/zoom). Windows y Linux siguen sin marco, con controles propios.
    "decorations",
    // "Overlay" = equivalente Tauri de `hiddenInset`: el contenido se dibuja bajo la
    // barra de título y el semáforo queda flotando encima.
    "titleBarStyle",
    // Oculta el texto del título; la marca "Lekto" la dibuja la topbar propia.
    "hiddenTitle",
    // Posición del semáforo, para centrarlo en la altura de nuestra topbar.
    // OJO: el campo REQUIERE `titleBarStyle: Overlay` y `decorations: true`.
    "trafficLightPosition",
];

fn ventana_de(archivo: &str) -> serde_json::Map<String, serde_json::Value> {
    let ruta = Path::new(env!("CARGO_MANIFEST_DIR")).join(archivo);
    let texto = std::fs::read_to_string(&ruta)
        .unwrap_or_else(|e| panic!("no se pudo leer {}: {e}", ruta.display()));
    let json: serde_json::Value = serde_json::from_str(&texto)
        .unwrap_or_else(|e| panic!("{} no es JSON válido: {e}", ruta.display()));

    let ventanas = json["app"]["windows"]
        .as_array()
        .unwrap_or_else(|| panic!("{} no tiene app.windows como array", ruta.display()));

    // Ambos archivos declaran una sola ventana ("main"). Si algún día hay más, este
    // test debe crecer antes que la config, no después.
    assert_eq!(
        ventanas.len(),
        1,
        "{} declara {} ventanas; este arnés asume una sola",
        ruta.display(),
        ventanas.len()
    );

    ventanas[0]
        .as_object()
        .unwrap_or_else(|| panic!("{}: app.windows[0] no es un objeto", ruta.display()))
        .clone()
}

#[test]
fn macos_conf_no_diverge_de_la_base() {
    let base = ventana_de("tauri.conf.json");
    let mac = ventana_de("tauri.macos.conf.json");

    let permitidas: BTreeSet<&str> = DIFERENCIAS_PERMITIDAS.iter().copied().collect();

    // 1. Todo campo del base que no sea una diferencia permitida tiene que estar
    //    presente e idéntico en macOS. Atrapa el caso peligroso: se toca el base y
    //    nadie porta el cambio.
    for (clave, valor_base) in &base {
        if permitidas.contains(clave.as_str()) {
            continue;
        }
        let valor_mac = mac.get(clave).unwrap_or_else(|| {
            panic!(
                "`{clave}` está en tauri.conf.json pero FALTA en tauri.macos.conf.json. \
                 El merge de Tauri reemplaza el array `windows` entero, así que macOS \
                 perdería este campo en silencio. Cópialo, o agrégalo a DIFERENCIAS_PERMITIDAS."
            )
        });
        assert_eq!(
            valor_base, valor_mac,
            "`{clave}` difiere entre las dos configs (base={valor_base}, macos={valor_mac}) \
             y no está en DIFERENCIAS_PERMITIDAS"
        );
    }

    // 2. Y a la inversa: macOS no puede traer campos extra sin declararlos. Atrapa el
    //    caso de que alguien pruebe algo en macOS y se olvide de portarlo o de anotarlo.
    for clave in mac.keys() {
        if permitidas.contains(clave.as_str()) {
            continue;
        }
        assert!(
            base.contains_key(clave),
            "`{clave}` está solo en tauri.macos.conf.json. Si es a propósito, va en \
             DIFERENCIAS_PERMITIDAS con su razón escrita."
        );
    }
}

#[test]
fn macos_conserva_el_semaforo_nativo() {
    let mac = ventana_de("tauri.macos.conf.json");

    // Sin decoraciones no hay semáforo: sería el mismo bug que veníamos a arreglar.
    assert_eq!(
        mac.get("decorations"),
        Some(&serde_json::Value::Bool(true)),
        "macOS necesita `decorations: true` o se pierde el semáforo nativo"
    );

    // `trafficLightPosition` REQUIERE Overlay. Y el deserializador de Tauri cae en
    // silencio a `Visible` ante cualquier string desconocido, sin fallar el build:
    // un typo acá solo se vería en el Mac de otra persona. Por eso se compara exacto.
    assert_eq!(
        mac.get("titleBarStyle").and_then(|v| v.as_str()),
        Some("Overlay"),
        "titleBarStyle debe ser exactamente \"Overlay\": Tauri no falla ante un valor \
         desconocido, cae a \"Visible\" en silencio"
    );

    if mac.contains_key("trafficLightPosition") {
        let pos = &mac["trafficLightPosition"];
        assert!(
            pos.get("x").and_then(|v| v.as_f64()).is_some()
                && pos.get("y").and_then(|v| v.as_f64()).is_some(),
            "trafficLightPosition necesita `x` e `y` numéricos, llegó: {pos}"
        );
    }
}
