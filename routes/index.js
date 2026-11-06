const express = require('express');
const router = express.Router();
const passport = require('passport');
const dao = require('../dao');

// --- PAGINE PRINCIPALI ---
router.get('/', (req, res) => res.render('index'));
router.get('/stories', (req, res) => res.render('stories'));
router.get('/birre', (req, res) => res.render('birre'));

// --- E-COMMERCE E RICERCA ---
router.get('/shop', async (req, res, next) => {
  try {
    const { search, category, maxPrice, sort } = req.query;
    const products = await dao.getProducts(search, category, maxPrice, sort);
    res.render('shop', { products: products, filters: req.query, cartCount: 0 });
  } catch (err) {
    next(err);
  }
});

// --- DETTAGLIO PRODOTTO ---
router.get('/product/:id', async (req, res, next) => {
  try {
    const product = await dao.getProductById(req.params.id);
    if (!product) return res.render('404'); // Usa la tua pagina 404.ejs
    
    const reviews = await dao.getReviewsByProduct(req.params.id);
    res.render('product-detail', { product: product, reviews: reviews });
  } catch (err) {
    next(err);
  }
});

// --- AUTENTICAZIONE ---
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

// --- AZIONI: RECENSIONI E CARRELLO ---
router.post('/product/:id/review', async (req, res, next) => {
  try {
    if (!req.isAuthenticated()) return res.redirect('/login');
    await dao.addReview(req.params.id, req.user.id, req.body.rating, req.body.comment);
    res.redirect('/product/' + req.params.id);
  } catch (err) {
    next(err);
  }
});

router.post('/cart/add/:id', (req, res) => {
  res.redirect('/shop');
});

module.exports = router;