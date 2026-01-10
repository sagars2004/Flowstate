/**
 * Event batching utility
 * Batches events to reduce network overhead and backend load
 */

export interface BatchedEvent<T> {
  readonly data: T;
  readonly timestamp: number;
}

export class EventBatcher<T> {
  private readonly batchInterval: number;
  private readonly maxBatchSize: number;
  private batch: BatchedEvent<T>[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly flushCallback: (events: T[]) => void | Promise<void>;
  private readonly useAlarms: boolean;
  private alarmName: string;

  constructor(
    flushCallback: (events: T[]) => void | Promise<void>,
    batchInterval: number = 10000, // 10 seconds
    maxBatchSize: number = 50,
    useAlarms: boolean = false, // Set to true in service worker context
    alarmName: string = 'eventBatcher_flush'
  ) {
    this.flushCallback = flushCallback;
    this.batchInterval = batchInterval;
    this.maxBatchSize = maxBatchSize;
    this.useAlarms = useAlarms && typeof chrome !== 'undefined' && chrome.alarms !== undefined;
    this.alarmName = alarmName;

    // Set up alarm listener once if using alarms
    if (this.useAlarms && typeof chrome !== 'undefined' && chrome.alarms !== undefined) {
      chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === this.alarmName) {
          this.flush();
        }
      });
    }
  }

  add(event: T): void {
    this.batch.push({
      data: event,
      timestamp: Date.now(),
    });

    // Flush if batch size exceeded
    if (this.batch.length >= this.maxBatchSize) {
      this.flush();
      return;
    }

    // Start timer if not already running
    if (this.flushTimer === null && !this.useAlarms) {
      // Use setTimeout for content script context
      this.flushTimer = setTimeout(() => {
        this.flush();
      }, this.batchInterval);
    } else if (this.useAlarms && typeof chrome !== 'undefined' && chrome.alarms !== undefined) {
      // Check if alarm already exists
      chrome.alarms.get(this.alarmName, (alarm) => {
        if (!alarm) {
          // Create alarm if it doesn't exist
          chrome.alarms.create(this.alarmName, { delayInMinutes: this.batchInterval / 60000 });
        }
      });
    }
  }

  flush(): void {
    if (this.batch.length === 0) {
      return;
    }

    const eventsToFlush = this.batch.map((item) => item.data);
    this.batch = [];

    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.useAlarms && typeof chrome !== 'undefined' && chrome.alarms !== undefined) {
      chrome.alarms.clear(this.alarmName);
    }

    // Call flush callback
    void Promise.resolve(this.flushCallback(eventsToFlush)).catch((error) => {
      console.error('Error flushing events:', error);
    });
  }

  clear(): void {
    this.batch = [];
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.useAlarms && typeof chrome !== 'undefined' && chrome.alarms !== undefined) {
      chrome.alarms.clear(this.alarmName);
    }
  }

  getBatchSize(): number {
    return this.batch.length;
  }
}
