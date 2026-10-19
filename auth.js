
import { app, db, serverTimestamp } from "./firebase-config.js";

import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
    doc,
    getDoc,
    setDoc
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const auth = getAuth(app);
const proveedorGoogle = new GoogleAuthProvider();

const CLAVE_SESION = "reservasport_demo_sesion";

const registerForm = document.querySelector("#register-form");
const loginForm = document.querySelector("#login-form");
const googleButton = document.querySelector("#google-login");
const message = document.querySelector("#auth-message");

// Mostrar mensajes en pantalla.
function mostrarMensaje(texto, tipo = "error") {
    if (!message) return;

    message.textContent = texto;
    message.className = "auth-message " + tipo;
}

// Obtener el perfil de Firestore usando el UID de Firebase Auth.
async function obtenerPerfil(usuario) {
    const referencia = doc(db, "usuarios", usuario.uid);
    const resultado = await getDoc(referencia);

    if (!resultado.exists()) {
        return null;
    }

    return resultado.data();
}

// Crear el perfil de un usuario nuevo de Google.
// Nunca se asigna el rol administrador automáticamente.
async function obtenerOCrearPerfilGoogle(usuario) {
    const referencia = doc(db, "usuarios", usuario.uid);
    const resultado = await getDoc(referencia);

    if (resultado.exists()) {
        return resultado.data();
    }

    const perfilNuevo = {
        nombre: usuario.displayName || "Usuario de ReservaSport",
        email: usuario.email || "",
        rol: "usuario",
        creadoEn: serverTimestamp()
    };

    await setDoc(referencia, perfilNuevo);

    return {
        nombre: perfilNuevo.nombre,
        email: perfilNuevo.email,
        rol: perfilNuevo.rol
    };
}

// Guardar la sesión.
function guardarSesion(usuario, perfil) {
    const sesion = {
        uid: usuario.uid,
        email: usuario.email,
        nombre: perfil.nombre || usuario.displayName || usuario.email,
        rol: perfil.rol
    };

    localStorage.setItem(
        CLAVE_SESION,
        JSON.stringify(sesion)
    );

    return sesion;
}

// REGISTRO CON CORREO Y CONTRASEÑA.
if (registerForm) {
    registerForm.addEventListener("submit", async (evento) => {
        evento.preventDefault();

        const nombre =
            document.querySelector("#nombre").value.trim();

        const email =
            document.querySelector("#email").value.trim().toLowerCase();

        const password =
            document.querySelector("#password").value;

        const confirmar =
            document.querySelector("#confirm-password").value;

        if (!nombre) {
            mostrarMensaje("Escribe tu nombre.");
            return;
        }

        if (password.length < 6) {
            mostrarMensaje(
                "La contraseña debe tener al menos 6 caracteres."
            );
            return;
        }

        if (password !== confirmar) {
            mostrarMensaje("Las contraseñas no coinciden.");
            return;
        }

        try {
            mostrarMensaje("Registrando usuario...", "success");

            const credencial =
                await createUserWithEmailAndPassword(
                    auth,
                    email,
                    password
                );

            await setDoc(
                doc(db, "usuarios", credencial.user.uid),
                {
                    nombre,
                    email,
                    rol: "usuario",
                    creadoEn: serverTimestamp()
                }
            );

            mostrarMensaje(
                "Registro completado. Ahora inicia sesión.",
                "success"
            );

            registerForm.reset();
            await signOut(auth);

            setTimeout(() => {
                window.location.href = "login.html";
            }, 1000);

        } catch (error) {
            console.error("Error de registro:", error);

            const mensajes = {
                "auth/email-already-in-use":
                    "Este correo ya está registrado. Inicia sesión.",
                "auth/invalid-email":
                    "El correo electrónico no es válido.",
                "auth/weak-password":
                    "La contraseña es demasiado débil.",
                "permission-denied":
                    "Firestore rechazó el registro. Revisa las reglas."
            };

            mostrarMensaje(
                mensajes[error.code] ||
                "No se pudo completar el registro. Revisa la consola."
            );
        }
    });
}

// INICIO DE SESIÓN CON CORREO Y CONTRASEÑA.
if (loginForm) {
    loginForm.addEventListener("submit", async (evento) => {
        evento.preventDefault();

        const email =
            document.querySelector("#email").value.trim().toLowerCase();

        const password =
            document.querySelector("#password").value;

        try {
            mostrarMensaje("Iniciando sesión...", "success");

            const credencial =
                await signInWithEmailAndPassword(
                    auth,
                    email,
                    password
                );

            const perfil = await obtenerPerfil(credencial.user);

            if (!perfil) {
                await signOut(auth);
                localStorage.removeItem(CLAVE_SESION);

                mostrarMensaje(
                    "Tu cuenta no tiene perfil en Firestore. Contacta al administrador."
                );
                return;
            }

            if (
                perfil.rol !== "usuario" &&
                perfil.rol !== "administrador"
            ) {
                await signOut(auth);
                localStorage.removeItem(CLAVE_SESION);

                mostrarMensaje("Tu cuenta no tiene un rol válido.");
                return;
            }

            const sesion = guardarSesion(
                credencial.user,
                perfil
            );

            mostrarMensaje(
                "Bienvenido/a, " + sesion.nombre,
                "success"
            );

            window.location.href =
                sesion.rol === "administrador"
                    ? "administrador.html"
                    : "reservas.html";

        } catch (error) {
            console.error("Error de inicio de sesión:", error);

            const mensajes = {
                "auth/invalid-credential":
                    "Correo o contraseña incorrectos.",
                "auth/user-not-found":
                    "No existe una cuenta con ese correo.",
                "auth/wrong-password":
                    "La contraseña es incorrecta.",
                "auth/invalid-email":
                    "El correo electrónico no es válido.",
                "auth/too-many-requests":
                    "Demasiados intentos. Espera un momento.",
                "permission-denied":
                    "No se pudo leer tu perfil. Revisa las reglas de Firestore."
            };

            mostrarMensaje(
                mensajes[error.code] ||
                "No se pudo iniciar sesión. Revisa la consola."
            );
        }
    });
}

// INICIO DE SESIÓN Y REGISTRO CON GOOGLE.
if (googleButton) {
    googleButton.addEventListener("click", async () => {
        try {
            googleButton.disabled = true;

            mostrarMensaje(
                "Conectando con Google...",
                "success"
            );

            const credencial = await signInWithPopup(
                auth,
                proveedorGoogle
            );

            const usuario = credencial.user;

            // Crear perfil si es su primera entrada.
            // Si ya existe, conservar su rol registrado.
            const perfil =
                await obtenerOCrearPerfilGoogle(usuario);

            if (
                perfil.rol !== "usuario" &&
                perfil.rol !== "administrador"
            ) {
                await signOut(auth);
                localStorage.removeItem(CLAVE_SESION);

                mostrarMensaje(
                    "Tu cuenta no tiene un rol válido. Contacta al administrador."
                );
                return;
            }

            const sesion = guardarSesion(usuario, perfil);

            mostrarMensaje(
                "Bienvenido/a, " + sesion.nombre,
                "success"
            );

            window.location.href =
                sesion.rol === "administrador"
                    ? "administrador.html"
                    : "reservas.html";

        } catch (error) {
            console.error("Error con Google:", error);

            const mensajes = {
                "auth/popup-closed-by-user":
                    "Cerraste la ventana de Google antes de terminar.",
                "auth/popup-blocked":
                    "Tu navegador bloqueó la ventana emergente. Permítela e inténtalo de nuevo.",
                "auth/unauthorized-domain":
                    "Este dominio no está autorizado en Firebase Authentication.",
                "auth/account-exists-with-different-credential":
                    "Este correo ya tiene una cuenta con otro método de acceso."
            };

            mostrarMensaje(
                mensajes[error.code] ||
                "No se pudo acceder con Google. Revisa la consola."
            );

        } finally {
            googleButton.disabled = false;
        }
    });
}

// PROTEGER LAS PÁGINAS PRIVADAS.
onAuthStateChanged(auth, async (usuario) => {
    const pagina = window.location.pathname.split("/").pop();

    const paginasPrivadas = [
        "reservas.html",
        "administrador.html"
    ];

    if (!paginasPrivadas.includes(pagina)) {
        return;
    }

    if (!usuario) {
        localStorage.removeItem(CLAVE_SESION);
        window.location.replace("login.html");
        return;
    }

    try {
        const perfil = await obtenerPerfil(usuario);

        if (!perfil) {
            await signOut(auth);
            localStorage.removeItem(CLAVE_SESION);
            window.location.replace("login.html");
            return;
        }

        guardarSesion(usuario, perfil);

        if (
            pagina === "administrador.html" &&
            perfil.rol !== "administrador"
        ) {
            alert(
                "Acceso denegado. Necesitas una cuenta administradora."
            );

            window.location.replace("reservas.html");
            return;
        }

        if (
            pagina === "reservas.html" &&
            perfil.rol === "administrador"
        ) {
            window.location.replace("administrador.html");
        }

    } catch (error) {
        console.error("Error al comprobar el perfil:", error);

        alert(
            "No se pudo verificar tu cuenta. Inténtalo nuevamente."
        );
    }
});

// CERRAR SESIÓN.
export async function cerrarSesionFirebase() {
    try {
        await signOut(auth);

        localStorage.removeItem(CLAVE_SESION);
        localStorage.removeItem("reservasport_deporte");

        window.location.href = "index.html";

    } catch (error) {
        console.error("Error al cerrar sesión:", error);

        alert("No se pudo cerrar la sesión.");
    }
}

console.log("ReservaSport: autenticación Firebase preparada.");
