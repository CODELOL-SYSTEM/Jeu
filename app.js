
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";

import {
  getAuth,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";

import {
  getDatabase,
  ref,
  get,
  set,
  update,
  onValue,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js";

/* CONFIGURATION FIREBASE */
const firebaseConfig = {
  apiKey: "AIzaSyBSLc3oIdX9wB_LsOCTk_gcnNGEdg8DbgM",
  authDomain: "jeu-parti.firebaseapp.com",
  databaseURL: "https://jeu-parti-default-rtdb.firebaseio.com",
  projectId: "jeu-parti",
  storageBucket: "jeu-parti.firebasestorage.app",
  messagingSenderId: "145699622088",
  appId: "1:145699622088:web:1b4e054f8e832d203469fd",
  measurementId: "G-GW0F953JJ4"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

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

/* NAVIGATION */
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

  const startButton = $("startButton");
  if (startButton) {
    startButton.disabled = value || !amHost();
  }
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

  return Array.from(
    random,
    number => chars[number % chars.length]
  ).join("");
}

/* IDENTIFIANT DU SALON */
async function roomDocumentId(code, password) {
  const data = new TextEncoder().encode(`${code}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

/* GESTION DES JOUEURS */
function getPlayers() {
  const players = roomData?.players;

  if (!players) return [];

  if (Array.isArray(players)) {
    return players.filter(Boolean);
  }

  return Object.values(players);
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

/* AFFICHAGE DES JOUEURS */
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
    label.textContent =
      player.uid === roomData.hostUid ? "HÔTE" : "JOUEUR";

    li.append(name, label);
    list.appendChild(li);
  });
}

/* AFFICHAGE DU SALON */
function renderRoom() {
  if (!roomData) return;

  $("displayCode").textContent = currentRoomCode || "------";
  renderPlayers();

  const startButton = $("startButton");

  if (startButton) {
    startButton.style.display = amHost() ? "block" : "none";
    startButton.disabled = busy || !amHost();
  }

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

/* AFFICHAGE DU JEU */
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

    $("shownAnswer").textContent =
      `La personne choisie : ${game.answer || "..."}`;

    $("guessArea").style.display = "block";
  } else if (game.phase === "result") {
    $("gameTitle").textContent = "Fin de la manche";

    $("gameDescription").textContent =
      `Question : ${game.question || "Non disponible"}`;

    notice(
      "gameNotice",
      `Réponse : ${game.answer || "Non disponible"}. Tu peux retourner au salon.`
    );
  } else {
    $("gameTitle").textContent = "La partie est prête";

    $("gameDescription").textContent =
      "Attends que l'hôte lance une manche.";
  }
}

/* CONNEXION FIREBASE */
async function initializeConnection() {
  try {
    const credential = await signInAnonymously(auth);
    currentUser = credential.user;
  } catch (error) {
    console.error("Erreur de connexion Firebase :", error);

    document.querySelectorAll(".primary").forEach(button => {
      button.disabled = true;
    });

    alert(
      "Connexion Firebase impossible. Active l'authentification anonyme dans Firebase > Authentication > Sign-in method."
    );
  }
}

await initializeConnection();

/* CRÉER UN SALON */
$("createForm").addEventListener("submit", async event => {
  event.preventDefault();

  if (busy) return;

  if (!currentUser) {
    notice("createNotice", "Connexion Firebase impossible. Recharge la page.");
    return;
  }

  const pseudo = normalizePseudo($("createPseudo").value);
  const password = $("createPassword").value;

  clearNotice("createNotice");

  if (!pseudo) {
    notice("createNotice", "Entre un pseudo.");
    return;
  }

  if (password.length < 4) {
    notice(
      "createNotice",
      "Le mot de passe doit contenir au moins 4 caractères."
    );
    return;
  }

  setBusy(true);

  try {
    let created = false;

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomCode();
      const roomId = await roomDocumentId(code, password);
      const roomRef = ref(db, `rooms/${roomId}`);

      const existing = await get(roomRef);

      if (existing.exists()) continue;

      const room = {
        code,
        hostUid: currentUser.uid,
        players: {
          [currentUser.uid]: {
            uid: currentUser.uid,
            pseudo
          }
        },
        createdAt: serverTimestamp(),
        game: {
          phase: "lobby",
          round: 0
        }
      };

      await set(roomRef, room);

      currentPseudo = pseudo;
      currentRoomCode = code;
      currentRoomId = roomId;

      created = true;
      listenToRoom();
      break;
    }

    if (!created) {
      throw new Error("Impossible de créer le salon. Réessaie.");
    }
  } catch (error) {
    console.error("Erreur création salon :", error);
    notice("createNotice", firebaseMessage(error));
  } finally {
    setBusy(false);
    if (roomData) renderRoom();
  }
});

/* REJOINDRE UN SALON */
$("joinForm").addEventListener("submit", async event => {
  event.preventDefault();

  if (busy) return;

  if (!currentUser) {
    notice("joinNotice", "Connexion Firebase impossible. Recharge la page.");
    return;
  }

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
    const roomRef = ref(db, `rooms/${roomId}`);

    /* Vérifier que le salon existe */
    const snapshot = await get(roomRef);

    if (!snapshot.exists() || snapshot.val()?.code !== code) {
      throw new Error("Code ou mot de passe incorrect.");
    }

    /* Ajouter le joueur dans la branche players uniquement */
    const playersRef = ref(db, `rooms/${roomId}/players`);

    const result = await runTransaction(playersRef, currentPlayers => {
      const players = currentPlayers || {};
      const existingPlayer = players[currentUser.uid];

      if (!existingPlayer && Object.keys(players).length >= 12) {
        return;
      }

      return {
        ...players,
        [currentUser.uid]: {
          uid: currentUser.uid,
          pseudo
        }
      };
    });

    if (!result.committed) {
      const latest = await get(roomRef);

      if (!latest.exists() || latest.val()?.code !== code) {
        throw new Error("Code ou mot de passe incorrect.");
      }

      const players = latest.val()?.players || {};

      if (!players[currentUser.uid] && Object.keys(players).length >= 12) {
        throw new Error("Ce salon est complet (12 joueurs maximum).");
      }

      throw new Error(
        "Firebase a refusé l'ajout du joueur. Vérifie les règles de la base."
      );
    }

    /* Vérification finale avant d'ouvrir le salon */
    const updatedRoom = await get(roomRef);

    if (!updatedRoom.exists()) {
      throw new Error("Le salon n'existe plus.");
    }

    const data = updatedRoom.val();

    if (!data.players?.[currentUser.uid]) {
      throw new Error("Le joueur n'a pas été enregistré dans le salon.");
    }

    currentPseudo = pseudo;
    currentRoomCode = code;
    currentRoomId = roomId;

    listenToRoom();
  } catch (error) {
    console.error("Erreur rejoindre salon :", error);
    notice("joinNotice", firebaseMessage(error));
  } finally {
    setBusy(false);
    if (roomData) renderRoom();
  }
});

/* SYNCHRONISATION EN TEMPS RÉEL */
function listenToRoom() {
  if (unsubscribeRoom) unsubscribeRoom();

  const roomRef = ref(db, `rooms/${currentRoomId}`);

  unsubscribeRoom = onValue(
    roomRef,
    snapshot => {
      if (!snapshot.exists()) {
        notice("lobbyNotice", "Ce salon n'existe plus.");
        return;
      }

      roomData = snapshot.val();

      if (!amMember()) {
        notice("lobbyNotice", "Tu n'es plus membre de ce salon.");
        return;
      }

      renderRoom();
    },
    error => {
      console.error("Erreur synchronisation :", error);
      notice("lobbyNotice", firebaseMessage(error));
    }
  );
}

/* LANCER UNE MANCHE : HÔTE UNIQUEMENT */
window.startGame = async function () {
  if (!roomData || !amHost() || busy) return;

  const players = getPlayers();

  if (players.length < 2) {
    notice("lobbyNotice", "Il faut au moins deux joueurs pour commencer.");
    return;
  }

  setBusy(true);

  try {
    const answerer =
      players[Math.floor(Math.random() * players.length)];

    const question =
      QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];

    const nextRound = (roomData.game?.round || 0) + 1;

    await update(ref(db, `rooms/${currentRoomId}/game`), {
      phase: "answer",
      round: nextRound,
      answererUid: answerer.uid,
      question,
      answer: "",
      chosenUid: "",
      guesses: {}
    });
  } catch (error) {
    console.error("Erreur lancement partie :", error);
    notice("lobbyNotice", firebaseMessage(error));
  } finally {
    setBusy(false);
    if (roomData) renderRoom();
  }
};

/* RÉPONDRE À LA QUESTION */
$("answerForm").addEventListener("submit", async event => {
  event.preventDefault();

  const game = roomData?.game;

  if (
    busy ||
    !game ||
    game.phase !== "answer" ||
    game.answererUid !== currentUser?.uid
  ) {
    return;
  }

  const answer = $("answerInput").value.trim();

  if (!answer) {
    notice("gameNotice", "Entre le pseudo choisi.");
    return;
  }

  const chosen = getPlayers().find(
    player => player.pseudo.toLowerCase() === answer.toLowerCase()
  );

  if (!chosen) {
    notice("gameNotice", "Choisis un pseudo présent dans le salon.");
    return;
  }

  setBusy(true);

  try {
    await update(ref(db, `rooms/${currentRoomId}/game`), {
      phase: "guess",
      answer: chosen.pseudo,
      chosenUid: chosen.uid
    });

    $("answerInput").value = "";
  } catch (error) {
    console.error("Erreur réponse :", error);
    notice("gameNotice", firebaseMessage(error));
  } finally {
    setBusy(false);
  }
});

/* DEVINER LA QUESTION */
$("guessForm").addEventListener("submit", async event => {
  event.preventDefault();

  if (
    busy ||
    !roomData?.game ||
    roomData.game.phase !== "guess"
  ) {
    return;
  }

  const guess = $("guessInput").value.trim();

  if (!guess) {
    notice("gameNotice", "Écris ta supposition.");
    return;
  }

  setBusy(true);

  try {
    const roomRef = ref(db, `rooms/${currentRoomId}`);

    const transaction = await runTransaction(roomRef, data => {
      if (!data || data.game?.phase !== "guess") {
        return;
      }

      const players = data.players || {};
      const guesses = data.game.guesses || {};

      if (!players[currentUser.uid]) return;
      if (currentUser.uid === data.game.answererUid) return;
      if (guesses[currentUser.uid]) return;

      const updatedGuesses = {
        ...guesses,
        [currentUser.uid]: {
          uid: currentUser.uid,
          pseudo: currentPseudo,
          guess
        }
      };

      const eligiblePlayers = Object.values(players).filter(
        player => player.uid !== data.game.answererUid
      );

      const allGuessed = eligiblePlayers.every(
        player => Boolean(updatedGuesses[player.uid])
      );

      return {
        ...data,
        game: {
          ...data.game,
          guesses: updatedGuesses,
          phase: allGuessed ? "result" : "guess"
        }
      };
    });

    if (!transaction.committed) {
      throw new Error(
        "Supposition déjà envoyée ou manche terminée. Réessaie."
      );
    }

    $("guessInput").value = "";
    notice("gameNotice", "Ta supposition a été envoyée !");
  } catch (error) {
    console.error("Erreur supposition :", error);
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

  clearNotice("lobbyNotice");
  showScreen("homeScreen");
};

/* MESSAGES D'ERREUR */
function firebaseMessage(error) {
  const message = String(error?.message || "");
  const code = String(error?.code || "");

  if (message.includes("Code ou mot de passe incorrect.")) {
    return "Code ou mot de passe incorrect.";
  }

  if (message.includes("Ce salon est complet")) {
    return "Ce salon est complet (12 joueurs maximum).";
  }

  if (
    code === "PERMISSION_DENIED" ||
    code === "permission-denied" ||
    message.includes("PERMISSION_DENIED")
  ) {
    return "Accès refusé. Vérifie les règles de Realtime Database.";
  }

  if (message.includes("Firebase a refusé l'ajout")) {
    return message;
  }

  if (message.includes("network")) {
    return "Problème de connexion Internet. Réessaie.";
  }

  return message || "Une erreur est survenue. Vérifie Firebase.";
}

/* NAVIGATION */
window.showScreen = showScreen;
