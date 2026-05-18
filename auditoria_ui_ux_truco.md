# 📱 Auditoría UI/UX & QA - Anotador de Truco PWA

**Analista:** Senior UI/UX Designer & QA Mobile Engineer
**Objetivo:** Preparación para despliegue en Google Play Store (PWA TWA) y estandarización a Calidad Premium (Skeuomorphic/Glassmorphism).

---

## 1. Consistencia de Marca y Tipografía 🔠
* **Inconsistencia de Abreviaturas (Truncamiento):** 
  En el marcador superior, nombres largos o predeterminados como "NOSOTROS" sufren recortes (`text-overflow: ellipsis`), mostrándose como `NOSOT.` si la pantalla es estrecha. Esto rompe la simetría si del otro lado dice `ELLOS`.
  * **Solución UX:** Ajustar dinámicamente el tamaño de la fuente (`clamp()`) o establecer un ancho mínimo asegurado, limitando los caracteres de entrada a 8-10 máximo por diseño.
* **Jerarquía de Fuentes:** Se mezcla `Luckiest Guy`, `Orbitron` e `Inter`. En la pantalla de ajustes, la palabra "AJUSTES" desaparece visualmente en temas claros (como Rojo o Diego) por falta de un color de contraste estricto.

## 2. Legibilidad y Contraste 👁️‍🗨️
* **Fallo Crítico en Ajustes (Fondo Blanco):** 
  Al seleccionar los temas de Racing, Rojo o Diego, los textos blancos sobre el panel de configuración sufren de "lavado" (low contrast ratio < 3:1). La palabra "AJUSTES" se vuelve invisible.
  * **Solución UX:** Aplicar un `text-shadow` profundo y un fondo de panel oscuro semi-transparente (`rgba(0,0,0,0.6)`) con `backdrop-filter: blur` para garantizar lectura sobre *cualquier* fondo.
* **Marcador Central:** El reloj y los números `00:00` compiten visualmente con el resplandor rojo central si no tienen un delineado oscuro (stroke o sombra paralela fuerte).

## 3. Análisis de Layout y Espaciado (UX) 📏
* **Botones Flotantes (Home y Ajustes) Huérfanos/Invasivos:**
  Actualmente, estos botones están posicionados con `position: absolute; right: -5px; top: -20px;`. En pantallas de iPhone (con Dynamic Island) o teléfonos Android con notches muy profundos, estos botones pueden quedar fuera del área segura (`safe-area-inset`) o verse "apretados" contra la esquina.
  * **Solución UX:** Deben pasar de ser absolutos a estar contenidos en un `flex` header, o usar un margen superior con `padding-top: env(safe-area-inset-top)`.
* **Zonas Táctiles (Touch Targets):** Los botones de "+1" (la gran caja) están perfectos, pero los controles del cronómetro (Play/Reset) están algo muy pegados entre sí (`gap: 12px;`). Según las guías de Material Design, necesitan al menos 48x48px de área interactiva separada.

## 4. Elementos Faltantes o Huérfanos 🧩
* **Indicador Visual Activo de Puntos:** En ajustes se elige "A 15" o "A 30", pero en el flujo del marcador central no hay una pista visual pasiva que le recuerde al usuario a cuántos puntos se está jugando sin tener que entrar a ajustes.
* **Botón Atrás (Back/Close) Consistente:** En los modales y en la pantalla de ajustes, el botón de cierre a veces compite con las opciones de tema. Falta un botón inferior primario de "GUARDAR Y VOLVER" bien anclado.

## 5. Checklist de Calidad Premium (Console/Skeuomorphic Look) 💎
Para alcanzar ese renderizado hiperdetallado, metálico y profundo, la app actual carece de:
- [ ] **Bordes de Cristal (Glass Edges):** Falta un borde superior translúcido (`border-top: 1px solid rgba(255,255,255,0.4);`) en las tarjetas para simular luz rebotando.
- [ ] **Sombras Internas (Inset Shadows):** Las pantallas negras de los números no se ven "hundidas" en el dispositivo. Necesitan un `box-shadow: inset 0 5px 15px rgba(0,0,0,0.8);`.
- [ ] **Gradientes Metálicos:** Los contenedores principales son grises planos. Deberían tener un leve gradiente lineal (`linear-gradient(145deg, #444, #111)`).
- [ ] **Efecto Hover/Active (Microinteracciones):** Al tocar los botones grandes, deben reducir su escala físicamente (`transform: scale(0.97)`) para dar sensación de botón mecánico.

---

## 🛠️ PARCHES CSS (Reglas Corregidas para Aplicar)

Agregá o reemplazá estas clases en tu archivo `style.css` para aplicar inmediatamente los fixes de legibilidad, consistencia y look premium:

```css
/* 1. FIJAR LEGIBILIDAD EN PANTALLA DE AJUSTES (CONTRASTE INFALIBLE) */
.pantalla-config {
    background: rgba(10, 10, 12, 0.85); /* Fondo oscuro general más profundo */
    backdrop-filter: blur(15px);
    -webkit-backdrop-filter: blur(15px);
}
.pantalla-config h2 {
    color: #ffffff;
    text-shadow: 0 4px 10px rgba(0,0,0,0.9), 0 1px 3px rgba(0,0,0,0.8); /* Evita que el título desaparezca */
    letter-spacing: 2px;
}

/* 2. LOOK PREMIUM "HUNDIDO" PARA LOS DISPLAYS DE PUNTOS */
.caja-puntos {
    background: linear-gradient(145deg, #1a1a1a, #0a0a0a);
    box-shadow: 
        inset 0 8px 15px rgba(0, 0, 0, 0.9), /* Efecto display hundido mecanico */
        inset 0 1px 2px rgba(255, 255, 255, 0.05),
        0 2px 0 rgba(255,255,255,0.1); /* Brillo del labio inferior */
    border: 1px solid rgba(0, 0, 0, 0.8);
}

/* 3. SIMETRÍA Y PREVENCIÓN DE TRUNCAMIENTO EN NOMBRES */
.caja-nombre {
    min-width: 90px;
    max-width: 110px;
    font-size: clamp(0.7rem, 2.5vw, 0.95rem); /* Ajuste dinámico de fuente */
    word-break: break-all;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: center;
    /* Borde de cristal superior */
    border-top: 1px solid rgba(255, 255, 255, 0.2);
}

/* 4. FIX PARA BOTONES FLOTANTES Y SAFE AREAS (NOTCH) */
.controles-superiores {
    position: absolute;
    top: max(10px, env(safe-area-inset-top)); /* Respeta el notch de iPhones y Androids */
    right: max(10px, env(safe-area-inset-right));
    display: flex;
    gap: 8px;
    z-index: 100;
}

/* 5. MICRO-INTERACCIÓN DE BOTONES MECÁNICOS (TACTIL) */
.btn-crono:active, .caja-puntos:active {
    transform: scale(0.96) translateY(2px);
    box-shadow: inset 0 10px 20px rgba(0,0,0,0.9);
    transition: transform 0.05s ease, box-shadow 0.05s ease;
}
```
