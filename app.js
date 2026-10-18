
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import {
  getDatabase, ref, get, set, update, onValue, runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js";

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
const $ = id => document.getElementById(id);

let user = null, roomId = null, roomCode = null, pseudo = "";
let room = null, stopListening = null, busy = false, timerInterval = null;
let lastTimerPhase = "", scoring = false;

const WORD_PAIRS = [
  ["GAZ","PROUT"],["CHAT","TIGRE"],["PIZZA","BURGER"],["PLAGE","PISCINE"],
  ["AVION","HÉLICOPTÈRE"],["FOOTBALL","RUGBY"],["TÉLÉPHONE","TABLETTE"],
  ["CHOCOLAT","BONBON"],["ÉCOLE","COLLÈGE"],["LUNE","SOLEIL"],
  ["PANDA","KOALA"],["YOUTUBE","TIKTOK"],["FANTÔME","ZOMBIE"],
  ["POMME","POIRE"],["ROBOT","ALIEN"],["POMPIER","POLICIER"],
  ["PIRATE","NINJA"],["MONTAGNE","VOLCAN"],["GUITARE","PIANO"],
  ["CINÉMA","THÉÂTRE"],["NEIGE","PLUIE"],["LION","LOUP"],
  ["MOTO","VOITURE"],["FRAISE","CERISE"],["DRAGON","DINOSAURE"]
];

const VOTE_QUESTIONS = [
  "Qui survivrait le plus longtemps sur une île déserte ?",
  "Qui pourrait devenir célèbre du jour au lendemain ?",
  "Qui arriverait le plus souvent en retard ?",
  "Qui serait le meilleur détective ?",
  "Qui rirait dans une situation sérieuse ?",
  "Qui dépenserait un million d'euros le plus vite ?",
  "Qui pourrait se perdre avec un GPS ?",
  "Qui deviendrait célèbre sur Internet ?",
  "Qui oublierait son propre anniversaire ?",
  "Qui pourrait devenir président du groupe ?",
  "Qui est le plus compétitif ?",
  "Qui pourrait partir en voyage sans rien préparer ?"
];

const QUIZ = [
  {q:"Combien de côtés possède un hexagone ?",a:"6"},
  {q:"Quelle planète est surnommée la planète rouge ?",a:"mars"},
  {q:"Combien font 9 × 8 ?",a:"72"},
  {q:"Quel est le plus grand animal du monde ?",a:"baleine bleue"},
  {q:"Combien de minutes dans une heure ?",a:"60"},
  {q:"Quelle est la capitale de l'Italie ?",a:"rome"},
  {q:"Combien de jours dans une année bissextile ?",a:"366"},
  {q:"Quel gaz les plantes absorbent-elles principalement ?",a:"dioxyde de carbone"},
  {q:"Combien de couleurs compte généralement un arc-en-ciel ?",a:"7"}
];

const TRUE_FALSE = [
  {q:"Les pieuvres ont trois cœurs.",a:"vrai"},
  {q:"La Terre possède deux lunes naturelles.",a:"faux"},
  {q:"Un triangle possède trois côtés.",a:"vrai"},
  {q:"Les chauves-souris sont des oiseaux.",a:"faux"},
  {q:"La lumière voyage plus vite que le son.",a:"vrai"},
  {q:"Les araignées sont des insectes.",a:"faux"},
  {q:"Le Soleil est une planète.",a:"faux"},
  {q:"L'eau pure gèle vers 0 °C à pression normale.",a:"vrai"}
];

const MYSTERIES = [
  {q:"Je suis jaune, courbé et les singes m'aiment. Qui suis-je ?",a:"banane"},
  {q:"J'ai des aiguilles mais je ne couds pas. Qui suis-je ?",a:"horloge"},
  {q:"Plus je sèche, plus je deviens mouillé. Qui suis-je ?",a:"serviette"},
  {q:"J'ai des dents mais je ne mange pas. Qui suis-je ?",a:"peigne"},
  {q:"Je monte et descends sans bouger. Qui suis-je ?",a:"escalier"}
];

const TOPICS = ["Nourriture","Jeux vidéo","Animaux","Films","Vacances","École","Sport","Internet","Musique","Objets du quotidien"];

const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clean = s => String(s || "").trim().replace(/\s+/g," ").slice(0,100);
const normalizeCode = s => s.trim().toUpperCase().replace(/[^A-Z0-9]/g,"");
const normalizeName = s => s.trim().replace(/\s+/g," ").slice(0,20);

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return [...bytes].map(n => chars[n % chars.length]).join("");
}

async function roomDocumentId(code,password) {
  const bytes = new TextEncoder().encode(`${code}:${password}`);
  const hash = await crypto.subtle.digest("SHA-256",bytes);
  return [...new Uint8Array(hash)].map(n => n.toString(16).padStart(2,"0")).join("");
}

function say(id,msg) {
  const el = $(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
}
function clearSay(id) {
  const el = $(id);
  if (el) { el.textContent = ""; el.classList.remove("show"); }
}
function setBusy(value) {
  busy = value;
  document.querySelectorAll("form button[type=submit]").forEach(b => b.disabled = value);
}
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.toggle("active",s.id === id));
  window.scrollTo({top:0,behavior:"smooth"});
}
function allPlayers() {
  const p = room?.players || {};
  return Array.isArray(p) ? p.filter(Boolean) : Object.values(p);
}
function isHost() { return !!user && room?.hostUid === user.uid; }
function isMember() { return allPlayers().some(p => p.uid === user?.uid); }
function currentScores() { return room?.scores || {}; }
function modeName(mode) {
  return ({
    imposteur:"IMPOSTEUR", vote:"VOTE DU GROUPE", association:"ASSOCIATION DE MOTS",
    quiz:"QUIZ EXPRESS","vrai-faux":"VRAI OU FAUX",mystere:"MOT MYSTÈRE"
  })[mode] || "JEU";
}
function randUidPlayer() { return pick(allPlayers()); }

function makeGame(mode,round,maxRounds) {
  const people = allPlayers();
  const pair = pick(WORD_PAIRS), impostor = randUidPlayer();
  const quiz = pick(QUIZ), truth = pick(TRUE_FALSE), mystery = pick(MYSTERIES);
  const votePrompt = pick(VOTE_QUESTIONS), topic = pick(TOPICS);
  const words = {};

  people.forEach(p => {
    if (mode === "imposteur") words[p.uid] = p.uid === impostor.uid ? pair[1] : pair[0];
    else if (mode === "association") words[p.uid] = topic;
    else if (mode === "quiz") words[p.uid] = quiz.q;
    else if (mode === "vrai-faux") words[p.uid] = truth.q;
    else if (mode === "mystere") words[p.uid] = mystery.q;
    else words[p.uid] = votePrompt;
  });

  let title = "", description = "", prompt = "", phase = "answer", correctAnswer = "";

  if (mode === "imposteur") {
    title = "Mémorise ton mot secret";
    description = "Un seul joueur possède un mot différent. Ne le révèle pas.";
    phase = "reveal";
  } else if (mode === "vote") {
    title = "Qui est le plus susceptible de… ?";
    description = "Vote pour le joueur correspondant à la question.";
    prompt = votePrompt;
    phase = "vote";
  } else if (mode === "association") {
    title = "Association de mots";
    description = "Propose un mot lié au thème. Un mot déjà utilisé devient gris.";
    prompt = `Thème : ${topic}`;
  } else if (mode === "quiz") {
    title = "Quiz express";
    description = "Réponds correctement pour gagner 2 points.";
    prompt = quiz.q; correctAnswer = quiz.a;
  } else if (mode === "vrai-faux") {
    title = "Vrai ou faux ?";
    description = "Réponds par vrai ou faux.";
    prompt = truth.q; correctAnswer = truth.a;
  } else if (mode === "mystere") {
    title = "Mot mystère";
    description = "Trouve la réponse à cette énigme.";
    prompt = mystery.q; correctAnswer = mystery.a;
  }

  return {
    mode, round, phase, title, description, prompt, words,
    impostorUid: mode === "imposteur" ? impostor.uid : "",
    correctAnswer, entries:{}, votes:{}, usedWords:{},
    createdAt: Date.now(), maxRounds
  };
}

async function initialize() {
  try {
    const result = await signInAnonymously(auth);
    user = result.user;
  } catch (error) {
    console.error(error);
    alert("Connexion Firebase impossible. Active Authentication > Sign-in method > Anonymous.");
  }
}
await initialize();

/* CRÉATION */
$("createForm").addEventListener("submit",async e => {
  e.preventDefault();
  if (busy || !user) return;
  const name = normalizeName($("createPseudo").value);
  const password = $("createPassword").value;
  clearSay("createNotice");

  if (!name) return say("createNotice","Entre un pseudo.");
  if (password.length < 4) return say("createNotice","Le mot de passe doit contenir au moins 4 caractères.");

  setBusy(true);
  try {
    for (let i=0;i<8;i++) {
      const code = randomCode();
      const id = await roomDocumentId(code,password);
      const roomRef = ref(db,`rooms/${id}`);
      const result = await runTransaction(roomRef,current => {
        if (current !== null) return;
        return {
          code, hostUid:user.uid,
          players:{[user.uid]:{uid:user.uid,pseudo:name}},
          scores:{[user.uid]:0}, maxRounds:5,
          createdAt:Date.now(), game:{phase:"lobby"}
        };
      });
      if (!result.committed) continue;
      roomId=id; roomCode=code; pseudo=name;
      listenRoom();
      return;
    }
    throw new Error("Impossible de générer un code. Réessaie.");
  } catch(error) {
    console.error("Création :",error);
    say("createNotice",friendlyError(error));
  } finally { setBusy(false); }
});

/* REJOINDRE */
$("joinForm").addEventListener("submit",async e => {
  e.preventDefault();
  if (busy || !user) return;
  const code=normalizeCode($("joinCode").value);
  const name=normalizeName($("joinPseudo").value);
  const password=$("joinPassword").value;
  clearSay("joinNotice");

  if (code.length!==6 || !name || !password)
    return say("joinNotice","Vérifie le code, le pseudo et le mot de passe.");

  setBusy(true);
  try {
    const id=await roomDocumentId(code,password);
    const roomRef=ref(db,`rooms/${id}`);
    const snapshot=await get(roomRef);
    const data=snapshot.val();

    if (!data || data.code!==code) throw new Error("Code ou mot de passe incorrect.");

    const playersRef=ref(db,`rooms/${id}/players`);
    const joined=await runTransaction(playersRef,current => {
      const p=current || {};
      if (!p[user.uid] && Object.keys(p).length>=12) return;
      return {...p,[user.uid]:{uid:user.uid,pseudo:name}};
    });

    if (!joined.committed) throw new Error("Salon complet ou accès refusé.");
    const fresh=await get(roomRef);
    if (!fresh.exists() || !fresh.val()?.players?.[user.uid])
      throw new Error("Le joueur n'a pas été enregistré.");

    await update(ref(db,`rooms/${id}/scores`),{[user.uid]:data.scores?.[user.uid] || 0});
    roomId=id; roomCode=code; pseudo=name;
    listenRoom();
  } catch(error) {
    console.error("Rejoindre :",error);
    say("joinNotice",friendlyError(error));
  } finally { setBusy(false); }
});

function listenRoom() {
  if (stopListening) stopListening();
  stopListening=onValue(ref(db,`rooms/${roomId}`),snapshot => {
    if (!snapshot.exists()) {
      say("lobbyNotice","Ce salon n'existe plus.");
      return;
    }
    room=snapshot.val();
    if (!isMember()) {
      say("lobbyNotice","Tu ne fais plus partie de ce salon.");
      return;
    }
    renderRoom();
  },error => {
    console.error(error);
    say("lobbyNotice",friendlyError(error));
  });
}

/* AFFICHAGE DU SALON */
function renderRoom() {
  $("displayCode").textContent=roomCode || room.code || "------";
  $("hostSettings").classList.toggle("hidden",!isHost());
  $("lobbyDescription").textContent=isHost()
    ?"Tu es l'hôte. Choisis les règles et lance quand tout le monde est prêt."
    :"Tu as rejoint le salon. Seul l'hôte peut démarrer la partie.";
  renderPlayers();

  if (room.game && room.game.phase!=="lobby") {
    showScreen("gameScreen");
    renderGame();
  } else showScreen("lobbyScreen");
}
function renderPlayers() {
  const list=$("playerList");
  list.replaceChildren();
  const people=allPlayers();
  $("playerCount").textContent=`${people.length}/12`;
  if (!people.length) {
    const li=document.createElement("li"); li.textContent="En attente de joueurs…"; list.append(li); return;
  }
  people.forEach(p => {
    const li=document.createElement("li");
    const n=document.createElement("span"); n.textContent=p.pseudo;
    const tag=document.createElement("span"); tag.className="host-label";
    tag.textContent=p.uid===room.hostUid?"HÔTE":`${currentScores()[p.uid]||0} PTS`;
    li.append(n,tag); list.append(li);
  });
}

/* DÉMARRER, HÔTE UNIQUEMENT */
$("startButton").addEventListener("click",async () => {
  if (!isHost() || busy) return;
  if (allPlayers().length<2) return say("lobbyNotice","Il faut au moins 2 joueurs.");
  const mode=$("gameMode").value;
  const maxRounds=Number($("roundCount").value);
  setBusy(true);
  try {
    const scoreMap={};
    allPlayers().forEach(p=>scoreMap[p.uid]=0);
    const game=makeGame(mode,1,maxRounds);
    await update(ref(db,`rooms/${roomId}`),{
      maxRounds,scores:scoreMap,game
    });
  } catch(error) {
    say("lobbyNotice",friendlyError(error));
  } finally { setBusy(false); }
});

/* TIMER LOCAL, SYNCHRONISÉ SUR L'HEURE DE DÉBUT */
function startTimer(game) {
  if (timerInterval) clearInterval(timerInterval);
  const tick=()=>{
    const elapsed=Math.floor((Date.now()-(game.phaseStartedAt||Date.now()))/1000);
    const left=Math.max(0,10-elapsed);
    $("timerNumber").textContent=String(left);
    if (left===0) {
      clearInterval(timerInterval); timerInterval=null;
      if (isHost() && game.phase==="reveal") hostNext();
    }
  };
  tick();
  timerInterval=setInterval(tick,250);
}

function renderGame() {
  const game=room?.game;
  if (!game) return;
  $("modeLabel").textContent=`MODE ${modeName(game.mode)}`;
  $("roundLabel").textContent=`MANCHE ${game.round}/${room.maxRounds||game.maxRounds||5}`;
  $("secretWord").textContent=game.words?.[user.uid] || "••••••";
  $("gameTitle").textContent=game.title||"La manche";
  $("gameDescription").textContent=game.description||"";
  $("promptText").textContent=game.prompt||"";
  $("promptCard").classList.toggle("hidden",!game.prompt);
  $("secretCard").classList.toggle("hidden",game.mode!=="imposteur");
  $("actionForm").classList.add("hidden");
  $("hostGameControls").classList.add("hidden");
  $("returnButton").classList.add("hidden");
  clearSay("gameNotice");

  if (game.phase==="reveal") {
    $("phaseLabel").textContent="MÉMORISE TON MOT";
    $("timerDescription").textContent="Tu as 10 secondes pour mémoriser ton mot secret.";
    if (lastTimerPhase!==`${game.round}-reveal-${game.phaseStartedAt}`) {
      lastTimerPhase=`${game.round}-reveal-${game.phaseStartedAt}`;
      startTimer(game);
    }
    if (isHost()) {
      $("hostGameControls").classList.remove("hidden");
      $("nextButton").textContent="TERMINER LES 10 SECONDES ↗";
    }
  } else {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval=null;
    $("timerNumber").textContent="•";
  }

  if (game.phase==="clues") {
    $("phaseLabel").textContent="PLACE AUX INDICES";
    $("timerDescription").textContent="Donne un indice sans révéler directement ton mot.";
    configureAction("Ton indice","Un mot seulement","ENVOYER L'INDICE");
  } else if (game.phase==="vote") {
    $("phaseLabel").textContent="À VOUS DE VOTER";
    $("timerDescription").textContent="Écris le pseudo exact du joueur. Pas de vote pour soi.";
    configureAction("Ton vote","Pseudo du joueur","VOTER");
  } else if (game.phase==="answer") {
    $("phaseLabel").textContent="À TOI DE JOUER";
    $("timerDescription").textContent="Envoie ta réponse.";
    configureAction("Ta réponse","Écris ta réponse","VALIDER");
  } else if (game.phase==="result") {
    $("phaseLabel").textContent="RÉSULTATS";
    $("timerDescription").textContent="Les points ont été calculés.";
    $("gameTitle").textContent=game.resultTitle||"Manche terminée";
    $("gameDescription").textContent=game.resultText||"";
    if (isHost()) {
      $("hostGameControls").classList.remove("hidden");
      $("nextButton").textContent=game.round>=(room.maxRounds||5)?"VOIR LE PODIUM ↗":"MANCHE SUIVANTE ↗";
    }
  } else if (game.phase==="finished") {
    $("phaseLabel").textContent="PARTIE TERMINÉE";
    $("timerDescription").textContent="Classement final";
    $("gameTitle").textContent="LE PODIUM.";
    $("gameDescription").textContent="Bravo à tous les joueurs !";
    $("returnButton").classList.remove("hidden");
  }

  renderEntries();
  renderScores();
}
function configureAction(label,placeholder,buttonText) {
  const game=room.game;
  const existing=game.entries?.[user.uid] || game.votes?.[user.uid];
  const canPlay=game.phase==="vote" ? !game.votes?.[user.uid] : !game.entries?.[user.uid];
  if (!canPlay) {
    $("actionForm").classList.add("hidden");
    say("gameNotice","Ta réponse a déjà été enregistrée. Attends les autres joueurs.");
    return;
  }
  $("actionForm").classList.remove("hidden");
  $("actionLabel").textContent=label;
  $("actionInput").placeholder=placeholder;
  $("actionButton").textContent=buttonText;
  $("actionInput").value="";
}
function renderEntries() {
  const list=$("entryList"); list.replaceChildren();
  const game=room?.game; if (!game) return;
  const entries=Object.values(game.entries||{});
  const used=game.usedWords||{};
  $("entryCount").textContent=String(entries.length);
  if (!entries.length) {
    const li=document.createElement("li"); li.textContent="Aucune réponse pour le moment."; list.append(li);
  }
  entries.forEach(e=>{
    const li=document.createElement("li"); li.className="entry";
    const key=String(e.value||"").toLowerCase();
    if (used[key]) li.classList.add("used");
    li.textContent=`${e.pseudo} : ${e.value}`;
    if (used[key]) li.classList.add("used");
    list.append(li);
  });
  if (game.phase==="vote" && game.mode==="imposteur") {
    const count=Object.keys(game.votes||{}).length;
    const li=document.createElement("li"); li.textContent=`Votes reçus : ${count}/${allPlayers().length}`;
    list.append(li);
  }
}
function renderScores() {
  const list=$("scoreList"); list.replaceChildren();
  allPlayers().sort((a,b)=>(currentScores()[b.uid]||0)-(currentScores()[a.uid]||0)).forEach((p,i)=>{
    const li=document.createElement("li");
    const n=document.createElement("span"); n.textContent=`${i+1}. ${p.pseudo}`;
    const pts=document.createElement("strong"); pts.style.color="var(--accent)";
    pts.textContent=`${currentScores()[p.uid]||0} pts`;
    li.append(n,pts); list.append(li);
  });
}

/* ENVOYER UNE RÉPONSE OU UN VOTE */
$("actionForm").addEventListener("submit",async e=>{
  e.preventDefault();
  if (busy || !room?.game) return;
  const game=room.game, value=clean($("actionInput").value);
  if (!value) return say("gameNotice","Écris une réponse avant de valider.");
  setBusy(true); clearSay("gameNotice");
  try {
    if (game.phase==="vote") await submitVote(value);
    else if (game.phase==="answer" || game.phase==="clues") await submitEntry(value);
    else throw new Error("Cette action n'est pas disponible.");
    $("actionInput").value="";
    say("gameNotice","Réponse envoyée !");
  } catch(error) {
    say("gameNotice",friendlyError(error));
  } finally { setBusy(false); }
});

async function submitEntry(value) {
  const game=room.game;
  if (game.entries?.[user.uid]) throw new Error("Tu as déjà répondu.");
  if (game.mode==="association") {
    const key=value.toLowerCase();
    if (game.usedWords?.[key]) throw new Error("Ce mot a déjà été utilisé. Choisis-en un autre.");
  }

  const entry={uid:user.uid,pseudo,value,at:Date.now()};
  const entryRef=ref(db,`rooms/${roomId}/game/entries/${user.uid}`);
  const result=await runTransaction(entryRef,current=>current===null?entry:undefined);
  if (!result.committed) throw new Error("Ta réponse est déjà enregistrée.");

  if (game.mode==="association") {
    await set(ref(db,`rooms/${roomId}/game/usedWords/${value.toLowerCase().replace(/[.#$\[\]/]/g,"_")}`),true);
  }
  await maybeFinish();
}
async function submitVote(value) {
  const target=allPlayers().find(p=>p.pseudo.toLowerCase()===value.toLowerCase());
  if (!target) throw new Error("Pseudo introuvable. Vérifie l'orthographe.");
  if (target.uid===user.uid) throw new Error("Tu ne peux pas voter pour toi-même.");
  const voteRef=ref(db,`rooms/${roomId}/game/votes/${user.uid}`);
  const result=await runTransaction(voteRef,current=>current===null?{
    uid:user.uid,targetUid:target.uid,targetPseudo:target.pseudo
  }:undefined);
  if (!result.committed) throw new Error("Tu as déjà voté.");
  await maybeFinish();
}
async function maybeFinish() {
  const snap=await get(ref(db,`rooms/${roomId}/game`));
  if (!snap.exists()) return;
  const game=snap.val(), people=allPlayers();
  const count=game.phase==="vote"?Object.keys(game.votes||{}).length:Object.keys(game.entries||{}).length;
  if (count>=people.length && isHost()) await scoreAndFinish(game);
}

/* CALCUL DES POINTS */
async function scoreAndFinish(game) {
  if (!isHost() || scoring || !game || game.phase==="result" || game.phase==="finished") return;
  scoring=true;
  try {
    const people=allPlayers(), score={...currentScores()};
    let title="MANCHE TERMINÉE", text="";
    const entries=Object.values(game.entries||{}), votes=Object.values(game.votes||{});
    if (game.mode==="imposteur") {
      const tally={};
      votes.forEach(v=>tally[v.targetUid]=(tally[v.targetUid]||0)+1);
      const top=Object.entries(tally).sort((a,b)=>b[1]-a[1]);
      const found=top.length>0 && top[0][0]===game.impostorUid && (top.length===1 || top[0][1]>(top[1][1]||0));
      if (found) {
        people.forEach(p=>{if(p.uid!==game.impostorUid)score[p.uid]=(score[p.uid]||0)+2;});
        title="IMPOSTEUR DÉMASQUÉ !";
        text=`L'imposteur était ${people.find(p=>p.uid===game.impostorUid)?.pseudo}. Les autres gagnent 2 points.`;
      } else {
        score[game.impostorUid]=(score[game.impostorUid]||0)+3;
        title="L'IMPOSTEUR A GAGNÉ !";
        text=`L'imposteur était ${people.find(p=>p.uid===game.impostorUid)?.pseudo}. Il gagne 3 points.`;
      }
    } else if (game.mode==="vote") {
      const tally={}; votes.forEach(v=>tally[v.targetUid]=(tally[v.targetUid]||0)+1);
      const top=Object.entries(tally).sort((a,b)=>b[1]-a[1]);
      const winner=top.length && (top.length===1 || top[0][1]>(top[1][1]||0)) ? top[0][0] : null;
      if (winner) score[winner]=(score[winner]||0)+2;
      title="RÉSULTAT DU VOTE";
      text=winner?`${people.find(p=>p.uid===winner)?.pseudo} gagne 2 points.`:"Égalité ! Personne ne gagne de points.";
    } else if (["quiz","vrai-faux","mystere"].includes(game.mode)) {
      let correct=0;
      entries.forEach(e=>{
        if(e.value.trim().toLowerCase()===String(game.correctAnswer).trim().toLowerCase()){
          score[e.uid]=(score[e.uid]||0)+2; correct++;
        }
      });
      title="RÉPONSES RÉVÉLÉES";
      text=`${correct} bonne(s) réponse(s). Réponse : ${game.correctAnswer}.`;
    } else if (game.mode==="association") {
      const tally={};
      entries.forEach(e=>tally[e.value.toLowerCase()]=(tally[e.value.toLowerCase()]||0)+1);
      entries.forEach(e=>{if(tally[e.value.toLowerCase()]===1)score[e.uid]=(score[e.uid]||0)+1;});
      title="ASSOCIATION TERMINÉE";
      text="Chaque mot unique rapporte 1 point.";
    }
    await update(ref(db,`rooms/${roomId}`),{
      scores:score,
      "game/phase":"result",
      "game/resultTitle":title,
      "game/resultText":text,
      "game/scored":true
    });
  } finally { scoring=false; }
}

/* CONTRÔLES HÔTE */
$("nextButton").addEventListener("click",hostNext);
async function hostNext() {
  if (!isHost() || busy || !room?.game) return;
  const game=room.game;
  setBusy(true);
  try {
    if (game.phase==="reveal") {
      await update(ref(db,`rooms/${roomId}/game`),{
        phase:"clues",phaseStartedAt:null,title:"Donne un indice",
        description:"Décris ton mot sans le dire directement.",entries:{},votes:{}
      });
    } else if (game.phase==="clues") {
      await update(ref(db,`rooms/${roomId}/game`),{
        phase:"vote",title:"Qui est l'imposteur ?",
        description:"Vote pour le joueur que tu soupçonnes.",entries:{},votes:{}
      });
    } else if (game.phase==="result") {
      if (game.round >= (room.maxRounds||5)) {
        await update(ref(db,`rooms/${roomId}/game`),{phase:"finished"});
      } else {
        const next=makeGame(game.mode,game.round+1,room.maxRounds||5);
        await update(ref(db,`rooms/${roomId}`),{game:next});
      }
    } else if (["answer","vote"].includes(game.phase)) {
      const snap=await get(ref(db,`rooms/${roomId}/game`));
      await scoreAndFinish(snap.val());
    }
  } catch(error) {
    say("gameNotice",friendlyError(error));
  } finally { setBusy(false); }
}

/* COPIER, RETOUR, QUITTER */
$("copyButton").addEventListener("click",async()=>{
  try { await navigator.clipboard.writeText(roomCode); say("lobbyNotice","Code copié !"); }
  catch { say("lobbyNotice",`Code du salon : ${roomCode}`); }
});
$("leaveLobby").addEventListener("click",leaveRoom);
$("returnButton").addEventListener("click",async()=>{
  if (!isHost()) return say("gameNotice","Seul l'hôte peut retourner au lobby.");
  try { await update(ref(db,`rooms/${roomId}/game`),{phase:"lobby"}); }
  catch(error) { say("gameNotice",friendlyError(error)); }
});
function leaveRoom() {
  if (stopListening) stopListening();
  if (timerInterval) clearInterval(timerInterval);
  stopListening=null; timerInterval=null; roomId=null; roomCode=null; pseudo="";
  room=null; lastTimerPhase=""; scoring=false;
  showScreen("homeScreen");
}

function friendlyError(error) {
  const code=error?.code||"";
  if (code==="PERMISSION_DENIED" || code==="permission-denied")
    return "Accès refusé par Firebase. Vérifie les règles de Realtime Database.";
  if (code==="NETWORK_ERROR" || code==="unavailable")
    return "Connexion impossible. Vérifie Internet et réessaie.";
  if (error?.message) return error.message;
  return "Une erreur est survenue. Vérifie la configuration Firebase.";
}

/* Le lancement est masqué chez les joueurs et vérifié dans le code. */
