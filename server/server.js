const express = require("express");
const passport = require("passport");
const local = require("./strategies/local");

const sqlite = require("better-sqlite3");
const session = require("express-session")

const fileUpload = require("express-fileupload");

const SqliteStore = require("better-sqlite3-session-store")(session)
const db = new sqlite("sessions.db", { verbose: console.log });

const { query, queryRun } = require("./src/database");

const app = express();
const mustacheExpress = require ('mustache-express');
const store = new session.MemoryStore();

const users = require('./routes/users');
const api = require('./routes/api');

const router = express.Router()

app.engine('html', mustacheExpress());
app.set('view engine', 'html');
app.set('views', __dirname + '/views');

app.use(express.urlencoded({extended: false}))
app.use(express.json());

const publicFilePath = __dirname + '/public';
app.use(express.static(publicFilePath));
app.set("static root", publicFilePath);
const mediaFilePath = publicFilePath + '/media';

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
app.use(fileUpload());

app.use('/users', users);
app.use('/api', api);

// Middleware function to add extra context
app.use((req, res, next) => {
  // Your extra context data
  console.log('Time: ', Date.now())

	if (typeof(req.user) !== 'undefined') {
		const extraContext = {
			user: req.user.username,
			authenticated: req.isAuthenticated()
		};
 		console.log("authenticated ? "+ req.isAuthenticated().toString());
		// Add the extra context to res.locals
		Object.assign(res.locals, extraContext);
  }
  // Call next() to continue to the next middleware or route handler
  next();
});



app.get("/", (req, res) => {
  //res.send("hello world");
  res.render("index.html", { "a": "Hello", "b": "World" });
});

app.get("/dashboard", (req, res) => {
  if (req.isAuthenticated() ) {
    res.render("dashboard.html", { "a": "Dashboard", "b": "World" });
  } else {
    res.redirect("/");
  }
});

app.get("/document/:docid/page/:page", (req, res) => {
  if (req.isAuthenticated() ) {
    console.log(req.params);
    res.render("page.html", { "params": req.params });
  } else {
    res.redirect("/");
  }
});

app.get("/document/:docid", (req, res) => {
  if (req.isAuthenticated() ) {
    console.log(req.params);
    //res.render("document.html", { "a": "Dashboard", "b": "World" });
    res.render("document.html", { "params": req.params });
  } else {
    res.redirect("/");
  }
});

app.listen(3080, () => {
  console.log("App listening on port 3080");
});

