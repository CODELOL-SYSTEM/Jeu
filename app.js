
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import {
  getAuth,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

/* CONFIGURATION FIREBASE */
const firebaseConfig = {
  apiKey: "AIzaSyBSLc3oIdX9wB_LsOCTk_gcnNGEdg8DbgM",
  authDomain: "jeu-parti.firebaseapp.com",
  projectId: "jeu-parti",
  storageBucket: "jeu-parti.firebasestorage.app",
  messagingSenderId: "145699622088",
  appId: "1:145699622088:web:1b4e054f8e832d203469fd",
  measurementId: "G-GW0F953JJ4"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentRoomId = null;
let currentRoomCode = null;
let currentUser = null;
let currentPseudo = "";
let unsubscribeRoom = null;
let roomData = null;
let busy = false;

const $ = id => document.getElementById(id);

const QUESTIONS = [
  "Qui est le plus susceptible de devenir célèbre ?",
  "Qui survivrait le plus longtemps sur une île déserte ?",
  "Qui est le plus drôle du groupe ?",
  "Qui arriverait le plus souvent en retard ?",
  "Qui pourrait devenir millionnaire ?",
  "Qui est le plus compétitif ?",
  "Qui serait le meilleur détective ?",
  "Qui pourrait partir à l'aventure sans prévenir ?",
  "Qui est le plus susceptible de rire au mauvais moment ?",
  "Qui serait le meilleur chef d'équipe ?",
  "Qui pourrait oublier pourquoi il est entré dans une pièce ?",
  "Qui est le plus doué pour convaincre les autres ?"
];

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(screen => {
    screen.classList.toggle("active", screen.id === id);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function notice(id, message) {
  const element = $(id);
  if (!element) return;
  element.textContent = message;
  element.classList.add("show");
}

function clearNotice(id) {
  const element = $(id);
  if (!element) return;
  element.textContent = "";
  element.classList.remove("show");
}

function setBusy(value) {
  busy = value;
  document.querySelectorAll("form button[type='submit']").forEach(button => {
    button.disabled = value;
  });
}

function normalizePseudo(value) {
  return value.trim().replace(/\s+/g, " ").slice(0, 20);
}

function normalizeCode(value) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const random = new Uint32Array(6);
  crypto.getRandomValues(random);
  return Array.from(random, number => chars[number % chars.length]).join("");
}

/*
 * Le code et le mot de passe servent à calculer l'identifiant du document.
 * Cela évite de stocker le mot de passe en clair.
 * Ce mécanisme seul ne remplace pas une vraie protection serveur.
 */
async function roomDocumentId(code, password) {
  const data = new TextEncoder().encode(`${code}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function getPlayers() {
  return Array.isArray(roomData?.players) ? roomData.players : [];
}

function amHost() {
  return roomData?.hostUid === currentUser?.uid;
}

function amMember() {
  return getPlayers().some(player => player.uid === currentUser?.uid);
}

function getMyPlayer() {
  return getPlayers().find(player => player.uid === currentUser?.uid);
}

function safeText(value) {
  return String(value ?? "");
}

function renderPlayers() {
  const list = $("playerList");
  if (!list) return;

  list.replaceChildren();

  const players = getPlayers();

  if (!players.length) {
    const li = document.createElement("li");
    li.textContent = "Aucun joueur pour le moment.";
    list.appendChild(li);
    return;
  }

  players.forEach(player => {
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = safeText(player.pseudo);

    const label = document.createElement("span");
    label.className = "host-label";
    label.textContent = player.uid === roomData.hostUid ? "HÔTE" : "JOUEUR";

    li.append(name, label);
    list.appendChild(li);
  });
}

function renderRoom() {
  if (!roomData) return;

  $("displayCode").textContent = currentRoomCode || "------";
  renderPlayers();

  $("startButton").style.display = amHost() ? "block" : "none";
  $("lobbyDescription").textContent = amHost()
    ? "Tu es l'hôte. Lance la partie quand au moins deux joueurs sont présents."
    : "Tu as rejoint le salon. Attends que l'hôte lance la partie.";

  if (roomData.game?.phase && roomData.game.phase !== "lobby") {
    renderGame();
    showScreen("gameScreen");
  } else {
    showScreen("lobbyScreen");
  }
}

function renderGame() {
  const game = roomData?.game;
  if (!game) return;

  $("answerArea").style.display = "none";
  $("guessArea").style.display = "none";
  clearNotice("gameNotice");

  if (game.phase === "answer") {
    if (game.answererUid === currentUser.uid) {
      $("gameTitle").textContent = "À toi de choisir !";
      $("gameDescription").textContent =
        "Lis la question secrète et choisis un joueur dans la liste.";
      $("secretQuestion").textContent = game.question || "";
      $("answerArea").style.display = "block";
    } else {
      $("gameTitle").textContent = "Une réponse se prépare…";
      $("gameDescription").textContent =
        "Un joueur a reçu une question secrète. Attends sa réponse.";
    }
  } else if (game.phase === "guess") {
    $("gameTitle").textContent = "Devine la question";
    $("gameDescription").textContent =
      "Un joueur a été choisi. Quelle question a-t-il reçue ?";
    $("shownAnswer").textContent = `La personne choisie : ${game.answer || "..."}`;
    $("guessArea").style.display = "block";
  } else if (game.phase === "result") {
    $("gameTitle").textContent = "Fin de la manche";
    $("gameDescription").textContent =
      `Question : ${game.question || "Non disponible"}`;
    notice("gameNotice",
      `Réponse : ${game.answer || "Non disponible"}. Tu peux retourner au salon.`);
  } else {
    $("gameTitle").textContent = "La partie est prête";
    $("gameDescription").textContent = "Attends que l'hôte lance une manche.";
  }
}

/* CONNEXION ANONYME FIREBASE */
async function initializeConnection() {
  try {
    const credential = await signInAnonymously(auth);
    currentUser = credential.user;
  } catch (error) {
    console.error(error);
    document.querySelectorAll(".primary").forEach(button => {
      button.disabled = true;
    });
    alert(
      "Connexion Firebase impossible. Vérifie que l'authentification anonyme est activée dans Firebase."
    );
  }
}

await initializeConnection();

/* CRÉER UN SALON */
$("createForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (busy || !currentUser) return;

  const pseudo = normalizePseudo($("createPseudo").value);
  const password = $("createPassword").value;

  clearNotice("createNotice");

  if (pseudo.length < 1) {
    notice("createNotice", "Entre un pseudo.");
    return;
  }

  if (password.length < 4) {
    notice("createNotice", "Le mot de passe doit contenir au moins 4 caractères.");
    return;
  }

  setBusy(true);

  try {
    let code;
    let roomId;
    let created = false;

    for (let attempt = 0; attempt < 5; attempt++) {
      code = randomCode();
      roomId = await roomDocumentId(code, password);
      const ref = doc(db, "rooms", roomId);
      const existing = await getDoc(ref);

      if (!existing.exists()) {
        await setDoc(ref, {
          code,
          hostUid: currentUser.uid,
          memberUids: [currentUser.uid],
          players: [{ uid: currentUser.uid, pseudo }],
          createdAt: serverTimestamp(),
          game: { phase: "lobby", round: 0 }
        });
        created = true;
        break;
      }
    }

    if (!created) {
      throw new Error("Impossible de générer un code. Réessaie.");
    }

    currentPseudo = pseudo;
    currentRoomCode = code;
    currentRoomId = roomId;
    listenToRoom();

  } catch (error) {
    console.error(error);
    notice("createNotice", firebaseMessage(error));
  } finally {
    setBusy(false);
  }
});

/* REJOINDRE UN SALON */
$("joinForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (busy || !currentUser) return;

  const code = normalizeCode($("joinCode").value);
  const pseudo = normalizePseudo($("joinPseudo").value);
  const password = $("joinPassword").value;

  clearNotice("joinNotice");

  if (code.length !== 6 || !pseudo || !password) {
    notice("joinNotice", "Vérifie le code, le pseudo et le mot de passe.");
    return;
  }

  setBusy(true);

  try {
    const roomId = await roomDocumentId(code, password);
    const ref = doc(db, "rooms", roomId);

    await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(ref);

      if (!snapshot.exists() || snapshot.data().code !== code) {
        throw new Error("Code ou mot de passe incorrect.");
      }

      const data = snapshot.data();
      const players = Array.isArray(data.players) ? data.players : [];
      const memberUids = Array.isArray(data.memberUids) ? data.memberUids : [];

      if (!memberUids.includes(currentUser.uid)) {
        if (players.length >= 12) {
          throw new Error("Ce salon est complet (12 joueurs maximum).");
        }

        transaction.update(ref, {
          memberUids: [...memberUids, currentUser.uid],
          players: [
            ...players,
            { uid: currentUser.uid, pseudo }
          ]
        });
      } else {
        transaction.update(ref, {
          players: players.map(player =>
            player.uid === currentUser.uid ? { ...player, pseudo } : player
          )
        });
      }
    });

    currentPseudo = pseudo;
    currentRoomCode = code;
    currentRoomId = roomId;
    listenToRoom();

  } catch (error) {
    console.error(error);
    notice("joinNotice", firebaseMessage(error));
  } finally {
    setBusy(false);
  }
});

/* SYNCHRONISATION EN TEMPS RÉEL */
function listenToRoom() {
  if (unsubscribeRoom) unsubscribeRoom();

  const ref = doc(db, "rooms", currentRoomId);

  unsubscribeRoom = onSnapshot(ref, snapshot => {
    if (!snapshot.exists()) {
      notice("lobbyNotice", "Ce salon n'existe plus.");
      return;
    }

    roomData = snapshot.data();

    if (!amMember()) {
      notice("lobbyNotice", "Tu n'es plus membre de ce salon.");
      return;
    }

    renderRoom();
  }, error => {
    console.error(error);
    notice("lobbyNotice", firebaseMessage(error));
  });
}

/* LANCER UNE MANCHE */
window.startGame = async function () {
  if (!roomData || !amHost() || busy) return;

  const players = getPlayers();

  if (players.length < 2) {
    notice("lobbyNotice", "Il faut au moins deux joueurs pour commencer.");
    return;
  }

  setBusy(true);

  try {
    const answerer = players[Math.floor(Math.random() * players.length)];
    const question = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];

    await updateDoc(doc(db, "rooms", currentRoomId), {
      game: {
        phase: "answer",
        round: (roomData.game?.round || 0) + 1,
        answererUid: answerer.uid,
        question,
        answer: "",
        guesses: []
      }
    });
  } catch (error) {
    console.error(error);
    notice("lobbyNotice", firebaseMessage(error));
  } finally {
    setBusy(false);
  }
};

/* RÉPONDRE À LA QUESTION */
$("answerForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (busy || !roomData?.game || roomData.game.phase !== "answer") return;

  const answer = $("answerInput").value.trim();
  if (!answer) {
    notice("gameNotice", "Entre le pseudo choisi.");
    return;
  }

  const chosen = getPlayers().find(player =>
    player.pseudo.toLowerCase() === answer.toLowerCase()
  );

  if (!chosen) {
    notice("gameNotice", "Choisis un pseudo présent dans le salon.");
    return;
  }

  setBusy(true);

  try {
    await updateDoc(doc(db, "rooms", currentRoomId), {
      "game.phase": "guess",
      "game.answer": chosen.pseudo,
      "game.chosenUid": chosen.uid
    });
    $("answerInput").value = "";
  } catch (error) {
    console.error(error);
    notice("gameNotice", firebaseMessage(error));
  } finally {
    setBusy(false);
  }
});

/* DEVINER LA QUESTION */
$("guessForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (busy || !roomData?.game || roomData.game.phase !== "guess") return;

  const guess = $("guessInput").value.trim();
  if (!guess) {
    notice("gameNotice", "Écris ta supposition.");
    return;
  }

  setBusy(true);

  try {
    const ref = doc(db, "rooms", currentRoomId);

    await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists()) throw new Error("Le salon n'existe plus.");

      const data = snapshot.data();
      if (data.game?.phase !== "guess") {
        throw new Error("Cette manche est déjà terminée.");
      }

      const guesses = Array.isArray(data.game.guesses)
        ? data.game.guesses
        : [];

      const alreadyGuessed = guesses.some(item => item.uid === currentUser.uid);
      if (alreadyGuessed) throw new Error("Tu as déjà envoyé ta supposition.");

      const updated = [
        ...guesses,
        { uid: currentUser.uid, pseudo: currentPseudo, guess }
      ];

      const eligiblePlayers = (data.players || []).filter(
        player => player.uid !== data.game.answererUid
      );

      const allGuessed = eligiblePlayers.every(player =>
        updated.some(item => item.uid === player.uid)
      );

      transaction.update(ref, {
        "game.guesses": updated,
        ...(allGuessed ? { "game.phase": "result" } : {})
      });
    });

    $("guessInput").value = "";
    notice("gameNotice", "Ta supposition a été envoyée.");

  } catch (error) {
    console.error(error);
    notice("gameNotice", firebaseMessage(error));
  } finally {
    setBusy(false);
  }
});

/* COPIER LE CODE */
window.copyRoomCode = async function () {
  if (!currentRoomCode) return;

  try {
    await navigator.clipboard.writeText(currentRoomCode);
    notice("lobbyNotice", "Code copié !");
  } catch {
    notice("lobbyNotice", `Ton code : ${currentRoomCode}`);
  }
};

/* QUITTER LE SALON */
window.leaveRoom = function () {
  if (unsubscribeRoom) unsubscribeRoom();
  unsubscribeRoom = null;
  currentRoomId = null;
  currentRoomCode = null;
  currentPseudo = "";
  roomData = null;
  showScreen("homeScreen");
};

/* MESSAGES D'ERREUR */
function firebaseMessage(error) {
  const code = error?.code || "";

  if (error?.message === "Code ou mot de passe incorrect.") {
    return error.message;
  }

  if (error?.message) {
    return error.message;
  }

  if (code === "permission-denied") {
    return "Accès refusé. Vérifie les règles Firestore.";
  }

  if (code === "unavailable") {
    return "Serveur inaccessible. Vérifie ta connexion Internet.";
  }

  return "Une erreur est survenue. Vérifie la configuration Firebase.";
};

/* NAVIGATION */
window.showScreen = showScreen;
