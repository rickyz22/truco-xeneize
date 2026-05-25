let puntosNos = 0;
let puntosEllos = 0;
let segundos = 0;
let cronometroIntervalo = null;
let corriendo = false;
let wakeLock = null;
let limitePuntos = 30;
let nombreNos = localStorage.getItem("nombreNos") || "NOSOTROS";
let nombreEllos = localStorage.getItem("nombreEllos") || "ELLOS";
let usuarioInteractuo = false;
let pantallaAntesConfig = "inicio";

// Caché en memoria de preferencias de hardware/sonido para evitar accesos síncronos lentos a localStorage en el hilo principal
let prefVibrar = localStorage.getItem("show-vibrar") !== "false";
let prefSonido = localStorage.getItem("show-sonido") !== "false";

let audioContext = null;

const ICONOS_LOCALES = {
  settings: "\u2699",
  close: "\u00d7",
  emoji_events: "\ud83c\udfc6",
  filter_vintage: "\u273f",
  timer: "\u23f1",
  pin: "#",
  volume_up: "\ud83d\udd0a",
  volume_off: "\ud83d\udd07",
  vibration: "\u224b",
  delete_sweep: "\u232b",
  home: "\u2302",
  sports: "\u2691",
  play_arrow: "\u25b6",
  pause: "\u2161",
  replay: "\u21ba",
  send: "\u27a4",
};

function setIcon(el, nombre) {
  if (!el) return;
  el.dataset.icon = nombre;
  el.textContent = ICONOS_LOCALES[nombre] || nombre;
}

function aplicarIconosLocales() {
  document.querySelectorAll(".material-icons").forEach((el) => {
    setIcon(el, el.dataset.icon || el.textContent.trim());
  });
}

let refrescandoPorUpdate = false;

function mostrarAvisoActualizacion(worker) {
  if (!worker || document.getElementById("update-banner")) return;

  const banner = document.createElement("div");
  banner.id = "update-banner";
  banner.innerHTML = `
        <div class="update-banner-text">
            <strong>Actualizacion disponible</strong>
            <span>Toca para cargar la ultima version.</span>
        </div>
        <button type="button" id="btn-update-app">Actualizar</button>
    `;

  document.body.appendChild(banner);

  document.getElementById("btn-update-app").addEventListener("click", () => {
    worker.postMessage({ type: "SKIP_WAITING" });
  });
}

function registrarServiceWorker() {
  if (!("serviceWorker" in navigator) || window.location.protocol === "file:")
    return;

  navigator.serviceWorker
    .register("sw.js")
    .then((reg) => {
      console.log("Service Worker registrado con exito:", reg.scope);

      if (reg.waiting && navigator.serviceWorker.controller) {
        mostrarAvisoActualizacion(reg.waiting);
      }

      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (
            newWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            mostrarAvisoActualizacion(newWorker);
          }
        });
      });
    })
    .catch((err) =>
      console.error("Error al registrar el Service Worker:", err),
    );

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refrescandoPorUpdate) return;
    refrescandoPorUpdate = true;
    window.location.reload();
  });
}

const DB_NAME = "truco-xeneize-db";
const DB_VERSION = 1;
const STORE_APP = "app";
let dbPromise = null;

function abrirDB() {
  if (!("indexedDB" in window)) {
    return Promise.reject(new Error("IndexedDB no disponible"));
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_APP)) {
        db.createObjectStore(STORE_APP);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

async function leerDB(clave) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_APP, "readonly");
    const request = tx.objectStore(STORE_APP).get(clave);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function guardarDB(clave, valor) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_APP, "readwrite");
    tx.objectStore(STORE_APP).put(valor, clave);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function borrarDB(clave) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_APP, "readwrite");
    tx.objectStore(STORE_APP).delete(clave);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function leerPartidaLegacy() {
  const pGuardados = localStorage.getItem("puntosNos");
  if (pGuardados === null && !localStorage.getItem("partidaIniciada"))
    return null;

  return {
    puntosNos: parseInt(localStorage.getItem("puntosNos") || 0),
    puntosEllos: parseInt(localStorage.getItem("puntosEllos") || 0),
    segundos: parseInt(localStorage.getItem("segundos") || 0),
    actualizadaEn: new Date().toISOString(),
  };
}

async function cargarPartidaPersistida() {
  try {
    const partida = await leerDB("partida");
    if (partida) return partida;

    const legacy = leerPartidaLegacy();
    if (legacy) {
      await guardarDB("partida", legacy);
      return legacy;
    }
  } catch (error) {
    console.warn(
      "IndexedDB no disponible, usando localStorage para partida:",
      error,
    );
    return leerPartidaLegacy();
  }

  return null;
}

async function leerHistorialPersistido() {
  try {
    const historial = await leerDB("historial");
    if (Array.isArray(historial)) return historial;

    const legacy = JSON.parse(localStorage.getItem("historial") || "[]");
    if (legacy.length) {
      await guardarDB("historial", legacy);
    }
    return legacy;
  } catch (error) {
    console.warn(
      "IndexedDB no disponible, usando localStorage para historial:",
      error,
    );
    return JSON.parse(localStorage.getItem("historial") || "[]");
  }
}

function vibrar(ms = 30) {
  if (!usuarioInteractuo) return;
  if (!prefVibrar) return;
  try {
    if (navigator.vibrate) {
      navigator.vibrate(ms);
    }
  } catch (e) {
    console.warn(
      "Vibración no disponible en este dispositivo/contexto:",
      e.message,
    );
  }
}

function initAudio() {
  if (audioContext) return;
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) {
    console.warn("No se pudo crear AudioContext:", e);
  }
}

function playBeep(tipo = "default") {
  if (!prefSonido || !audioContext) return;

  try {
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    const osc = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioContext.destination);

    if (tipo === "sumar") {
      // Sonido retro estilo moneda (agudo doble)
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, audioContext.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(
        880,
        audioContext.currentTime + 0.08,
      ); // A5
      gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + 0.1,
      );
      osc.start();
      osc.stop(audioContext.currentTime + 0.1);
    } else if (tipo === "restar") {
      // Sonido hacia abajo graves
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, audioContext.currentTime); // A4
      osc.frequency.exponentialRampToValueAtTime(
        293.66,
        audioContext.currentTime + 0.08,
      ); // D4
      gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + 0.1,
      );
      osc.start();
      osc.stop(audioContext.currentTime + 0.1);
    } else if (tipo === "victoria") {
      // Arpegio brillante y alegre
      const notas = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notas.forEach((f, idx) => {
        const oscNode = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscNode.type = "triangle";
        oscNode.frequency.setValueAtTime(
          f,
          audioContext.currentTime + idx * 0.08,
        );
        gain.gain.setValueAtTime(0.12, audioContext.currentTime + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          audioContext.currentTime + idx * 0.08 + 0.25,
        );
        oscNode.connect(gain);
        gain.connect(audioContext.destination);
        oscNode.start(audioContext.currentTime + idx * 0.08);
        oscNode.stop(audioContext.currentTime + idx * 0.08 + 0.25);
      });
    } else {
      // Sonido por defecto
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + 0.08,
      );
      osc.start();
      osc.stop(audioContext.currentTime + 0.08);
    }
  } catch (e) {
    console.error("Error al reproducir beep:", e);
  }
}

async function activarWakeLock() {
  try {
    if ("wakeLock" in navigator) {
      wakeLock = await navigator.wakeLock.request("screen");
    }
  } catch {}
}

document.addEventListener("visibilitychange", async () => {
  if (wakeLock !== null && document.visibilityState === "visible") {
    await activarWakeLock();
  }
});

let timerGuardar = null;
async function guardarProgresoInmediato() {
  const partida = {
    puntosNos,
    puntosEllos,
    segundos,
    actualizadaEn: new Date().toISOString(),
  };

  try {
    await guardarDB("partida", partida);
    localStorage.setItem("partidaIniciada", "true");
  } catch (error) {
    console.warn(
      "IndexedDB no disponible, guardando partida en localStorage:",
      error,
    );
    localStorage.setItem("partidaIniciada", "true");
    localStorage.setItem("puntosNos", puntosNos);
    localStorage.setItem("puntosEllos", puntosEllos);
    localStorage.setItem("segundos", segundos);
  }
}
function guardarProgreso() {
  if (timerGuardar) clearTimeout(timerGuardar);
  timerGuardar = setTimeout(() => {
    void guardarProgresoInmediato();
  }, 150);
}

// Asegurar que se guarde si el usuario minimiza la app de golpe
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    if (timerGuardar) {
      clearTimeout(timerGuardar);
      void guardarProgresoInmediato();
    }
  }
});

async function comenzarJuego() {
  vibrar();
  activarWakeLock();

  // Marcar sesion activa (se borra solo si se cierra la app completamente)
  sessionStorage.setItem("enJuego", "true");
  localStorage.setItem("partidaIniciada", "true");

  // Si habia una partida guardada, retomarla
  const partidaGuardada = await cargarPartidaPersistida();
  if (partidaGuardada) {
    puntosNos = parseInt(partidaGuardada.puntosNos || 0);
    puntosEllos = parseInt(partidaGuardada.puntosEllos || 0);
    segundos = parseInt(partidaGuardada.segundos || 0);
    mostrarTiempo();
  }

  detenerAnimacionPelota();
  mostrarPantallaJuego();
}

function sincronizarGridMarcador() {
  const cronoVisible = localStorage.getItem("show-crono") !== "false";
  const marcador = document.querySelector(".marcador-futbol");
  if (marcador) {
    marcador.style.gridTemplateColumns = cronoVisible
      ? "1fr 120px 1fr"
      : "1fr 1fr";
  }
}

function mostrarPantallaJuego() {
  document.getElementById("pantalla-inicio").style.display = "none";
  document.getElementById("contenido-juego").style.display = "flex";
  detenerAnimacionPelota();
  sincronizarGridMarcador();
  actualizarInterfaz();
}

function toggleCronometro() {
  vibrar();

  const icono = document.getElementById("icono-play");
  const btn = document.getElementById("btn-play-pause");

  if (!corriendo) {
    cronometroIntervalo = setInterval(() => {
      segundos++;
      mostrarTiempo();
      guardarProgreso();
    }, 1000);

    setIcon(icono, "pause");
    btn.classList.add("corriendo");
    btn.style.background = "";
    btn.style.color = "";
    corriendo = true;
  } else {
    clearInterval(cronometroIntervalo);

    setIcon(icono, "play_arrow");
    btn.classList.remove("corriendo");
    btn.style.background = "";
    btn.style.color = "";
    corriendo = false;
  }
}

function mostrarTiempo() {
  let min = Math.floor(segundos / 60);
  let seg = segundos % 60;

  document.getElementById("cronometro").innerText =
    `${min.toString().padStart(2, "0")}:${seg.toString().padStart(2, "0")}`;
}

function resetearCronometro() {
  vibrar();
  clearInterval(cronometroIntervalo);
  cronometroIntervalo = null;
  segundos = 0;
  corriendo = false;

  mostrarTiempo();
  guardarProgreso();

  setIcon(document.getElementById("icono-play"), "play_arrow");

  const btn = document.getElementById("btn-play-pause");
  btn.classList.remove("corriendo");
  btn.style.background = "";
  btn.style.color = "";
}

function juegoTerminado() {
  return puntosNos >= limitePuntos || puntosEllos >= limitePuntos;
}

function sumar(equipo) {
  if (juegoTerminado()) return;

  vibrar();
  playBeep("sumar");

  if (equipo === "nos" && puntosNos < limitePuntos) {
    puntosNos++;
    document.getElementById("num-nos").innerText = puntosNos;
    agregarPalito("palitos-nos", puntosNos);
  }
  if (equipo === "ellos" && puntosEllos < limitePuntos) {
    puntosEllos++;
    document.getElementById("num-ellos").innerText = puntosEllos;
    agregarPalito("palitos-ellos", puntosEllos);
  }

  if (juegoTerminado()) {
    clearInterval(cronometroIntervalo);
    const ganador = puntosNos >= limitePuntos ? nombreNos : nombreEllos;
    vibrar(200);
    playBeep("victoria");
    void guardarEnHistorial(ganador);
    mostrarModal(
      "\u00a1GANARON!",
      `El equipo de ${ganador} se lleva la gloria.`,
      false,
    );
  }

  guardarProgreso();
}

function restar(equipo) {
  if (juegoTerminado()) return;

  vibrar();
  playBeep("restar");

  if (equipo === "nos" && puntosNos > 0) {
    puntosNos--;
    document.getElementById("num-nos").innerText = puntosNos;
    quitarPalito("palitos-nos", puntosNos);
  }
  if (equipo === "ellos" && puntosEllos > 0) {
    puntosEllos--;
    document.getElementById("num-ellos").innerText = puntosEllos;
    quitarPalito("palitos-ellos", puntosEllos);
  }

  guardarProgreso();
}

function actualizarInterfaz(equipo) {
  if (!equipo || equipo === "nos") {
    document.getElementById("num-nos").innerText = puntosNos;
    document.getElementById("palitos-nos").innerHTML =
      dibujarPalitos(puntosNos);
  }
  if (!equipo || equipo === "ellos") {
    document.getElementById("num-ellos").innerText = puntosEllos;
    document.getElementById("palitos-ellos").innerHTML =
      dibujarPalitos(puntosEllos);
  }

  if (juegoTerminado()) {
    clearInterval(cronometroIntervalo);

    let ganador = puntosNos >= limitePuntos ? nombreNos : nombreEllos;

    vibrar(200);
    playBeep("victoria");

    void guardarEnHistorial(ganador);

    mostrarModal(
      "¡GANARON!",
      `El equipo de ${ganador} se lleva la gloria.`,
      false,
    );
  }
}

function mostrarModal(
  titulo,
  mensaje,
  esConfirmacion,
  accion,
  labelNo = "VOLVER",
  labelSi = "REINICIAR",
) {
  const modal = document.getElementById("modal-custom");

  document.getElementById("modal-titulo").innerText = titulo;
  document.getElementById("modal-mensaje").innerText = mensaje;

  const btnBox = document.getElementById("modal-botones");
  btnBox.innerHTML = "";

  if (esConfirmacion) {
    let btnNo = document.createElement("button");
    btnNo.innerText = labelNo;
    btnNo.className = "btn-modal-cancelar";
    btnNo.onclick = () => (modal.style.display = "none");

    let btnSi = document.createElement("button");
    btnSi.innerText = labelSi;
    btnSi.className = "btn-modal-confirmar";
    btnSi.onclick = () => {
      if (accion) accion();
      modal.style.display = "none";
    };

    btnBox.append(btnNo, btnSi);
  } else {
    let btnOk = document.createElement("button");
    btnOk.innerText = "¡VAMOS!";
    btnOk.className = "btn-modal-confirmar";
    btnOk.onclick = () => {
      reiniciarTotalmente();
      modal.style.display = "none";
    };

    btnBox.append(btnOk);
  }

  modal.style.display = "flex";
}

function reiniciar() {
  vibrar();
  mostrarModal(
    "¿NUEVA PARTIDA?",
    "¿Borrar puntos y tiempo?",
    true,
    reiniciarTotalmente,
  );
}

function reiniciarTotalmente() {
  puntosNos = 0;
  puntosEllos = 0;

  localStorage.setItem("partidaIniciada", "true");
  sessionStorage.setItem("enJuego", "true");

  resetearCronometro();
  actualizarInterfaz();
  reiniciarArbitro();
}

async function guardarEnHistorial(ganador) {
  let historial = await leerHistorialPersistido();

  historial.push({
    fecha: new Date().toISOString(),
    ganador,
    puntosNos,
    puntosEllos,
    tiempo: segundos,
  });

  if (historial.length > 10) historial.shift();

  try {
    await guardarDB("historial", historial);
    localStorage.removeItem("historial");
  } catch (error) {
    console.warn(
      "IndexedDB no disponible, guardando historial en localStorage:",
      error,
    );
    localStorage.setItem("historial", JSON.stringify(historial));
  }
}

async function mostrarHistorial() {
  const lista = document.getElementById("lista-historial");
  lista.innerHTML = "";

  const historial = await leerHistorialPersistido();

  if (historial.length === 0) {
    lista.innerHTML = "<p>No hay partidas guardadas.</p>";
    return;
  }

  historial.forEach((p) => {
    const div = document.createElement("div");
    div.className = "partida-historial";

    const fecha = new Date(p.fecha).toLocaleString();

    div.innerHTML = `<p>${fecha} - Ganó ${p.ganador} (${p.puntosNos}-${p.puntosEllos})</p>`;

    lista.appendChild(div);
  });
}

async function reiniciarHistorial() {
  vibrar();
  localStorage.removeItem("historial");
  try {
    await borrarDB("historial");
  } catch (error) {
    console.warn("No se pudo borrar historial en IndexedDB:", error);
  }
  await mostrarHistorial();
}

// Reconstrucción completa (usada en reset/init)
function dibujarPalitos(puntos) {
  let html = '<div class="grupo-15">';

  for (let i = 0; i < puntos; i++) {
    if (i === 15) {
      html += '</div><div class="linea-divisoria"></div><div class="grupo-15">';
    }

    if (i % 5 === 0) html += '<div class="cuadradito">';

    html += `<img src="fosforo.png" alt="" class="fosforo p${(i % 5) + 1}">`;

    if (i % 5 === 4 || i === puntos - 1) html += "</div>";
  }

  return html + "</div>";
}

/**
 * Agrega un palito de forma incremental (O(1) DOM ops, sin reconstruir todo).
 * @param {string} id - ID del contenedor
 * @param {number} puntos - Valor NUEVO (ya incrementado)
 */
function agregarPalito(id, puntos) {
  const contenedor = document.getElementById(id);
  const i = puntos - 1; // índice 0-based del palito nuevo
  const img = `<img src="fosforo.png" alt="" class="fosforo p${(i % 5) + 1}">`;

  if (i === 0) {
    // Primer palito: inicializar estructura
    contenedor.innerHTML = `<div class="grupo-15"><div class="cuadradito">${img}</div></div>`;
    return;
  }
  if (i === 15) {
    // Palito 16: nuevo bloque con separador
    contenedor.insertAdjacentHTML(
      "beforeend",
      `<div class="linea-divisoria"></div><div class="grupo-15"><div class="cuadradito">${img}</div></div>`,
    );
    return;
  }
  if (i % 5 === 0) {
    // Inicio de nuevo cuadradito en el grupo actual
    contenedor
      .querySelector(".grupo-15:last-child")
      .insertAdjacentHTML("beforeend", `<div class="cuadradito">${img}</div>`);
    return;
  }
  // Agregar al último cuadradito
  contenedor
    .querySelector(".grupo-15:last-child .cuadradito:last-child")
    .insertAdjacentHTML("beforeend", img);
}

/**
 * Quita el último palito de forma incremental.
 * @param {string} id - ID del contenedor
 * @param {number} puntos - Valor NUEVO (ya decrementado)
 */
function quitarPalito(id, puntos) {
  const contenedor = document.getElementById(id);
  if (puntos === 0) {
    contenedor.innerHTML = '<div class="grupo-15"></div>';
    return;
  }
  const lastGrupo = contenedor.querySelector(".grupo-15:last-child");
  const lastCuadradito = lastGrupo.querySelector(".cuadradito:last-child");
  const lastImg =
    lastCuadradito && lastCuadradito.querySelector(".fosforo:last-child");
  if (lastImg) lastImg.remove();

  if (lastCuadradito && lastCuadradito.children.length === 0)
    lastCuadradito.remove();

  if (lastGrupo.children.length === 0) {
    lastGrupo.remove();
    const divisoria = contenedor.querySelector(".linea-divisoria");
    if (divisoria) divisoria.remove();
  }
}

function abrirConfiguracion() {
  const contenidoJuego = document.getElementById("contenido-juego");
  pantallaAntesConfig =
    contenidoJuego && contenidoJuego.style.display !== "none"
      ? "juego"
      : "inicio";

  document.getElementById("pantalla-inicio").style.display = "none";
  contenidoJuego.style.display = "none";
  document.getElementById("pantalla-config").style.display = "flex";
  detenerAnimacionPelota();
  void mostrarHistorial();
}

function cerrarConfig() {
  vibrar();

  document.getElementById("pantalla-config").style.display = "none";

  if (pantallaAntesConfig === "juego") {
    document.getElementById("contenido-juego").style.display = "flex";
    detenerAnimacionPelota();
  } else {
    document.getElementById("pantalla-inicio").style.display = "flex";
    iniciarAnimacionPelota();
  }
}

function volverInicio() {
  vibrar();
  // Si hay una partida en curso, pedir confirmación antes de abandonarla
  const hayPartida = puntosNos > 0 || puntosEllos > 0 || segundos > 0;
  if (hayPartida) {
    mostrarModal(
      "\u00bfIR AL MEN\u00da?",
      "La partida se va a guardar y pod\u00e9s retomar cuando vuelvas.",
      true,
      _irAlMenuSinBorrar,
      "CANCELAR",
      "IR AL MEN\u00da",
    );
  } else {
    _irAlMenuSinBorrar();
  }
}

function _irAlMenuSinBorrar() {
  // Solo navega al menú; NO borra la partida guardada
  // El botón "Jugar Ahora" la retomará
  clearInterval(cronometroIntervalo);
  cronometroIntervalo = null;
  corriendo = false;
  void guardarProgresoInmediato();

  document.getElementById("contenido-juego").style.display = "none";
  document.getElementById("pantalla-inicio").style.display = "flex";
  iniciarAnimacionPelota();
}

function cambiarEstilo(equipo) {
  document.body.className = "tema-" + equipo;
  localStorage.setItem("equipo", equipo);

  // Resaltar el botón del tema seleccionado en la cuadrícula de configuración
  const botones = document.querySelectorAll(".btn-equipo");
  botones.forEach((btn) => {
    btn.classList.toggle("activo-tema", btn.classList.contains(equipo));
  });

  actualizarImagenFlor(equipo);
}

function editarNombre(equipo) {
  vibrar();
  const nombreActual = equipo === "nos" ? nombreNos : nombreEllos;
  const nuevoNombre = prompt("Ingresa el nombre del equipo:", nombreActual);
  if (nuevoNombre && nuevoNombre.trim() !== "") {
    const nombreLimpio = nuevoNombre.trim().substring(0, 15).toUpperCase();
    if (equipo === "nos") {
      nombreNos = nombreLimpio;
      localStorage.setItem("nombreNos", nombreNos);
    } else {
      nombreEllos = nombreLimpio;
      localStorage.setItem("nombreEllos", nombreEllos);
    }
    actualizarNombresUI();
    playBeep("sumar");
  }
}

function actualizarNombresUI() {
  const elNos = document.getElementById("name-nos");
  const elEllos = document.getElementById("name-ellos");
  const lblNos = document.getElementById("lbl-nos");
  const lblEllos = document.getElementById("lbl-ellos");

  if (elNos) elNos.innerText = nombreNos;
  if (elEllos) elEllos.innerText = nombreEllos;

  // Scoreboard labels take first 8 characters (evita truncamiento "NOSOT")
  if (lblNos) lblNos.innerText = nombreNos.substring(0, 8);
  if (lblEllos) lblEllos.innerText = nombreEllos.substring(0, 8);
}

function cambiarLimitePuntos(limite, conEfectos = true) {
  if (conEfectos) vibrar();
  limitePuntos = limite;
  localStorage.setItem("limitePuntos", limite);

  const btn15 = document.getElementById("btn-limite-15");
  const btn30 = document.getElementById("btn-limite-30");
  if (btn15 && btn30) {
    btn15.classList.toggle("activa", limite === 15);
    btn30.classList.toggle("activa", limite === 30);
  }

  // Reflejar visualmente sin disparar modal de victoria ni guardar en historial
  if (puntosNos >= limite || puntosEllos >= limite) {
    document.getElementById("num-nos").innerText = puntosNos;
    document.getElementById("num-ellos").innerText = puntosEllos;
    document.getElementById("palitos-nos").innerHTML =
      dibujarPalitos(puntosNos);
    document.getElementById("palitos-ellos").innerHTML =
      dibujarPalitos(puntosEllos);
  }
}

function toggleElemento(tipo) {
  const el = document.getElementById(`check-${tipo}`);
  if (!el) return;

  const activo = el.checked;

  if (tipo === "crono") {
    const contCrono = document.getElementById("cont-crono");
    contCrono.style.display = activo ? "flex" : "none";
    // Colapsar/restaurar la columna central del grid para que NOS y ELLOS queden centrados
    const marcador = document.querySelector(".marcador-futbol");
    if (marcador) {
      marcador.style.gridTemplateColumns = activo ? "1fr 120px 1fr" : "1fr 1fr";
    }
  } else if (tipo === "num") {
    document.getElementById("cont-nos").style.visibility = activo
      ? "visible"
      : "hidden";
    document.getElementById("cont-ellos").style.visibility = activo
      ? "visible"
      : "hidden";
  } else if (tipo === "sonido") {
    setIcon(
      document.getElementById("icon-sonido"),
      activo ? "volume_up" : "volume_off",
    );
    prefSonido = activo;
  } else if (tipo === "vibrar") {
    prefVibrar = activo;
  } else if (tipo === "flor") {
    const elFlor = document.getElementById("cont-flor");
    if (elFlor) elFlor.style.display = activo ? "flex" : "none";
  }

  localStorage.setItem(`show-${tipo}`, activo);
  vibrar();
}

window.onload = async () => {
  aplicarIconosLocales();
  registrarServiceWorker();

  // Cargar estilo y tema inicial
  const equipo = localStorage.getItem("equipo") || "boca";
  cambiarEstilo(equipo);
  actualizarNombresUI();

  // Cargar límite de puntos inicial (sin vibración al iniciar)
  const limiteGuardado = localStorage.getItem("limitePuntos");
  if (limiteGuardado) {
    cambiarLimitePuntos(parseInt(limiteGuardado), false);
  } else {
    cambiarLimitePuntos(30, false);
  }
  // Detectar si la app fue cerrada completamente o solo minimizada
  // sessionStorage se borra al cerrar la app, pero persiste al cambiar de pantalla
  const enSesionActiva = sessionStorage.getItem("enJuego");
  const partidaGuardada = await cargarPartidaPersistida();

  if (enSesionActiva && partidaGuardada) {
    // Volvio desde otra app (cambio de pantalla), restaurar anotador directamente
    puntosNos = parseInt(partidaGuardada.puntosNos || 0);
    puntosEllos = parseInt(partidaGuardada.puntosEllos || 0);
    segundos = parseInt(partidaGuardada.segundos || 0);
    mostrarTiempo();
    mostrarPantallaJuego();
  } else {
    // App cerrada completamente: mostrar menu principal
    // Si habia partida guardada, el boton "Jugar Ahora" la retomara
    iniciarAnimacionPelota();
  }

  // Restaurar preferencias
  ["crono", "num", "sonido", "vibrar", "flor"].forEach((tipo) => {
    const estado = localStorage.getItem(`show-${tipo}`);

    if (estado !== null) {
      const el = document.getElementById(`check-${tipo}`);

      if (el) {
        el.checked = JSON.parse(estado);

        if (tipo === "sonido") {
          setIcon(
            document.getElementById("icon-sonido"),
            el.checked ? "volume_up" : "volume_off",
          );
        } else {
          toggleElemento(tipo);
        }
      }
    }
  });
};

/* --- PELOTA REBOTADORA EN PANTALLA DE INICIO --- */
let animacionPelotaId = null;
let pelotaResizeHandler = null;

function iniciarAnimacionPelota() {
  const pelota = document.getElementById("pelota-rebotadora");
  const container = document.getElementById("pantalla-inicio");
  if (!pelota || !container) return;

  pelota.style.display = "block";

  let w = window.innerWidth;
  let h = window.innerHeight;
  const size = 65; // perfect visual scale
  pelota.style.width = size + "px";
  pelota.style.height = size + "px";

  // Start inside screen boundary
  let x = Math.random() * (w - size - 40) + 20;
  let y = Math.random() * (h - size - 40) + 20;

  // Velocities: dynamic 1.5px to 2.7px per frame
  let dx = (Math.random() > 0.5 ? 1 : -1) * (1.5 + Math.random() * 1.2);
  let dy = (Math.random() > 0.5 ? 1 : -1) * (1.5 + Math.random() * 1.2);

  let rotation = 0;
  const spinSpeed = 1.5;

  pelotaResizeHandler = function () {
    w = window.innerWidth;
    h = window.innerHeight;
  };
  window.addEventListener("resize", pelotaResizeHandler);

  function update() {
    if (container.style.display === "none") {
      pelota.style.display = "none";
      animacionPelotaId = null;
      window.removeEventListener("resize", pelotaResizeHandler);
      pelotaResizeHandler = null;
      return;
    }

    x += dx;
    y += dy;
    rotation += spinSpeed;

    // Bounce horizontal walls
    if (x <= 0) {
      x = 0;
      dx = -dx;
      vibrarSutilBounce();
    } else if (x + size >= w) {
      x = w - size;
      dx = -dx;
      vibrarSutilBounce();
    }

    // Bounce vertical walls
    if (y <= 0) {
      y = 0;
      dy = -dy;
      vibrarSutilBounce();
    } else if (y + size >= h) {
      y = h - size;
      dy = -dy;
      vibrarSutilBounce();
    }

    pelota.style.left = x + "px";
    pelota.style.top = y + "px";
    pelota.style.transform = `rotate(${rotation}deg)`;

    animacionPelotaId = requestAnimationFrame(update);
  }

  if (animacionPelotaId) {
    cancelAnimationFrame(animacionPelotaId);
  }
  animacionPelotaId = requestAnimationFrame(update);
}

function detenerAnimacionPelota() {
  if (animacionPelotaId) {
    cancelAnimationFrame(animacionPelotaId);
    animacionPelotaId = null;
  }
  if (pelotaResizeHandler) {
    window.removeEventListener("resize", pelotaResizeHandler);
    pelotaResizeHandler = null;
  }
  const pelota = document.getElementById("pelota-rebotadora");
  if (pelota) pelota.style.display = "none";
}

function vibrarSutilBounce() {
  if (!usuarioInteractuo) return; // Evita warnings de intervención del navegador antes del primer tap
  const vibrarHabilitado = localStorage.getItem("show-vibrar") !== "false";
  if (vibrarHabilitado && navigator.vibrate) {
    navigator.vibrate(8);
  }
}

// Registrar interacción inicial para habilitar audio y vibración
function registrarInteraccionUsuario() {
  usuarioInteractuo = true;
  initAudio();
  window.removeEventListener("click", registrarInteraccionUsuario);
  window.removeEventListener("touchstart", registrarInteraccionUsuario);
  window.removeEventListener("mousedown", registrarInteraccionUsuario);
}
window.addEventListener("click", registrarInteraccionUsuario);
window.addEventListener("touchstart", registrarInteraccionUsuario, {
  passive: true,
});
window.addEventListener("mousedown", registrarInteraccionUsuario);

function actualizarImagenFlor(tema) {
  const el = document.querySelector(".flor-img");
  if (!el) return;

  if (tema === "river" || tema === "independiente") {
    el.src = "flor-blanca.png";
  } else if (tema === "boca") {
    el.src = "flor-boca.png";
  } else {
    el.src = "flor.png";
  }
}

// --- MÓDULO ÁRBITRO (Compadrito, canchero y reglamento completo) ---
function abrirArbitro() {
  vibrar();
  document.getElementById("modal-arbitro").style.display = "flex";
  setTimeout(() => document.getElementById("input-arbitro").focus(), 100);
}

function cerrarArbitro() {
  vibrar();
  document.getElementById("modal-arbitro").style.display = "none";
}

function reiniciarArbitro() {
  const chat = document.getElementById("chat-arbitro");
  if (chat) {
    chat.innerHTML = `
            <div class="mensaje-arbitro">
                <strong>🃏 Árbitro:</strong> ¡Buenas, papá! Silbato en mano y reglamento en la cabeza. Decime qué quilombo se armó en la mesa — jerarquía de cartas, pardas, envido, truco — y te doy el fallo <em>indiscutible</em>. ¿De qué va la discusión?
            </div>
        `;
  }
  const input = document.getElementById("input-arbitro");
  if (input) {
    input.value = "";
  }
}

function manejarEnterArbitro(event) {
  if (event.key === "Enter") {
    enviarConsultaArbitro();
  }
}

// ── GEMINI vía CLOUDFLARE WORKER PROXY ───────────────────────
// La key vive en el Worker de Cloudflare como secreto.
// Aquí solo va la URL pública del proxy.
const WORKER_URL = "https://truco-ricky.rickyz1749.workers.dev/";

// Convierte el markdown que a veces devuelve Gemini a HTML básico
function geminiAHtml(txt) {
  return txt
    .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\n\n/g, "<br><br>")
    .replace(/\n/g, "<br>");
}

async function llamarGemini(consulta) {
  const juegaConFlor = document.getElementById("check-flor")?.checked;
  const systemPrompt =
    `Sos el Árbitro ASART, el árbitro oficial del truco argentino.
` +
    `Sos canchero, directo, hablás con lunfardo porteño y respondés con autoridad total.
` +
    `SOLO respondés sobre truco argentino: reglas, puntos, jerarquía de cartas, envido, real envido, falta envido, flor, pardas, truco, retruco, vale cuatro, irse al mazo, y cualquier situación de juego.
` +
    `Si te preguntan algo fuera del truco, decís que eso no va y los volvés al juego.
` +
    `Contexto de la partida: NOS ${puntosNos} — ELLOS ${puntosEllos} (jugando a ${limitePuntos} puntos). ` +
    `${juegaConFlor ? "Juegan CON flor." : "Juegan SIN flor."}
` +
    `Respondé en menos de 80 palabras. Para fallos clave usá <b>texto</b>. No uses asteriscos de markdown.`;

  const res = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: consulta }] }],
      generationConfig: { maxOutputTokens: 200, temperature: 0.65 },
    }),
  });

  const data = await res.json();

  // Si Gemini devolvio un error (quota, key invalida, safety, etc.)
  if (!res.ok || data.error) {
    const msg =
      data.error?.message || data.error?.status || `HTTP ${res.status}`;
    throw new Error(`Gemini: ${msg}`);
  }

  // Respuesta bloqueada por filtros de seguridad
  const finishReason = data.candidates?.[0]?.finishReason;
  if (finishReason && finishReason !== "STOP") {
    throw new Error(`Gemini: bloqueado (${finishReason})`);
  }

  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!raw) throw new Error("Gemini: sin texto en respuesta");
  return geminiAHtml(raw);
}

// Agrega el indicador de "pensando" al chat y devuelve su id
function agregarLoaderArbitro() {
  const chat = document.getElementById("chat-arbitro");
  const id = "loader-" + Date.now();
  const div = document.createElement("div");
  div.id = id;
  div.className = "mensaje-arbitro";
  div.innerHTML =
    `<strong>🃏 Árbitro:</strong> ` +
    `<span style="opacity:0.6;font-size:0.85em">Consultando Gemini…</span> ` +
    `<span class="loader-dots"><span></span><span></span><span></span></span>`;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return id;
}

// Reemplaza el loader con la respuesta y muestra el origen
function reemplazarLoaderArbitro(id, texto, origen) {
  const el = document.getElementById(id);
  if (!el) return;
  // origen: 'gemini' | 'local' | 'error'
  const badge =
    origen === "gemini"
      ? `<span class="badge-origen gemini">⚡ Gemini</span>`
      : origen === "error"
        ? `<span class="badge-origen error">⚠️ local</span>`
        : `<span class="badge-origen local">📵 offline</span>`;
  el.innerHTML = `<strong>🃏 Árbitro:</strong> ${badge} ${texto}`;
  document.getElementById("chat-arbitro").scrollTop = 99999;
}

async function enviarConsultaArbitro() {
  const input = document.getElementById("input-arbitro");
  const texto = input.value.trim();
  if (!texto) return;

  vibrar(20);
  agregarMensajeChat("usuario", texto);
  input.value = "";

  // Bloquear input mientras el árbitro piensa
  input.disabled = true;
  const btnEnviar = document.getElementById("btn-enviar-arbitro");
  btnEnviar.disabled = true;

  const idLoader = agregarLoaderArbitro();

  try {
    // No usamos navigator.onLine: en PWAs de Android puede devolver
    // false aunque haya internet. Intentamos la llamada directamente
    // y dejamos que el fetch falle si no hay red.
    const respuesta = await llamarGemini(texto);
    reemplazarLoaderArbitro(idLoader, respuesta, "gemini");
    vibrar(40);
  } catch (err) {
    console.warn("Arbitro fallback:", err.message);
    const esOffline = err instanceof TypeError || err.message.includes("fetch");
    reemplazarLoaderArbitro(
      idLoader,
      motorArbitro(texto),
      esOffline ? "local" : "error",
    );
    vibrar(40);
  } finally {
    input.disabled = false;
    btnEnviar.disabled = false;
  }
}

function agregarMensajeChat(remitente, texto) {
  const chat = document.getElementById("chat-arbitro");
  const div = document.createElement("div");
  div.className =
    remitente === "arbitro" ? "mensaje-arbitro" : "mensaje-usuario";

  if (remitente === "arbitro") {
    div.innerHTML = `<strong>🃏 Árbitro:</strong> ${texto}`;
  } else {
    div.innerHTML = `<strong>Vos:</strong> ${texto.replace(/</g, "&lt;")}`;
  }

  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

// ============================================================
// MOTOR DEL ÁRBITRO — FALLO PRIMERO, siempre
// ============================================================
function motorArbitro(consulta) {
  const c = consulta
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // ── HELPERS DE DETECCIÓN ─────────────────────────────────
  // tiene(): verdadero si al menos UNA de las frases está en la consulta
  const tiene = (...frases) => frases.some((f) => c.includes(f));
  // todas(): verdadero solo si TODAS las frases están en la consulta
  const todas = (...frases) => frases.every((f) => c.includes(f));

  // Canto ACEPTADO: formas explícitas de "quiero"/"acepto".
  // Se eliminó c.includes('si') que era falso positivo masivo
  // (casi cualquier frase en español contiene "si").
  const querido = () =>
    tiene("queri", "acepto", "bueno va") ||
    (tiene("quiero") && !tiene("no quiero", "no quier"));

  // Canto RECHAZADO
  const noQuerido = () =>
    tiene("no quiero", "no quier", "no queri", "no quise", "me fui al mazo");

  // Detectores de jugadas específicas
  // hayRealEnvido: requiere "real" en contexto de envido,
  // no solo la palabra "real" suelta.
  const hayRealEnvido = () =>
    tiene("real envido") ||
    (tiene("real") &&
      tiene("envido", "tanto", "canto", "tengo", "tenia", "pinta"));

  // hayFalta: requiere contexto explícito de envido para no
  // confundir "me falta una carta" con la jugada Falta Envido.
  const hayFalta = () =>
    tiene("falta envido") ||
    (tiene("falta") && tiene("envido", "quiero", "queri", "cuanto vale"));

  // hayTruco / hayRetruco: usa regex de palabra entera para que
  // "retruco" no active también la regla de truco simple.
  const hayTruco = () => /\btruco\b/.test(c) && !/\bretruco\b/.test(c);
  const hayRetruco = () => tiene("retruco");
  const hayValeCuatro = () => tiene("vale cuatro", "vale 4");
  const hayEnvido = () => tiene("envido");
  //

  // ── 1. SITUACIONES CRÍTICAS ─────────────────────────────────

  if (
    (tiene("mazo") && tiene("sin mostrar", "escondi")) ||
    (todas("no", "mostro", "mazo") && tiene("tanto", "carta"))
  ) {
    return (
      "<b>¡Marchó el que se fue al mazo escondiendo las cartas, los puntos van para el rival, papá!</b><br>" +
      "Escuchame bien, che: es obligatorio mostrar las cartas en la mesa al final de la mano para cobrar el envido. Si te vas al mazo ocultando el juego, le regalás los porotos al rival de prepo, aunque hayas cantado 33 de boca. El que se esconde, pierde."
    );
  }

  // SITUACIÓN: "Cantar el Envido tarde (Mano en juego)"
  if (
    c.includes("envido tarde") ||
    (c.includes("envido") &&
      (c.includes("tarde") ||
        c.includes("ya jugo") ||
        c.includes("ya tiraron")))
  ) {
    return (
      "<b>¡Marchaste por lento, ya no se puede cantar el envido, papá!</b><br>" +
      "Mirá, cortita y al pie: el envido solo se puede cantar antes de jugar tu primera carta en la primera mano. Si vos o tu compañero ya tiraron un naipe a la mesa, cagaron, la ventana del envido se cerró."
    );
  }

  // SITUACIÓN: "Mal cantado (tirar los tantos mal) / Revocado"
  if (
    c.includes("mal cantado") ||
    c.includes("canto mal") ||
    c.includes("canto de mas") ||
    c.includes("menti tantos") ||
    (c.includes("canto") && c.includes("tenia") && c.includes("mas"))
  ) {
    return (
      "<b>¡Perdés todos los puntos por mentiroso si tu rival te dijo quiero, papá!</b><br>" +
      "Si cantás de más (por ejemplo, tirás 30 y tenías 28 reales) y te dicen 'quiero', marchaste: al final de la mano, al mostrar las cartas, perdés los porotos del envido en el acto y se los lleva tu rival por revocado (mentiroso), aunque él tuviera menos que tus 28 reales. Si te dicen 'no quiero' zafás con el punto del no quiero, pero si te obligan a mostrar y mentiste, penalizás."
    );
  }

  // SITUACIÓN: "Cantar Envido cuando ya se cantó o jugó Truco"
  if (
    c.includes("envido") &&
    c.includes("truco") &&
    (c.includes("despues") ||
      c.includes("ya se canto") ||
      c.includes("antes del truco"))
  ) {
    return (
      "<b>¡Tarde para el envido, ya está el truco querido en juego y caducó tu tiempo, papá!</b><br>" +
      "Mirá, una vez que el Truco fue cantado y se aceptó ('quiero'), ya no hay vuelta atrás para los tantos. El envido se juega antes de meterse con los camiones del truco."
    );
  }

  // SITUACIÓN: "Se pasó de puntos (Gana el partido en el envido)"
  if (
    c.includes("paso de puntos") ||
    c.includes("gana en el envido") ||
    c.includes("envido corta") ||
    c.includes("corta el partido")
  ) {
    return (
      "<b>¡El envido corta el partido en el acto, papá!</b><br>" +
      "Prestá atención, che: los puntos del Envido se anotan y se cuentan siempre ANTES que los del Truco. Si alguno tiene 28 puntos, gana el Envido (suma 2 porotos) y llega a 30, el partido se termina ahí mismo. No me importa si tu rival tenía un 'Vale Cuatro' en la manga para ganar la mano de truco; el envido cobra primero y corta el juego."
    );
  }

  // SITUACIÓN: "Cantar una cosa por otra (Me equivoqué al cantar)"
  if (
    c.includes("cosa por otra") ||
    c.includes("me equivoque al cantar") ||
    c.includes("quise decir") ||
    c.includes("canté una cosa")
  ) {
    return (
      "<b>¡Palabra cantada, palabra santa, papá! Marchaste con lo que salió de tu boca.</b><br>" +
      "Che, no hay tutía acá. Si de los nervios quisiste decir 'Envido' pero gritaste 'Truco', te jodiste. En el truco vale lo que cantás al viento, no lo que tenías en la cabecita. A bancarse el grito."
    );
  }

  // SITUACIÓN: "Carta tocada o dada vuelta sin querer"
  if (
    c.includes("carta tocada") ||
    c.includes("se dio vuelta") ||
    c.includes("se resbalo") ||
    c.includes("sin querer")
  ) {
    return (
      "<b>¡Carta que tocó la mesa boca arriba, es carta jugada y a llorar a la iglesia, papá!</b><br>" +
      "Mirá, no me vengas con que 'se me resbaló' o 'fue sin querer'. Si el naipe tocó la mesa boca arriba, ya está quemado y es carta jugada. No la podés levantar más, prestá más atención."
    );
  }

  // SITUACIÓN: "Decir Son Buenas"
  if (
    c.includes("son buenas") ||
    c.includes("decir son buenas") ||
    c.includes("le dije son buenas")
  ) {
    return (
      "<b>¡Regalaste los porotos en el acto al decirle son buenas al rival, papá!</b><br>" +
      "Viste cómo es: si el rival te canta sus tantos y vos le decís 'son buenas' porque no le llegás, él se anota los puntos inmediatamente. No está obligado a mostrar las cartas en la mesa porque vos ya diste el brazo a torcer."
    );
  }

  // ── 2. FALTA ENVIDO (va ANTES de envido simple para no ser
  //    capturada por las reglas genéricas de envido) ────────────
  if (hayFalta()) {
    const pNos = puntosNos || 0;
    const pEllos = puntosEllos || 0;
    const limite = limitePuntos || 30;
    const mitad = limite / 2;
    const enMalas = pNos < mitad && pEllos < mitad;
    const puntero = Math.max(pNos, pEllos);
    const leFaltan = limite - puntero;

    if (noQuerido()) {
      return (
        `<b>Te llevás 1 poroto (o los tantos acumulados antes si hubo revirada) y a barajar, papá.</b><br>` +
        `Si no quieren la Falta Envido, se paga el escalón anterior o 1 punto si fue directa.`
      );
    }
    if (enMalas) {
      return (
        `<b>¡Ganás el partido entero (${limite} puntos) y a cobrar, papá!</b><br>` +
        `Como están ambos en las malas (NOS: ${pNos} — ELLOS: ${pEllos}), la Falta Envido querida vale el chico completo: ${limite} porotos. El de más tantos se lleva la victoria.`
      );
    }
    return (
      `<b>Son ${leFaltan} poroto${leFaltan !== 1 ? "s" : ""} para el que gane la Falta, papá.</b><br>` +
      `Como ya están en las buenas, la Falta Envido querida vale los puntos que le faltan para llegar a ${limite} al que va ganando (lidera con ${puntero} porotos, le faltan ${leFaltan}). ¡Se define todo!`
    );
  }

  // ── 3. ENVIDO Y REAL ENVIDO ──────────────────────────────
  // Orden: Real+Real → Envido+Real → Envido+Envido → solo Real → solo Envido

  // Real Envido + Real Envido
  if ((c.match(/\breal\b/g) || []).length >= 2) {
    if (noQuerido())
      return (
        "<b>Son 3 porotos para el que cantó primero, papá.</b><br>" +
        "Se asustó con el segundo Real Envido y no lo quiso, así que paga el escalón anterior de 3 porotos."
      );
    if (querido() || tiene("cuanto", "vale", "cuantos son"))
      return (
        "<b>Son 6 porotos para el que ponga los tantos en la mesa, papá.</b><br>" +
        "Dos Real Envido seguidos y queridos son 3 + 3 = 6 porotos limpios. El de más tantos festeja y el otro a llorar a la iglesia."
      );
  }

  // Envido + Real Envido (ambas jugadas en la misma mano)
  if (hayEnvido() && hayRealEnvido()) {
    if (noQuerido())
      return (
        "<b>Son 2 porotos para el que cantó primero, papá.</b><br>" +
        "Arrugaron al Real Envido, así que pagan solo lo querido del primer envido (2 porotos). Te la barata por pecho frío."
      );
    if (querido() || tiene("cuanto", "vale", "cuantos son"))
      return (
        "<b>Son 5 porotos para el que tenga más tantos en la mano, papá.</b><br>" +
        "La matemática no falla: tiraron envido (2) y le reviraron un Real Envido arriba (3). Como se aceptó, se juegan 5 porotos."
      );
  }

  // Envido + Envido
  if (hayEnvido() && (c.match(/\benvido\b/g) || []).length >= 2) {
    if (noQuerido())
      return (
        "<b>Son 2 porotos para el que cantó el primer envido, papá.</b><br>" +
        "El rival se achicó al segundo envido, así que te tiene que pagar el escalón anterior, que son 2 porotos. A anotarlos."
      );
    if (querido() || tiene("cuanto", "vale", "cuantos son"))
      return (
        "<b>Son 4 porotos para el que tenga mejor envido, papá.</b><br>" +
        "Cortita y al pie: metieron un envido (2) y le reviraron otro envido arriba (2 más). Como lo quisieron, hay 4 porotos en juego en la mesa."
      );
  }

  // Solo Real Envido (sin envido previo)
  if (hayRealEnvido()) {
    if (noQuerido())
      return (
        "<b>Son 3 porotos para el que cantó el Real Envido, papá.</b><br>" +
        "El rival no quiso pagar la apuesta, así que te llevás los 3 porotos de arriba y a barajar."
      );
    if (querido() || tiene("cuanto", "vale", "cuantos son"))
      return (
        "<b>Son 3 porotos para el ganador del Real Envido, papá.</b><br>" +
        "Lo quisieron de una, se juegan 3 puntos secos. Gana el de más tantos en la mesa."
      );
    return (
      "<b>El Real Envido vale 3 porotos, papá.</b><br>" +
      "Se canta en la primera mano antes de tirar carta. ¿Lo quisieron o no lo quisieron?"
    );
  }

  // Solo Envido
  if (hayEnvido()) {
    if (noQuerido())
      return (
        "<b>Es 1 poroto de arriba para el que cantó, papá.</b><br>" +
        "El otro arrugó al envido de una, así que te regala 1 punto para la libreta. ¡A barajar de nuevo!"
      );
    if (querido() || tiene("cuanto", "vale", "cuantos son"))
      return (
        "<b>Son 2 porotos para el que gane el envido, papá.</b><br>" +
        "Se cantó un solo envido y lo quisieron, así que son 2 puntos directos al marcador."
      );
    if (
      tiene(
        "como se calcula",
        "como se cuenta",
        "cuanto tengo",
        "cuantos tengo",
        "mis tantos",
        "cuanto me da",
      )
    )
      return (
        "<b>Contame las cartas que tenés y te digo los tantos en el acto, papá.</b><br>" +
        "Decime el valor y el palo de tus naipes y te hago la matemática criolla al toque, che."
      );
  }

  // ── 4. TRUCO, RETRUCO Y VALE CUATRO ──────────────────────
  // hayValeCuatro / hayRetruco / hayTruco usan detección precisa
  // para no confundir entre sí (ej: retruco no activa truco simple).

  // Vale Cuatro
  if (hayValeCuatro()) {
    if (noQuerido())
      return (
        "<b>Son 3 porotos para el que cantó el Vale Cuatro, papá.</b><br>" +
        "El rival se tiró al mazo en el último piso, así que cobrás el escalón anterior, que son 3 porotos (el Retruco)."
      );
    return (
      "<b>Son 4 porotos para el que gane las cartas, papá.</b><br>" +
      "Se pudrió todo en la mesa: cantaron Vale Cuatro y lo aceptaron. El que gane 2 de 3 manos se lleva los 4 porotos."
    );
  }

  // Retruco
  if (hayRetruco()) {
    if (noQuerido())
      return (
        "<b>Son 2 porotos para el que cantó el Retruco, papá.</b><br>" +
        "El otro arrugó antes de las papas quemadas, así que te paga los 2 porotos del Truco querido."
      );
    return (
      "<b>Son 3 porotos para el ganador de la mano, papá.</b><br>" +
      "Se cantó Retruco y lo quisieron, hay 3 porotos en juego. A mostrar quién tiene más naipes de peso."
    );
  }

  // Truco simple (regex \btruco\b excluye retruco)
  if (hayTruco()) {
    if (noQuerido())
      return (
        "<b>Es 1 poroto de arriba para el que cantó Truco, papá.</b><br>" +
        "El rival arrugó al truco inicial y te regala 1 punto. A juntar las cartas y dar de nuevo."
      );
    if (querido() || tiene("cuanto", "vale", "cuantos son", "acepto"))
      return (
        "<b>Son 2 porotos para el que gane las manos de cartas, papá.</b><br>" +
        "Aceptaron el Truco a secas, se juegan 2 puntos. ¡A tirar naipes a la mesa!"
      );
  }

  // ── BLOQUE REEMPLAZADO — las siguientes reglas continúan igual ──
  // Vale Cuatro no querido (bloque legacy eliminado, cubierto arriba)
  if (false) {
    return (
      "<b>Son 3 porotos para el que cantó el Vale Cuatro, papá.</b><br>" +
      "El rival se tiró al mazo en el último piso, así que cobrás el escalón anterior, que son 3 porotos (el Retruco)."
    );
  }

  // (bloques de truco/retruco legacy eliminados, cubiertos por hayTruco/hayRetruco arriba)

  // ── 5. PARDAS / EMPATES ──────────────────────────────────
  if (c.includes("parda") || c.includes("empat") || c.includes("empatan")) {
    const esPrimera = c.includes("primer") || c.includes("primera");
    const esSegunda = c.includes("segund") || c.includes("segunda");
    const esTercera = c.includes("tercer") || c.includes("tercera");
    const tresPardas =
      c.includes("tres") ||
      c.includes("todas") ||
      (esPrimera && esSegunda && esTercera);

    if (tresPardas) {
      return (
        "<b>¡Gana la mano de truco el jugador que es MANO, papá!</b><br>" +
        "Escuchá bien, che: si se empatan las tres manos de corrido, la ronda se la lleva el que salió jugando el chico primero por ser MANO. Anotate los porotos."
      );
    }
    if (esPrimera && esSegunda) {
      return (
        "<b>¡Define la tercera mano de cartas a cara de perro, papá!</b><br>" +
        "Empataron primera y empataron segunda, así que el que gane la tercera mano se lleva los porotos. Si también empatan la tercera, gana el MANO."
      );
    }
    if (esPrimera && !esSegunda) {
      return (
        "<b>¡Define la segunda mano de cartas, papá!</b><br>" +
        "Como la primera mano fue parda, el que gane la segunda mano se queda con el Truco. Cortita y al pie."
      );
    }
    if (esSegunda && !esPrimera) {
      return (
        "<b>¡Gana el que se llevó la primera mano de cartas, papá!</b><br>" +
        "Como ganaste la primera mano y empataron la segunda, ya ganaste la ronda de truco. Un empate después de ganar te mantiene arriba."
      );
    }
    return (
      "<b>Define la regla de la parda, papá.</b><br>" +
      "Mirá, las cosas son así, viste: primera parda define la segunda. Primera y segunda parda define la tercera. Las tres pardas de corrido se las lleva el MANO."
    );
  }

  // ── 6. COMPARACIÓN Y JERARQUÍA DE CARTAS ─────────────────
  // Requiere que haya AL MENOS un palo o carta específica en la consulta
  // para no dispararse con cualquier pregunta que diga "gana".
  const hayContextoCarta = () =>
    tiene("espada", "basto", "copa", "oro", "ancho", "macho", "hembra") ||
    /\b(1|2|3|4|5|6|7|10|11|12)\s*(de|y)/.test(c) ||
    tiene("naipe", "carta");

  if (
    hayContextoCarta() &&
    tiene(
      "gana",
      "quien pica",
      "cual vale mas",
      "carta mas alta",
      "carta mas fuerte",
      "quien tira",
      "le gana",
    )
  ) {
    if (tiene("espada") && tiene("1", "as", "ancho", "macho")) {
      return (
        "<b>¡Gana el 1 de espadas, papá!</b><br>" +
        "El Macho es el rey indiscutible del truco, che. No existe carta en todo el mazo que lo tape, jugalo de cabeza."
      );
    }
    if (tiene("basto") && tiene("1", "as", "ancho", "hembra")) {
      return (
        "<b>¡Gana el 1 de bastos, papá!</b><br>" +
        "La Hembra va segunda en la jerarquía del mazo. Solo la corta el 1 de espadas (El Macho). Con esta carta te comés a casi todos."
      );
    }
    if (tiene("7") && tiene("espada") && tiene("oro")) {
      return (
        "<b>¡Gana el 7 de espadas sobre el 7 de oro, papá!</b><br>" +
        "Tercera contra cuarta carta del mazo. El 7 de espadas pica al de oro siempre, no los confundas."
      );
    }
    if (tiene("3") && tiene("2", "dos")) {
      return (
        "<b>¡El 3 le gana al 2, papá!</b><br>" +
        "En las cartas comunes, todos los 3 van quinto en la jerarquía y pican a todos los 2. El palo no importa."
      );
    }
    // Comparación genérica de cartas
    return (
      "<b>Contame qué cartas querés comparar y te digo cuál pica, papá.</b><br>" +
      "Decime el número y el palo de ambas y te dicto el veredicto al toque."
    );
  }

  // Jerarquía completa
  if (
    c.includes("jerarquia") ||
    c.includes("orden de cartas") ||
    c.includes("lista de cartas") ||
    c.includes("todas las cartas") ||
    (c.includes("explicame") && c.includes("carta"))
  ) {
    return (
      "<b>El orden de cartas va de mayor a menor, papá.</b><br>" +
      "Mirá, bajate el reglamento de la cabeza: 1️⃣ 1 de espadas (El Macho) → 2️⃣ 1 de bastos (La Hembra) → 3️⃣ 7 de espadas → 4️⃣ 7 de oro → ⑤ Todos los 3 → ⑥ Todos los 2 → ⑦ 1 de copas y oro (falsos) → ⑧ Todos los 12, 11, 10 → ⑨ 7 de copas y bastos (falsos) → ⑩ 6s, 5s y los 4s (que son lo peor de la mesa). ¿Qué cartas querés comparar, che?"
    );
  }

  // ── 6. CÁLCULO DE TANTOS ──────────────────────────────────
  if (
    (c.includes("explicame") ||
      c.includes("como se calcula") ||
      c.includes("como se cuenta")) &&
    (c.includes("envido") || c.includes("tanto"))
  ) {
    return (
      "<b>Los tantos se calculan según las cartas del mismo palo, papá.</b><br>" +
      "Te lo explico cortita y al pie, viste: si tenés dos cartas del mismo palo, sumás 20 + el valor de las cartas (las figuras 10, 11 y 12 valen 0). Si tenés tres del mismo palo, agarrás las dos más altas y sumás. Si son de palos distintos, vale solo el valor de la carta más alta (sin sumar 20)."
    );
  }
  if (
    c.includes("cuanto tengo") ||
    c.includes("cuantos tengo") ||
    c.includes("cuanto me da") ||
    c.includes("mis tantos") ||
    (c.includes("cuanto") && c.includes("tanto"))
  ) {
    return (
      "<b>Contame las cartas que tenés y te digo los tantos en el acto, papá.</b><br>" +
      "Decime el valor y el palo de tus naipes y te hago la matemática criolla al toque, che."
    );
  }
  if (
    c.includes("33") ||
    ((c.includes("maximo") || c.includes("maxima")) && c.includes("envido"))
  ) {
    return (
      "<b>El máximo posible de envido es 33, papá.</b><br>" +
      "Necesitás un 7 y un 3 del mismo palo (ejemplo: 7 de espadas y 3 de espadas). Hacés 20 + 7 + 3 = 33. Imbatible, el que lo tiene duerme tranquilo."
    );
  }

  // ── 7. FLOR ──────────────────────────────────────────────
  if (c.includes("flor")) {
    const juegaConFlor = document.getElementById("check-flor")?.checked;
    if (!juegaConFlor) {
      return (
        "<b>¡Están jugando SIN flor en esta partida, papá!</b><br>" +
        "Ojo con la configuración de la mesa: el que cante flor en esta ronda marcha preso y pierde los puntos de la mano automáticamente por pecho frío. ¡Avisados!"
      );
    }
    if (c.includes("contraflor al rest") || c.includes("contra flor al rest")) {
      return (
        "<b>¡Se juega el partido entero si se quiere la Contraflor al Resto, papá!</b><br>" +
        "Es todo o nada: el que gane la contraflor se lleva el chico completo de 30 porotos."
      );
    }
    if (c.includes("contraflor") || c.includes("contra flor")) {
      return (
        "<b>Gana el que tenga más tantos de flor en la mesa, papá.</b><br>" +
        "Contraflor vs Contraflor, se muestran las tres cartas y el que sume más porotos de flor cobra. Contame cuánto tienen y te digo quién pica."
      );
    }
    if (
      c.includes("se olvido") ||
      c.includes("no canto") ||
      c.includes("no la canto") ||
      c.includes("ya jugo")
    ) {
      return (
        "<b>Perdió la flor por lento, papá.</b><br>" +
        "Si ya jugó una carta sin haber cantado 'Flor', la ventana caducó. La flor se canta obligatoriamente antes de tirar el primer naipe de la primera mano."
      );
    }
    return (
      "<b>La flor son tres cartas del mismo palo y se canta en la primera mano, papá.</b><br>" +
      "Quien tenga flor está obligado a cantarla antes de tirar su primera carta. Si se te pasa la jugada, la perdiste."
    );
  }

  // ── 8. AL MAZO (IRSE) ─────────────────────────────────────
  if (
    c.includes("al mazo") ||
    c.includes("se fue al mazo") ||
    c.includes("irse al mazo")
  ) {
    const teniaAlgo =
      c.includes("truco") ||
      c.includes("envido") ||
      c.includes("real") ||
      c.includes("retruco") ||
      c.includes("vale cuatro");
    if (teniaAlgo) {
      return (
        "<b>El que se va al mazo pierde los puntos que estaban en juego, papá.</b><br>" +
        "Si ya había cantos de por medio, el rival cobra el escalón anterior al último grito. Decime qué se había cantado y te saco la cuenta, che."
      );
    }
    return (
      "<b>Es 1 poroto de truco para el rival, papá.</b><br>" +
      "Se fue al mazo sin que hubiera nada cantado en la mesa, así que cede 1 poroto directo. A barajar y dar de nuevo."
    );
  }

  // ── 9. MANO / QUIÉN EMPIEZA ───────────────────────────
  if (
    tiene("quien es mano", "soy mano", "es mano", "ser mano") ||
    tiene("quien empieza", "quien sale primero", "el mano", "mano en esta")
  ) {
    return (
      "<b>El MANO es el jugador que reparte y juega primero en la primera mano, papá.</b><br>" +
      "Ser MANO tiene ventaja en las pardas: si se empatan las tres manos, el MANO gana el truco. En las rondas siguientes rota, y quien fue MANO última vez pasa a ser contramano."
    );
  }

  // ── 10. SALUDOS Y EXPRESIONES ────────────────────────
  if (
    c.includes("hola") ||
    c.includes("buenas") ||
    c.includes("buen dia") ||
    c.includes("como estas")
  ) {
    return (
      "<b>¡Buenas, papá! El Árbitro está listo en la mesa con el reglamento oficial.</b><br>" +
      "Decime qué quilombo se armó en el asado —jerarquía de cartas, envidos, pardas o truco— y te dicto el fallo al toque, che."
    );
  }
  if (
    c.includes("gracias") ||
    c.includes("ok") ||
    c.includes("entendi") ||
    tiene("dale gracias", "de nada", "joya")
  ) {
    return (
      "<b>De nada, maestro. A jugar limpio y no sean pechos fríos. 🃏</b><br>" +
      "Cualquier otra discusión que se arme me chiflás y la cobramos."
    );
  }
  if (
    c.includes("negro") ||
    c.includes("pelotud") ||
    c.includes("cagad") ||
    c.includes("mal arbitro") ||
    c.includes("te equivocas")
  ) {
    return (
      "<b>¡Che, guardá los modales que acá el silbato lo tengo yo, papá!</b><br>" +
      "El reglamento de la mesa habla por mí. Si creés que me equivoqué, contame la situación exacta con los porotos y naipes, y lo arreglamos de caballero."
    );
  }

  // Fallback canchero
  const fallbacks = [
    "<b>Pará la mano, che. No entendí el quilombo en la mesa.</b><br>Decime con las palabras justas qué cantaron, qué respondieron y quién tiene los naipes, y te canto la posta al toque.",
    "<b>Necesito más datos de la jugada, papá.</b><br>Contame qué cartas se jugaron, qué mano están disputando o cuántos porotos hay en juego y te dicto el veredicto.",
    "<b>No me vengas con parrafadas raras, maestro. ¿Truco, envido o parda?</b><br>Decime el tema puntual y te resuelvo el dilema cortita y al pie.",
    "<b>Mirá, tirame la situación exacta de la mesa.</b><br>¿Qué se cantó y qué dijo el otro? Con eso te digo quién marcha preso y quién festeja.",
  ];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}
