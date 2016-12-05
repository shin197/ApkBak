
/*eslint-env node*/

//------------------------------------------------------------------------------
// node.js starter application for Bluemix
//------------------------------------------------------------------------------

// This application uses express as its web server
// for more info, see: http://expressjs.com
var express = require('express');

// cfenv provides access to your Cloud Foundry environment
// for more info, see: https://www.npmjs.com/package/cfenv
var cfenv = require('cfenv');

// create a new express server
var app = express();
//var serv = require('http').Server(app);
var http = require('http');
var serv = http.createServer(app);
var io = require('socket.io').listen(serv);
var users = [];
//var io = require('socket.io')(serv,{});

app.get('/',function(req, res) {
	res.sendFile(__dirname + '/public/index.html');
});

var SOCKET_LIST = {};
var PLAYER_LIST = {};
var uid = 0;
function XOR(a,b) {
  return ( a || b ) && !( a && b );
}
var WIDTH = 1000;
var HEIGHT = 800;

io.emit('some event', { for: 'everyone' });


var intersect = function(ax,ay,aw,ah,bx,by,bw,bh){
	return ax < bx+bw && ay < by+bh && bx < ax+aw && by < ay+ah;
};
var Player = function(id){
	var self ={
		x:Math.random()*WIDTH,
		y:Math.random()*HEIGHT,
		id:id,
		color: (Math.random() * 360)+"",
		size: 20,
		pressingRight:false,
		pressingLeft:false,
		pressingUp:false,
		pressingDown:false,
		xspeed:0,
		yspeed:0,
		nickname:"",
		msgExpireTimer:-1,
		update: function(){
			// timer expires
			if(this.msgExpireTimer > 0)
				this.msgExpireTimer--;
			if(this.msgExpireTimer == 0){
				this.msg = null;
			}
			this.xspeed = 0;
			this.yspeed = 0;
			if(XOR(this.pressingLeft,this.pressingRight))
				if(this.pressingLeft)
					this.xspeed = -5;
				if(this.pressingRight)
					this.xspeed = 5;
			if(XOR(this.pressingUp,this.pressingDown))
				if(this.pressingUp)
					this.yspeed = -5;
				if(this.pressingDown)
					this.yspeed = 5;
			if(XOR(this.pressingLeft,this.pressingRight)&&XOR(this.pressingUP,this.pressingDown)){
				this.xspeed /= Math.sqrt(2);
				this.yspeed /= Math.sqrt(2);
			}
			this.x += this.xspeed;
			this.y += this.yspeed;
			if(0 > this.x)
				this.x = 0;
			if(this.x + this.size > WIDTH)
				this.x = WIDTH -  this.size;
			if(0 > this.y)
				this.y = 0;
			if(this.y + this.size > HEIGHT)
				this.y = HEIGHT - this.size;
		}
	}
	return self;
}

io.sockets.on('connection', function(socket){
  socket.on('new user', function(data, callback) {
    if(data in users) {
      callback(false);
    } else {
      callback(true);
      socket.nickname = data;
      console.log('a user connected');
      //callback(socket.nickname + ' is connected!');
      io.sockets.emit('new message', {msg: socket.nickname + ' is connected', nick: 'Information' });
      users[socket.nickname] = socket;
      PLAYER_LIST[socket.id].nickname = data;
      updateNicknames();
    }
  });
  function updateNicknames() {
    io.sockets.emit('usernames', Object.keys(users));
  }

  socket.on('send message', function(data, callback) {
  	var msg = data.trim();
  	if(msg.substr(0,3) == '/w ') {
  		msg = msg.substr(3);
  		var ind = msg.indexOf(' ');
  		if(ind != -1) {
  			var name = msg.substr(0, ind);
  			var msg = msg.substr(ind + 1);
  			if(name in users) {
  				users[name].emit('whisper', {msg: msg, nick: socket.nickname});
  				//console.log('Wisper: ');
  			} else {
  				callback('Error: Enter a valid user.');
  			}
  		} else {
  			callback('Error: Please enter a message for your whisper.');
  		}
  	}else {
  		console.log('normal!');
    	io.sockets.emit('new message', {msg: data, nick: socket.nickname});
  	}
  });

  socket.on('disconnect', function(data) {
    if(!socket.nickname) return;
    //console.log('a user disconnected');
    //callback(socket.nickname + ' is disconnected!');
    io.sockets.emit('new message', {msg: socket.nickname + ' is disconnected', nick: 'Information'});
    delete users[socket.nickname];
    updateNicknames();
  })

  socket.id = uid++;
	SOCKET_LIST[socket.id] = socket;
	var player = Player(socket.id);
	PLAYER_LIST[player.id] = player;
	socket.on('disconnect',function(){
		delete SOCKET_LIST[socket.id];
		delete PLAYER_LIST[socket.id];
	});
	socket.on('keyPress',function(data){
		if(data.inputId === 'left')
			player.pressingLeft = data.state;
		else if(data.inputId === 'right')
			player.pressingRight = data.state;
		else if(data.inputId === 'up')
			player.pressingUp = data.state;
		else if(data.inputId === 'down')
			player.pressingDown = data.state;
	});

});

setInterval(function(){
	var pack = [];
	for(var i in PLAYER_LIST){
		var player = PLAYER_LIST[i];
		player.update();
		pack.push({
			x:player.x,
			y:player.y,
			color:player.color,
			nickname: player.nickname
		});
	}
	for(var i in SOCKET_LIST){
		var socket = SOCKET_LIST[i];
		socket.emit('newPositions',pack);
	}
},1000/60);


// serve the files out of ./public as our main files
app.use(express.static(__dirname + '/public'));

// get the app environment from Cloud Foundry
var appEnv = cfenv.getAppEnv();

// start server on the specified port and binding host
serv.listen(appEnv.port, '0.0.0.0', function() {
  // print a message when the server starts listening
  console.log("server starting on " + appEnv.url);
});
