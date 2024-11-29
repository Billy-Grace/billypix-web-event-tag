// GTM API functions required
const log = require('logToConsole');
const copyFromWindow = require('copyFromWindow');
const getType = require('getType');
const Object = require('Object');
const setInWindow = require('setInWindow');
const createArgumentsQueue = require('createArgumentsQueue');
const getTimestamp = require('getTimestamp');
const Math = require('Math');
const injectScript = require('injectScript');


// Debug to see if correct
if (data.isDebug){
  log('Incoming user defined: ', data);
}

// Check which option is selected and grab the right name
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

// If set, make sure to grab all the event data parameters and set as string
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

// Unique identifier for BillyPix, replace 'ID-XXXXXXXX' with actual ID
const billyPixId = data.trackingID;
const cdnEndpoint = data.useStaging ? 'https://staging.bgmin.cdn.billygrace.com' : 'https://bgmin.cdn.billygrace.com';
const billyFunctionName = data.useStaging ? 'StagBillyPix' : 'BillyPix';
const eventName = getEventName(data);
const eventData = getEventData(data);



// Debug to see if correct
if (data.isDebug){
  log('eventName', eventName);
  log('eventData', eventData);
}

// Sanity check: Fail if no event name is set
if (eventName === 'unknown') {
  log('No eventName is set, please make sure to select one are set a custom one');
  return data.gtmOnFailure();
}

// Return the existing 'BillyPix' global method if available
let BillyPix = copyFromWindow(billyFunctionName);

function loadBackupBilly (BillyPixBackup) {
  // Initialize BillyPix so the Tracking ID is set on the web page
  BillyPixBackup('init', billyPixId);
  
  // Debug to see if correct
  if (data.isDebug){
    log('Backup: Successfully initialized the ' + billyFunctionName + ' for ID: ' + billyPixId);
  }
}

function loadLibraryIfNotAvailable() {
  // Function to ensure BillyPix is defined and properly queues commands
  const BillyPixBackup = createArgumentsQueue(billyFunctionName, billyFunctionName + '.queue');
  
  // Setup BillyPix with the current timestamp
  setInWindow(billyFunctionName + '.t', getTimestamp(), false);

  // Generate the script URL with cache busting
  const secondsBuste = 30*1000;
  const epochRounded = secondsBuste * Math.ceil(getTimestamp() / secondsBuste);
  const scriptUrl = cdnEndpoint + '?t=' + epochRounded + '&v=0.2.0';
  
  // Inject the BillyPix script
  injectScript(scriptUrl, loadBackupBilly(BillyPixBackup), data.gtmOnFailure, scriptUrl);
  
  return BillyPixBackup;
}


// Sanity check: BillyPix needs to be available
if (getType(BillyPix) === 'undefined') {
    
    // Make it clear they the user messed up
    log(billyFunctionName + ' not available in window, make sure to first run the "Billy Grace - Web Configuration" tag. For now we are still loading it, but this can lead to performance issued');
  
    // Load the backup when not set
    BillyPix = loadLibraryIfNotAvailable();
}

// If all is set correct, lets fire the event :)
BillyPix('event', eventName, eventData);

// Debug to see if correct
if (data.isDebug){
  log('Fired event: ', eventName, eventData);
}

data.gtmOnSuccess();