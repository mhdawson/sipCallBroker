// Copyright 2014-2017 the project authors as listed in the AUTHORS file.
// All rights reserved. Use of this source code is governed by the
// license that can be found in the LICENSE file.
const mqtt = require('mqtt');
const path = require('path');
const fs = require('fs');
const socketio = require('socket.io');
const sipster = require('sipster');
const https = require('https');

///////////////////////////////////////////////
// micro-app framework methods
///////////////////////////////////////////////
const Server = function() {
}


Server.getDefaults = function() {
  return { 'title': 'sip message bridge' };
}



var replacements;
Server.getTemplateReplacments = function() {
  if (replacements === undefined) {
    const config = Server.config;
    replacements = [{ 'key': '<DASHBOARD_TITLE>', 'value': config.title },
                    { 'key': '<UNIQUE_WINDOW_ID>', 'value': config.title },
                    { 'key': '<PAGE_WIDTH>', 'value': Server.config.windowSize.y },
                    { 'key': '<PAGE_HEIGHT>', 'value': Server.config.windowSize.x }];

  }
  return replacements;
}


Server.startServer = function(server) {
  // we will only send sms message if NOTIFY message arives after the
  // bridge is started
  var messageAlreadyWaiting = true;

  var config = Server.config;

  eventSocket = socketio.listen(server);

  // setup mqtt
  var mqttOptions;
  if (config.mqtt.serverUrl.indexOf('mqtts') > -1) {
    mqttOptions = { key: fs.readFileSync(path.join(__dirname, 'mqttclient', '/client.key')),
                    cert: fs.readFileSync(path.join(__dirname, 'mqttclient', '/client.cert')),
                    ca: fs.readFileSync(path.join(__dirname, 'mqttclient', '/ca.cert')),
                    checkServerIdentity: function() { return undefined }
    }
  }
  var mqttClient = mqtt.connect(config.mqtt.serverUrl, mqttOptions);

  mqttClient.on('connect', function() {
    mqttClient.subscribe(Server.config.mqtt.requestTopic);
  });

  mqttClient.on('message', function(topic, message) {
    if (topic === Server.config.mqtt.requestTopic) {
      const dest = Server.config.connections[message];
      if (dest !== undefined) {
        makeConnection(dest);
      }
    }
  });


  const makeConnection = function(dest) {
    const call = acct.makeCall('sip:' + Server.config.sources.default + '@montreal2.voip.ms');
    call.on('state', function(state) {
      if(state == 'confirmed') {
        console.log('tranferring');
        call.transfer('sip:' + dest + '@montreal2.voip.ms');
      }
    });
  }


  eventSocket.on('connection', function(ioclient) {
  });

  // initialize pjsip 
  var epconfig = config.sipster.epconfig;
  sipster.init(epconfig);
 
  // set up a transport to listen for incoming connections, defaults to UDP 
  // this is required even though we will be outgoing only
  var transport = new sipster.Transport({ port: 5060 });
 
  // set up sip account
  var acct = new sipster.Account(config.sipster.sip);

  acct.on('state', function(active, status) {
  });

  sipster.start();

  acct.on('state', function(active, status) {
  });

  acct.on('error', function(active, status) {
  });

};


if (require.main === module) {
  var microAppFramework = require('micro-app-framework');
  microAppFramework(path.join(__dirname), Server);
}


module.exports = Server;