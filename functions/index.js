
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const {
  getFirestore,
  FieldValue
} = require("firebase-admin/firestore");

initializeApp();

const db = getFirestore();

// UID del único administrador principal autorizado.
const ADMIN_PRINCIPAL_UID = "FIGdCf6xnqXrVtodhaOxQioAlHk1";

// Comprueba la sesión, el UID y el rol guardado en Firestore.
async function exigirAdministradorPrincipal(request) {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Debes iniciar sesión."
    );
  }

  if (request.auth.uid !== ADMIN_PRINCIPAL_UID) {
    throw new HttpsError(
      "permission-denied",
      "Solo el administrador principal puede realizar esta acción."
    );
  }

  const perfilSnap = await db
    .collection("usuarios")
    .doc(request.auth.uid)
    .get();

  if (
    !perfilSnap.exists ||
    perfilSnap.data().rol !== "administrador"
  ) {
    throw new HttpsError(
      "permission-denied",
      "La cuenta principal no tiene el rol de administrador."
    );
  }
}

// Un usuario solicita convertirse en administrador.
exports.solicitarAdministracion = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Inicia sesión antes de solicitar autorización."
    );
  }

  const uid = request.auth.uid;
  const perfilRef = db.collection("usuarios").doc(uid);
  const perfilSnap = await perfilRef.get();

  if (!perfilSnap.exists) {
    throw new HttpsError(
      "failed-precondition",
      "No se encontró tu perfil de usuario."
    );
  }

  const perfil = perfilSnap.data();

  if (perfil.rol === "administrador") {
    throw new HttpsError(
      "already-exists",
      "Tu cuenta ya es administradora."
    );
  }

  if (perfil.rol !== "usuario") {
    throw new HttpsError(
      "permission-denied",
      "Solo las cuentas con rol usuario pueden solicitar autorización."
    );
  }

  const solicitudRef = db.collection("solicitudes_admin").doc(uid);
  const solicitudSnap = await solicitudRef.get();

  if (
    solicitudSnap.exists &&
    solicitudSnap.data().estado === "pendiente"
  ) {
    return {
      mensaje: "Ya tienes una solicitud pendiente."
    };
  }

  await solicitudRef.set({
    uid,
    nombre: perfil.nombre || "",
    email: perfil.email || request.auth.token.email || "",
    estado: "pendiente",
    creadaEn: FieldValue.serverTimestamp(),
    revisadaEn: null,
    revisadaPor: null
  });

  return {
    mensaje: "Solicitud enviada al administrador principal."
  };
});

// Lista las solicitudes pendientes para el administrador principal.
exports.listarSolicitudesAdmin = onCall(async (request) => {
  await exigirAdministradorPrincipal(request);

  const resultado = await db
    .collection("solicitudes_admin")
    .where("estado", "==", "pendiente")
    .get();

  return {
    solicitudes: resultado.docs.map((documento) => {
      const datos = documento.data();

      return {
        id: documento.id,
        ...datos,
        creadaEn: datos.creadaEn
          ? datos.creadaEn.toDate().toISOString()
          : null
      };
    })
  };
});

// Aprueba o rechaza una solicitud pendiente.
exports.resolverSolicitudAdmin = onCall(async (request) => {
  await exigirAdministradorPrincipal(request);

  const uidSolicitante = request.data?.uid;
  const decision = request.data?.decision;

  if (
    typeof uidSolicitante !== "string" ||
    !["aprobar", "rechazar"].includes(decision)
  ) {
    throw new HttpsError(
      "invalid-argument",
      "La solicitud o la decisión no son válidas."
    );
  }

  if (uidSolicitante === ADMIN_PRINCIPAL_UID) {
    throw new HttpsError(
      "failed-precondition",
      "No puedes tramitar una solicitud sobre la cuenta principal."
    );
  }

  const solicitudRef = db
    .collection("solicitudes_admin")
    .doc(uidSolicitante);

  const usuarioRef = db
    .collection("usuarios")
    .doc(uidSolicitante);

  await db.runTransaction(async (tx) => {
    const solicitudSnap = await tx.get(solicitudRef);
    const usuarioSnap = await tx.get(usuarioRef);

    if (!solicitudSnap.exists || !usuarioSnap.exists) {
      throw new HttpsError(
        "not-found",
        "No se encontró la solicitud o el perfil del usuario."
      );
    }

    if (solicitudSnap.data().estado !== "pendiente") {
      throw new HttpsError(
        "failed-precondition",
        "Esta solicitud ya fue revisada."
      );
    }

    if (decision === "aprobar") {
      if (usuarioSnap.data().rol !== "usuario") {
        throw new HttpsError(
          "failed-precondition",
          "El perfil ya no tiene el rol de usuario esperado."
        );
      }

      tx.update(usuarioRef, {
        rol: "administrador"
      });
    }

    tx.update(solicitudRef, {
      estado: decision === "aprobar" ? "aprobada" : "rechazada",
      revisadaEn: FieldValue.serverTimestamp(),
      revisadaPor: request.auth.uid
    });
  });

  return {
    mensaje: decision === "aprobar"
      ? "Solicitud aprobada. La cuenta ya es administradora."
      : "Solicitud rechazada."
  };
});

