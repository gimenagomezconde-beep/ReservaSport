import { app, db } from "./firebase-config.js";

import {
    getAuth,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
    collection,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    writeBatch,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const auth = getAuth(app);

// Sesión
const CLAVE_SESION = "reservasport_demo_sesion";

// UID principal actual.
// Si tu administrador principal es otra cuenta, este UID debe coincidir.
const UID_ADMINISTRADOR_PRINCIPAL =
    "31UICugjxzgwH3j5T517JsXbSFIX";

// Elementos del panel
const saludoAdmin = document.getElementById("admin-saludo");
const mensajeAdmin = document.getElementById("admin-mensaje");
const tablaReservas = document.getElementById("tabla-reservas");

const filtroTexto = document.getElementById("filtro-texto");
const filtroDeporte = document.getElementById("filtro-deporte");
const filtroFecha = document.getElementById("filtro-fecha");
const filtroEstado = document.getElementById("filtro-estado");

const tablaSolicitudes =
    document.getElementById("tabla-solicitudes");

const mensajeSolicitudes =
    document.getElementById("mensaje-solicitudes");

const botonActualizarSolicitudes =
    document.getElementById("actualizar-solicitudes");

let sesionAdmin = null;
let accesoPermitido = false;
let reservasActuales = [];

// --------------------------------------------------
// MENSAJES
// --------------------------------------------------

function mostrarMensaje(texto) {
    if (mensajeAdmin) {
        mensajeAdmin.textContent = texto;
    }
}

function mostrarMensajeSolicitudes(texto) {
    if (mensajeSolicitudes) {
        mensajeSolicitudes.textContent = texto;
    }
}

// --------------------------------------------------
// VERIFICAR ADMINISTRADOR
// --------------------------------------------------

async function verificarAdministrador(usuario) {
    if (!usuario) {
        localStorage.removeItem(CLAVE_SESION);
        window.location.replace("login.html");
        return false;
    }

    const referenciaPerfil = doc(db, "usuarios", usuario.uid);
    const resultadoPerfil = await getDoc(referenciaPerfil);

    if (!resultadoPerfil.exists()) {
        await signOut(auth);
        localStorage.removeItem(CLAVE_SESION);
        window.location.replace("login.html");
        return false;
    }

    const perfil = resultadoPerfil.data();

    if (perfil.rol !== "administrador") {
        localStorage.removeItem(CLAVE_SESION);

        alert("Acceso denegado. Esta cuenta no es administradora.");

        window.location.replace("reservas.html");
        return false;
    }

    sesionAdmin = {
        uid: usuario.uid,
        email: usuario.email,
        nombre: perfil.nombre || usuario.email,
        rol: perfil.rol
    };

    localStorage.setItem(
        CLAVE_SESION,
        JSON.stringify(sesionAdmin)
    );

    if (saludoAdmin) {
        saludoAdmin.textContent =
            "Bienvenido/a, " + sesionAdmin.nombre;
    }

    console.log("Administrador conectado:", {
        uid: sesionAdmin.uid,
        email: sesionAdmin.email,
        rol: sesionAdmin.rol
    });

    console.log(
        "¿Es administrador principal?",
        sesionAdmin.uid === UID_ADMINISTRADOR_PRINCIPAL
    );

    accesoPermitido = true;
    return true;
}

// --------------------------------------------------
// CELDAS SEGURAS
// --------------------------------------------------

function crearCelda(valor) {
    const celda = document.createElement("td");

    celda.textContent =
        valor !== undefined && valor !== null && valor !== ""
            ? String(valor)
            : "-";

    return celda;
}

// --------------------------------------------------
// FORMATEAR FECHA
// --------------------------------------------------

function formatearFecha(fecha) {
    if (!fecha) return "-";

    const partes = String(fecha).split("-");

    if (partes.length !== 3) {
        return String(fecha);
    }

    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

// --------------------------------------------------
// LEER RESERVAS
// --------------------------------------------------

async function leerTodasLasReservas() {
    const resultado = await getDocs(
        collection(db, "reservas")
    );

    reservasActuales = resultado.docs.map(documento => ({
        id: documento.id,
        ...documento.data()
    }));

    return reservasActuales;
}

// --------------------------------------------------
// CAMBIAR ESTADO DE UNA RESERVA
// --------------------------------------------------

async function cambiarEstadoReserva(idReserva, nuevoEstado) {
    if (!accesoPermitido) return;

    const accion = nuevoEstado === "Confirmada"
        ? "confirmar"
        : "cancelar";

    if (!window.confirm(`¿Deseas ${accion} esta reserva?`)) {
        return;
    }

    try {
        const referenciaReserva = doc(
            db,
            "reservas",
            idReserva
        );

        const resultadoReserva = await getDoc(referenciaReserva);

        if (!resultadoReserva.exists()) {
            alert("La reserva ya no existe en Firebase.");
            await mostrarReservasAdmin();
            return;
        }

        await updateDoc(referenciaReserva, {
            estado: nuevoEstado,
            actualizadoEn: serverTimestamp()
        });

        alert(
            nuevoEstado === "Confirmada"
                ? "¡Reserva confirmada correctamente!"
                : "La reserva se canceló correctamente."
        );

        await mostrarReservasAdmin();

    } catch (error) {
        console.error("Error al actualizar reserva:", error);

        alert(
            error.code === "permission-denied"
                ? "Firestore rechazó la actualización. Revisa las reglas."
                : "No se pudo actualizar la reserva. Revisa la consola."
        );
    }
}

// --------------------------------------------------
// MOSTRAR RESERVAS
// --------------------------------------------------

async function mostrarReservasAdmin() {
    if (!accesoPermitido) return;

    if (
        !tablaReservas ||
        !mensajeAdmin ||
        !filtroTexto ||
        !filtroDeporte ||
        !filtroFecha ||
        !filtroEstado
    ) {
        console.error(
            "Faltan elementos del panel en administrador.html."
        );
        return;
    }

    mostrarMensaje("Cargando reservas desde Firestore...");

    try {
        const todas = await leerTodasLasReservas();

        const confirmadas = todas.filter(
            reserva => reserva.estado === "Confirmada"
        );

        const canceladas = todas.filter(
            reserva => reserva.estado === "Cancelada"
        );

        const total = document.getElementById("total-reservas");
        const totalConfirmadas =
            document.getElementById("total-confirmadas");
        const totalCanceladas =
            document.getElementById("total-canceladas");

        if (total) total.textContent = todas.length;

        if (totalConfirmadas) {
            totalConfirmadas.textContent = confirmadas.length;
        }

        if (totalCanceladas) {
            totalCanceladas.textContent = canceladas.length;
        }

        const texto = filtroTexto.value.trim().toLowerCase();
        const deporte = filtroDeporte.value;
        const fecha = filtroFecha.value;
        const estado = filtroEstado.value;

        const filtradas = todas.filter(reserva => {
            const nombre = String(
                reserva.nombre || ""
            ).toLowerCase();

            const correo = String(
                reserva.email || ""
            ).toLowerCase();

            const deporteReserva = String(
                reserva.deporte || ""
            ).toLowerCase();

            return (
                (
                    !texto ||
                    nombre.includes(texto) ||
                    correo.includes(texto) ||
                    deporteReserva.includes(texto)
                ) &&
                (!deporte || reserva.deporte === deporte) &&
                (!fecha || reserva.fecha === fecha) &&
                (!estado || reserva.estado === estado)
            );
        });

        tablaReservas.replaceChildren();

        if (filtradas.length === 0) {
            mostrarMensaje(
                todas.length === 0
                    ? "No hay reservas registradas en Firestore."
                    : "No se encontraron reservas con esos filtros."
            );
            return;
        }

        mostrarMensaje(
            `Se muestran ${filtradas.length} de ${todas.length} reservas.`
        );

        filtradas.forEach(reserva => {
            const fila = document.createElement("tr");

            const numero = String(reserva.id)
                .slice(-6)
                .padStart(6, "0");

            fila.append(
                crearCelda("RS-" + numero),
                crearCelda(reserva.nombre),
                crearCelda(reserva.email),
                crearCelda(reserva.deporte),
                crearCelda(reserva.cancha),
                crearCelda(formatearFecha(reserva.fecha)),
                crearCelda(reserva.horario)
            );

            const celdaEstado = crearCelda(reserva.estado);

            celdaEstado.className =
                reserva.estado === "Confirmada"
                    ? "estado-confirmada"
                    : "estado-cancelada";

            fila.appendChild(celdaEstado);

            const celdaAccion = document.createElement("td");
            const boton = document.createElement("button");

            boton.type = "button";
            boton.className = "admin-boton";

            if (reserva.estado === "Confirmada") {
                boton.textContent = "Cancelar";
                boton.style.background = "#ffeded";
                boton.style.color = "#d93636";

                boton.addEventListener("click", () => {
                    cambiarEstadoReserva(
                        reserva.id,
                        "Cancelada"
                    );
                });
            } else {
                boton.textContent = "Confirmar";
                boton.style.background = "#e6f7ef";
                boton.style.color = "#188b63";

                boton.addEventListener("click", () => {
                    cambiarEstadoReserva(
                        reserva.id,
                        "Confirmada"
                    );
                });
            }

            celdaAccion.appendChild(boton);
            fila.appendChild(celdaAccion);
            tablaReservas.appendChild(fila);
        });

    } catch (error) {
        console.error("Error al cargar reservas:", error);

        mostrarMensaje(
            error.code === "permission-denied"
                ? "Firestore no permite consultar las reservas."
                : "No se pudieron cargar las reservas. Revisa la consola."
        );
    }
}

// --------------------------------------------------
// BOTONES DE SOLICITUDES
// --------------------------------------------------

function crearBotonSolicitud(texto, accion, decision) {
    const boton = document.createElement("button");

    boton.type = "button";
    boton.textContent = texto;
    boton.className = "admin-boton";
    boton.style.marginRight = "6px";

    if (decision === "aprobada") {
        boton.style.background = "#e6f7ef";
        boton.style.color = "#188b63";
    } else {
        boton.style.background = "#ffeded";
        boton.style.color = "#d93636";
    }

    boton.addEventListener("click", accion);

    return boton;
}

// --------------------------------------------------
// MOSTRAR SOLICITUDES DE ADMINISTRADOR
// --------------------------------------------------

async function mostrarSolicitudesAdmin() {
    if (!accesoPermitido) {
        console.warn(
            "No se cargan solicitudes porque el acceso no está autorizado."
        );
        return;
    }

    if (!tablaSolicitudes || !mensajeSolicitudes) {
        console.error(
            "Faltan tabla-solicitudes o mensaje-solicitudes en administrador.html."
        );
        return;
    }

    tablaSolicitudes.replaceChildren();

    mostrarMensajeSolicitudes(
        "Cargando solicitudes desde Firestore..."
    );

    try {
        const resultado = await getDocs(
            collection(db, "solicitudes_admin")
        );

        // Diagnóstico: muestra en la consola lo que leyó Firestore.
        console.log(
            "Total de solicitudes encontradas:",
            resultado.size
        );

        resultado.docs.forEach(documento => {
            console.log(
                "Documento de solicitud:",
                documento.id,
                documento.data()
            );
        });

        const todasLasSolicitudes = resultado.docs.map(documento => ({
            id: documento.id,
            ...documento.data()
        }));

        const pendientes = todasLasSolicitudes.filter(
            solicitud =>
                String(solicitud.estado || "")
                    .trim()
                    .toLowerCase() === "pendiente"
        );

        if (pendientes.length === 0) {
            mostrarMensajeSolicitudes(
                todasLasSolicitudes.length === 0
                    ? "Firestore no devolvió solicitudes. Comprueba que el panel y el emulador de datos sean los mismos."
                    : "Se encontraron solicitudes, pero ninguna tiene estado pendiente. Revisa la consola."
            );
            return;
        }

        mostrarMensajeSolicitudes(
            `Solicitudes pendientes: ${pendientes.length}.`
        );

        pendientes.forEach(solicitud => {
            const fila = document.createElement("tr");

            fila.append(
                crearCelda(
                    solicitud.nombre ||
                    solicitud.nombreSolicitante ||
                    solicitud.email ||
                    solicitud.correo ||
                    solicitud.id
                ),
                crearCelda(
                    solicitud.email ||
                    solicitud.correo ||
                    solicitud.correoSolicitante
                ),
                crearCelda("Pendiente")
            );

            const celdaAcciones = document.createElement("td");

            if (
                sesionAdmin &&
                sesionAdmin.uid === UID_ADMINISTRADOR_PRINCIPAL
            ) {
                const botonAprobar = crearBotonSolicitud(
                    "Aprobar",
                    () => resolverSolicitud(
                        solicitud.id,
                        "aprobada"
                    ),
                    "aprobada"
                );

                const botonRechazar = crearBotonSolicitud(
                    "Rechazar",
                    () => resolverSolicitud(
                        solicitud.id,
                        "rechazada"
                    ),
                    "rechazada"
                );

                celdaAcciones.append(
                    botonAprobar,
                    botonRechazar
                );
            } else {
                celdaAcciones.textContent =
                    "Solo el administrador principal puede resolverla.";
            }

            fila.appendChild(celdaAcciones);
            tablaSolicitudes.appendChild(fila);
        });

    } catch (error) {
        console.error(
            "Error al cargar solicitudes de administrador:",
            error
        );

        mostrarMensajeSolicitudes(
            error.code === "permission-denied"
                ? "Firestore no permite leer las solicitudes. Revisa las reglas del emulador."
                : "No se pudieron cargar las solicitudes. Revisa la consola del navegador."
        );
    }
}

// --------------------------------------------------
// APROBAR O RECHAZAR SOLICITUD
// --------------------------------------------------

async function resolverSolicitud(uidSolicitante, decision) {
    if (!accesoPermitido || !sesionAdmin) {
        alert("No tienes una sesión administrativa válida.");
        return;
    }

    if (sesionAdmin.uid !== UID_ADMINISTRADOR_PRINCIPAL) {
        alert(
            "Solo el administrador principal puede resolver solicitudes."
        );
        return;
    }

    if (!["aprobada", "rechazada"].includes(decision)) {
        return;
    }

    const confirmar = window.confirm(
        decision === "aprobada"
            ? "¿Deseas aprobar la solicitud y convertir al usuario en administrador?"
            : "¿Deseas rechazar la solicitud?"
    );

    if (!confirmar) return;

    try {
        const referenciaSolicitud = doc(
            db,
            "solicitudes_admin",
            uidSolicitante
        );

        const referenciaUsuario = doc(
            db,
            "usuarios",
            uidSolicitante
        );

        const [solicitudSnap, usuarioSnap] = await Promise.all([
            getDoc(referenciaSolicitud),
            getDoc(referenciaUsuario)
        ]);

        if (!solicitudSnap.exists()) {
            throw new Error(
                "No se encontró el documento de la solicitud."
            );
        }

        if (solicitudSnap.data().estado !== "pendiente") {
            throw new Error(
                "La solicitud ya fue revisada o dejó de estar pendiente."
            );
        }

        if (!usuarioSnap.exists()) {
            throw new Error(
                "No se encontró el perfil del solicitante en usuarios."
            );
        }

        if (usuarioSnap.data().rol !== "usuario") {
            throw new Error(
                "El solicitante ya no tiene el rol usuario."
            );
        }

        const lote = writeBatch(db);

        if (decision === "aprobada") {
            lote.update(referenciaUsuario, {
                rol: "administrador"
            });
        }

        lote.update(referenciaSolicitud, {
            estado: decision,
            revisadoPor: sesionAdmin.uid,
            revisadoEn: serverTimestamp()
        });

        await lote.commit();

        alert(
            decision === "aprobada"
                ? "Solicitud aprobada correctamente. El usuario ahora es administrador."
                : "Solicitud rechazada correctamente. El usuario conserva su rol usuario."
        );

        await mostrarSolicitudesAdmin();

    } catch (error) {
        console.error(
            "Error al resolver la solicitud:",
            error
        );

        if (error.code === "permission-denied") {
            alert(
                "Firestore rechazó la operación. Revisa el UID principal y las reglas del emulador."
            );
        } else {
            alert(
                error.message ||
                "No se pudo resolver la solicitud."
            );
        }
    }
}

// --------------------------------------------------
// ACTUALIZAR RESERVAS
// --------------------------------------------------

const botonActualizar = document.getElementById("admin-actualizar");

if (botonActualizar) {
    botonActualizar.addEventListener(
        "click",
        mostrarReservasAdmin
    );
}

// --------------------------------------------------
// ACTUALIZAR SOLICITUDES
// --------------------------------------------------

if (botonActualizarSolicitudes) {
    botonActualizarSolicitudes.addEventListener(
        "click",
        mostrarSolicitudesAdmin
    );
}

// --------------------------------------------------
// FILTROS DE RESERVAS
// --------------------------------------------------

[filtroTexto, filtroDeporte, filtroFecha, filtroEstado]
    .filter(Boolean)
    .forEach(campo => {
        campo.addEventListener(
            "input",
            mostrarReservasAdmin
        );

        campo.addEventListener(
            "change",
            mostrarReservasAdmin
        );
    });

// --------------------------------------------------
// IMPRIMIR
// --------------------------------------------------

const botonImprimir = document.getElementById("admin-imprimir");

if (botonImprimir) {
    botonImprimir.addEventListener("click", () => {
        window.print();
    });
}

// --------------------------------------------------
// CERRAR SESIÓN
// --------------------------------------------------

const botonCerrarSesion =
    document.getElementById("admin-cerrar-sesion");

if (botonCerrarSesion) {
    botonCerrarSesion.addEventListener("click", async () => {
        try {
            await signOut(auth);

            localStorage.removeItem(CLAVE_SESION);
            localStorage.removeItem("reservasport_deporte");

            window.location.replace("login.html");

        } catch (error) {
            console.error(
                "Error al cerrar sesión:",
                error
            );

            alert("No se pudo cerrar la sesión.");
        }
    });
}

// --------------------------------------------------
// INICIAR PANEL
// --------------------------------------------------

onAuthStateChanged(auth, async usuario => {
    accesoPermitido = false;

    try {
        const valido = await verificarAdministrador(usuario);

        if (valido) {
            await Promise.all([
                mostrarReservasAdmin(),
                mostrarSolicitudesAdmin()
            ]);
        }
    } catch (error) {
        console.error(
            "Error al verificar al administrador:",
            error
        );

        mostrarMensaje(
            "No se pudo verificar el perfil. Revisa la conexión y las reglas de Firestore."
        );

        mostrarMensajeSolicitudes(
            "No se pudo verificar el acceso al panel."
        );
    }
});

console.log(
    "ReservaSport: panel de reservas y solicitudes conectado a Firebase."
);