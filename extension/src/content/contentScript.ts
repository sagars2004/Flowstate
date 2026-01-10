/**
 * Content script for typing velocity measurement
 * Injected into all web pages to track typing activity (metadata only)
 */

interface TypingMetrics {
  keypressCount: number;
  startTime: number;
  lastKeypressTime: number;
}

let typingMetrics: TypingMetrics | null = null;
let typingVelocityBuffer: number[] = [];
let velocityReportTimer: number | null = null;
const VELOCITY_REPORT_INTERVAL = 10000; // Report every 10 seconds
const VELOCITY_WINDOW_MS = 60000; // 1 minute window for velocity calculation

function resetTypingMetrics(): void {
  typingMetrics = {
    keypressCount: 0,
    startTime: Date.now(),
    lastKeypressTime: Date.now(),
  };
}

function calculateTypingVelocity(): number {
  if (!typingMetrics || typingMetrics.keypressCount === 0) {
    return 0;
  }

  const timeElapsed = typingMetrics.lastKeypressTime - typingMetrics.startTime;
  if (timeElapsed === 0) {
    return 0;
  }

  // Calculate characters per minute
  const minutesElapsed = timeElapsed / 60000;
  const velocity = Math.round(typingMetrics.keypressCount / minutesElapsed);

  return velocity;
}

function reportTypingVelocity(): void {
  if (!typingMetrics || typingMetrics.keypressCount === 0) {
    return;
  }

  const velocity = calculateTypingVelocity();
  typingVelocityBuffer.push(velocity);

  // Send to background script
  chrome.runtime.sendMessage(
    {
      type: 'TYPING_VELOCITY',
      payload: {
        velocity,
        keypressCount: typingMetrics.keypressCount,
        timestamp: Date.now(),
        windowDuration: typingMetrics.lastKeypressTime - typingMetrics.startTime,
      },
    },
    () => {
      // Ignore errors (extension might be reloading)
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        // Extension context invalidated - script will be reinjected
      }
    }
  );

  // Reset metrics for next window
  resetTypingMetrics();

  // Schedule next report
  velocityReportTimer = window.setTimeout(reportTypingVelocity, VELOCITY_REPORT_INTERVAL);
}

function handleKeypress(event: KeyboardEvent): void {
  // Ignore modifier keys and function keys
  if (
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.key.length > 1 // Function keys, arrows, etc.
  ) {
    return;
  }

  // Initialize metrics if needed
  if (!typingMetrics) {
    resetTypingMetrics();
    velocityReportTimer = window.setTimeout(reportTypingVelocity, VELOCITY_REPORT_INTERVAL);
  }

  // Update metrics
  if (typingMetrics) {
    typingMetrics.keypressCount++;
    typingMetrics.lastKeypressTime = Date.now();

    // Reset if too much time has passed (user stopped typing)
    const timeSinceLastKeypress = Date.now() - typingMetrics.lastKeypressTime;
    if (timeSinceLastKeypress > VELOCITY_WINDOW_MS) {
      resetTypingMetrics();
    }
  }
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('keydown', handleKeypress);
  });
} else {
  document.addEventListener('keydown', handleKeypress);
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (velocityReportTimer !== null) {
    clearTimeout(velocityReportTimer);
    velocityReportTimer = null;
  }

  // Send final velocity report if there's data
  if (typingMetrics && typingMetrics.keypressCount > 0) {
    reportTypingVelocity();
  }
});
