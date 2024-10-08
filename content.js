let players = {};

const costs = {
  road: { lumber: 1, brick: 1 },
  settlement: { lumber: 1, brick: 1, grain: 1, wool: 1 },
  city: { grain: 2, ore: 3 },
  developmentCard: { wool: 1, grain: 1, ore: 1 }
};

function validPlayerName(playerName) {
  playerName = playerName.toLowerCase();
  if ( playerName === 'bot' || playerName === 'happy') {
    return false;
  }
  return true;
}

function initializePlayers() {
  const initialResources = { lumber: 0, brick: 0, ore: 0, grain: 0, wool: 0, unknown: 0 };
  document.querySelectorAll('.color_row').forEach(row => {
    const playerName = row.querySelector('.color_row_name').textContent.trim();
    players[playerName] = {...initialResources};
  });
}

function updateStorage() {
  chrome.storage.local.set({players: players}, function() {
    chrome.runtime.sendMessage({action: "updatePopup"});
  });
}

function tradeResourcesBetweenPlayers(senderPlayer, receiverPlayer, senderResources, receiverResources) {
  // For some reason resource is a number, so "senderResources[resource]" get's the resource name
  for (const resource in senderResources) {
    players[senderPlayer][senderResources[resource]]--;
    players[receiverPlayer][senderResources[resource]]++;
  }

  for (const resource in receiverResources) {
    players[receiverPlayer][receiverResources[resource]]--;
    players[senderPlayer][receiverResources[resource]]++;
  }

  updateStorage();
}

function tradeResourcesWithBank(playerName, tradeResources, resourceFromBank) {
  for (const resource in tradeResources) {
    players[playerName][tradeResources[resource]]--;
  }

  players[playerName][resourceFromBank]++;

  updateStorage();
}

function extractTradeResources(messageElement) {
  const text = messageElement.textContent;
  
  // Extract player names
  const senderPlayerMatch = text.match(/^(\S+)/);
  const senderPlayerName = senderPlayerMatch ? senderPlayerMatch[1] : null;
  const receiverPlayerMatch = text.match(/from (\S+)/);
  const receiverPlayerName = receiverPlayerMatch ? receiverPlayerMatch[1] : null;

  // Initialize resource lists
  const givenResources = [];
  const receivedResources = [];

  // Get all resource images
  const resourceImages = messageElement.querySelectorAll('img.lobby-chat-text-icon');

// Flag to know when to switch to the second list
let addingToFirstList = true;

resourceImages.forEach((img) => {
  if (addingToFirstList) {
    givenResources.push(img.alt);
// Check if the next sibling contains the "and got" text
if (img.nextSibling && img.nextSibling.textContent.includes('and got')) {
  addingToFirstList = false; // Switch to the second list after "and got"
}
} else {
// After "and got", add images to the second list
receivedResources.push(img.alt);
}
});

  return {
    senderPlayerName,
    receiverPlayerName,
    givenResources,
    receivedResources
  };
}

function subtractResourceFromPlayer(playerName, resource) {
  // Check if the player has enough of resource type
  if (players[playerName][resource] > 0) {
    players[playerName][resource]--;
    return;
  }
  players[playerName].unknown--;
  players[playerName][resource]++;
}

function playerBuildItem(playerName, builtItem){
  // If the player has enough resources to buy the item, then assume that pays with knwown resources and return
  if (builtItem === 'road') {
    subtractResourceFromPlayer(playerName, 'lumber');
    subtractResourceFromPlayer(playerName, 'brick');
  } else if (builtItem === 'settlement') {
    subtractResourceFromPlayer(playerName, 'lumber');
    subtractResourceFromPlayer(playerName, 'brick');
    subtractResourceFromPlayer(playerName, 'grain');
    subtractResourceFromPlayer(playerName, 'wool');
  } else if (builtItem === 'city') {
    subtractResourceFromPlayer(playerName, 'grain');
    subtractResourceFromPlayer(playerName, 'grain');
    subtractResourceFromPlayer(playerName, 'ore');
    subtractResourceFromPlayer(playerName, 'ore');
    subtractResourceFromPlayer(playerName, 'ore');
  }

}

function getMainPlayerName() {
  const username = document.getElementById('header_profile_username').textContent.trim();
  if (!username) return;
  return username;
}

// TODO: check how to incorporate unkwown resources here
function useMonopolyDevelopmentCard(playerName, resourceType, amount) {
  players[playerName][resourceType] += amount;
  for (const player in players) {
    if (player === playerName) continue;
    players[player][resourceType] = 0;
  }
  updateStorage();
}

function stealResourceFromAnotherPlayer(playerName, stolenFrom, resourceImages) {
  const mainPlayerName = getMainPlayerName();
  if(playerName.toLowerCase() === 'you'){
    playerName = mainPlayerName; // We know what was stolen, no need to use unkwown
    const stolenItem = resourceImages[0].alt;
    players[playerName][stolenItem]++;
    players[stolenFrom][stolenItem]--;
  }
  else if(stolenFrom.toLowerCase() === 'you'){
    stolenFrom = mainPlayerName;
    const stolenItem = resourceImages[0].alt;
    players[playerName][stolenItem]++;
    players[stolenFrom][stolenItem]--;
  }
  else{
    players[playerName].unknown++;
    players[stolenFrom].unknown--;
  }
  updateStorage();
}

function processGameLogs() {
  const gameLog = document.getElementById('game-log-text');
  if (!gameLog) return;

  const mainPlayerName = getMainPlayerName();

  gameLog.querySelectorAll('.message-post').forEach(message => {
    const text = message.textContent;
    const resourceImages = message.querySelectorAll('img.lobby-chat-text-icon');
    const playerMatch = text.match(/^(\S+)/);
    if (!playerMatch) return;
    
    let playerName = playerMatch[1];
    if (!validPlayerName(playerName)) return; 
    if (!players[playerName] && playerName.toLowerCase() !== 'you') {
      // Initialize player if they don't exist and account for first strutures
      players[playerName] = { lumber: 0, brick: 0, ore: 0, grain: 0, wool: 0, unknown: 0 };
    } 

    if (text.includes('received starting resources')) {
      resourceImages.forEach(img => { 
        const resourceType = img.alt;
        if (resourceType in players[playerName]) {
          players[playerName][resourceType]++;
        }
      });
    } else if (text.includes('gave')) { // Trade
      // Check if the trade is to the bank
      if (text.includes('bank')) {
        const tradeResources = [];
        for(let i = 0; i < resourceImages.length - 1; i++){
          tradeResources.push(resourceImages[i].alt);
        }
        // Last resource is from the bank
        const resourceFromBank = resourceImages[resourceImages.length - 1].alt;

        tradeResourcesWithBank(playerName, tradeResources, resourceFromBank);

      } else{

        const { senderPlayerName, receiverPlayerName, givenResources, receivedResources } = extractTradeResources(message);

        tradeResourcesBetweenPlayers(senderPlayerName, receiverPlayerName, givenResources, receivedResources);
      }
    } else if (text.includes('got')) {
      resourceImages.forEach(img => {
        const resourceType = img.alt;
        if (resourceType in players[playerName]) {
          players[playerName][resourceType]++;
        }
      });
    } else if (text.includes('built')) {
      // We can assume that there is only one thing being built at a time
      const builtItem = resourceImages[0].alt;
      playerBuildItem(playerName, builtItem);
    } else if (text.includes('bought')) {
      subtractResourceFromPlayer(playerName, 'wool');
      subtractResourceFromPlayer(playerName, 'grain');
      subtractResourceFromPlayer(playerName, 'ore');
    } else if (text.includes('stole')) { // TODO: Account for stealing using monopoly card
      console.log(text);
        console.log(resourceImages[0].alt);
      // Case when the player stole uses the monopoly card to steal from everyone
      if(!text.includes('from')){
        const amount = Number(text.split(' ')[2]);
        useMonopolyDevelopmentCard(playerName, resourceImages[0].alt, amount);
      } else{
        let stolenFrom = text.match(/from (\S+)/)[1];
        stealResourceFromAnotherPlayer(playerName, stolenFrom, resourceImages);
      }  
    } else if (text.includes('discarded')) {
      if (playerName.toLowerCase() === 'you') {
        playerName = mainPlayerName;
      }
      resourceImages.forEach(img => {
        const resourceType = img.alt;
        if (resourceType in players[playerName]) {
          players[playerName][resourceType]--;
        }
      });
    } else if (text.includes('took from bank')) {
      if (playerName.toLowerCase() === 'you') {
        playerName = mainPlayerName;
      }
      resourceImages.forEach(img => {
        const resourceType = img.alt;
        players[playerName][resourceType]++;
      });
    }

    

    // // Ensure no negative values
    // for (const resource in players[playerName]) {
    //   if (players[playerName][resource] < 0) {
    //     players[playerName].unknown += Math.abs(players[playerName][resource]);
    //     players[playerName][resource] = 0;
    //   }
    // }
  });

  updateStorage();
}

function restartTracker() {
  players = {};
  chrome.storage.local.set({players: players}, function() {
    chrome.runtime.sendMessage({action: "updatePopup"});
  });
  console.log('Tracker restarted');
}

// Initialize players when the script loads
initializePlayers();

// Process game logs initially
processGameLogs();

// Set up a MutationObserver to watch for changes in the game log
const observer = new MutationObserver(processGameLogs);
const gameLog = document.getElementById('game-log-text');
if (gameLog) {
  observer.observe(gameLog, { childList: true, subtree: true });
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "restart") {
    restartTracker();
    sendResponse({success: true});
  } else if (request.action === "recalculate") {
    players = {};
    initializePlayers();
    processGameLogs();
    sendResponse({success: true});
  }
  return true;  // Indicates that the response is sent asynchronously
});