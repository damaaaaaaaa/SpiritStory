var express = require('express');
var router = express.Router();

/* GET home page. */
router.get ('/', function(req, res, next) {
    res.render('index', { title: 'Express' });
});

router.get ('/login', function(req, res) {
    res.render ('login');
}) 

router.get ('/shop', function (req, res) {
    res.render ('shop');
})

router.get ('/register', function (req, res) {
    res.render ('register');
})

router.get ('/product-detail', function (req, res) {
    res.render ('product-register');
})

router.get ('/404', function (req, res) {
    res.render ('404');
})

router.get ('/birre', function (req, res) {
    res.render ('birre');
})

router.get ('/stories', function (req, res) {
    res.render ('stories');
})


module.exports = router;
