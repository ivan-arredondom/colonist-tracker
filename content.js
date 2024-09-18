let players = {};

const costs = {
  road: { wood: 1, brick: 1 },
  settlement: { wood: 1, brick: 1, grain: 1, wool: 1 },
  city: { grain: 2, ore: 3 },
  developmentCard: { wool: 1, grain: 1, ore: 1 }
};

function initializePlayers() {
  const initialResources = { wood: 0, brick: 0, ore: 0, grain: 0, wool: 0, unknown: 0 };
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

function processGameLogs() {
  const gameLog = document.getElementById('game-log-text');
  if (!gameLog) return;

  gameLog.querySelectorAll('.message-post').forEach(message => {
    const text = message.textContent;
    const resourceImages = message.querySelectorAll('img.lobby-chat-text-icon');
    const playerMatch = text.match(/^(\S+)/);
    if (!playerMatch) return;
    
    const playerName = playerMatch[1];
    if (playerName.toLowerCase() === 'happy') return; // Ignore if the player's name is "happy"
    if (!players[playerName]) players[playerName] = { wood: 4, brick: 4, ore: 0, grain: 2, wool: 2, unknown: 0 };

    if (text.includes('received starting resources')) {
      resourceImages.forEach(img => {
        const resourceType = img.alt;
        if (resourceType in players[playerName]) {
          players[playerName][resourceType]++;
        }
      });
    } else if (text.includes('got')) {
      console.log(message);
      console.log(text);
      resourceImages.forEach(img => {
        const resourceType = img.alt;
        if (resourceType in players[playerName]) {
          players[playerName][resourceType]++;
        }
      });
    } else if (text.includes('placed') || text.includes('built')) {
      if (text.includes('road')) {
        players[playerName].wood--;
        players[playerName].brick--;
      } else if (text.includes('settlement')) {
        players[playerName].wood--;
        players[playerName].brick--;
        players[playerName].grain--;
        players[playerName].wool--;
      } else if (text.includes('city')) {
        players[playerName].grain -= 2;
        players[playerName].ore -= 3;
      }
    } else if (text.includes('bought a development card')) {
      players[playerName].wool--;
      players[playerName].grain--;
      players[playerName].ore--;
    } else if (text.includes('stole')) {
      const stolenFrom = text.match(/from (\S+)/)[1];
      players[playerName].unknown++;
      players[stolenFrom].unknown--;
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