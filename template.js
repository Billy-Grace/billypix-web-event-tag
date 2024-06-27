// GTM API functions required
const log = require('logToConsole');
const copyFromWindow = require('copyFromWindow');
const getType = require('getType');
const Object = require('Object');

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
const billyFunctionName = data.useStaging ? 'StagBillyPix' : 'BillyPix';
const eventName = getEventName(data);
const eventData = getEventData(data);

// Return the existing 'BillyPix' global method if available
let BillyPix = copyFromWindow(billyFunctionName);

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

// Sanity check: BillyPix needs to be available
if (getType(BillyPix) === 'undefined') {
  log(billyFunctionName + ' not available in window, make sure to first run the "Billy Grace - Web Configuration" tag');
  return data.gtmOnFailure();
}

// If all is set correct, lets fire the event :)
BillyPix('event', eventName, eventData);

// Debug to see if correct
if (data.isDebug){
  log('Fired event: ', eventName, eventData);
}

data.gtmOnSuccess();