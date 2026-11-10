const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const db = new sqlite3.Database('./spiritstory.db', (err) => {
  if (err) console.error('Errore apertura DB:', err.message);
});

// ================= PRODOTTI & RICERCA (CON FILTRI) =================
exports.getProducts = (search, category, maxPrice, sort) => {
  return new Promise((resolve, reject) => {
    let sql = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (category && (category === 'distillato' || category === 'birra')) {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (search && search.trim() !== '') {
      sql += ' AND (name LIKE ? OR brand LIKE ? OR story LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }
    if (maxPrice && !isNaN(maxPrice)) {
      sql += ' AND price <= ?';
      params.push(Number(maxPrice));
    }

    if (sort === 'price_asc') {
      sql += ' ORDER BY price ASC';
    } else if (sort === 'price_desc') {
      sql += ' ORDER BY price DESC';
    } else {
      sql += ' ORDER BY id DESC';
    }

    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

exports.getProductById = (id) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM products WHERE id = ?', [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

// ================= RECENSIONI (UTENTE STANDARD) =================
exports.getReviewsByProduct = (productId) => {
  return new Promise((resolve, reject) => {
    const sql = `SELECT reviews.*, users.username 
                 FROM reviews JOIN users ON reviews.user_id = users.id 
                 WHERE product_id = ? ORDER BY date DESC`;
    db.all(sql, [productId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

exports.addReview = (productId, userId, rating, comment) => {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO reviews (product_id, user_id, rating, comment, date) 
                 VALUES (?, ?, ?, ?, datetime('now'))`;
    db.run(sql, [productId, userId, rating, comment], function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
};

// ================= LOGIN E UTENTI =================
exports.getUser = (email, password) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
      if (err) return reject(err);
      if (!user) return resolve(false);

      bcrypt.compare(password, user.password_hash).then((matches) => {
        if (matches) resolve({ id: user.id, username: user.username, email: user.email, role: user.role });
        else resolve(false);
      }).catch(reject);
    });
  });
};

exports.getUserById = (id) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT id, username, email, role FROM users WHERE id = ?', [id], (err, user) => {
      if (err) reject(err);
      else resolve(user);
    });
  });
};

// ================= FUNZIONI ADMIN (RICERCA UTENTI E ORDINI) =================
exports.searchUsers = (query) => {
  return new Promise((resolve, reject) => {
    let sql = 'SELECT id, username, email, role FROM users';
    const params = [];
    if (query && query.trim() !== '') {
      sql += ' WHERE username LIKE ? OR email LIKE ?';
      params.push(`%${query.trim()}%`, `%${query.trim()}%`);
    }
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

exports.getAllOrders = () => {
  return new Promise((resolve, reject) => {
    const sql = `SELECT orders.*, users.username, users.email 
                 FROM orders JOIN users ON orders.user_id = users.id 
                 ORDER BY date DESC`;
    db.all(sql, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// ================= CARRELLO UTENTE LOGGATO =================
exports.getCartByUser = (userId) => {
  return new Promise((resolve, reject) => {
    const sql = `SELECT cart_items.id, cart_items.product_id, cart_items.quantity, 
                        products.name, products.price, products.image 
                 FROM cart_items JOIN products ON cart_items.product_id = products.id 
                 WHERE cart_items.user_id = ?`;
    db.all(sql, [userId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

exports.addToCartDB = (userId, productId, quantity = 1) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?', [userId, productId], (err, row) => {
      if (err) return reject(err);
      if (row) {
        db.run('UPDATE cart_items SET quantity = quantity + ? WHERE id = ?', [quantity, row.id], (err2) => {
          if (err2) reject(err2); else resolve();
        });
      } else {
        db.run('INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)', [userId, productId, quantity], (err2) => {
          if (err2) reject(err2); else resolve();
        });
      }
    });
  });
};

// Registrazione sicura (con ruolo)
exports.registerUser = (username, email, password, role = 'user') => {
  return new Promise(async (resolve, reject) => {
    try {
      const hash = await bcrypt.hash(password, 10);
      const sql = 'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)';
      db.run(sql, [username, email, hash, role], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    } catch (err) {
      reject(err);
    }
  });
};

// Aggiunta Prodotti (Admin)
exports.addProduct = (brand, name, category, price, image, story, drink_tips) => {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO products (brand, name, category, price, image, story, drink_tips) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`;
    db.run(sql, [brand, name, category, price, image, story, drink_tips], function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
};

// =================================================================
// NUOVE FUNZIONI PER IL 30 E LODE (Ordini, Profilo, Admin Avanzato)
// =================================================================

// --- GESTIONE ORDINI (User & Admin) ---
exports.createOrder = (userId, cartItems, total) => {
  return new Promise((resolve, reject) => {
    // Inserisce l'ordine principale
    const sqlOrder = 'INSERT INTO orders (user_id, total, status, date) VALUES (?, ?, ?, CURRENT_TIMESTAMP)';
    db.run(sqlOrder, [userId, total, 'In Preparazione'], function(err) {
      if (err) return reject(err);
      const orderId = this.lastID;
      
      // Inserisce i singoli prodotti dell'ordine e scala lo stock
      const sqlItem = 'INSERT INTO cart_items (order_id, product_id) VALUES (?, ?)';
      const sqlStock = 'UPDATE products SET stock = stock - 1 WHERE id = ?';
      
      cartItems.forEach(productId => {
          db.run(sqlItem, [orderId, productId]);
          db.run(sqlStock, [productId]); // Modifica i livelli di stock in tempo reale
      });
      resolve(orderId);
    });
  });
};

exports.getUserOrders = (userId) => {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM orders WHERE user_id = ? ORDER BY date DESC';
    db.all(sql, [userId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

exports.getAllOrders = () => {
  return new Promise((resolve, reject) => {
    const sql = `SELECT orders.*, users.username, users.email 
                 FROM orders JOIN users ON orders.user_id = users.id 
                 ORDER BY date DESC`;
    db.all(sql, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

exports.updateOrderStatus = (orderId, status) => {
  return new Promise((resolve, reject) => {
    const sql = 'UPDATE orders SET status = ? WHERE id = ?';
    db.run(sql, [status, orderId], function(err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

// --- GESTIONE UTENTI E RECENSIONI (Admin) ---
exports.getAllUsers = () => {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT id, username, email, role FROM users';
    db.all(sql, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

exports.deleteUser = (userId) => {
  return new Promise((resolve, reject) => {
    const sql = 'DELETE FROM users WHERE id = ?';
    db.run(sql, [userId], function(err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

exports.deleteReview = (reviewId) => {
  return new Promise((resolve, reject) => {
    const sql = 'DELETE FROM reviews WHERE id = ?';
    db.run(sql, [reviewId], function(err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};