// Copyright 2016 the project authors as listed in the AUTHORS file.
// All rights reserved. Use of this source code is governed by the
// license that can be found in the LICENSE file.

const fs = require('fs');
const path = require('path');
const twilio = require('twilio');

// array of listeners that are also informed of
// messages logged
var listeners = new Array();


// log levels
module.exports.LOG_INFO = 0 
module.exports.LOG_WARN = 1;
module.exports.LOG_ERROR = 2;


/**
 * Sends an sms message using the twillio info in config
 * 
 * @param config - object with configuration data
 * @param message - sms messasge to be sent
 */
var sendSMS = function(config, message) {
  // send sms message indicating alarm has been triggered
  var twilioClient = new twilio.RestClient(config.twilio.accountSID, config.twilio.accountAuthToken);
  twilioClient.sendMessage({
    to: config.twilio.toNumber,
    from: config.twilio.fromNumber,
    body: message 
  }, function(err, message) {
    if (err) { 
      module.exports.logMessage(config, 'Failed to send sms:' + err.message, module.exports.LOG_WARN);
    } else {
      module.exports.logMessage(config, 'SMS Sent:' + message.sid, module.exports.LOG_INFO);
    }
  });
}

/**
 * Add listener to list of listeners informed
 * when a message is logged
 * 
 * @param listener - listener to be added
 */
module.exports.addListener = function(listener) {
  listeners.push(listener);
}


/**
 * Remove listener from list of listeners informed
 * when a message is logged
 * 
 * @param listener - listener to be added
 */
module.exports.removeListner = function(listener) {
  for (var i = 0; i < listeners.length; i++) {
    if (listeners[i] === listener) {
      listeners.splice(i,1);
    }
  }
}


/**
 * Log a message and optionally if at LOG_ERROR
 * level send an sms alert
 *
 * @param config - object with configuration data
 * @param messaege - message to be logged
 * @param level - level one of LOG_ERROR, LOG_WARN or
 *                LOG_INFO
 */
module.exports.logMessage = function(config, message, level) {
  if (level === module.exports.LOG_ERROR) {
    if (config.twilio.sendError) {
      sendSMS(config, message, level);
    }
  }

  // no point to provide error function as we won't do
  // anything in case of an error
  var formattedMessage = level + ':' + new Date() + ': ' + message;
  fs.appendFile(module.exports.getLogFileName(config), formattedMessage + '\n');

  // notify the listeners
  for (var i = 0; i < listeners.length; i++) {
    listeners[i](formattedMessage);
  }
}



var logFileName;
/**
 * get the name of the log file to write logs to
 * 
 * @param config - object with configuration data
 */
module.exports.getLogFileName = function(config) {
  if (logFileName === undefined) {
    logFileName = path.join(config.eventLogPrefix, 'event_log.txt');
  }
  return logFileName;
}
