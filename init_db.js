const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const db = new sqlite3.Database('./spiritstory.db');

async function init() {
  // Generiamo gli hash delle password con bcrypt (MAI password in chiaro!)
  const userHash = await bcrypt.hash('password123', 10);
  const adminHash = await bcrypt.hash('admin123', 10);

  db.serialize(() => {
    // Puliamo eventuali tabelle vecchie se rilanci lo script
    db.run('DROP TABLE IF EXISTS cart_items');
    db.run('DROP TABLE IF EXISTS reviews');
    db.run('DROP TABLE IF EXISTS orders');
    db.run('DROP TABLE IF EXISTS products');
    db.run('DROP TABLE IF EXISTS users');

    // 1. Tabella USERS
    db.run(`CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username VARCHAR(100) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role TEXT CHECK(role IN ('user', 'admin')) NOT NULL
    )`);

    // 2. Tabella PRODUCTS
    db.run(`CREATE TABLE products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(255) NOT NULL,
      brand VARCHAR(150) NOT NULL,
      category TEXT CHECK(category IN ('distillato', 'birra')) NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      image VARCHAR(500),
      story TEXT,
      drink_tips TEXT
    )`);

    // 3. Tabella REVIEWS
    db.run(`CREATE TABLE reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INT NOT NULL,
      user_id INT NOT NULL,
      rating TINYINT NOT NULL,
      comment TEXT,
      date DATETIME NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // 4. Tabella ORDERS
    db.run(`CREATE TABLE orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INT NOT NULL,
      total DECIMAL(10,2) NOT NULL,
      date DATETIME NOT NULL,
      items_json TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // 5. Tabella CART_ITEMS
    db.run(`CREATE TABLE cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INT NOT NULL,
      product_id INT NOT NULL,
      quantity INT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    // INSERIMENTO DEI 2 UTENTI (Standard e Admin)
    const insertUser = db.prepare('INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)');
    insertUser.run('MarioRossi', 'user@spirit.it', userHash, 'user');
    insertUser.run('AdminBoss', 'admin@spirit.it', adminHash, 'admin');
    insertUser.finalize();

    // INSERIMENTO PRODOTTI INIZIALI
    // INSERIMENTO DEI TUOI 10 PRODOTTI DELLO SHOP
    const insertProd = db.prepare(`INSERT INTO products (name, brand, category, price, image, story, drink_tips) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    
    insertProd.run("OLD NO. 7 CLASSIC", "JACK DANIEL'S", "distillato", 25.00, "/images/jack.png", "Il classico Tennessee Whiskey filtrato goccia a goccia attraverso 3 metri di carbone d'acero.", "Perfetto on the rocks o in un intramontabile Jack & Cola.");
    insertProd.run("TENNESSEE APPLE (MELA VERDE)", "JACK DANIEL'S", "distillato", 28.00, "/images/jack.png", "Il carattere unico di Jack Daniel's unito alla freschezza croccante della mela verde.", "Servilo con acqua tonica e una fetta di mela verde per un Jack Apple & Tonic.");
    insertProd.run("TENNESSEE HONEY (MIELE)", "JACK DANIEL'S", "distillato", 27.00, "/images/jack.png", "Un liquore a base di Jack Daniel's e vero miele, dal finale morbido e naturalmente dolce.", "Da gustare ghiacciato in shot o con limonata fresca.");
    insertProd.run("TENNESSEE FIRE (CANNELLA)", "JACK DANIEL'S", "distillato", 27.00, "/images/jack.png", "Infuso con liquore alla cannella piccante per uno spirito dal carattere infuocato.", "Servire freddissimo come shot.");
    insertProd.run("ORIGINAL HERBAL", "JÄGERMEISTER", "distillato", 18.00, "/images/ipa.png", "Nato nel 1934 a Wolfenbüttel: 56 erbe, fiori, radici e frutti segreti macerati in botti di rovere.", "Rigorosamente Ice Cold Shot a -18°C.");
    insertProd.run("JÄGERMEISTER ORANGE", "JÄGERMEISTER", "distillato", 22.00, "/images/ipa.png", "La base erbacea originale incontra le note agrumate delle migliori arance di Sicilia.", "Ottimo con ghiaccio e una scorza d'arancia.");
    insertProd.run("SCHARF HOT GINGER", "JÄGERMEISTER", "distillato", 21.00, "/images/ipa.png", "Una variante esplosiva con un'intensa infusione di zenzero naturale.", "Provalo in un Jäger Mule con Ginger Beer.");
    insertProd.run("NON FILTRATA - SARDEGNA", "ICHNUSA", "birra", 2.50, "/images/ipa.png", "Lager a bassa fermentazione, corposa e velata grazie ai lieviti rimasti in sospensione.", "Servire a 3-5°C inclinando il bicchiere a 45 gradi.");
    insertProd.run("DRAUGHT STOUT (NITRO)", "GUINNESS", "birra", 4.50, "/images/ipa.png", "La leggendaria stout irlandese nata a Dublino nel 1759, famosa per la sua schiuma cremosa.", "Spillare in due tempi lasciando riposare per 119.5 secondi.");
    insertProd.run("CARLO QUINTO - RUBY RED", "CHARLES QUINT", "birra", 6.00, "/images/ipa.png", "Birra belga ad alta fermentazione dal colore rosso rubino e dall'aroma maltato e speziato.", "Servire a 8°C nel suo tradizionale boccale a quattro manici.");
    
    insertProd.finalize();
    
    insertProd.run(
      "Jack Daniel's Special Edition",
      "Jack Daniel's",
      "distillato",
      32.50,
      "/images/jack.png",
      "Nato a Lynchburg, Tennessee, nel 1866 grazie a Jasper Newton 'Jack' Daniel. Filtrato goccia a goccia attraverso 3 metri di carbone d'acero saccarino.",
      "Servilo on the rocks con 2 cubetti di ghiaccio grandi, oppure crea un classico Jack & Cola con una fetta di lime fresco."
    );

    insertProd.run(
      "Jägermeister Manifest",
      "Jägermeister",
      "distillato",
      28.00,
      "/images/jager.png",
      "Creato a Wolfenbüttel nel 1934 da Curt Mast. Una ricetta segreta di 56 erbe, radici, fiori e frutti macerati in botti di rovere.",
      "Bevilo rigorosamente Ice Cold Shot a -18°C, oppure prova il Jäger Mule con Ginger Beer e succo di lime."
    );

    insertProd.run(
      "Punk IPA Underground",
      "BrewDog",
      "birra",
      5.50,
      "/images/ipa.png",
      "La birra che ha dato inizio alla rivoluzione craft europea. Esplosione di luppoli del Nuovo Mondo con note tropicali di pompelmo e ananas.",
      "Servire a 6-8°C in bicchiere pinta americana. Perfetta con burger speziati o street food fritto."
    );
    insertProd.finalize();

    // INSERIMENTO DI UNA RECENSIONE E DI UN ORDINE DI PROVA
    db.run(`INSERT INTO reviews (product_id, user_id, rating, comment, date) VALUES (1, 1, 5, 'Bottiglia iconica, spedizione velocissima!', datetime('now'))`);
    db.run(`INSERT INTO orders (user_id, total, date, items_json) VALUES (1, 38.00, datetime('now'), '[{"name":"Jack Daniel''s Special Edition","qty":1,"price":32.5},{"name":"Punk IPA Underground","qty":1,"price":5.5}]')`);

    console.log("Database spiritstory.db creato e popolato con successo!");
  });

  db.close();
}

init();