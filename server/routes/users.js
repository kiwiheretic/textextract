const express = require('express')
const passport = require("passport");
const db = require('../src/database');

const router = express.Router()

// middleware that is specific to this router
//router.use((req, res, next) => {
//  console.log('Time: ', Date.now())
//  next()
//})

// define the about route
router.post('/login', passport.authenticate('local'),  (req, res) => {
  res.redirect('/dashboard');
})

router.post('/logout', function(req, res, next){
  console.log("logout");
  req.logout(function(err) {
    if (err) { return next(err); }
    res.json( {redirect: '/'});
  });
});
module.exports = router
