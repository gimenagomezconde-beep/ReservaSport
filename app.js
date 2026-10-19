
const botonesDeporte = document.querySelectorAll("[data-sport]");

const CLAVE_SESION = "reservasport_demo_sesion";
const CLAVE_DEPORTE = "reservasport_deporte";

function obtenerSesion() {
    try {
        return JSON.parse(
            localStorage.getItem(CLAVE_SESION) || "null"
        );
    } catch (error) {
        return null;
    }
}

botonesDeporte.forEach(function (boton) {
    boton.addEventListener("click", function () {
        const deporte = boton.dataset.sport;
        const sesion = obtenerSesion();

        // Recordar el deporte seleccionado.
        localStorage.setItem(CLAVE_DEPORTE, deporte);

        // Si no inició sesión, ir al login.
        if (!sesion) {
            window.location.href = "login.html";
            return;
        }

        // Si inició sesión, ir a las reservas.
        window.location.href = "reservas.html";
    });
});

console.log("ReservaSport: página principal lista.");
