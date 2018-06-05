/******

Blurple
https://blurple.romtypo.com

Copyright 2018 ROM Typo (romtypo.com) and tehZevo (zevo.me)

******/


var fs = require("fs");
var Jimp = require("jimp");
var express=require("express");
var app=express();
var Strategy = require('passport-discord').Strategy;
var passport=require("passport");
var session=require("express-session");
var request=require("request");
var path=require("path");
passport.serializeUser(function(user, done) {
  done(null, user);
});
passport.deserializeUser(function(obj, done) {
  done(null, obj);
});
var os=require("os");

var server=os.hostname();

var Webhook = require("webhook-discord");
var Hook = new Webhook("[wehook error url]");

var scopes = ['identify'];

passport.use(new Strategy({
    clientID: '[discord client id]',
    clientSecret: '[discord client secret]',
    callbackURL: '[callback url]',
    scope: scopes
}, function(accessToken, refreshToken, profile, done) {
    process.nextTick(function() {
        return done(null, profile);
    });
}));
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb'}));
app.use("/files",express.static("out"));
app.use(express.static("public"));
app.use(session({
    secret: '[insert random thing]',
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
app.get('/login', passport.authenticate('discord', { scope: scopes }), function(req, res) {});
app.get('/oauth',
    passport.authenticate('discord', { failureRedirect: '/' }), function(req, res) { res.redirect('/avatar') } // auth success
);
app.get("/info",checkAuth,(req,res)=>{
  res.json(req.user);
});

app.get("/hostname",(req,res)=>{
  res.send(server);
});

function checkAuth(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.redirect("/");
}

process.on("uncaughtException",(err)=>{
  Hook.custom("Blurple Error! [uncaughtException]","<@[ownerid]>\n```\n"+err.stack+"\n```","Uh ohz!");
  console.log("exception");
})

app.get("/error",(req,res)=>{
  throw new Error("lol error");
})

app.get("/avatar",checkAuth,(req,res)=>{
  var uses=JSON.parse(fs.readFileSync("../uses.json","utf8"));
  uses.avatar++;
  fs.writeFileSync("../uses.json",JSON.stringify(uses));

  var a=request("https://cdn.discordapp.com/avatars/"+req.user.id+"/"+req.user.avatar+".png").pipe(fs.createWriteStream("in/"+req.user.id+".png"));
  a.on("finish",()=>{
    generate("in/"+req.user.id+".png",(type,data)=>{
      res.redirect("https://"+os.hostname()+"/files/"+data.split("/")[1]);
      return;
      res.set("content-type",type);
      res.sendFile(path.join(__dirname,data));
    },"out/"+req.user.id+".png",req);
  })
});

var darkBlurple = [78, 93, 148];
var blurple = [114, 137, 218];
var greyple = [153, 170, 181];
var darkButNotBlack = [44, 47, 51];
var notQuiteBlack = [35, 39, 42];

var _levels = {
  "64": darkBlurple,
  "128": blurple,
  "255": [255, 255, 255]
}
var _inverted={
  "255": darkBlurple,
  "128": blurple,
  "64": [255, 255, 255]
}

app.post("/",(req,res)=>{
  var uses=JSON.parse(fs.readFileSync("../uses.json","utf8"));
  uses.file++;
  fs.writeFileSync("../uses.json",JSON.stringify(uses));

  var base64Data = req.body.file.data.replace(/^data:image\/(.*);base64,/, "");
  var type=req.body.file.data.match(/^data:(.*);base64,/)[1];
  if(type!==req.body.file.type){
    res.status(400);
    res.send("Wot you doin mate?");
    return;
  }
  var permitted=["image/png","image/bmp","image/jpeg"];
  if(permitted.indexOf(type)===-1){
    res.status(400);
    res.send("Wot file type m8");
    return;
  }
  var name=Math.floor(Math.random()*1000000)+"."+req.body.file.type.split("/")[1];

  fs.writeFileSync("in/"+name, base64Data, 'base64');
  generate("in/"+name,(type,data)=>{
    res.redirect("https://"+os.hostname()+"/files/"+data.split("/")[1]);
    return;
    res.set("content-type",type);
    res.sendFile(path.join(__dirname,data));
  },"out/"+name,type,(req.body.invert?_inverted:_levels));
})

function generate(file,res,out,type,levels){
  if(!levels){levels=_levels}
  if(!type){type="image/png"}
  console.log("Start of "+file);
  Jimp.read(file, (err, image) =>
  {
    var data=image.grayscale()
      .scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
        var red   = this.bitmap.data[ idx + 0 ];
        var green = this.bitmap.data[ idx + 1 ];
        var blue  = this.bitmap.data[ idx + 2 ];
        //var alpha = this.bitmap.data[ idx + 3 ];
        var alpha = 255;

        var keys = Object.keys(levels);
        for(var i = 0; i < keys.length; i++)
        {
          if(red < keys[i])
          {
            var c = levels[keys[i]]
            red = c[0];
            green = c[1];
            blue = c[2];
            break;
          }
        }

        this.bitmap.data[idx + 0] = red;
        this.bitmap.data[idx + 1] = green;
        this.bitmap.data[idx + 2] = blue;
        this.bitmap.data[idx + 3] = alpha;
      })
      .write(out,()=>{
        console.log("Done with "+file);
        res(type,out);
        fs.unlink(file);
        setTimeout(()=>{
          fs.unlink(out);
        },300000);
        console.log("Finished with "+file);
      })
  });
}

app.use(function (err, req, res, next) {
  console.error(err.stack)
  Hook.custom("Blurple Error!","<@[ownerid]>\n__IP:__ `"+req.headers['x-forwarded-for']+"`\n__Stack:__\n```\n"+err.stack+"\n```","Uh ohz!");
  res.status(500).send('Something broke!')
})
app.get("/uses",(req,res)=>{
  res.set("Access-Control-Allow-Origin","*");
  res.send(fs.readFileSync("../uses.json","utf8"))
})
app.listen(52708,()=>{
  console.log("live at :52708");
})
