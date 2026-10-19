"use strict";

/* =========================================================
   JEUX ENTRE POTES
   Firebase Realtime Database
   ========================================================= */

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

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const $ = id => document.getElementById(id);
const uid = getUID();

let roomCode = null;
let roomData = null;
let roomListener = null;
let isLeaving = false;
let localError = "";
let toastTimer = null;

function getUID() {
  let id = localStorage.getItem("jep_player_id");
  if (!id) {
    id = "p_" + Math.random().toString(36).slice(2, 12) +
      Date.now().toString(36);
    localStorage.setItem("jep_player_id", id);
  }
  return id;
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.add("hidden"), 2600);
}

function showError(message) {
  localError = message;
  const el = $("roomError");
  el.textContent = message;
  el.classList.remove("hidden");
}

function clearError() {
  localError = "";
  $("roomError").classList.add("hidden");
}

function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function shuffle(list) {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

/* =========================================================
   BANQUE DE MOTS DE L'IMPOSTEUR
   Chaque entrée contient deux mots proches.
   ========================================================= */

const WORDS = {
  gaming: [
    ["Minecraft", "Roblox"], ["Fortnite", "Apex Legends"],
    ["PlayStation", "Xbox"], ["Mario", "Sonic"],
    ["GTA", "Watch Dogs"], ["FIFA", "eFootball"],
    ["Call of Duty", "Battlefield"], ["Valorant", "Counter-Strike"],
    ["League of Legends", "Dota 2"], ["Rocket League", "Trackmania"],
    ["Among Us", "Loup-Garou"], ["Pokémon", "Digimon"],
    ["Zelda", "Genshin Impact"], ["Mario Kart", "Crash Team Racing"],
    ["The Sims", "Animal Crossing"], ["Fall Guys", "Stumble Guys"],
    ["Rivals", "BedWars"], ["Blox Fruits", "King Legacy"],
    ["Adopt Me", "Pet Simulator"], ["Steal a Brainrot", "Grow a Garden"],
    ["Overwatch", "Team Fortress"], ["Elden Ring", "Dark Souls"],
    ["Red Dead Redemption", "GTA"], ["Farming Simulator", "Euro Truck Simulator"],
    ["Terraria", "Starbound"], ["Subnautica", "Stranded Deep"],
    ["The Last of Us", "Days Gone"], ["God of War", "Assassin's Creed"],
    ["Hogwarts Legacy", "Skyrim"], ["Need for Speed", "Forza Horizon"],
    ["Super Mario", "Kirby"], ["Pac-Man", "Space Invaders"],
    ["Wii Sports", "Nintendo Switch Sports"], ["Tetris", "Puyo Puyo"],
    ["Clash Royale", "Brawl Stars"], ["Clash of Clans", "Boom Beach"],
    ["PUBG", "Free Fire"], ["Doom", "Quake"],
    ["Phasmophobia", "Lethal Company"], ["Dead by Daylight", "Friday the 13th"],
    ["League of Legends", "Wild Rift"], ["Hades", "Dead Cells"],
    ["Cyberpunk 2077", "Starfield"], ["Satisfactory", "Factorio"],
    ["It Takes Two", "A Way Out"], ["Sea of Thieves", "Skull and Bones"],
    ["Spleef", "BedWars"], ["The Forest", "Sons of the Forest"],
    ["Geometry Dash", "The Impossible Game"], ["Plants vs Zombies", "Bloons TD"]
  ],

  animaux: [
    ["Lion", "Tigre"], ["Chat", "Lynx"], ["Chien", "Loup"],
    ["Dauphin", "Requin"], ["Crocodile", "Alligator"],
    ["Lièvre", "Lapin"], ["Abeille", "Guêpe"], ["Aigle", "Faucon"],
    ["Poule", "Dinde"], ["Cheval", "Âne"], ["Zèbre", "Cheval"],
    ["Chameau", "Dromadaire"], ["Lama", "Alpaga"],
    ["Panda", "Koala"], ["Phoque", "Otarie"], ["Baleine", "Dauphin"],
    ["Pieuvre", "Calamar"], ["Grenouille", "Crapaud"],
    ["Papillon", "Mite"], ["Hibou", "Chouette"],
    ["Guépard", "Léopard"], ["Panthère", "Jaguar"],
    ["Éléphant", "Rhinocéros"], ["Hérisson", "Porc-épic"],
    ["Mouton", "Chèvre"], ["Vache", "Buffle"],
    ["Canard", "Oie"], ["Flamant rose", "Cigogne"],
    ["Fourmi", "Termite"], ["Moustique", "Mouche"],
    ["Tortue", "Tortue marine"], ["Iguane", "Caméléon"],
    ["Orque", "Requin blanc"], ["Renard", "Coyote"],
    ["Castor", "Loutre"], ["Écureuil", "Marmotte"],
    ["Sanglier", "Cochon"], ["Âne", "Mulet"],
    ["Perroquet", "Perruche"], ["Autruche", "Émeu"],
    ["Méduse", "Anémone"], ["Crabe", "Homard"],
    ["Crevette", "Écrevisse"], ["Paon", "Faisan"],
    ["Bison", "Yak"], ["Kangourou", "Wallaby"],
    ["Rat", "Souris"], ["Chauve-souris", "Hirondelle"],
    ["Escargot", "Limace"], ["Lézard", "Salamandre"]
  ],

  nourriture: [
    ["Pizza", "Burger"], ["Frites", "Potatoes"], ["Crêpe", "Gaufre"],
    ["Sushi", "Maki"], ["Tacos", "Burrito"], ["Kebab", "Gyros"],
    ["Pâtes", "Nouilles"], ["Lasagnes", "Gratin"],
    ["Croissant", "Pain au chocolat"], ["Donut", "Muffin"],
    ["Glace", "Sorbet"], ["Gâteau", "Tarte"],
    ["Chocolat noir", "Chocolat au lait"], ["Bonbon", "Chewing-gum"],
    ["Pomme", "Poire"], ["Pêche", "Abricot"], ["Citron", "Lime"],
    ["Fraise", "Framboise"], ["Melon", "Pastèque"],
    ["Coca-Cola", "Pepsi"], ["Limonade", "Soda"],
    ["Café", "Chocolat chaud"], ["Thé", "Infusion"],
    ["Eau gazeuse", "Eau plate"], ["Lait", "Lait végétal"],
    ["Riz", "Semoule"], ["Poulet", "Dinde"],
    ["Steak", "Côtelette"], ["Jambon", "Bacon"],
    ["Saucisse", "Merguez"], ["Saumon", "Truite"],
    ["Moules", "Huîtres"], ["Fromage", "Yaourt"],
    ["Beurre", "Margarine"], ["Miel", "Confiture"],
    ["Pain", "Baguette"], ["Brioche", "Pain de mie"],
    ["Ketchup", "Mayonnaise"], ["Moutarde", "Sauce barbecue"],
    ["Salade", "Chou"], ["Carotte", "Panais"],
    ["Courgette", "Concombre"], ["Aubergine", "Poivron"],
    ["Soupe", "Velouté"], ["Omelette", "Œufs brouillés"],
    ["Raclette", "Fondue"], ["Paella", "Risotto"],
    ["Brownie", "Cookie"], ["Crème brûlée", "Flan"]
  ],

  films: [
    ["Harry Potter", "Le Seigneur des anneaux"],
    ["Batman", "Spider-Man"], ["Superman", "Iron Man"],
    ["Shrek", "Madagascar"], ["Toy Story", "Cars"],
    ["Le Roi Lion", "Le Livre de la jungle"],
    ["Les Simpson", "Family Guy"], ["Stranger Things", "Dark"],
    ["Mercredi", "Sabrina"], ["La Casa de Papel", "Lupin"],
    ["Squid Game", "Alice in Borderland"], ["The Walking Dead", "The Last of Us"],
    ["Fast and Furious", "Mission Impossible"], ["Avatar", "Dune"],
    ["Star Wars", "Star Trek"], ["Jurassic Park", "King Kong"],
    ["Joker", "Venom"], ["Deadpool", "Wolverine"],
    ["Titanic", "Pearl Harbor"], ["Jumanji", "Zathura"],
    ["Scream", "Halloween"], ["Conjuring", "Insidious"],
    ["Kung Fu Panda", "Mulan"], ["Ratatouille", "La Petite Sirène"],
    ["Bob l'éponge", "Les Tortues Ninja"], ["Cars", "Planes"],
    ["One Piece", "Naruto"], ["Dragon Ball", "Bleach"],
    ["Demon Slayer", "Jujutsu Kaisen"], ["Pokémon", "Digimon"],
    ["Les Minions", "Les Schtroumpfs"], ["Matrix", "Inception"],
    ["Top Gun", "Pearl Harbor"], ["Rocky", "Creed"],
    ["The Office", "Parks and Recreation"], ["Friends", "How I Met Your Mother"],
    ["Breaking Bad", "Better Call Saul"], ["Loki", "WandaVision"],
    ["Iron Man", "Captain America"], ["Aquaman", "Black Panther"],
    ["Cendrillon", "La Belle au bois dormant"], ["Aladdin", "Hercule"],
    ["Vice-Versa", "Soul"], ["Coco", "Encanto"],
    ["Le Monde de Nemo", "Gang de requins"], ["Cars", "Turbo"],
    ["John Wick", "Equalizer"], ["Maman j'ai raté l'avion", "Beethoven"],
    ["Pirates des Caraïbes", "Peter Pan"], ["Transformers", "Pacific Rim"]
  ],

  sport: [
    ["Football", "Rugby"], ["Basketball", "Handball"],
    ["Tennis", "Badminton"], ["Boxe", "MMA"],
    ["Ski", "Snowboard"], ["Surf", "Kitesurf"],
    ["Natation", "Plongée"], ["Cyclisme", "VTT"],
    ["Formule 1", "MotoGP"], ["Rallye", "Karting"],
    ["Golf", "Mini-golf"], ["Volley-ball", "Beach-volley"],
    ["Judo", "Karaté"], ["Escrime", "Kendo"],
    ["Escalade", "Alpinisme"], ["Marathon", "Sprint"],
    ["Hockey sur glace", "Hockey sur gazon"],
    ["Patinage artistique", "Danse sur glace"],
    ["Équitation", "Polo"], ["Tir à l'arc", "Tir sportif"],
    ["Pétanque", "Bowling"], ["Billard", "Snooker"],
    ["CrossFit", "Musculation"], ["Yoga", "Pilates"],
    ["Aviron", "Canoë"], ["Voile", "Planche à voile"],
    ["Lutte", "Sumo"], ["Taekwondo", "Kick-boxing"],
    ["Dodgeball", "Balle au prisonnier"], ["Fléchettes", "Tir à l'arc"],
    ["Baseball", "Cricket"], ["Football américain", "Rugby"],
    ["Biathlon", "Triathlon"], ["Parkour", "Gymnastique"],
    ["Ping-pong", "Tennis"], ["Course à pied", "Marche rapide"],
    ["Plongeon", "Natation synchronisée"], ["Skeleton", "Luge"],
    ["Haltérophilie", "Powerlifting"], ["Paddle", "Kayak"]
  ],

  objets: [
    ["Téléphone", "Tablette"], ["Ordinateur", "Console"],
    ["Clavier", "Piano"], ["Casque audio", "Écouteurs"],
    ["Souris", "Trackpad"], ["Télévision", "Moniteur"],
    ["Canapé", "Fauteuil"], ["Lit", "Canapé-lit"],
    ["Four", "Micro-ondes"], ["Réfrigérateur", "Congélateur"],
    ["Balai", "Aspirateur"], ["Brosse à dents", "Fil dentaire"],
    ["Stylo", "Crayon"], ["Cahier", "Classeur"],
    ["Sac à dos", "Cartable"], ["Valise", "Sac de voyage"],
    ["Voiture", "Camionnette"], ["Moto", "Scooter"],
    ["Train", "Métro"], ["Avion", "Hélicoptère"],
    ["Bateau", "Sous-marin"], ["Vélo", "Trottinette"],
    ["Lampe", "Bougie"], ["Horloge", "Montre"],
    ["Porte", "Fenêtre"], ["Escalier", "Ascenseur"],
    ["Piscine", "Jacuzzi"], ["Garage", "Cave"],
    ["Restaurant", "Cafétéria"], ["École", "Université"],
    ["Cinéma", "Théâtre"], ["Hôtel", "Camping"],
    ["Plage", "Piscine"], ["Forêt", "Jungle"],
    ["Montagne", "Colline"], ["Rivière", "Canal"],
    ["Pont", "Tunnel"], ["Parc", "Jardin"],
    ["Boulangerie", "Pâtisserie"], ["Pharmacie", "Parfumerie"],
    ["Supermarché", "Centre commercial"], ["Stade", "Arène"],
    ["Aéroport", "Gare"], ["Bibliothèque", "Librairie"],
    ["Musée", "Galerie d'art"], ["Château", "Palais"],
    ["Couteau", "Ciseaux"], ["Marteau", "Maillet"],
    ["Tournevis", "Clé anglaise"], ["Lampe torche", "Lanterne"]
  ],

  culture: [
    ["Mars", "Vénus"], ["Atlantique", "Pacifique"],
    ["Paris", "Lyon"], ["France", "Italie"],
    ["Japon", "Chine"], ["Pyramides", "Colisée"],
    ["Lune", "Soleil"], ["Comète", "Astéroïde"],
    ["Volcan", "Geyser"], ["Tornade", "Ouragan"],
    ["Amazonie", "Sahara"], ["Pôle Nord", "Pôle Sud"],
    ["Or", "Argent"], ["Diamant", "Rubis"],
    ["Shakespeare", "Molière"], ["Mozart", "Beethoven"],
    ["Van Gogh", "Monet"], ["Picasso", "Dalí"],
    ["Einstein", "Newton"], ["Tesla", "Edison"],
    ["Rome", "Athènes"], ["Londres", "Dublin"],
    ["New York", "Los Angeles"], ["Canada", "Australie"],
    ["Espagnol", "Italien"], ["Allemand", "Néerlandais"],
    ["Drapeau", "Blason"], ["Roi", "Empereur"],
    ["Démocratie", "République"], ["Mythologie grecque", "Mythologie romaine"],
    ["Dragon", "Griffon"], ["Sirène", "Nymphe"],
    ["Vampire", "Loup-garou"], ["Fantôme", "Zombie"],
    ["Ange", "Démon"], ["Magie", "Alchimie"],
    ["Robot", "Cyborg"], ["Intelligence artificielle", "Robotique"],
    ["Volcan", "Séisme"], ["Éclipse solaire", "Éclipse lunaire"],
    ["Équateur", "Méridien"], ["Glacier", "Iceberg"],
    ["ADN", "ARN"], ["Bactérie", "Virus"],
    ["Planète", "Étoile"], ["Galaxie", "Nébuleuse"],
    ["Diamant", "Graphite"], ["Énergie solaire", "Énergie éolienne"],
    ["Archéologie", "Paléontologie"], ["Météorite", "Comète"]
  ]
};

/* =========================================================
   QUESTIONS POUR LES AUTRES MODES
   ========================================================= */

const QUIZ = [
  { q: "Quelle est la capitale de l'Italie ?", a: ["Rome", "Milan", "Venise", "Naples"], c: 0, cat: "culture" },
  { q: "Combien de côtés a un hexagone ?", a: ["5", "6", "7", "8"], c: 1, cat: "culture" },
  { q: "Quelle planète est surnommée la planète rouge ?", a: ["Vénus", "Jupiter", "Mars", "Mercure"], c: 2, cat: "culture" },
  { q: "Quel animal est le plus grand au monde ?", a: ["Éléphant", "Girafe", "Baleine bleue", "Requin blanc"], c: 2, cat: "animaux" },
  { q: "Combien de joueurs une équipe de football a-t-elle sur le terrain ?", a: ["9", "10", "11", "12"], c: 2, cat: "sport" },
  { q: "Quel studio a créé Minecraft à l'origine ?", a: ["Mojang", "Nintendo", "Valve", "Epic Games"], c: 0, cat: "gaming" },
  { q: "Quel est le symbole chimique de l'eau ?", a: ["CO2", "H2O", "O2", "NaCl"], c: 1, cat: "culture" },
  { q: "Combien de minutes y a-t-il dans deux heures ?", a: ["100", "110", "120", "140"], c: 2, cat: "culture" },
  { q: "Quel pays est connu pour les pyramides de Gizeh ?", a: ["Grèce", "Égypte", "Mexique", "Inde"], c: 1, cat: "culture" },
  { q: "Quel est le satellite naturel de la Terre ?", a: ["Mars", "La Lune", "Le Soleil", "Titan"], c: 1, cat: "culture" },
  { q: "Quel est le résultat de 9 × 8 ?", a: ["63", "72", "81", "64"], c: 1, cat: "culture" },
  { q: "Quel organe pompe le sang ?", a: ["Poumon", "Foie", "Cœur", "Rein"], c: 2, cat: "culture" },
  { q: "Quel jeu met en scène des Creepers ?", a: ["Terraria", "Minecraft", "Roblox", "Fortnite"], c: 1, cat: "gaming" },
  { q: "Quelle couleur obtient-on en mélangeant bleu et jaune ?", a: ["Violet", "Vert", "Orange", "Rose"], c: 1, cat: "culture" },
  { q: "Quel est le plus grand océan ?", a: ["Atlantique", "Indien", "Arctique", "Pacifique"], c: 3, cat: "culture" },
  { q: "Combien de pattes a une araignée ?", a: ["6", "8", "10", "12"], c: 1, cat: "animaux" },
  { q: "Dans quel sport utilise-t-on un volant ?", a: ["Tennis", "Badminton", "Squash", "Volley"], c: 1, cat: "sport" },
  { q: "Quelle entreprise fabrique la PlayStation ?", a: ["Microsoft", "Sony", "Nintendo", "Sega"], c: 1, cat: "gaming" },
  { q: "Quel est l'ingrédient principal du guacamole ?", a: ["Concombre", "Avocat", "Courgette", "Petit pois"], c: 1, cat: "nourriture" },
  { q: "Combien de jours compte une année bissextile ?", a: ["364", "365", "366", "367"], c: 2, cat: "culture" },
  { q: "Quel personnage est associé à une toile d'araignée ?", a: ["Batman", "Spider-Man", "Superman", "Flash"], c: 1, cat: "films" },
  { q: "Quel gaz les plantes absorbent-elles principalement ?", a: ["Oxygène", "Hélium", "Dioxyde de carbone", "Hydrogène"], c: 2, cat: "culture" },
  { q: "Quelle est la monnaie du Japon ?", a: ["Won", "Yuan", "Yen", "Dollar"], c: 2, cat: "culture" },
  { q: "Quel est le contraire de nocturne ?", a: ["Diurne", "Lunaire", "Solaire", "Crépusculaire"], c: 0, cat: "culture" },
  { q: "Quel animal produit le miel ?", a: ["Guêpe", "Abeille", "Fourmi", "Papillon"], c: 1, cat: "animaux" },
  { q: "Dans quel jeu construit-on souvent avec des blocs ?", a: ["Minecraft", "FIFA", "Valorant", "The Sims"], c: 0, cat: "gaming" },
  { q: "Quelle ville est la capitale de l'Espagne ?", a: ["Barcelone", "Séville", "Madrid", "Valence"], c: 2, cat: "culture" },
  { q: "Quel métal est liquide à température ambiante ?", a: ["Fer", "Mercure", "Cuivre", "Aluminium"], c: 1, cat: "culture" },
  { q: "Quel instrument possède généralement 88 touches ?", a: ["Guitare", "Piano", "Violon", "Flûte"], c: 1, cat: "culture" },
  { q: "Quel est le résultat de 15 + 27 ?", a: ["32", "42", "52", "43"], c: 1, cat: "culture" },
  { q: "Quel animal est célèbre pour sa poche ventrale ?", a: ["Koala", "Kangourou", "Panda", "Wombat"], c: 1, cat: "animaux" },
  { q: "Quelle est la langue principalement parlée au Brésil ?", a: ["Espagnol", "Portugais", "Français", "Anglais"], c: 1, cat: "culture" },
  { q: "Quel sport se joue à Roland-Garros ?", a: ["Golf", "Tennis", "Rugby", "Cyclisme"], c: 1, cat: "sport" },
  { q: "Quel personnage vit à Bikini Bottom ?", a: ["Garfield", "Bob l'éponge", "Nemo", "Stitch"], c: 1, cat: "films" },
  { q: "Combien de mois y a-t-il dans une année ?", a: ["10", "11", "12", "13"], c: 2, cat: "culture" },
  { q: "Quel est le plus petit nombre premier ?", a: ["0", "1", "2", "3"], c: 2, cat: "culture" },
  { q: "Quel jeu est célèbre pour ses Battle Royale ?", a: ["Fortnite", "The Sims", "Tetris", "Stardew Valley"], c: 0, cat: "gaming" },
  { q: "Quel fruit est associé au cidre traditionnel ?", a: ["Raisin", "Pomme", "Poire", "Orange"], c: 1, cat: "nourriture" },
  { q: "Combien de cordes possède généralement une guitare classique ?", a: ["4", "5", "6", "7"], c: 2, cat: "culture" },
  { q: "Quel est le plus grand continent ?", a: ["Afrique", "Europe", "Asie", "Amérique du Sud"], c: 2, cat: "culture" },
  { q: "Quel est le nom du célèbre sorcier à lunettes ?", a: ["Merlin", "Harry Potter", "Gandalf", "Dumbledore"], c: 1, cat: "films" },
  { q: "Quel animal est un mammifère marin ?", a: ["Thon", "Dauphin", "Pieuvre", "Méduse"], c: 1, cat: "animaux" },
  { q: "Combien font 12 × 12 ?", a: ["124", "144", "132", "154"], c: 1, cat: "culture" },
  { q: "Quel est le premier mois de l'année ?", a: ["Décembre", "Janvier", "Mars", "Février"], c: 1, cat: "culture" },
  { q: "Quel appareil sert à mesurer la température ?", a: ["Baromètre", "Thermomètre", "Chronomètre", "Altimètre"], c: 1, cat: "culture" },
  { q: "Quel héros Marvel utilise un bouclier étoilé ?", a: ["Thor", "Hulk", "Captain America", "Hawkeye"], c: 2, cat: "films" },
  { q: "Quel est le résultat de 100 ÷ 4 ?", a: ["20", "25", "40", "50"], c: 1, cat: "culture" },
  { q: "Quel légume est souvent orange ?", a: ["Carotte", "Concombre", "Aubergine", "Courgette"], c: 0, cat: "nourriture" },
  { q: "Quel pays a pour capitale Berlin ?", a: ["Autriche", "Allemagne", "Suisse", "Belgique"], c: 1, cat: "culture" },
  { q: "Quel jeu consiste à aligner des pièces pour faire disparaître des lignes ?", a: ["Tetris", "Pac-Man", "Pong", "Doom"], c: 0, cat: "gaming" }
];

const TRUE_FALSE = [
  { q: "Les pieuvres ont trois cœurs.", a: true },
  { q: "Le Soleil est une planète.", a: false },
  { q: "Les chauves-souris sont des mammifères.", a: true },
  { q: "L'eau pure gèle à environ 0 °C à pression normale.", a: true },
  { q: "Les humains ont normalement quatre poumons.", a: false },
  { q: "La Terre tourne autour du Soleil.", a: true },
  { q: "Les araignées sont des insectes.", a: false },
  { q: "Un triangle a quatre côtés.", a: false },
  { q: "Le miel peut se conserver très longtemps s'il est bien stocké.", a: true },
  { q: "Les dauphins respirent sous l'eau avec des branchies.", a: false },
  { q: "La lumière voyage plus vite que le son.", a: true },
  { q: "La capitale de l'Australie est Sydney.", a: false },
  { q: "Les plantes utilisent la lumière pour la photosynthèse.", a: true },
  { q: "Le mont Everest est la plus haute montagne au-dessus du niveau de la mer.", a: true },
  { q: "Les pingouins vivent naturellement au pôle Nord.", a: false },
  { q: "Un kilogramme équivaut à 1 000 grammes.", a: true },
  { q: "Vénus est la planète la plus proche du Soleil.", a: false },
  { q: "Les crocodiles sont des reptiles.", a: true },
  { q: "Le son peut se propager dans le vide.", a: false },
  { q: "Les tomates sont botaniquement des fruits.", a: true },
  { q: "La Grande Muraille de Chine est facilement visible à l'œil nu depuis la Lune.", a: false },
  { q: "Les abeilles communiquent notamment par des danses.", a: true },
  { q: "Un octogone possède huit côtés.", a: true },
  { q: "Les humains adultes ont normalement 206 os.", a: true },
  { q: "Le cœur humain se trouve entièrement à droite.", a: false },
  { q: "La baleine bleue est un mammifère.", a: true },
  { q: "Le diamant et le graphite contiennent du carbone.", a: true },
  { q: "Le Japon se trouve en Europe.", a: false },
  { q: "Mars possède deux lunes naturelles.", a: true },
  { q: "Les requins sont des mammifères.", a: false },
  { q: "Le français est une langue romane.", a: true },
  { q: "La Lune produit sa propre lumière.", a: false },
  { q: "Les flamants roses peuvent leur couleur à leur alimentation.", a: true },
  { q: "Un marathon mesure environ 42,2 kilomètres.", a: true },
  { q: "Le zéro est un nombre pair.", a: true },
  { q: "Les plantes respirent uniquement pendant la nuit.", a: false },
  { q: "L'Antarctique est le continent le plus froid en moyenne.", a: true },
  { q: "La foudre ne frappe jamais deux fois au même endroit.", a: false },
  { q: "Le bambou est une plante de la famille des graminées.", a: true },
  { q: "Le sang humain est bleu avant d'être exposé à l'air.", a: false }
];

const PREFERENCES = [
  ["Pouvoir voler", "Pouvoir devenir invisible"],
  ["Vivre à la mer", "Vivre à la montagne"],
  ["Ne plus jouer aux jeux vidéo", "Ne plus regarder de films"],
  ["Avoir beaucoup d'argent", "Avoir beaucoup de temps libre"],
  ["Voyager dans le passé", "Voyager dans le futur"],
  ["Lire dans les pensées", "Voir l'avenir"],
  ["Être célèbre", "Être anonyme mais riche"],
  ["Manger sucré", "Manger salé"],
  ["Ne jamais avoir froid", "Ne jamais avoir chaud"],
  ["Avoir un dragon", "Avoir un robot intelligent"],
  ["Habiter dans un château", "Habiter sur une île"],
  ["Parler toutes les langues", "Savoir jouer de tous les instruments"],
  ["Gagner chaque débat", "Faire rire tout le monde"],
  ["Être très rapide", "Être très fort"],
  ["Avoir un bouton pause du temps", "Avoir un bouton retour en arrière"],
  ["Ne plus utiliser de téléphone", "Ne plus utiliser d'ordinateur"],
  ["Faire un tour du monde", "Vivre un an dans l'espace"],
  ["Être le meilleur joueur", "Être le meilleur stratège"],
  ["Avoir toujours raison", "Ne jamais avoir de regrets"],
  ["Pouvoir respirer sous l'eau", "Pouvoir survivre dans l'espace"],
  ["Avoir un majordome", "Avoir un chef cuisinier"],
  ["Être invisible une heure par jour", "Pouvoir te téléporter une fois par jour"],
  ["Ne dormir que 3 heures", "Ne jamais être fatigué"],
  ["Posséder une maison connectée", "Posséder une voiture volante"],
  ["Être bloqué dans un jeu vidéo", "Être bloqué dans un film"],
  ["Vivre sans musique", "Vivre sans séries"],
  ["Avoir une mémoire parfaite", "Apprendre dix fois plus vite"],
  ["Être connu pour ton humour", "Être connu pour ton intelligence"],
  ["Toujours dire la vérité", "Ne jamais pouvoir parler"],
  ["Avoir 10 meilleurs amis", "Avoir un seul ami exceptionnel"],
  ["Explorer une planète inconnue", "Explorer les profondeurs de l'océan"],
  ["Avoir un animal qui parle", "Avoir un animal qui te comprend"],
  ["Pouvoir changer de taille", "Pouvoir changer d'apparence"],
  ["Ne plus faire la queue", "Ne plus être dans les embouteillages"],
  ["Gagner 1 000 € maintenant", "Tenter de gagner 10 000 €"],
  ["Être champion du monde", "Créer ton propre jeu à succès"],
  ["Vivre dans une ville futuriste", "Vivre dans une forêt magique"],
  ["Avoir toujours de la chance", "Être toujours très persévérant"],
  ["Pouvoir arrêter le temps", "Pouvoir accélérer le temps"],
  ["Faire rire tes amis", "Les impressionner à chaque fois"]
];

const RIDDLES = [
  { q: "Plus je sèche, plus je deviens mouillée. Qui suis-je ?", a: "Une serviette" },
  { q: "J'ai des aiguilles mais je ne couds pas. Qui suis-je ?", a: "Une horloge" },
  { q: "Je peux faire le tour du monde en restant dans un coin. Qui suis-je ?", a: "Un timbre" },
  { q: "Je grandis sans être vivant et je meurs avec l'eau. Qui suis-je ?", a: "Le feu" },
  { q: "Plus on m'enlève, plus je deviens grand. Qui suis-je ?", a: "Un trou" },
  { q: "J'ai des touches mais aucune porte. Qui suis-je ?", a: "Un clavier" },
  { q: "Je monte et je descends sans bouger. Qui suis-je ?", a: "Un escalier" },
  { q: "Je suis plein de trous mais je retiens l'eau. Qui suis-je ?", a: "Une éponge" },
  { q: "Je parle sans bouche et j'entends sans oreilles. Qui suis-je ?", a: "Un écho" },
  { q: "J'ai un cou mais pas de tête. Qui suis-je ?", a: "Une bouteille" },
  { q: "Je suis toujours devant toi mais tu ne peux jamais me voir. Qui suis-je ?", a: "L'avenir" },
  { q: "Qu'est-ce qui a des dents mais ne mange jamais ?", a: "Un peigne" },
  { q: "Qu'est-ce qui peut être cassé sans être touché ?", a: "Une promesse" },
  { q: "Je peux être long ou court, je peux être cultivé ou acheté. Qui suis-je ?", a: "Un légume" },
  { q: "J'ai des villes sans maisons et des rivières sans eau. Qui suis-je ?", a: "Une carte" },
  { q: "Qu'est-ce qui a quatre pieds mais ne marche pas ?", a: "Une table" },
  { q: "Qu'est-ce qui disparaît dès qu'on prononce son nom ?", a: "Le silence" },
  { q: "Je suis léger comme une plume mais personne ne me retient longtemps. Qui suis-je ?", a: "Le souffle" },
  { q: "J'ai une tête et une queue mais pas de corps. Qui suis-je ?", a: "Une pièce de monnaie" },
  { q: "Qu'est-ce qui a des branches mais pas de feuilles ?", a: "Une banque" },
  { q: "Je suis à toi, mais les autres m'utilisent plus que toi. Qui suis-je ?", a: "Ton prénom" },
  { q: "Qu'est-ce qui peut remplir une pièce sans prendre de place ?", a: "La lumière" },
  { q: "Je commence la nuit et termine le matin. Qui suis-je ?", a: "La lettre N" },
  { q: "Qu'est-ce qui a un œil mais ne voit rien ?", a: "Une aiguille" },
  { q: "Je suis noir quand tu m'achètes, rouge quand tu m'utilises et gris quand tu me jettes. Qui suis-je ?", a: "Le charbon" },
  { q: "Qu'est-ce qui tombe sans jamais se faire mal ?", a: "La pluie" },
  { q: "Quel mois possède 28 jours ?", a: "Tous les mois" },
  { q: "Qu'est-ce qui a beaucoup de mots mais ne parle jamais ?", a: "Un dictionnaire" },
  { q: "Je peux être ouvert ou fermé, mais je ne suis pas une porte. Qui suis-je ?", a: "Un livre" },
  { q: "Qu'est-ce qui court sans jambes ?", a: "Une rivière" }
];

const CHALLENGES = [
  "Fais deviner un animal sans parler.",
  "Imite un personnage de film pendant 10 secondes.",
  "Fais une déclaration dramatique à un objet.",
  "Chante une chanson connue sans dire les paroles.",
  "Parle comme un robot pendant le prochain tour.",
  "Fais deviner un métier en mime.",
  "Raconte une histoire en utilisant trois mots choisis par les autres.",
  "Fais une publicité de 15 secondes pour une chaussette.",
  "Imite un commentateur sportif.",
  "Décris ton jeu vidéo préféré comme si c'était un documentaire animalier.",
  "Fais une phrase sans utiliser la lettre A.",
  "Invente un slogan pour le groupe.",
  "Fais deviner un film avec trois indices.",
  "Raconte une mini-histoire qui finit par un mot imposé.",
  "Parle avec un accent inventé jusqu'au prochain tour.",
  "Fais un compliment original à chaque joueur.",
  "Décris une pizza comme si c'était un objet légendaire.",
  "Mime un sport choisi par les autres.",
  "Invente un super-héros et son pouvoir absurde.",
  "Fais une imitation d'un présentateur météo.",
  "Donne cinq animaux en cinq secondes.",
  "Cite cinq jeux vidéo en cinq secondes.",
  "Fais deviner un objet les yeux fermés en le touchant, si tout le monde est d'accord.",
  "Raconte un souvenir drôle sans citer de nom.",
  "Invente un nouveau mot et explique sa définition.",
  "Décris un film sans dire le nom des personnages.",
  "Fais un discours pour devenir président du salon.",
  "Explique comment faire un sandwich comme un scientifique.",
  "Fais deviner une émotion uniquement avec ton visage.",
  "Invente une fin alternative à un film connu."
];

/* =========================================================
   INTERFACE ET SALONS
   ========================================================= */

function getPlayers(data = roomData) {
  return Object.entries(data?.players || {})
    .map(([id, player]) => ({ ...player, id }))
    .filter(player => player.name);
}

function isHost() {
  return Boolean(roomData && roomData.hostId === uid);
}

function currentPlayer() {
  return roomData?.players?.[uid] || null;
}

function setBusy(button, busy, text) {
  if (!button) return;
  button.disabled = busy;
  if (busy) {
    button.dataset.oldText = button.textContent;
    button.textContent = text || "Chargement…";
  } else {
    button.textContent = button.dataset.oldText || button.textContent;
  }
}

function showHome() {
  $("home").classList.remove("hidden");
  $("roomView").classList.add("hidden");
  $("hostSettings").classList.add("hidden");
  $("waitingNotice").classList.add("hidden");
  $("gameView").classList.add("hidden");
  $("scorePanel").classList.add("hidden");
}

function showRoom() {
  $("home").classList.add("hidden");
  $("roomView").classList.remove("hidden");
}

function getPlayerName(inputId) {
  const name = $(inputId).value.trim().replace(/\s+/g, " ");
  if (!name) throw new Error("Entre un pseudo avant de continuer.");
  if (name.length > 20) throw new Error("Ton pseudo doit faire 20 caractères maximum.");
  return name;
}

async function createRoom() {
  const button = $("createBtn");
  setBusy(button, true, "Création…");
  clearError();

  try {
    const name = getPlayerName("createName");
    let code = "";
    let created = false;

    for (let attempt = 0; attempt < 8; attempt++) {
      code = makeCode();
      const ref = db.ref("rooms/" + code);
      const result = await ref.transaction(current => {
        if (current !== null) return;
        return {
          hostId: uid,
          createdAt: Date.now(),
          status: "lobby",
          settings: {
            mode: "imposteur",
            category: "toutes",
            impostorCount: 1,
            roundCount: 10
          },
          round: 0,
          players: {
            [uid]: {
              name,
              joinedAt: Date.now(),
              score: 0,
              online: true
            }
          }
        };
      });

      if (result.committed) {
        created = true;
        break;
      }
    }

    if (!created) throw new Error("Impossible de créer un code. Réessaie.");

    enterRoom(code);
    toast("Salon créé ! Partage le code à tes amis.");
  } catch (error) {
    showError(error.message || "Impossible de créer le salon.");
  } finally {
    setBusy(button, false);
  }
}

async function joinRoom() {
  const button = $("joinBtn");
  setBusy(button, true, "Connexion…");
  clearError();

  try {
    const name = getPlayerName("joinName");
    const code = $("joinCode").value.trim().toUpperCase();

    if (!/^[A-Z0-9]{6}$/.test(code)) {
      throw new Error("Le code doit contenir 6 caractères.");
    }

    const ref = db.ref("rooms/" + code);
    const snapshot = await ref.get();

    if (!snapshot.exists()) throw new Error("Salon introuvable. Vérifie le code.");

    const room = snapshot.val();
    if (room.status === "finished") {
      throw new Error("Cette partie est terminée.");
    }

    if (room.status === "playing" && !room.players?.[uid]) {
      throw new Error("La partie a déjà commencé.");
    }

    const existingPlayers = Object.values(room.players || {});
    const sameName = existingPlayers.some(
      player => player.name.toLowerCase() === name.toLowerCase()
    );

    if (sameName && !room.players?.[uid]) {
      throw new Error("Ce pseudo est déjà utilisé dans ce salon.");
    }

    const updates = {};
    updates["players/" + uid] = {
      name,
      joinedAt: Date.now(),
      score: room.players?.[uid]?.score || 0,
      online: true
    };

    await ref.update(updates);
    enterRoom(code);
    toast("Tu as rejoint le salon !");
  } catch (error) {
    showError(error.message || "Impossible de rejoindre le salon.");
  } finally {
    setBusy(button, false);
  }
}

function enterRoom(code) {
  if (roomListener && roomCode) {
    db.ref("rooms/" + roomCode).off("value", roomListener);
  }

  roomCode = code;
  isLeaving = false;
  showRoom();
  $("roomCode").textContent = code;
  $("roomError").classList.add("hidden");

  roomListener = snapshot => {
    if (!snapshot.exists()) {
      showError("Ce salon n'existe plus.");
      return;
    }

    roomData = snapshot.val();
    renderRoom();
  };

  db.ref("rooms/" + roomCode).on("value", roomListener, error => {
    showError("Firebase a refusé la lecture : " + error.message);
  });

  db.ref("rooms/" + roomCode + "/players/" + uid + "/online")
    .onDisconnect().set(false).catch(() => {});
}

function renderRoom() {
  if (!roomData) return;

  $("roomCode").textContent = roomCode;
  const players = getPlayers();

  $("playerCount").textContent = players.length;
  $("playersList").innerHTML = players.map(player => `
    <div class="player ${player.id === uid ? "me" : ""}">
      <strong>${escapeHTML(player.name)}</strong>
      <small>
        ${player.id === roomData.hostId ? "👑 Hôte" : "Joueur"}
        ${player.id === uid ? " · Toi" : ""}
      </small>
      <small>🏆 ${Number(player.score || 0)} points</small>
    </div>
  `).join("");

  $("hostSettings").classList.toggle("hidden", !isHost() || roomData.status !== "lobby");
  $("waitingNotice").classList.toggle("hidden", isHost() || roomData.status !== "lobby");
  $("gameView").classList.toggle("hidden", roomData.status === "lobby");
  $("scorePanel").classList.toggle("hidden", !["finished", "results"].includes(roomData.status));

  if (roomData.status === "lobby") {
    $("gameContent").innerHTML = "";
    $("gameActions").innerHTML = "";
    $("gameMessage").textContent = "";
    return;
  }

  if (roomData.status === "finished" || roomData.status === "results") {
    renderScores();
    if (isHost()) {
      $("gameActions").innerHTML =
        `<button class="btn primary full" id="restartBtn">RECOMMENCER UNE PARTIE</button>`;
      $("restartBtn").onclick = restartRoom;
    } else {
      $("gameActions").innerHTML = `<div class="notice">En attente de l'hôte pour recommencer.</div>`;
    }
    return;
  }

  renderGame();
}

function renderScores() {
  const players = getPlayers().sort((a, b) => (b.score || 0) - (a.score || 0));
  $("scoreList").innerHTML = players.map((player, index) => `
    <div class="score-row">
      <span>${index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "　"} 
        ${escapeHTML(player.name)}</span>
      <strong>${Number(player.score || 0)} pts</strong>
    </div>
  `).join("");
}

/* =========================================================
   PARAMÈTRES ET DÉMARRAGE
   ========================================================= */

$("createBtn").addEventListener("click", createRoom);
$("joinBtn").addEventListener("click", joinRoom);

$("joinCode").addEventListener("input", event => {
  event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
});

$("copyCodeBtn").addEventListener("click", async () => {
  if (!roomCode) return;
  try {
    await navigator.clipboard.writeText(roomCode);
    toast("Code copié !");
  } catch {
    toast("Ton code : " + roomCode);
  }
});

$("startBtn").addEventListener("click", startGame);

async function startGame() {
  if (!isHost()) return showError("Seul l'hôte peut lancer la partie.");

  const players = getPlayers();
  if (players.length < 2) {
    return showError("Il faut au moins 2 joueurs pour commencer.");
  }

  const mode = $("modeSelect").value;
  const category = $("categorySelect").value;
  const impostorCount = Math.max(1, Number($("impostorCount").value) || 1);
  const roundCount = Math.max(1, Number($("roundCount").value) || 10);

  if (mode === "imposteur" && impostorCount >= players.length) {
    return showError("Il faut au moins un joueur normal. Réduis le nombre d'imposteurs.");
  }

  const settings = { mode, category, impostorCount, roundCount };
  try {
    await db.ref("rooms/" + roomCode).update({
      settings,
      round: 1,
      status: "playing",
      players: Object.fromEntries(players.map(p => [
        p.id,
        { ...roomData.players[p.id], score: Number(p.score || 0) }
      ]))
    });
    await startRound(1);
  } catch (error) {
    showError("Impossible de lancer la partie : " + error.message);
  }
}

function getCategoryPairs(category) {
  if (category === "toutes" || category === "mix") {
    return Object.values(WORDS).flat();
  }
  return WORDS[category] || Object.values(WORDS).flat();
}

function getQuestionsForMode(mode, category) {
  if (mode === "quiz") {
    const questions = category === "toutes" || category === "mix"
      ? QUIZ
      : QUIZ.filter(item => item.cat === category);
    return shuffle(questions.length ? questions : QUIZ);
  }

  if (mode === "vraioufaux") return shuffle(TRUE_FALSE);
  if (mode === "preferences") return shuffle(PREFERENCES);
  if (mode === "devinettes") return shuffle(RIDDLES);
  if (mode === "defis") return shuffle(CHALLENGES);
  return [];
}

async function startRound(roundNumber) {
  if (!isHost()) return;

  const players = getPlayers();
  const settings = roomData.settings || {};
  const mode = settings.mode || "imposteur";
  const category = settings.category || "toutes";

  const game = {
    mode,
    round: roundNumber,
    phase: mode === "imposteur" ? "clues" : "question",
    startedAt: Date.now(),
    answers: {},
    votes: {},
    revealed: false
  };

  if (mode === "imposteur") {
    const pairs = getCategoryPairs(category);
    const pair = randomItem(pairs);
    const shuffledPlayers = shuffle(players);
    const count = Math.min(
      Math.max(1, Number(settings.impostorCount) || 1),
      players.length - 1
    );
    const impostors = shuffledPlayers.slice(0, count).map(p => p.id);

    game.word = pair[0];
    game.impostorWord = pair[1];
    game.impostors = Object.fromEntries(impostors.map(id => [id, true]));
    game.phase = "clues";
  } else {
    const questions = getQuestionsForMode(mode, category);
    game.questions = questions;
    game.questionIndex = 0;
    game.currentQuestion = questions[0] || null;
  }

  try {
    await db.ref("rooms/" + roomCode).update({
      round: roundNumber,
      game,
      status: "playing"
    });
  } catch (error) {
    showError("Impossible de lancer la manche : " + error.message);
  }
}

/* =========================================================
   AFFICHAGE DU JEU
   ========================================================= */

function modeName(mode) {
  return ({
    imposteur: "🕵️ IMPOSTEUR",
    quiz: "🧠 QUIZ",
    vraioufaux: "✅ VRAI OU FAUX",
    preferences: "🤔 TU PRÉFÈRES",
    devinettes: "💡 DEVINETTES",
    defis: "🔥 DÉFIS"
  })[mode] || "JEU";
}

function renderGame() {
  const game = roomData.game;
  if (!game) return;

  $("gameModeLabel").textContent = modeName(game.mode);
  $("roundLabel").textContent =
    `Manche ${Number(roomData.round || 1)} / ${Number(roomData.settings?.roundCount || 10)}`;

  const content = $("gameContent");
  const actions = $("gameActions");
  const message = $("gameMessage");

  actions.innerHTML = "";
  message.textContent = "";

  if (game.mode === "imposteur") {
    renderImpostor(game, content, actions, message);
  } else if (game.mode === "quiz") {
    renderQuiz(game, content, actions, message);
  } else if (game.mode === "vraioufaux") {
    renderTrueFalse(game, content, actions, message);
  } else if (game.mode === "preferences") {
    renderPreference(game, content, actions, message);
  } else if (game.mode === "devinettes") {
    renderRiddle(game, content, actions, message);
  } else if (game.mode === "defis") {
    renderChallenge(game, content, actions, message);
  }
}

function addButton(container, label, className, callback) {
  const button = document.createElement("button");
  button.className = "btn " + className;
  button.textContent = label;
  container.appendChild(button);
  button.addEventListener("click", callback);
  return button;
}

function renderImpostor(game, content, actions, message) {
  const players = getPlayers();
  const me = currentPlayer();
  const isImpostor = Boolean(game.impostors?.[uid]);

  if (game.phase === "clues") {
    const myWord = isImpostor ? game.impostorWord : game.word;

    content.innerHTML = `
      <div class="game-card">
        <div class="eyebrow">TON MOT SECRET</div>
        <div class="big-word">${escapeHTML(myWord || "Mot indisponible")}</div>
        <p class="muted">
          ${isImpostor
            ? "Tu es l'imposteur ! Ton mot est différent. Fais semblant de connaître le mot des autres."
            : "Tu n'es pas l'imposteur. Donne un indice sans révéler le mot exact."}
        </p>
      </div>
      <div class="notice">
        Tour de table : chaque joueur donne un indice à voix haute.
        Quand tout le monde a parlé, l'hôte lance le vote.
      </div>
    `;

    if (isHost()) {
      addButton(actions, "PASSER AU VOTE", "primary full", () => changePhase("vote"));
    } else {
      message.textContent = "Attends que l'hôte lance le vote.";
    }
    return;
  }

  if (game.phase === "vote") {
    const alreadyVoted = Boolean(game.votes?.[uid]);

    content.innerHTML = `
      <div class="game-card">
        <div class="eyebrow">PHASE DE VOTE</div>
        <div class="game-question">Qui est l'imposteur ?</div>
        <p class="muted">Choisis le joueur que tu soupçonnes.</p>
      </div>
    `;

    if (!alreadyVoted) {
      const list = document.createElement("div");
      list.className = "players";

      players.filter(p => p.id !== uid).forEach(player => {
        const button = document.createElement("button");
        button.className = "btn secondary";
        button.textContent = "🗳️ " + player.name;
        button.addEventListener("click", () => castVote(player.id));
        list.appendChild(button);
      });

      actions.appendChild(list);
    } else {
      message.textContent = "Ton vote est enregistré. Attends les autres joueurs.";
    }

    const voteCount = Object.keys(game.votes || {}).length;
    message.textContent += ` Votes reçus : ${voteCount}/${players.length}.`;

    if (isHost()) {
      addButton(actions, "RÉVÉLER LES RÉSULTATS", "primary full", revealVotes);
    }
    return;
  }

  if (game.phase === "reveal") {
    const impostorNames = players
      .filter(p => game.impostors?.[p.id])
      .map(p => p.name);

    const voteSummary = players.map(player => {
      const target = game.votes?.[player.id];
      const targetPlayer = target ? roomData.players?.[target] : null;
      return `<div class="score-row">
        <span>${escapeHTML(player.name)}</span>
        <strong>${targetPlayer ? escapeHTML(targetPlayer.name) : "Pas de vote"}</strong>
      </div>`;
    }).join("");

    content.innerHTML = `
      <div class="game-card">
        <div class="eyebrow">RÉVÉLATION</div>
        <div class="game-question">Les imposteurs étaient…</div>
        <div class="big-word">${impostorNames.map(escapeHTML).join(", ") || "Inconnu"}</div>
        <p class="muted">Mot des joueurs : ${escapeHTML(game.word)}</p>
        <p class="muted">Mot des imposteurs : ${escapeHTML(game.impostorWord)}</p>
      </div>
      <h3>Résultat des votes</h3>
      ${voteSummary}
    `;

    if (isHost()) {
      addButton(actions, "MANCHE SUIVANTE", "primary full", nextRound);
    } else {
      message.textContent = "En attente de l'hôte pour la manche suivante.";
    }
  }
}

async function changePhase(phase) {
  if (!isHost()) return;
  try {
    await db.ref(`rooms/${roomCode}/game`).update({
      phase,
      votes: {},
      revealed: false
    });
  } catch (error) {
    showError("Impossible de changer de phase : " + error.message);
  }
}

async function castVote(targetId) {
  const gameRef = db.ref(`rooms/${roomCode}/game`);
  try {
    const result = await gameRef.transaction(game => {
      if (!game || game.phase !== "vote") return;
      game.votes = game.votes || {};
      if (game.votes[uid]) return;
      game.votes[uid] = targetId;
      return game;
    });

    if (result.committed) toast("Vote enregistré !");
  } catch (error) {
    showError("Vote impossible : " + error.message);
  }
}

async function revealVotes() {
  if (!isHost()) return;

  const players = getPlayers();
  const game = roomData.game;
  const votes = game.votes || {};
  const counts = {};

  Object.values(votes).forEach(targetId => {
    counts[targetId] = (counts[targetId] || 0) + 1;
  });

  const maxVotes = Math.max(0, ...Object.values(counts));
  const eliminatedIds = Object.keys(counts).filter(id => counts[id] === maxVotes);
  const impostorIds = Object.keys(game.impostors || {});
  const caught = eliminatedIds.some(id => impostorIds.includes(id));

  const updates = {
    phase: "reveal",
    revealed: true,
    eliminatedIds,
    caught
  };

  const scoreUpdates = {};

  players.forEach(player => {
    let delta = 0;

    if (impostorIds.includes(player.id)) {
      if (!caught) delta += 2;
    } else if (votes[player.id] && impostorIds.includes(votes[player.id])) {
      delta += 2;
    }

    if (delta) {
      scoreUpdates[`players/${player.id}/score`] =
        Number(player.score || 0) + delta;
    }
  });

  try {
    await db.ref("rooms/" + roomCode).update({
      game: { ...game, ...updates },
      ...scoreUpdates
    });
  } catch (error) {
    showError("Impossible de révéler les votes : " + error.message);
  }
}

/* =========================================================
   QUIZ
   ========================================================= */

function renderQuiz(game, content, actions, message) {
  const question = game.currentQuestion;
  if (!question) return showRoundEnd(content, actions, "Aucune question disponible.");

  const answers = game.answers || {};
  const alreadyAnswered = Object.prototype.hasOwnProperty.call(answers, uid);

  content.innerHTML = `
    <div class="game-card">
      <div class="eyebrow">QUESTION</div>
      <div class="game-question">${escapeHTML(question.q)}</div>
    </div>
  `;

  if (!alreadyAnswered) {
    const list = document.createElement("div");
    list.className = "answers";

    question.a.forEach((answer, index) => {
      addButton(list, answer, "secondary answer", () => submitAnswer(index));
    });

    actions.appendChild(list);
  } else {
    message.textContent = "Réponse enregistrée. Attends la suite !";
  }

  if (isHost()) {
    addButton(actions, "AFFICHER LA RÉPONSE / SUIVANT", "primary full", revealQuizAnswer);
  }
}

async function submitAnswer(answerIndex) {
  const ref = db.ref(`rooms/${roomCode}/game`);
  try {
    const result = await ref.transaction(game => {
      if (!game || game.phase !== "question") return;
      game.answers = game.answers || {};
      if (Object.prototype.hasOwnProperty.call(game.answers, uid)) return;

      const question = game.currentQuestion;
      const correct = question && answerIndex === question.c;
      game.answers[uid] = {
        answer: answerIndex,
        correct: Boolean(correct)
      };
      return game;
    });

    if (result.committed) toast("Réponse enregistrée !");
  } catch (error) {
    showError("Impossible d'enregistrer ta réponse : " + error.message);
  }
}

async function revealQuizAnswer() {
  if (!isHost()) return;

  const game = roomData.game;
  const question = game.currentQuestion;
  const answers = game.answers || {};
  const updates = {};

  getPlayers().forEach(player => {
    const answer = answers[player.id];
    if (answer?.correct) {
      updates[`players/${player.id}/score`] =
        Number(player.score || 0) + 1;
    }
  });

  const questions = game.questions || [];
  const nextIndex = Number(game.questionIndex || 0) + 1;

  if (nextIndex >= Math.min(questions.length, roomData.settings?.roundCount || 10)) {
    updates.status = "results";
    updates["game/phase"] = "finished";
  } else {
    updates["game/questionIndex"] = nextIndex;
    updates["game/currentQuestion"] = questions[nextIndex];
    updates["game/answers"] = {};
    updates["game/phase"] = "question";
  }

  updates["game/lastCorrectAnswer"] = question?.a?.[question.c] || "";

  try {
    await db.ref("rooms/" + roomCode).update(updates);
  } catch (error) {
    showError("Impossible de passer à la question suivante : " + error.message);
  }
}

/* =========================================================
   VRAI OU FAUX
   ========================================================= */

function renderTrueFalse(game, content, actions, message) {
  const question = game.currentQuestion;
  if (!question) return showRoundEnd(content, actions, "Plus de questions.");

  const answers = game.answers || {};
  const answered = Object.prototype.hasOwnProperty.call(answers, uid);

  content.innerHTML = `
    <div class="game-card">
      <div class="eyebrow">VRAI OU FAUX ?</div>
      <div class="game-question">${escapeHTML(question.q)}</div>
    </div>
  `;

  if (!answered) {
    addButton(actions, "VRAI ✅", "primary", () => submitTrueFalse(true));
    addButton(actions, "FAUX ❌", "secondary", () => submitTrueFalse(false));
  } else {
    message.textContent = "Tu as répondu. Attends la suite.";
  }

  if (isHost()) {
    addButton(actions, "RÉPONSE / QUESTION SUIVANTE", "primary full", revealTrueFalse);
  }
}

async function submitTrueFalse(value) {
  const ref = db.ref(`rooms/${roomCode}/game`);
  try {
    const result = await ref.transaction(game => {
      if (!game || game.phase !== "question") return;
      game.answers = game.answers || {};
      if (Object.prototype.hasOwnProperty.call(game.answers, uid)) return;

      game.answers[uid] = {
        answer: value,
        correct: value === Boolean(game.currentQuestion?.a)
      };
      return game;
    });
    if (result.committed) toast("Réponse enregistrée !");
  } catch (error) {
    showError("Réponse impossible : " + error.message);
  }
}

async function revealTrueFalse() {
  if (!isHost()) return;

  const game = roomData.game;
  const answers = game.answers || {};
  const updates = {};

  getPlayers().forEach(player => {
    if (answers[player.id]?.correct) {
      updates[`players/${player.id}/score`] =
        Number(player.score || 0) + 1;
    }
  });

  const questions = game.questions || [];
  const nextIndex = Number(game.questionIndex || 0) + 1;

  if (nextIndex >= Math.min(questions.length, roomData.settings?.roundCount || 10)) {
    updates.status = "results";
    updates["game/phase"] = "finished";
  } else {
    updates["game/questionIndex"] = nextIndex;
    updates["game/currentQuestion"] = questions[nextIndex];
    updates["game/answers"] = {};
    updates["game/phase"] = "question";
  }

  updates["game/lastCorrectAnswer"] =
    game.currentQuestion?.a ? "VRAI" : "FAUX";

  try {
    await db.ref("rooms/" + roomCode).update(updates);
  } catch (error) {
    showError("Impossible de passer à la question suivante : " + error.message);
  }
}

/* =========================================================
   TU PRÉFÈRES
   ========================================================= */

function renderPreference(game, content, actions, message) {
  const pair = game.currentQuestion;
  if (!pair) return showRoundEnd(content, actions, "Plus de questions.");

  const answered = Boolean(game.answers?.[uid]);

  content.innerHTML = `
    <div class="game-card">
      <div class="eyebrow">TU PRÉFÈRES ?</div>
      <div class="game-question">Tu choisis quoi ?</div>
      <p class="muted">Vote et compare tes choix avec ceux des autres.</p>
    </div>
  `;

  if (!answered) {
    addButton(actions, "🅰️ " + pair[0], "secondary full", () => submitPreference(0));
    addButton(actions, "🅱️ " + pair[1], "secondary full", () => submitPreference(1));
  } else {
    message.textContent = "Ton choix est enregistré.";
  }

  if (isHost()) {
    addButton(actions, "QUESTION SUIVANTE", "primary full", nextQuestion);
  }
}

async function submitPreference(choice) {
  const ref = db.ref(`rooms/${roomCode}/game`);
  try {
    const result = await ref.transaction(game => {
      if (!game || game.phase !== "question") return;
      game.answers = game.answers || {};
      if (game.answers[uid]) return;
      game.answers[uid] = { answer: choice, correct: false };
      return game;
    });
    if (result.committed) toast("Choix enregistré !");
  } catch (error) {
    showError("Impossible d'enregistrer le choix : " + error.message);
  }
}

/* =========================================================
   DEVINETTES
   ========================================================= */

function renderRiddle(game, content, actions, message) {
  const riddle = game.currentQuestion;
  if (!riddle) return showRoundEnd(content, actions, "Plus de devinettes.");

  content.innerHTML = `
    <div class="game-card">
      <div class="eyebrow">DEVINETTE</div>
      <div class="game-question">${escapeHTML(riddle.q)}</div>
      <p class="muted">Réfléchis avant de demander la réponse !</p>
      ${game.revealed ? `<div class="notice">Réponse : <strong>${escapeHTML(riddle.a)}</strong></div>` : ""}
    </div>
  `;

  if (isHost()) {
    addButton(
      actions,
      game.revealed ? "DEVINETTE SUIVANTE" : "RÉVÉLER LA RÉPONSE",
      "primary full",
      game.revealed ? nextQuestion : revealRiddle
    );
  } else {
    message.textContent = "Propose ta réponse à voix haute !";
  }
}

async function revealRiddle() {
  if (!isHost()) return;
  try {
    await db.ref(`rooms/${roomCode}/game`).update({ revealed: true });
  } catch (error) {
    showError("Impossible de révéler la réponse : " + error.message);
  }
}

/* =========================================================
   DÉFIS
   ========================================================= */

function renderChallenge(game, content, actions, message) {
  const challenge = game.currentQuestion;
  if (!challenge) return showRoundEnd(content, actions, "Plus de défis.");

  content.innerHTML = `
    <div class="game-card">
      <div class="eyebrow">DÉFI ENTRE POTES</div>
      <div class="game-question">${escapeHTML(challenge)}</div>
      <p class="muted">À vous de jouer. Le groupe décide si le défi est réussi.</p>
    </div>
  `;

  if (isHost()) {
    addButton(actions, "DÉFI RÉUSSI : +1 POINT", "primary full", awardChallengePoint);
    addButton(actions, "PASSER AU DÉFI SUIVANT", "secondary full", nextQuestion);
  } else {
    message.textContent = "Quand le groupe a décidé, l'hôte valide le défi.";
  }
}

async function awardChallengePoint() {
  if (!isHost()) return;

  const players = getPlayers();
  const list = document.createElement("div");
  list.className = "players";

  players.forEach(player => {
    addButton(list, "+1 " + player.name, "secondary full", async () => {
      try {
        await db.ref(`rooms/${roomCode}/players/${player.id}/score`)
          .set(Number(player.score || 0) + 1);
        toast("Point attribué à " + player.name);
      } catch (error) {
        showError("Impossible d'attribuer le point : " + error.message);
      }
    });
  });

  $("gameActions").appendChild(list);
}

/* =========================================================
   QUESTIONS SUIVANTES ET FIN DE PARTIE
   ========================================================= */

async function nextQuestion() {
  if (!isHost()) return;

  const game = roomData.game;
  const questions = game.questions || [];
  const nextIndex = Number(game.questionIndex || 0) + 1;

  if (nextIndex >= Math.min(questions.length, roomData.settings?.roundCount || 10)) {
    try {
      await db.ref("rooms/" + roomCode).update({
        status: "results",
        "game/phase": "finished"
      });
    } catch (error) {
      showError("Impossible de terminer la partie : " + error.message);
    }
    return;
  }

  try {
    await db.ref("rooms/" + roomCode + "/game").update({
      questionIndex: nextIndex,
      currentQuestion: questions[nextIndex],
      answers: {},
      revealed: false,
      phase: "question"
    });
  } catch (error) {
    showError("Impossible de passer à la question suivante : " + error.message);
  }
}

function showRoundEnd(content, actions, text) {
  content.innerHTML = `<div class="notice">${escapeHTML(text)}</div>`;
  if (isHost()) {
    addButton(actions, "QUESTION SUIVANTE", "primary full", nextQuestion);
  }
}

async function nextRound() {
  if (!isHost()) return;

  const current = Number(roomData.round || 1);
  const max = Number(roomData.settings?.roundCount || 10);

  if (current >= max) {
    try {
      await db.ref("rooms/" + roomCode).update({
        status: "results",
        "game/phase": "finished"
      });
    } catch (error) {
      showError("Impossible de terminer la partie : " + error.message);
    }
    return;
  }

  await startRound(current + 1);
}

async function restartRoom() {
  if (!isHost()) return;

  const players = getPlayers();
  const updates = {
    status: "lobby",
    round: 0,
    game: null
  };

  players.forEach(player => {
    updates[`players/${player.id}/score`] = 0;
  });

  try {
    await db.ref("rooms/" + roomCode).update(updates);
    toast("Nouvelle partie prête !");
  } catch (error) {
    showError("Impossible de recommencer : " + error.message);
  }
}

/* =========================================================
   QUITTER LE SALON
   ========================================================= */

$("leaveBtn").addEventListener("click", leaveRoom);

async function leaveRoom() {
  if (!roomCode || isLeaving) return;

  isLeaving = true;
  const oldCode = roomCode;
  const oldRoom = roomData;

  try {
    if (roomListener) {
      db.ref("rooms/" + oldCode).off("value", roomListener);
    }

    if (oldRoom?.players?.[uid]) {
      if (oldRoom.hostId === uid) {
        const remaining = Object.keys(oldRoom.players).filter(id => id !== uid);

        if (remaining.length) {
          const newHost = remaining[0];
          await db.ref("rooms/" + oldCode).update({
            hostId: newHost,
            [`players/${uid}`]: null
          });
        } else {
          await db.ref("rooms/" + oldCode).remove();
        }
      } else {
        await db.ref(`rooms/${oldCode}/players/${uid}`).remove();
      }
    }
  } catch (error) {
    console.error("Erreur en quittant le salon :", error);
  }

  roomCode = null;
  roomData = null;
  roomListener = null;
  isLeaving = false;
  showHome();
  toast("Tu as quitté le salon.");
}

/* =========================================================
   ÉTAT INITIAL ET ERREURS
   ========================================================= */

showHome();

window.addEventListener("online", () => toast("Connexion rétablie."));
window.addEventListener("offline", () => toast("Connexion Internet perdue."));
