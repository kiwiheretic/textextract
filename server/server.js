const express = require("express");
//const session = require("express-session");
const passport = require("passport");
const local = require("./strategies/local");

const sqlite = require("better-sqlite3");
const session = require("express-session")

const SqliteStore = require("better-sqlite3-session-store")(session)
const db = new sqlite("sessions.db", { verbose: console.log });

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
// app.use(session({
//   secret: "gobbledegook",
//   cookie: { maxAge: 60000 * 30 }, // 30 minutes
//   saveUninitialized: false,
//   resave: false,
//   store
// }));
app.use(
  session({
    saveUninitialized: false,
    store: new SqliteStore({
      client: db, 
      expired: {
        clear: true,
        intervalMs: 900000 //ms = 15min
      }
    }),
    secret: "keyboard cat",
    resave: false,
  })
)

app.use(passport.initialize());
app.use(passport.session());

app.use('/users', users);

app.get("/", (req, res) => {
  //res.send("hello world");
  res.render("index.html", { "a": "Hello", "b": "World" });
});

app.get("/dashboard", (req, res) => {
  //res.send("hello world");
  if (req.isAuthenticated() ) {
    res.render("dashboard.html", { "a": "Dashboard", "b": "World" });
  } else {
    res.redirect("/");
  }
});

app.listen(3080, () => {
  console.log("App listening on port 3080");
});

