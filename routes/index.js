const express = require('express');
const router = express.Router();
const passport = require('passport');
const dao = require('../dao');
const fs = require('fs');
const path = require('path');

// =================================================================
// 1. PAGINE PRINCIPALI E DEEP LINKING (SSR - Slide 14)
// =================================================================
router.get('/', (req, res) => res.render('index'));
router.get('/stories', (req, res) => res.render('stories'));
router.get('/birre', (req, res) => res.render('birre'));

router.get('/shop', async (req, res, next) => {
    try {
        const { search, category, maxPrice, sort } = req.query;
        const products = await dao.getProducts(search, category, maxPrice, sort);
        res.render('shop', { products: products, filters: req.query });
    } catch (err) {
        next(err);
    }
});

router.get('/product/:id', async (req, res, next) => {
    try {
        const product = await dao.getProductById(req.params.id);
        if (!product) return res.render('404');
        const reviews = await dao.getReviewsByProduct(req.params.id);
        res.render('product-detail', { product: product, reviews: reviews });
    } catch (err) {
        next(err);
    }
});

// =================================================================
// 2. CARRELLO: PAGINE WEB (Views)
// =================================================================
router.get('/cart', async (req, res, next) => {
    try {
        const cartIds = req.session.cart || [];
        let cartItems = [];
        let total = 0;
        for (let id of cartIds) {
            const product = await dao.getProductById(id);
            if (product) {
                cartItems.push(product);
                total += product.price;
            }
        }
        res.render('cart', { cartItems: cartItems, total: total });
    } catch (err) {
        next(err);
    }
});

// Fallback HTML tradizionale se Javascript è disabilitato (Accessibilità)
router.post('/cart/add/:id', (req, res) => {
    if (!req.session.cart) req.session.cart = []; 
    const quantity = parseInt(req.body.quantity) || 1;
    for(let i = 0; i < quantity; i++) req.session.cart.push(req.params.id);
    res.redirect('/cart');
});

router.post('/checkout', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login');
    req.session.cart = []; 
    res.render('checkout-success');
});

// =================================================================
// 3. API REST STRICT (Slide 15 - Separazione Rotte)
// =================================================================
router.post('/api/cart/add/:id', (req, res) => {
    if (!req.session.cart) req.session.cart = []; 
    const quantity = parseInt(req.body.quantity) || 1;
    for(let i = 0; i < quantity; i++) req.session.cart.push(req.params.id);
    
    // Risposta rigorosamente in formato JSON per la Fetch API
    res.json({ 
        success: true, 
        message: 'Prodotto aggiunto con successo (Via API REST)',
        cartCount: req.session.cart.length 
    });
});

// =================================================================
// 4. AUTENTICAZIONE E SICUREZZA (Slide 13)
// =================================================================
router.get('/login', (req, res) => res.render('login'));
router.get('/register', (req, res) => res.render('register'));

router.post('/login', passport.authenticate('local', {
    successRedirect: '/shop', 
    failureRedirect: '/login' 
}));

router.get('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        res.redirect('/shop');
    });
});

router.post('/register', async (req, res, next) => {
    try {
        const { username, email, password, confirm_password, admin_secret } = req.body;
        if (password !== confirm_password) return res.render('register', { error: "Le password non coincidono." });

        const hasNumber = /\d/.test(password);
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        if (password.length < 8 || !hasNumber || !hasSpecial) {
            return res.render('register', { error: "Password debole: usa almeno 8 caratteri, un numero e un simbolo speciale." });
        }

        let role = (admin_secret === 'ADMIN_2026') ? 'admin' : 'user';
        await dao.registerUser(username, email, password, role);
        res.redirect('/login');
    } catch (err) {
        res.render('register', { error: "Email già in uso o dati non validi." });
    }
});

router.post('/product/:id/review', async (req, res, next) => {
    try {
        if (!req.isAuthenticated()) return res.redirect('/login');
        await dao.addReview(req.params.id, req.user.id, req.body.rating, req.body.comment);
        res.redirect('/product/' + req.params.id);
    } catch (err) {
        next(err);
    }
});

// =================================================================
// 5. AREA AMMINISTRATORE E ACCOUNTABILITY (Slide 13)
// =================================================================
function isAdmin(req, res, next) {
    if (req.isAuthenticated() && req.user.role === 'admin') return next();
    res.status(403).send("<h1>Accesso Negato</h1><p>Controllo Accessi: Fallito.</p>");
}

// Funzione di Tracciabilità (Accountability)
function logAdminAction(adminUsername, action) {
    const logMessage = `[${new Date().toISOString()}] ADMIN ACCOUNTABILITY: Utente '${adminUsername}' ha eseguito: ${action}\n`;
    const logPath = path.join(__dirname, '../admin_audit.log');
    fs.appendFile(logPath, logMessage, (err) => {
        if(err) console.error("Errore nel sistema di tracciabilità.");
    });
}

router.get('/admin', isAdmin, (req, res) => res.render('admin'));

router.post('/admin/add-product', isAdmin, async (req, res, next) => {
    try {
        const { brand, name, category, price, image, story, drink_tips } = req.body;
        await dao.addProduct(brand, name, category, price, image, story, drink_tips);
        
        // Applichiamo l'Accountability registrando l'azione (Slide 13)
        logAdminAction(req.user.username, `Aggiunto prodotto '${name}' (Brand: ${brand}, Prezzo: ${price})`);
        
        res.redirect('/shop');
    } catch (err) {
        next(err);
    }
});

// =================================================================
// GESTIONE PROFILO E ORDINI UTENTE (Area Protetta Standard)
// =================================================================
// Middleware per verificare che l'utente sia loggato (Authorization base)
function isAuth(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.redirect('/login');
}

// Visualizzazione Profilo e Storico Ordini
router.get('/profile', isAuth, async (req, res, next) => {
    try {
        const orders = await dao.getUserOrders(req.user.id);
        res.render('profile', { user: req.user, orders: orders });
    } catch (err) {
        next(err);
    }
});

// Modifica del checkout per salvare realmente nel Database
router.post('/checkout', isAuth, async (req, res, next) => {
    try {
        const cartIds = req.session.cart || [];
        if (cartIds.length === 0) return res.redirect('/cart');

        let total = 0;
        for (let id of cartIds) {
            const p = await dao.getProductById(id);
            if (p) total += p.price;
        }

        // Crea l'ordine vero e proprio e svuota la sessione
        const orderId = await dao.createOrder(req.user.id, cartIds, total);
        req.session.cart = []; 
        
        res.render('checkout-success', { orderId: orderId });
    } catch (err) {
        next(err);
    }
});

// =================================================================
// ADMIN DASHBOARD AVANZATA (Gestione Utenti, Ordini e Recensioni)
// =================================================================

// Modifica la vecchia rotta GET /admin per passare tutti i dati alla vista
router.get('/admin', isAdmin, async (req, res, next) => {
    try {
        const users = await dao.getAllUsers();
        const orders = await dao.getAllOrders();
        // Passiamo i dati alla Dashboard
        res.render('admin', { users: users, orders: orders });
    } catch (err) {
        next(err);
    }
});

// API REST per aggiornare lo stato dell'ordine asincronamente
router.post('/api/admin/orders/:id/status', isAdmin, async (req, res) => {
    try {
        await dao.updateOrderStatus(req.params.id, req.body.status);
        logAdminAction(req.user.username, `Aggiornato stato ordine #${req.params.id} a '${req.body.status}'`);
        res.json({ success: true, message: 'Stato ordine aggiornato' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Errore DB' });
    }
});

// Rotta per eliminare un utente
router.post('/admin/users/delete/:id', isAdmin, async (req, res, next) => {
    try {
        await dao.deleteUser(req.params.id);
        logAdminAction(req.user.username, `Eliminato utente ID #${req.params.id}`);
        res.redirect('/admin');
    } catch (err) {
        next(err);
    }
});

// Rotta per eliminare una recensione
router.post('/admin/reviews/delete/:id', isAdmin, async (req, res, next) => {
    try {
        await dao.deleteReview(req.params.id);
        // Torma alla pagina precedente (il prodotto)
        res.redirect('back');
    } catch (err) {
        next(err);
    }
});

module.exports = router;