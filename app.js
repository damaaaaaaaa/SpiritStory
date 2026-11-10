const express = require('express');
const path = require('path');
const session = require('express-session');
const passport = require('passport');

const LocalStrategy = require('passport-local').Strategy; 
const dao = require('./dao');

const indexRouter = require('./routes/index');

const app = express();

// --- 1. CONFIGURAZIONE MOTORE GRAFICO (EJS) ---
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// --- 2. MIDDLEWARE BASE ---
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public'))); // Per CSS e Immagini

// --- 3. CONFIGURAZIONE PASSPORT (LOGIN) ---
passport.use(new LocalStrategy({ usernameField: 'email' }, function(email, password, done) {
  dao.getUser(email, password).then((user) => {
    if (!user) return done(null, false, { message: 'Credenziali errate.' });
    return done(null, user);
  }).catch(err => done(err));
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  dao.getUserById(id).then(user => done(null, user)).catch(err => done(err, null));
});

// --- 4. AVVIO SESSIONE SICURA ---
app.use(session({
  secret: 'spiritstory-super-segreto',
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// Passa i dati dell'utente a tutte le pagine EJS
// Passa i dati dell'utente e il carrello a tutte le pagine EJS
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  // Calcola quanti elementi ci sono nel carrello della sessione
  res.locals.cartCount = req.session.cart ? req.session.cart.length : 0;
  next();
});

// --- 5. COLLEGAMENTO ALLE ROTTE ---
app.use('/', indexRouter);

// Se l'utente cerca una pagina che non esiste (Errore 404)
app.use(function(req, res, next) {
  res.status(404).render('404');
});

module.exports = app;