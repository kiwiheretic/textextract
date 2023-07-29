const express = require("express");
const session = require("express-session");
const passport = require("passport");
const local = require("./strategies/local");

const app = express();
const mustacheExpress = require ('mustache-express');
const store = new session.MemoryStore();

const users = require('./routes/users');

app.engine('html', mustacheExpress());
app.set('view engine', 'html');
app.set('views', __dirname + '/views');

app.use(express.urlencoded({extended: false}))
app.use(express.json());

app.use(express.static(__dirname + '/public'));
app.use(session({
  secret: "gobbledegook",
  cookie: { maxAge: 60000 },
  saveUninitialized: false,
  resave: false,
  store
}));

app.use(passport.initialize());
app.use(passport.session());

app.use('/users', users);

app.get("/", (req, res) => {
  //res.send("hello world");
  res.render("index.html", { "a": "Hello", "b": "World" });
});


app.listen(3080, () => {
  console.log("App listening on port 3080");
});

