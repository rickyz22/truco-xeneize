let puntosNos = 0; 
let puntosEllos = 0;
let segundos = 0;
let cronometroIntervalo = null; 
let corriendo = false;
let wakeLock = null; 
const limitePuntos = 30;

let audioContext = null;

function vibrar(ms = 30) { 
    if (navigator.vibrate) navigator.vibrate(ms); 
}

function playBeep() {
    const sonidoHabilitado = localStorage.getItem('show-sonido') !== 'false';
    if (!sonidoHabilitado) return;

    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }

        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);

        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.1);
    } catch {}
}

async function activarWakeLock() {
    try { 
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
        }
    } catch {}
}

// 🔥 REACTIVAR WAKELOCK
document.addEventListener('visibilitychange', async () => {
    if (wakeLock !== null && document.visibilityState === 'visible') {
        await activarWakeLock();
    }
});

function guardarProgreso() {
    localStorage.setItem('puntosNos', puntosNos);
    localStorage.setItem('puntosEllos', puntosEllos);
    localStorage.setItem('segundos', segundos);
}

function comenzarJuego() {
    vibrar();
    activarWakeLock();
    localStorage.setItem('partidaIniciada', 'true');
    mostrarPantallaJuego();
}

function mostrarPantallaJuego() {
    document.getElementById('pantalla-inicio').style.display = 'none';
    document.getElementById('contenido-juego').style.display = 'block';
    actualizarInterfaz();
}

function toggleCronometro() {
    vibrar();

    const icono = document.getElementById('icono-play');
    const btn = document.getElementById('btn-play-pause');

    if (!corriendo) {
        cronometroIntervalo = setInterval(() => { 
            segundos++; 
            mostrarTiempo(); 
            guardarProgreso();
        }, 1000);

        icono.innerText = "pause";
        btn.style.background = "#ff4444"; 
        btn.style.color = "white";
        corriendo = true;

    } else {
        clearInterval(cronometroIntervalo);

        icono.innerText = "play_arrow";
        btn.style.background = "#ffcc00"; 
        btn.style.color = "#003b70";
        corriendo = false;
    }
}

function mostrarTiempo() {
    let min = Math.floor(segundos / 60); 
    let seg = segundos % 60;

    document.getElementById('cronometro').innerText =
        `${min.toString().padStart(2,'0')}:${seg.toString().padStart(2,'0')}`;
}

function resetearCronometro() {
    vibrar();
    clearInterval(cronometroIntervalo);
    cronometroIntervalo = null; 
    segundos = 0; 
    corriendo = false;

    mostrarTiempo();
    guardarProgreso();

    document.getElementById('icono-play').innerText = "play_arrow";

    const btn = document.getElementById('btn-play-pause');
    btn.style.background = "#ffcc00"; 
    btn.style.color = "#003b70";
}

// 🔥 BLOQUEO SI YA GANÓ
function juegoTerminado() {
    return puntosNos >= limitePuntos || puntosEllos >= limitePuntos;
}

function sumar(equipo) {
    if (juegoTerminado()) return;

    vibrar();
    playBeep();

    if (equipo === 'nos' && puntosNos < limitePuntos) puntosNos++;
    if (equipo === 'ellos' && puntosEllos < limitePuntos) puntosEllos++;

    actualizarInterfaz();
    guardarProgreso();
}

function restar(equipo) {
    if (juegoTerminado()) return;

    vibrar();
    playBeep();

    if (equipo === 'nos' && puntosNos > 0) puntosNos--;
    if (equipo === 'ellos' && puntosEllos > 0) puntosEllos--;

    actualizarInterfaz();
    guardarProgreso();
}

function actualizarInterfaz() {
    document.getElementById('num-nos').innerText = puntosNos;
    document.getElementById('num-ellos').innerText = puntosEllos;

    document.getElementById('palitos-nos').innerHTML = dibujarPalitos(puntosNos);
    document.getElementById('palitos-ellos').innerHTML = dibujarPalitos(puntosEllos);

    if (juegoTerminado()) {
        clearInterval(cronometroIntervalo);

        let ganador = puntosNos >= limitePuntos ? "NOSOTROS" : "ELLOS";

        vibrar(200); // vibración de victoria 🔥

        guardarEnHistorial(ganador);

        mostrarModal("¡GANARON!", `El equipo de ${ganador} se lleva la gloria.`, false);
    }
}

function mostrarModal(titulo, mensaje, esConfirmacion, accion) {
    const modal = document.getElementById('modal-custom');

    document.getElementById('modal-titulo').innerText = titulo;
    document.getElementById('modal-mensaje').innerText = mensaje;

    const btnBox = document.getElementById('modal-botones');
    btnBox.innerHTML = '';

    if (esConfirmacion) {
        let btnNo = document.createElement('button');
        btnNo.innerText = 'VOLVER';
        btnNo.className = 'btn-modal-cancelar';
        btnNo.onclick = () => modal.style.display = 'none';

        let btnSi = document.createElement('button');
        btnSi.innerText = 'REINICIAR';
        btnSi.className = 'btn-modal-confirmar';
        btnSi.onclick = () => { if(accion) accion(); modal.style.display = 'none'; };

        btnBox.append(btnNo, btnSi);

    } else {
        let btnOk = document.createElement('button');
        btnOk.innerText = '¡VAMOS!';
        btnOk.className = 'btn-modal-confirmar';
        btnOk.onclick = () => { reiniciarTotalmente(); modal.style.display = 'none'; };

        btnBox.append(btnOk);
    }

    modal.style.display = 'flex';
}

function reiniciar() {
    vibrar();
    mostrarModal("¿NUEVA PARTIDA?", "¿Borrar puntos y tiempo?", true, reiniciarTotalmente);
}

function reiniciarTotalmente() {
    puntosNos = 0; 
    puntosEllos = 0;

    localStorage.removeItem('partidaIniciada');

    resetearCronometro();
    actualizarInterfaz();
}

function guardarEnHistorial(ganador) {
    let historial = JSON.parse(localStorage.getItem('historial') || '[]');

    historial.push({
        fecha: new Date().toISOString(),
        ganador,
        puntosNos,
        puntosEllos,
        tiempo: segundos
    });

    if (historial.length > 10) historial.shift();

    localStorage.setItem('historial', JSON.stringify(historial));
}

function mostrarHistorial() {
    const lista = document.getElementById('lista-historial');
    lista.innerHTML = '';

    const historial = JSON.parse(localStorage.getItem('historial') || '[]');

    if (historial.length === 0) {
        lista.innerHTML = '<p>No hay partidas guardadas.</p>';
        return;
    }

    historial.forEach(p => {
        const div = document.createElement('div');
        div.className = 'partida-historial';

        const fecha = new Date(p.fecha).toLocaleString();

        div.innerHTML =
            `<p>${fecha} - Ganó ${p.ganador} (${p.puntosNos}-${p.puntosEllos})</p>`;

        lista.appendChild(div);
    });
}

function reiniciarHistorial() {
    vibrar();
    localStorage.removeItem('historial');
    mostrarHistorial();
}

function dibujarPalitos(puntos) {
    let html = '<div class="grupo-15">';

    for (let i = 0; i < puntos; i++) {
        if (i === 15) html += '</div><div class="grupo-15">';

        if (i % 5 === 0) html += '<div class="cuadradito">';

        html += `<img src="fosforo.png" class="fosforo p${(i % 5) + 1}">`;

        if (i % 5 === 4 || i === puntos - 1) html += '</div>';
    }

    return html + '</div>';
}

function abrirConfiguracion() {
    document.getElementById('pantalla-inicio').style.display = 'none';
    document.getElementById('contenido-juego').style.display = 'none';
    document.getElementById('pantalla-config').style.display = 'flex';

    mostrarHistorial();
}

function cerrarConfig() {
    vibrar();

    document.getElementById('pantalla-config').style.display = 'none';

    if (localStorage.getItem('partidaIniciada')) {
        document.getElementById('contenido-juego').style.display = 'block';
    } else {
        document.getElementById('pantalla-inicio').style.display = 'flex';
    }
}

function volverInicio() {
    vibrar();

    document.getElementById('contenido-juego').style.display = 'none';
    document.getElementById('pantalla-inicio').style.display = 'flex';
}

function cambiarEstilo(equipo) {
    document.body.className = equipo === 'boca' ? '' : 'tema-' + equipo;
    localStorage.setItem('equipo', equipo);
}

function toggleElemento(tipo) {
    const el = document.getElementById(`check-${tipo}`);
    if (!el) return;

    const activo = el.checked;

    if (tipo === 'crono') {
        document.getElementById('cont-crono').style.display = activo ? 'flex' : 'none';
    } 
    else if (tipo === 'num') {
        document.getElementById('cont-nos').style.display = activo ? 'flex' : 'none';
        document.getElementById('cont-ellos').style.display = activo ? 'flex' : 'none';
    }
    else if (tipo === 'sonido') {
        document.getElementById('icon-sonido').innerText = activo ? 'volume_up' : 'volume_off';
    }

    localStorage.setItem(`show-${tipo}`, activo);
    vibrar();
}

window.onload = () => {

    const equipo = localStorage.getItem('equipo');
    if (equipo) cambiarEstilo(equipo);

    if (localStorage.getItem('partidaIniciada')) {
        puntosNos = parseInt(localStorage.getItem('puntosNos') || 0);
        puntosEllos = parseInt(localStorage.getItem('puntosEllos') || 0);
        segundos = parseInt(localStorage.getItem('segundos') || 0);

        mostrarTiempo();
        mostrarPantallaJuego(); // 🔥 FIX
    }

    ['crono','num','sonido'].forEach(tipo => {
        const estado = localStorage.getItem(`show-${tipo}`);

        if (estado !== null) {
            const el = document.getElementById(`check-${tipo}`);

            if (el) {
                el.checked = JSON.parse(estado);

                if (tipo === 'sonido') {
                    document.getElementById('icon-sonido').innerText =
                        el.checked ? 'volume_up' : 'volume_off';
                } else {
                    toggleElemento(tipo);
                }
            }
        }
    });
};
