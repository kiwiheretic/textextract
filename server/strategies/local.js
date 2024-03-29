const localStrategy = require("passport-local");
const passport = require("passport");
const { query } = require("../src/database");

passport.serializeUser( (user,done) => {
  console.log('serializeUser');
  console.log(user);
  done(null, {userid: user.ID, username: user.username});
});

passport.deserializeUser( (user, done) => {
  try {
    const result =  query(`select * from users where ID = '${user.userid}'`);
    if (result.length) {
      done(null, result[0]);
    }
  } catch(err) {
    done (err, null);
  }
});

passport.use(new localStrategy(
  /* verification function */
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
