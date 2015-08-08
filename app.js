var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');
var passport = require('passport'),
    LocalStrategy = require('passport-local').Strategy;
var flash = require('connect-flash');
var bcrypt = require('bcrypt');

//connect database
var mongoose = require('mongoose');
var db = mongoose.connection;
mongoose.connect('mongodb://localhost:27017/test');

db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function callback() {
  console.log('Connected to DB');
});


var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');


var Schema = mongoose.Schema;

var UserSchema = new Schema({
  username: String,
  password: String,
  email: String
})

UserSchema.pre('save',function(next){
  var user = this;
  bcrypt.genSalt(10,function(err,salt){
    if(err) return next(err);
    bcrypt.hash(user.password,salt,function(err,hash){
      if(err) return next(err);
      user.password = hash;
      next();
    })
  })
})

//Password verification

UserSchema.methods.comparePassword = function(password, cb){
  bcrypt.compare(password,this.password, function(err, isMath){
    if(err) return next(err);
    cb(null,isMath);
  })
}
var User = mongoose.model('User',UserSchema);

var usr = new User({username: 'luxiaojian',email: 'luhuijian@duohuo.org',password: '1234'});
usr.save(function(err){
  if(err){
    console.log(err);
  }else{
    console.log('user' + usr.username + ' has saved!');
  }
});

passport.serializeUser(function(user,done){
  done(null, user.username);
});

passport.deserializeUser(function(user,done){
  User.findOne({username: user.username}, function(err,user){
    done(null, user);
  })
});
passport.use(new LocalStrategy(function(username,password,done){
  User.findOne({username: username},function (err,user){
    if(err){
      return done(err);
    }

    if(!user){
      return done(null, false, {message: '未知用户' + username});
    }

    user.comparePassword(password,function(err, isMath){
      if(err) return done(err);
      if(isMath){
        return done(null, user);
      }else{
        return done(null,false,{message: '用户密码验证错误!'})
      }
    })
  })
}))
// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(session({secret: 'luhuijian'}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());


function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/login')
}
app.get('/', function(req, res){
  res.render('index', { user: req.user });
});

app.get('/account', ensureAuthenticated, function(req, res){
  console.log(req.flash('error'));
  res.render('account', { user: req.user,message: req.flash('error')});
});

app.get('/login', function(req, res){
  res.render('login', { user: req.user,message: req.flash('error') });
  console.log(req.flash('error'));
});

app.post('/login',function (req,res,next){
  passport.authenticate('local',function(err,user,info){
    if(err){
      return next(err);
    }

    if(!user){
      console.log(info.message);
      req.flash('error', info.message);
      return res.redirect('/login');
    }

    req.logIn(user,function(err){
      if(err) {
        return next(err);
      }
       return res.redirect('/');
    })
  })(req,res,next);
})

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});

app.listen(3000, function() {
  console.log('Express server listening on port 3000');
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;
