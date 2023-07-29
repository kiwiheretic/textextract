const localStrategy = require("passport-local");
const passport = require("passport");
const { query } = require("../database");

passport.serializeUser( (user,done) => {
  done(null, user.username);
});

passport.deserializeUser( (username, done) => {
  try {
    const result =  query(`select * from users where username = '${username}'`);
    if (result.length) {
      done(null, result[0]);
    }
  } catch(err) {
    done (err, null);
  }
});

passport.use(new localStrategy(
  (username, password, done) => {
     const result =  query(`select * from users where username = '${username}'`);
     console.log(result);
     if ( result.length === 0) {
       done(null, false);
     } else if (result[0].password === password) {
       done(null, result[0]);
     } else {
       done(null, false);
     }
  }
));
