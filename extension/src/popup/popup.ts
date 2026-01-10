/**
 * Extension Popup UI
 * Provides session control and status display
 */

interface SessionStatus {
  sessionId: string | null;
  isActive: boolean;
  wsConnected: boolean;
}

let sessionStatus: SessionStatus = {
  sessionId: null,
  isActive: false,
  wsConnected: false,
};

async function loadSessionStatus(): Promise<void> {
  // Get status from background script
  chrome.runtime.sendMessage({ type: 'GET_SESSION_STATUS' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error getting session status:', chrome.runtime.lastError);
      return;
    }

    if (response) {
      sessionStatus = response;
      updateUI();
    }
  });
}

function updateUI(): void {
  const statusElement = document.getElementById('status');
  const sessionIdElement = document.getElementById('session-id');
  const connectionElement = document.getElementById('connection');
  const startButton = document.getElementById('start-button') as HTMLButtonElement;
  const endButton = document.getElementById('end-button') as HTMLButtonElement;

  if (!statusElement || !sessionIdElement || !connectionElement || !startButton || !endButton) {
    return;
  }

  // Update status
  if (sessionStatus.isActive) {
    statusElement.textContent = 'Active Session';
    statusElement.className = 'status active';
    startButton.disabled = true;
    endButton.disabled = false;

    if (sessionStatus.sessionId) {
      sessionIdElement.textContent = sessionStatus.sessionId.substring(0, 20) + '...';
      sessionIdElement.style.display = 'block';
    }
  } else {
    statusElement.textContent = 'No Active Session';
    statusElement.className = 'status inactive';
    startButton.disabled = false;
    endButton.disabled = true;
    sessionIdElement.style.display = 'none';
  }

  // Update connection status
  if (sessionStatus.wsConnected) {
    connectionElement.textContent = '✓ Connected';
    connectionElement.className = 'connection connected';
  } else {
    connectionElement.textContent = '✗ Disconnected';
    connectionElement.className = 'connection disconnected';
  }

}

async function startSession(): Promise<void> {
  const startButton = document.getElementById('start-button') as HTMLButtonElement;
  if (startButton) {
    startButton.disabled = true;
    startButton.textContent = 'Starting...';
  }

  chrome.runtime.sendMessage({ type: 'START_SESSION' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error starting session:', chrome.runtime.lastError);
      alert('Failed to start session: ' + chrome.runtime.lastError.message);
      if (startButton) {
        startButton.disabled = false;
        startButton.textContent = 'Start Session';
      }
      return;
    }

    if (response?.success) {
      setTimeout(() => {
        loadSessionStatus();
      }, 500);
    } else {
      alert('Failed to start session');
      if (startButton) {
        startButton.disabled = false;
        startButton.textContent = 'Start Session';
      }
    }
  });
}

async function endSession(): Promise<void> {
  const endButton = document.getElementById('end-button') as HTMLButtonElement;
  if (endButton) {
    endButton.disabled = true;
    endButton.textContent = 'Ending...';
  }

  chrome.runtime.sendMessage({ type: 'END_SESSION' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error ending session:', chrome.runtime.lastError);
      alert('Failed to end session: ' + chrome.runtime.lastError.message);
      if (endButton) {
        endButton.disabled = false;
        endButton.textContent = 'End Session';
      }
      return;
    }

    if (response?.success) {
      setTimeout(() => {
        loadSessionStatus();
      }, 500);
    } else {
      alert('Failed to end session');
      if (endButton) {
        endButton.disabled = false;
        endButton.textContent = 'End Session';
      }
    }
  });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadSessionStatus();

  // Refresh status every 2 seconds
  setInterval(loadSessionStatus, 2000);

  // Set up button handlers
  const startButton = document.getElementById('start-button');
  const endButton = document.getElementById('end-button');
  const openDashboardButton = document.getElementById('open-dashboard');

  if (startButton) {
    startButton.addEventListener('click', startSession);
  }

  if (endButton) {
    endButton.addEventListener('click', endSession);
  }

  if (openDashboardButton) {
    openDashboardButton.addEventListener('click', async () => {
      try {
        // Try to open dashboard
        await chrome.tabs.create({ url: 'http://localhost:5173' });
      } catch (error) {
        // If frontend not running, show helpful message
        alert(
          'Dashboard is not running.\n\n' +
          'To start it, run:\n' +
          'npm run dev:frontend\n\n' +
          'Or from project root:\n' +
          'npm run dev'
        );
        console.error('Failed to open dashboard:', error);
      }
    });
  }
});
