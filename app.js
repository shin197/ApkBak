
var express = require("express");
//var cfenv = require("cfenv");
var app = express();
//var serv = require('http').Server(app);
var http = require('http');
var serv = http.createServer(app);
var io = require('socket.io').listen(serv);
var nicknames = [];
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

serv.listen(3000, function(){
  console.log('listening on *:3000');
});

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
		msg:null,
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
/*
io.sockets.on('connection',function(socket){
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
*/
io.sockets.on('connection', function(socket){

  socket.on('new user', function(data, callback) {
    if(nicknames.indexOf(data) != -1) {
      callback(false);
    } else {
      callback(true);
      socket.nickname = data;
      nicknames.push(socket.nickname);
      updateNicknames();
    }
  });

  function updateNicknames() {
    io.sockets.emit('usernames', nicknames);
  }

  socket.on('send message', function(data) {
    io.sockets.emit('new message', {msg: data, nick: socket.nickname});
  });

  socket.on('disconnect', function(data) {
    if(!socket.nickname) return;
    nicknames.splice(nicknames.indexOf(socket.nickname), 1);
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
  /*
  	console.log('a user connected');
  	io.emit('chat message', "someone connect");
  	socket.on('disconnect', function(){
    console.log('user disconnected');
    io.emit('chat message', "someone disconnect");
  });

  socket.on('chat message', function(msg){
    console.log('message: ' + msg);
    io.emit('chat message', "someone: " + msg);
  });*/
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
			msg: player.msg
		});
	}
	for(var i in SOCKET_LIST){
		var socket = SOCKET_LIST[i];
		socket.emit('newPositions',pack);
	}
},1000/60);