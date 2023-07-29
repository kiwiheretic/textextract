const express = require('express')
const passport = require("passport");
const db = require('../database');

const router = express.Router()

// middleware that is specific to this router
router.use((req, res, next) => {
  console.log('Time: ', Date.now())
  next()
})

// define the about route
router.post('/login', passport.authenticate('local'),  (req, res) => {
  res.redirect('/dashboard');
})

module.exports = router
