document.addEventListener('DOMContentLoaded', function() {
  const restartButton = document.getElementById('restartButton');
  const recalculateButton = document.getElementById('recalculateButton');
  const statusMessage = document.createElement('p');
  document.body.appendChild(statusMessage);

  function checkTab(callback) {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0] && tabs[0].url && tabs[0].url.includes('colonist.io')) {
        callback(tabs[0]);
      } else {
        statusMessage.textContent = "Please navigate to a Colonist.io game page.";
      }
    });
  }

  function sendMessage(action) {
    checkTab(function(tab) {
      chrome.tabs.sendMessage(tab.id, {action: action}, function(response) {
        if (chrome.runtime.lastError) {
          statusMessage.textContent = "Error: Content script not loaded. Please refresh the game page.";
        } else if (response && response.success) {
          if (action === "restart") {
            statusMessage.textContent = "Tracker restarted. All players and resources have been reset.";
          } else {
            statusMessage.textContent = `${action} successful!`;
          }
          updatePopup();
        } else {
          statusMessage.textContent = `${action} failed. Please try again.`;
        }
      });
    });
  }

  restartButton.addEventListener('click', function() {
    sendMessage("restart");
  });

  recalculateButton.addEventListener('click', function() {
    sendMessage("recalculate");
  });

  function updatePopup() {
    chrome.storage.local.get(['players'], function(result) {
      const table = document.getElementById('resourceTable');
      // Clear existing rows except header
      while (table.rows.length > 1) {
        table.deleteRow(1);
      }
      
      if (result.players && Object.keys(result.players).length > 0) {
        for (const [player, resources] of Object.entries(result.players)) {
          const row = table.insertRow();
          row.insertCell().textContent = player;
          row.insertCell().textContent = resources.lumber;
          row.insertCell().textContent = resources.brick;
          row.insertCell().textContent = resources.ore;
          row.insertCell().textContent = resources.grain;
          row.insertCell().textContent = resources.wool;
          row.insertCell().textContent = resources.unknown;
        }
      } else {
        statusMessage.textContent = "No player data available. The tracker may have been reset or not initialized.";
      }
    });
  }

  // Update popup when opened
  updatePopup();

  // Listen for updates from content script
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "updatePopup") {
      updatePopup();
    }
  });
});