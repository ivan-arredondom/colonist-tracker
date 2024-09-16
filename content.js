// Example of accessing the DOM to get resource info
document.addEventListener('DOMContentLoaded', function() {
    const playerInfo = document.querySelector('.player-resources'); // Adjust based on actual class/id
    if (playerInfo) {
      console.log(playerInfo.innerText);
      chrome.storage.local.set({ resources: playerInfo.innerText });
    }
  });