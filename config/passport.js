
const LocalStrategy = require('passport-local').Strategy;
const User = require('../models/User');

module.exports = function(passport) {
  // Local Strategy
  passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password'
  }, (email, password, done) => {
    try {
      // Find user by email
      const user = User.getByEmail(email);
      
      if (!user) {
        return done(null, false, { message: 'User not found' });
      }
      
      // Check password
      const isMatch = User.comparePassword(password, user.password);
      
      if (isMatch) {
        return done(null, user);
      } else {
        return done(null, false, { message: 'Invalid credentials' });
      }
    } catch (error) {
      return done(error);
    }
  }));

  // Serialize user for session
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // Deserialize user from session
  passport.deserializeUser((id, done) => {
    try {
      const user = User.getById(id);
      if (user) {
        done(null, user);
      } else {
        done(null, false);
      }
    } catch (error) {
      done(error, null);
    }
  });
};
