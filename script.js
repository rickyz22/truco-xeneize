let puntosNos = 0;
let puntosEllos = 0;

function vibrar() {
    if (navigator.vibrate) {
        navigator.vibrate(50); // Vibración cortita al tocar
    }
}

function cambiarPuntos(equipo, valor) {
    vibrar();
    let timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    if (equipo === 'nos') {
        if (puntosNos + valor >= 0 && puntosNos + valor <= 30) {
            puntosNos += valor;
            document.getElementById('puntosNos').innerText = puntosNos;
            agregarHistorial(`[${timestamp}] NOS: ${valor > 0 ? '+' : ''}${valor} (Total: ${puntosNos})`, 'historial-nos');
        }
    } else {
        if (puntosEllos + valor >= 0 && puntosEllos + valor <= 30) {
            puntosEllos += valor;
            document.getElementById('puntosEllos').innerText = puntosEllos;
            agregarHistorial(`[${timestamp}] ELLOS: ${valor > 0 ? '+' : ''}${valor} (Total: ${puntosEllos})`, 'historial-ellos');
        }
    }
    
    checkGanador();
}

function agregarHistorial(texto, clase) {
    const log = document.getElementById('historial');
    const item = document.createElement('div');
    item.className = 'historial-item ' + clase;
    item.innerText = texto;
    log.prepend(item); // El movimiento más nuevo sale arriba
}

function checkGanador() {
    if (puntosNos === 30) {
        alert("¡GANAMOS NOSOTROS! ¡DALE BOOO!");
        reiniciarSinConfirmar();
    } else if (puntosEllos === 30) {
        alert("Ganaron ellos... a comerla.");
        reiniciarSinConfirmar();
    }
}

function reiniciar() {
    if (confirm("¿Querés reiniciar el partido?")) {
        reiniciarSinConfirmar();
    }
}

function reiniciarSinConfirmar() {
    puntosNos = 0;
    puntosEllos = 0;
    document.getElementById('puntosNos').innerText = 0;
    document.getElementById('puntosEllos').innerText = 0;
    document.getElementById('historial').innerHTML = '<div class="historial-item">Partido reiniciado.</div>';
}
