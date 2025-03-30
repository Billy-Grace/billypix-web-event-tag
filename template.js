// GTM API functions required
const log = require('logToConsole');
const copyFromWindow = require('copyFromWindow');
const getType = require('getType');
const Object = require('Object');
const setInWindow = require('setInWindow');
const getTimestamp = require('getTimestamp');
const Math = require('Math');
const injectScript = require('injectScript');
const JSON = require('JSON');
const getContainerVersion = require('getContainerVersion');
const queryPermission = require('queryPermission');

/**
 * Billy Grace Event Tag for GTM
 * It requires the Billy Grace Configuration tag to be run first.
 */

// Unique identifier for BillyPix, replace 'ID-XXXXXXXX' with actual ID
const billyPixId = data.trackingID;
const billyFunctionName = data.useStaging ? 'StagBillyPix' : 'BillyPix';

// Conditional logging based on boolean set by implementer
function debugLog(message) {
  if (data.isDebug) {
    log('[BG Event Tag]', message);
  }
}

/**
 * Determines the event name based on user configuration
 * @param {Object} data - The GTM tag data object
 * @return {String} The resolved event name
 */
const getEventName = (data) => {
  // Also send unknown names, as this indicates something is wrong
  let eventName = 'unknown';
  
  // Standard events from dropdown
  if (data.eventName === 'standard' && data.standardEventName) eventName = data.standardEventName;    

  // Custom event name typed out by user
  if (data.eventName === 'custom' && data.customEventName) eventName = data.customEventName;    
  
  // GTM Variabe as event name
  if (data.eventName === 'variable' && data.variableEventName) eventName = data.variableEventName;    
  
  return eventName;
};

/**
 * Collects all event parameters 
 * @param {Object} data - The GTM tag data object
 * @return {Object|String} The event parameters or empty string if none
 */
const getEventData = (data) => {
  // Store extra event data
  let customEventData = {};
  
  // If any extra custom parameters are set
  if (data.extraEventParameters){
    // If set, make sure to set in right format
    for (let extraDataItem of data.extraEventParameters) {
      customEventData[extraDataItem.eventParameterName] = extraDataItem.eventParameterValue;
    }
  }
  
  // If any of the values are set, then override anything we currently have
  if (data.transaction_id) customEventData.transaction_id = data.transaction_id;
  if (data.value) customEventData.value = data.value;
  if (data.currency) customEventData.currency = data.currency;
  
  // Used for de-duplication
  if (data.eventID) customEventData.event_id = data.eventID;
  
  // Just an empty string so no object parsing will happen on receival
  if (Object.keys(customEventData).length === 0){
     return '';
  }
  
  // Prepare data to be send out
  return customEventData;
};

// Grab all required data needed for this event
const eventName = getEventName(data);
const eventData = getEventData(data);


// Debug to see if correct
debugLog('eventName: ' + eventName);
debugLog('eventData: ' + JSON.stringify(eventData || {}));
  

// Sanity check: Fail if no event name is set
if (eventName === 'unknown') {
  log('[BG Event Tag] Error: No event name is set. Please select a standard event, set a custom event name, or use a variable.');
  return data.gtmOnFailure();
}

/**
 * Checks if the Billy Grace tracking function is properly set up in the window
 * @return {Boolean} True if BillyPix is available and valid
 */
function isBillyPixValid() {
  const BillyPixFunction = copyFromWindow(billyFunctionName);
  const existingQueue = copyFromWindow(billyFunctionName + '.queue');

  // BillyPix should exist, be a function, and have an array queue
  return BillyPixFunction && 
         (getType(BillyPixFunction) === 'function') && 
         (getType(existingQueue) === 'array');
}


/**
 * Callback function called after script is loaded
 * Initializes the tracking and sends the event
 */
function onScriptLoadedAndFireEvent() {
  // Get the function again to ensure we have latest reference
  const BillyPix = copyFromWindow(billyFunctionName);

  if (!BillyPix) {
    log('[BG Event Tag] Error: ' + billyFunctionName + ' not found after script load');
    return data.gtmOnFailure();
  }

  // Determine if live debugging needs to be turned on
  const cv = getContainerVersion();

  // Difference preview and debug: https://support.google.com/tagmanager/answer/6107056
  // TLDR: Both are set to true when you are debugging your container
  const isGtmDebugSession = cv.debugMode && cv.previewMode;
  
  // Initialize BillyPix with the tracking ID
  BillyPix('init', billyPixId, {debug: isGtmDebugSession});
  debugLog('Successfully initialized the ' + billyFunctionName + ' for ID: ' + billyPixId);

  // Fire the event
  BillyPix('event', eventName, eventData);
  
  // Complete the tag
  return data.gtmOnSuccess();
}


/**
 * Adds the main tracking function to the window
 * Only called if the function doesn't already exist (backup functionality)
 */
function addMainFunctionToWindow() {
  debugLog(billyFunctionName + ' not found, initializing...');
  
  // Main function that gets triggered on each call to it
  const pixelFunction = function() {
    
    // Store arguments for easier access
    let args = [];
    for (var i = 0; i < arguments.length; i++) {
      args.push(arguments[i]);
    }

    // Get a fresh reference to the function to ensure we have the latest version
    const pixelFunc = copyFromWindow(billyFunctionName);
    
    // If process method exists and is a function, pass arguments to it
    if (pixelFunc && typeof pixelFunc.process === 'function') {
      debugLog('Processing ' + billyFunctionName + '("' + args[0] + '", "' + args[1] + '", ' +JSON.stringify(args[2] || {}) + ')');
      
      // Call process safely using call instead of apply
      return pixelFunc.process(args[0], args[1], args[2]);
    } else {
      // Process isn't available yet, queue the command for later execution
      debugLog('Queueing ' + billyFunctionName + '("' + args[0] + '", "' + args[1] + '", ' +JSON.stringify(args[2] || {}) + ')');
      
      // Get the queue and push to it
      const queue = copyFromWindow(billyFunctionName + '.queue');
      
      // Add to queu for later processing when remote js arrives
      if (queue && getType(queue) === 'array') {
        queue.push(args);
      } else {
        
        // If queue isn't available, initialize it first
        setInWindow(billyFunctionName + '.queue', [args], true);
        debugLog('Created new queue with first event');
      }
    }
  };
  
  // Set the function in the window
  setInWindow(billyFunctionName, pixelFunction, true);
  
  // Initialize an empty queue array
  setInWindow(billyFunctionName + '.queue', [], true);
  
  // Set the timestamp
  setInWindow(billyFunctionName + '.t', getTimestamp(), true);
}


// Sanity check: BillyPix needs to be available
if (isBillyPixValid()) {
    // BillyPix is already available and valid - just fire the event
    debugLog('BillyPix reference exists in window');
  
    // Grab the existing function
    const BillyPix = copyFromWindow(billyFunctionName);

    // Fire the event
    BillyPix('event', eventName, eventData);
    
    // Complete the tag
    data.gtmOnSuccess();
}else{
    // Make it clear they the user messed up
    log('[BG Event Tag] Warning: ' + billyFunctionName + ' not available in window, make sure to first run the "Billy Grace - Web Configuration" tag. For now we are still loading it, but this can lead to performance issued');

    // The backup functionality to add the BillyPix object if the sequencing was off
    // Can be added to the window before loading the js bundle
    addMainFunctionToWindow();

    // Calculate cache busting value
    const secondsBuste = 30*1000; // 6 hours in milliseconds
    const epochRounded = secondsBuste * Math.ceil(getTimestamp() / secondsBuste);
    const cdnEndpoint = data.useStaging ? 'https://staging.bgmin.cdn.billygrace.com' : 'https://bgmin.cdn.billygrace.com';
    const scriptUrl = cdnEndpoint + '?t=' + epochRounded + '&v=0.2.0';

    // Check permissions for script injection
    if (!queryPermission('inject_script', scriptUrl)) {
      log('[BG Event Tag] Error: Permission denied to inject script from ' + scriptUrl);
      return data.gtmOnFailure();
    }

    // Inject the BillyPix script
    injectScript(scriptUrl, onScriptLoadedAndFireEvent, data.gtmOnFailure, scriptUrl);  
}