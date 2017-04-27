# 理解Passport.js的工作流程
## 关于Passport.js

[![Greenkeeper badge](https://badges.greenkeeper.io/luxiaojian/express-passport-local.svg)](https://greenkeeper.io/)
`Passport.js`是Nodejs一个做登录注册的中间件，支持本地验证和第三方账号的登录验证（支持绝大部分社交网站）。
## 组成部分
* `passport.initialize()`: 每次请求到来时触发，保证session中包含`passport.user`对象（有可能是空对象）。
* `passport.session()`:把服务器上序列化好的用户对象加载到`req.user`中。
* `passport.serializeUser`:决定用户对象的具体要存在session中的信息。
* `passport.deserializeUser`:每次请求到来时由`passport.session`触发，加载用户对象到req.user中。
* `passport.authenticate`:登录时验证用户登录信息中间件，首先触发定义好的`LocalStrategy`本地策略，然后执行回调。  


## Passport.js的工作流程
### 搭建环境和安装依赖
> 环境采用Nodejs,数据库采用mongodb,用mongoose来更好的操作mongodb,用express作为web框架

#### 依赖的module  
1. `cookie-parser`:cookie解析中间件。
2. `express-session`: session解析中间件，依赖于cookie-parser。
3. `connect-flash`: 消息提示中间件。
4. `body-parser`:解析http请求内容，form表单提交和ajax发送请求时都要经过它的处理。
5. `passport`和`passport-local`:passport验证策略模块和本地验证策略模块。
6. `bcrypt`:对密码哈希和加盐模块。

```js
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
// database log to console
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function callback() {
  console.log('Connected to DB');
});
```
#### 验证工作流 
 ![passportJS执行流程1](./media/passportJS%E6%89%A7%E8%A1%8C%E6%B5%81%E7%A8%8B1.jpg)

```js
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
```

* 用户填写完登录信息，post请求提交到`/login`路由，passport.authenticate验证中间件开始执行。

```js
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
```

* `passport.authenticate`中间件会首先执行我们之前定义好的本地验证策略Localstrategy,定义的代码如上。

	在passport.user中，done()有三种用法
	* 系统异常，数据库查询错误时，返回done(err)。
	* 验证不通过时，返回done(null,false,message),这是message是出错信息，可以通过connect-flash返回给浏览器。
	* 验证通过时，返回done(null,user)。

	在我们定义的本地策略中，我们分明就数据库查找不到用户和用户密码不对时，验证不通过，并返回相应错误信息，否则验证通过。
* 接着执行`passport.authenticate`中的回调函数，这个回调有三个参数出错对象err,我们定义的本地验证策略传递出来的用户对象user以及本地验证出错传递出来的错误信息message。在user对象没有传递过来时，重定向到登陆页面`/login`，并把出错信息传递给用户。如果传递的user对象存在，则调用req.logIn方法。
> 这里的req.logIn()，不是http原生的方法，是passport扩展的。
> passport扩展了四种方法：
>  1. `req.logIn(user,options,callback)`:用login()也可以,作用是为登录用户初始化session,在session中设置session为false,既不初始化session。默认为true。
> 2. `req.logOut()`:用logout()也可以,作用是登出用户，删除该用户session。不带参数。
> 3. `isAuthenticated()`:不带参数，用来验证用户是否保存在session中（是否已经登录），若存在则返回true。
> 4. `isUnauthenticated()`:与isAuthenticated()作用相反。

```js
passport.serializeUser(function(user,done){
  done(null, user.username);
});
```
* 在req.logIn方法中会调用我们之前定义好的序列化函数`passport.serializeUser`,这个函数用了觉得把用户对象具体存到session里面的信息。这里我把用户的用户名存到session中，这里存用户名在反序列化时可以凭session中用户名到数据库找到完整用户对象。
这样用户登陆网站时，passport就帮我们做好了验证工作。

#### passport.js如何为随后的用户的请求做验证？
![passportJS执行流程2](./media/passportJS%E6%89%A7%E8%A1%8C%E6%B5%81%E7%A8%8B2.jpg)

* 在用户登陆后向服务器发出的每一个请求，到达服务后首先触发`passport.initialize()`,这个函数会在请求req中寻找passport.user对象，如果存在则加载到session中，否则创建`req.passport.user = {}`。

```js
passport.deserializeUser(function(user,done){
  User.findOne({username: user.username}, function(err,user){
    done(null, user);
  })
});
```
* 接着触发`passport.session()`,在这个函数中，如果找到session中序列化与发出请求用户对象信息，则认为验证通过。passport.session()还会触发我们之前的定义好的反序列化函数`passport.deserializeUser()`来根据session存贮用户对象信息到数据库中查找到完整用户对象，(这里我根据session中存储用户的username,到数据库中查找到完整user对象)并把完整用户对象加载到req.user中，从而可以前端调用。

这样就可以在用户登录后验证用户随后发出每一个请求。  


