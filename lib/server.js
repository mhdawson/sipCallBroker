// Copyright 2014-2017 the project authors as listed in the AUTHORS file.
// All rights reserved. Use of this source code is governed by the
// license that can be found in the LICENSE file.
const eventLog = require('./eventLog.js');
const fs = require('fs');
const https = require('https');
const mqtt = require('mqtt');
const path = require('path');
const readline = require('readline');
const sipster = require('sipster');
const socketio = require('socket.io');

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

  const pageHeight = Server.config.windowSize.y;
  const pageWidth = Server.config.windowSize.x;

  // create the html for the divs
  const divs = new Array();
  divs[0] = '    <div id="logdata"' + ' style="position: absolute; ' +
                 'width:' + (pageWidth - 2) + 'px; ' +
                 'height:' + (pageHeight - 30) +  'px; '  +
                 'z-index: 1;' +
                 'top:' + '0px; ' +
                 'left:' + '1px; ' +
                 'background-color: white; ' +
                 'font-size:11px;' +
                 'overflow:auto;' +
                 '"></div>';


  if (replacements === undefined) {
    const config = Server.config;
    replacements = [{ 'key': '<DASHBOARD_TITLE>', 'value': config.title },
                    { 'key': '<UNIQUE_WINDOW_ID>', 'value': config.title },
                    { 'key': '<CONTENT>', 'value': divs.join("\n")},
                    { 'key': '<PAGE_WIDTH>', 'value': pageWidth },
                    { 'key': '<PAGE_HEIGHT>', 'value': pageHeight }];

  }
  return replacements;
}


Server.startServer = function(server) {
  const config = Server.config;

  eventSocket = socketio.listen(server);

  // setup mqtt
  const mqttOptions;
  if (config.mqtt.serverUrl.indexOf('mqtts') > -1) {
    mqttOptions = { key: fs.readFileSync(path.join(__dirname, 'mqttclient', '/client.key')),
                    cert: fs.readFileSync(path.join(__dirname, 'mqttclient', '/client.cert')),
                    ca: fs.readFileSync(path.join(__dirname, 'mqttclient', '/ca.cert')),
                    checkServerIdentity: function() { return undefined }
    }
  }
  const mqttClient = mqtt.connect(config.mqtt.serverUrl, mqttOptions);

  mqttClient.on('connect', function() {
    mqttClient.subscribe(Server.config.mqtt.requestTopic);
    mqttClient.subscribe(Server.config.mqtt.cancelTopic);
  });

  mqttClient.on('message', function(topic, message) {
    if (topic === Server.config.mqtt.requestTopic) {
      const dest = Server.config.connections[message].dest;
      var source = Server.config.connections[message].source;
      if (source === undefined) {
        source = 'default';
      }
      sourceNumber = Server.config.sources[source];
      if (dest !== undefined) {
        makeConnection(dest, sourceNumber);
      }
    } else if (topic === Server.config.mqtt.cancelTopic) {
      if (call !== undefined) {
        eventLog.logMessage(config,
                           'call cancelled',
                            eventLog.LOG_INFO);
        call.hangup();
        call = undefined;
      }
    }
  });

  var call = undefined;
  const makeConnection = function(dest, source) {
    const callInfo = 'sip:' + source + '@' + Server.config.relay;
    const transferInfo = 'sip:' + dest + '@' + Server.config.relay;
    eventLog.logMessage(config,
                        'Setting up call from[' + callInfo + '] to [' + transferInfo + ']', 
                        eventLog.LOG_INFO);
    call = acct.makeCall(callInfo);
    call.on('state', function(state) {
      if(state == 'confirmed') {
        eventLog.logMessage(config,
                           'from answered, calling destination',
                            eventLog.LOG_INFO);
        call.transfer(transferInfo);
        call = undefined;
      }
    });
  }

  eventSocket.on('connection', function(ioclient) {
    const lineReader = readline.createInterface({
      input: fs.createReadStream(eventLog.getLogFileName(config))
    });
    lineReader.on('line', function(line) {
      eventSocket.to(ioclient.id).emit('eventLog', line);
    });

    const eventLogListener = function(message) {
      eventSocket.to(ioclient.id).emit('eventLog', message);
    }
    eventLog.addListener(eventLogListener);

    eventSocket.on('disconnect', function () {
      eventLog.removeListenter(eventLogListener);
    });
  });

  // initialize pjsip 
  const epconfig = config.sipster.epconfig;
  sipster.init(epconfig);
 
  // set up a transport to listen for incoming connections, defaults to UDP 
  // this is required even though we will be outgoing only
  const transport = new sipster.Transport({ port: 5060 });
 
  // set up sip account
  const acct = new sipster.Account(config.sipster.sip);
  acct.on('error', function(active, status) {
    eventLog.logMessage(config, 'Error:[' + active + ', ' + status + ']', eventLog.LOG_ERROR);
  });

  eventLog.logMessage(config, 'message bridge starting', eventLog.LOG_INFO);
  sipster.start();
};


if (require.main === module) {
  const microAppFramework = require('micro-app-framework');
  microAppFramework(path.join(__dirname), Server);
}


module.exports = Server;
