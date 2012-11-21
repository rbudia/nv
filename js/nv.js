// NOTE: in comments 'bb' === 'backbone'

// TODO Lane move this to the nessus bb model
var isChangeVis = false;


// TODO Mike do we need these? -Lane
var eventList;
var nbeText1 = "";
var nbeText2 = "";
var groupList = [];


// TODO Lane Mike the sizeBy functions are currently connected directly to 
// buttons in index.html. We should create a bb view for the div id="sizeoptions" 
// so we can handle these via bb events.
function sizeBySeverity() {
   NV.treemap.set('sizeOption', 'cvss'); 
}

function sizeByCriticality() {
   NV.treemap.set('sizeOption', 'criticality'); 
}

function sizeByCount() {
   NV.treemap.set('sizeOption', 'value'); 
}


// Sets the main Backbone data model
function setNBEData(dataset){
  NV.nessus.setData(dataset);
}


function handleGroupAdd(){
  //TODO make sure each IP is only in one group(?)
  //TODO should really be able to remove groups also ...
  var start = $("#ipStart").val();
  var end = $("#ipEnd").val();
  var groupName = $("#groupName").val();
  var weight = $("#defaultWeight").val();
  var newGroup = {"start":start, "end":end, "groupName":groupName, "weight":weight};
  groupList.push(newGroup);
  console.log("added group: " + JSON.stringify(newGroup));
  console.log("group list now contains: " + JSON.stringify(groupList));
  updateCurrentGroupTable(); //why is this needed here?  Somehow affects table re-drawing?
}

// remove loaded data
function clearData() {
  eventList = {};
  groupList = [];
  
  // TODO: RESET THE VIS HERE!
  
  $('#file-list').html('');
  $('#file-reset-btn').addClass('disabled');
  $('#file-continue-btn').addClass('disabled');

  $('#groups-continue-btn').addClass('disabled');

  $('#groupsTabNav').addClass('disabled');
  $('#visTabNav').addClass('disabled');

}

function showDataPage() {
  console.log('show data page');
  $('#file-status-msg').html('');
  $('#file-status').alert('close')
}

function dataLoaded(fileName) {
  $('#groupsTabNav').removeClass('disabled');
  
  $('#file-status').css('display', 'block');
  $('#file-status').addClass('alert-success');
  $('#file-status-msg').html('<i class="icon-file"></i> <strong>' + fileName + '</strong> loaded in browser.');
  
  $('#file-list').append('<i class="icon-file"></i> ' + fileName);

  $('#file-reset-btn').removeClass('disabled');  
  $('#file-continue-btn').removeClass('disabled');

}

function showGroupsPage(){
  console.log('show group page');
  if( ! eventList ) {
    updateEventList();
  }
  updateCurrentGroupTable();
  
  $('#visTabNav').removeClass('disabled');
  $('#groups-continue-btn').removeClass('disabled');
  
}

function showVisPage(){
  console.log('show vis page');
  //in case groups tab did not set it.
  if( ! eventList ) {
    updateEventList();
  }
}

function updateEventList(){
  var nbeItems1 = "",
      nbeItems2 = "";

  nbeItems1 = parseNBEFile( nbeText1 );
  eventList = nbeItems1;
  if(nbeText2.trim() !== ""){
    isChangeVis = true;
    nbeItems2 = parseNBEFile( nbeText2 );
    eventList = mergeNBEs(nbeItems1, nbeItems2);
  }
}

function updateCurrentGroupTable(){

  if( ! eventList ){ //have never seen this happen, but leaving in for now --mdi
    console.log("updateCurrentGroupTable needed to update eventList: this is unexpected.");
    updateEventList();
  }

  //build default group list
//  console.log("event list is " + JSON.stringify(eventList));
  var ips = findIPsInList(eventList);
  //console.log("have these IPs: " + JSON.stringify(ips));

  //add to the default group.
  //NOTE we are building this list of groups:ips, instead of the two seperate lists we already have, so that all machines in a group are next to each other in the table.  TODO might be cleaner to just do this in buildTable?  No other fns need this list currently.
  groups = {};
  for( var i=0; i < ips.length; i++ ){
    var groupName = findGroupName(ips[i]);
    var weight = 1; //default
    for(var j=0; j<groupList.length; j++){
      if(groupList[j].groupName === groupName){
        weight = groupList[j].weight;
      }
    }
    var entry = {"ip": ips[i], "weight": weight};
    console.log("found that ip " + ips[i] + " is in group " + groupName);
    if( !groups[groupName] ){
      groups[groupName] = [];
    }
    groups[groupName].push(entry);
  }

  //console.log("current group list is: " + JSON.stringify(groups) );

  //display the (default) groups and weights for all machines.
  buildTable(groups);

  //add group name to item in crossfilter
  eventList = addGroupInfoToData(groups, eventList);

  // sets the backbone data model
  setNBEData(eventList);
}

//TODO
//this will be somewhat slow, O(n^2), no easy way around it.
//note this will modify nbeItems2 and not modify nbeItems1.  Can change this if needed later.
function mergeNBEs(nbeItems1, nbeItems2){

  var result = []
    , openItems = 0
    , changedItems = 0
    , found
    , i
    , j
    , item;

  function compareEntries(a, b){ //true if equal, false if not
    if(a.ip === b.ip && a.vulnid === b.vulnid && a.vulntype === b.vulntype && a.cvss === b.cvss && a.port === b.port){
      return true;
    }
    else {
      return false;
    }
  }

  //iterate through first list, find matching items in second list. mark them 'open' in result and remove from second list.
  //if no matching item is found, mark it as 'changed' in first.
  for(i=0; i<nbeItems1.length; i++){
    found = false;
    for(j=0; j<nbeItems2.length; j++){
      if( compareEntries(nbeItems1[i], nbeItems2[j]) ){
        found = true;
        item = nbeItems1[i];
        item.state = 'open';
        result.push(item);
        nbeItems2.splice(j, 1);
        openItems +=1;
        break;
      }
    }
    if(found === false){
      item = nbeItems1[i];
      item.state = 'fixed';
      result.push(item);
      changedItems +=1;
    }
  }
  console.log("open items: " + openItems);
  console.log("changed items: " + changedItems);
  console.log("new items: " + nbeItems2.length);
  //handle items remaining in second list. (append to result list, mark 'new')
  while( nbeItems2.length > 0){
    item = nbeItems2.pop();
    item.state = 'new';
    result.push(item);
  }

  return result;
}

function findIPsInList(eventList){
  var ips = {}; //making a fake set here.
  for( var i=0; i < eventList.length; i++ ){
    ips[eventList[i].ip] = true;
  }
  ips = Object.keys(ips); //only need to keep this
  return ips;
}

function findGroupName(ip){
  var testAddr = ip.split('.');
  if( testAddr.length !== 4){
    throw "address of " + groupList[i].end + " is invalid";
  }

  function isAfter(start, test){ //after or equal will return true
    for(var i=0; i<4; i++){
      if(parseInt(start[i], 10) > parseInt(test[i], 10)){
        return false;
      }
    }
    return true;
  }

  function isBefore(end, test){ //before or equal
    return isAfter(test, end);
  }

  //grouplist contains a list of {start, end, groupName, weight}
  for(var i=0; i<groupList.length; i++){
    var start = groupList[i].start.split('.');
    if( start.length !== 4){
      throw "start address of " + groupList[i].start + " is invalid";
    }
    var end = groupList[i].end.split('.');
    if( end.length !== 4){
      throw "end address of " + groupList[i].end + " is invalid";
    }
    console.log(groupList[i].groupName + ": isAfter(" + groupList[i].start + ", " + ip + ") returned " + isAfter(start, testAddr) );
    console.log(groupList[i].groupName + ": isBefore(" + groupList[i].end  + ", " + ip + ") returned " + isBefore(end, testAddr) );
    if( isAfter(start, testAddr) && isBefore(end, testAddr) ){
      return groupList[i].groupName;
    }
  }
  return "none"; //not found; "none" is the default label for table.
}

function addGroupInfoToData(groups, eventList){
  var events = []
    , ips = {} //make a map of ip:{group, weight}
    , groupNames = Object.keys(groups)
    , i
    , j;
  for( j=0; j < groupNames.length; j++ ){
    var machines = groups[groupNames[j]];
    for( i=0; i < machines.length; i++ ){
      ips[machines[i].ip] = {"group": groupNames[j], "weight": machines[i].weight};
    }
  }

  for( i=0; i < eventList.length; i++ ){
    events.push(eventList[i]);
    events[i].group  = ips[eventList[i].ip].group;
    events[i].criticality = parseInt(ips[eventList[i].ip].weight, 10);
  }
  return events;
}

function buildTable(groups){
  $('#currentGroupTable').select('tbody').html("");
  var weightSelector, row;
  var groupNames = Object.keys(groups);
  for( var j=0; j < groupNames.length; j++ ){
    var machines = groups[groupNames[j]];
    for( var i=0; i < machines.length; i++ ){
      weightSelector = '<select class="weightSelect" id="weightSelect' + machines[i].ip.split('.').join('_') + '"';
      weightSelector += '><option value="1">1 (lowest)</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option><option value="7">7</option><option value="8">8</option><option value="9">9</option><option value="10">10 (highest)</option></select>';
      row = '<tr>';
      row += '<td>'+ groupNames[j] +'</td><td>'+ machines[i].ip +'</td>';
      row += '<td>'+ weightSelector +'</td>';
      row += '</tr>';
      $('#currentGroupTable').select('tbody').append(row);
      $('#weightSelect' + machines[i].ip.split('.').join('_') ).children().eq(machines[i].weight-1).attr("selected","selected");
      //console.log( $('#weightSelect' + machines[i]["ip"].split('.').join('_') ).select('option').eq(machines[i]["weight"]-1).html() );
    }
  }
}

//TODO has to be on a server for this to work?  Go figure.
//rather loosely based on these examples http://www.html5rocks.com/en/tutorials/file/dndfiles/
var handleFileSelect = function (element) {
  
  var holder = document.getElementById(element);
  
  if (typeof window.FileReader === 'undefined') {
    $('#file-status').css('display', 'block');
    $('#file-status').addClass('alert-error');
    console.log('FileReader not supported');
  } 
  else {
    console.log('FileReader supported');
  }
 
  holder.ondragover = function () { 
    this.className = 'hover'; 
    return false; 
  };
  
  holder.ondragend = function () { 
    this.className = ''; 
    return false; 
  };
  
  holder.ondrop = function (e) {
    this.className = '';
    e.preventDefault();

    var files = e.dataTransfer.files,
        f = files[0],
        reader = new FileReader();
                      
    reader.readAsText(f); //utf-8 encoding is default

    reader.onload = function (event) {
      // if this is the first file, load to nbeText1
      // if not, then any additional files are saved to nbeText2
      if ( nbeText1.trim() === '' ) {
        nbeText1 = event.target.result;
      }
      else {
        nbeText2 = event.target.result;
      }
      console.log('Loaded file: ' + f.name);

      dataLoaded(f.name);
    };

    reader.onerror = function() {
      $('#file-status').css('display', 'block');
      $('#file-status').addClass('alert-error');
      $('#file-status-msg').html('could not parse file ' + f.name + ' as text');
    };

    return false;
  };
  
};

var vulnIdInfo = {};

// initialization
$().ready(function () {

  // set up file drag and drop
  handleFileSelect('file-drop');

  // reset the data
  $('#file-reset-btn').click(function(event) {
    clearData();
  });  

  // tab events
  $('#dataTab1Link').click(function(event) {
    event.preventDefault();
    showDataPage();
  });
  $('#file-continue-btn').click(function(event) {
    $('#groupsTabLink').tab('show');
    showGroupsPage();
  });
  
  $('#groupsTabLink').click(function(event) {
    event.preventDefault();
    showGroupsPage();
  });
  $('#groups-continue-btn').click(function(event) {
    $('#visTabLink').tab('show');
    showVisPage();
  });
  
  $('#visTabLink').click(function(event) {
    event.preventDefault();
    showVisPage();
  });  

  // set up button for adding new group
  $('#addGroupBtn').click(function(event) {
    handleGroupAdd();
  });
  

  //TODO kind of a dumb reason to need a server running...
  // -- true, maybe we could just put the vulnids in a js file and include in the html?
  $.get("data/vulnIDs.json", function(data) {
    console.log("Got the vulnIDs JSON file!");
    //console.log(data)
    tempData = data;//JSON.parse(data);
    tempKeys = Object.keys(tempData);
    for(var i=0; i<tempKeys.length; i++){
      //console.log( tempData[tempKeys[i]])
      vulnIdInfo[tempKeys[i]] = tempData[tempKeys[i]];
    }
    //var resp = $(data); // Now you can do whatever you want with it
    //$("#contentMain", resp).appendTo("#nessusinfo");
  });

});
