import fs from 'fs';
import path from 'path';
import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import {
  saveSingleInspectionWork,
  uploadInspectionMediaToS3,
  saveInspectionDetailsToS3,
  getNextUserInspectionSeq,
  generateUserWorkId,
  resolveInspectionUsername,
  getPresignedS3Url,
  findExistingInspectionWork,
} from './storage';
import { logServerProcess } from './serverLogger';

export interface InspectionJobData {
  jobId: string;
  data: any;
  submittedByUserId: string;
  submittedByUserName: string;
  username: string;
  createdAt: string;
  attempts: number;
  maxAttempts: number;
}

export type JobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'REJECTED_RETRY_FROM_APP' | 'FAILED';

export interface JobRecord {
  jobId: string;
  status: JobStatus;
  progress: number;
  statusMessage: string;
  error?: string;
  workId?: string;
  userSequence?: number;
  result?: any;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  queuePosition?: number;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const QUEUE_PERSISTENCE_FILE = path.join(DATA_DIR, 'server_queue_store.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Persistent Disk-backed Store for Queue state & History
interface PersistentQueueState {
  waitingQueue: InspectionJobData[];
  activeJob: InspectionJobData | null;
  jobs: Record<string, JobRecord>;
}

function loadPersistentState(): PersistentQueueState {
  try {
    if (fs.existsSync(QUEUE_PERSISTENCE_FILE)) {
      const raw = fs.readFileSync(QUEUE_PERSISTENCE_FILE, 'utf-8');
      if (raw.trim()) {
        const parsed = JSON.parse(raw);
        // If an active job was interrupted by server crash/restart, place it back to front of waiting queue!
        if (parsed.activeJob) {
          console.log(`[ServerQueue] Restoring interrupted job ${parsed.activeJob.jobId} from server restart`);
          parsed.waitingQueue = [parsed.activeJob, ...(parsed.waitingQueue || [])];
          parsed.activeJob = null;
        }
        return {
          waitingQueue: parsed.waitingQueue || [],
          activeJob: null,
          jobs: parsed.jobs || {},
        };
      }
    }
  } catch (e) {
    console.error('[ServerQueue] Failed to read persistent queue state:', e);
  }
  return { waitingQueue: [], activeJob: null, jobs: {} };
}

function savePersistentState(state: PersistentQueueState) {
  try {
    fs.writeFileSync(QUEUE_PERSISTENCE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (e) {
    console.error('[ServerQueue] Failed to persist queue state:', e);
  }
}

let queueState: PersistentQueueState = loadPersistentState();
let isProcessing = false;
let redisClient: IORedis | null = null;
let bullQueue: Queue | null = null;
let bullWorker: Worker | null = null;
let isRedisAvailable = false;

// Initialize BullMQ if REDIS_URL or REDIS_HOST is configured
const redisUrl = process.env.REDIS_URL || process.env.REDIS_URI;
if (redisUrl) {
  try {
    redisClient = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      connectTimeout: 5000,
      retryStrategy(times) {
        const delay = Math.min(times * 200, 3000);
        return delay;
      },
    });

    redisClient.on('connect', () => {
      console.log('[ServerQueue] Redis connected successfully for BullMQ');
      isRedisAvailable = true;
    });

    redisClient.on('error', (err) => {
      console.warn('[ServerQueue] Redis error, fallback queue will handle jobs:', err.message);
      isRedisAvailable = false;
    });

    bullQueue = new Queue('inspection-works-queue', {
      connection: redisClient,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });

    bullWorker = new Worker(
      'inspection-works-queue',
      async (job) => {
        return await processInspectionJob(job.data);
      },
      {
        connection: redisClient,
        concurrency: 1, // Strict FIFO: Process one by one!
      }
    );
  } catch (err: any) {
    console.warn('[ServerQueue] Could not initialize BullMQ with Redis, using persistent disk FIFO queue:', err?.message || err);
  }
}

/**
 * Exponential Backoff helper with Jitter
 */
export async function waitWithBackoff(attempt: number, baseDelayMs = 500, maxDelayMs = 8000): Promise<void> {
  const expDelay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
  const jitter = Math.floor(Math.random() * (expDelay * 0.3));
  const totalWait = expDelay + jitter;
  await new Promise((resolve) => setTimeout(resolve, totalWait));
}

/**
 * Core processing logic:
 * 1. Takes inspection job data.
 * 2. Compresses & uploads any remaining un-uploaded media to AWS S3.
 * 3. Saves inspection work entry to MongoDB.
 * 4. Saves JSON metadata to S3 (`inspection/{username}/`).
 * 5. Generates unique sequential Work ID for the user.
 * 6. Marks completed and returns results.
 */
async function processInspectionJob(jobData: InspectionJobData): Promise<any> {
  const { data, username, jobId } = jobData;

  updateJobRecord(jobId, {
    status: 'PROCESSING',
    progress: 25,
    statusMessage: 'Saving media to S3 and recording entry...',
  });

  const updatedFieldsData = { ...(data.fieldsData || {}) };
  let lastCameraPhotoUrl = null;

  // Process dynamic fields with media (if base64 or local paths present)
  for (const [key, val] of Object.entries(updatedFieldsData)) {
    if (typeof val === 'string' && val.trim() !== '') {
      const valLower = val.toLowerCase();
      const keyLower = key.toLowerCase();
      const isPhotoUrl =
        val.startsWith('http') ||
        val.startsWith('/uploads') ||
        val.startsWith('data:image') ||
        valLower.endsWith('.jpg') ||
        valLower.endsWith('.jpeg') ||
        valLower.endsWith('.png') ||
        val.includes('s3.amazonaws.com');
      const isPhotoKey =
        keyLower.includes('photo') || keyLower.includes('camera') || keyLower.includes('image') || keyLower.includes('picture');

      if (isPhotoUrl || isPhotoKey) {
        if (val.startsWith('data:image/')) {
          try {
            const match = val.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
            if (match) {
              const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
              const buffer = Buffer.from(match[2], 'base64');
              const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
              const fileName = `${uniqueId}.${ext}`;
              const s3Upload = await uploadInspectionMediaToS3(buffer, fileName, `image/${match[1]}`, username);
              if (s3Upload.success && s3Upload.url) {
                updatedFieldsData[key] = s3Upload.url;
                lastCameraPhotoUrl = s3Upload.url;
              }
            }
          } catch (_) {}
        } else if (val.startsWith('http') || val.includes('s3.amazonaws.com')) {
          lastCameraPhotoUrl = val;
        }
      }
    }
  }

  let imageUrl = data.imageUrl || null;
  if (lastCameraPhotoUrl) {
    imageUrl = lastCameraPhotoUrl;
  } else if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('data:image/')) {
    try {
      const match = imageUrl.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
      if (match) {
        const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
        const buffer = Buffer.from(match[2], 'base64');
        const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        const fileName = `${uniqueId}.${ext}`;
        const s3Upload = await uploadInspectionMediaToS3(buffer, fileName, `image/${match[1]}`, username);
        if (s3Upload.success && s3Upload.url) {
          imageUrl = s3Upload.url;
          lastCameraPhotoUrl = s3Upload.url;
        }
      }
    } catch (_) {}
  }

  // Sanitize: Never persist local mobile device paths (/data/user/0/...) into MongoDB or S3
  const isMobilePath = (str: any) =>
    typeof str === 'string' &&
    (str.startsWith('/data/') || str.startsWith('/storage/') || str.includes('offline_images') || str.includes('raw_uploads'));

  if (lastCameraPhotoUrl) {
    imageUrl = lastCameraPhotoUrl;
    // Replace any field that holds a local mobile path with the valid S3 photo URL
    for (const [k, v] of Object.entries(updatedFieldsData)) {
      if (isMobilePath(v) || v === data.imageUrl) {
        updatedFieldsData[k] = lastCameraPhotoUrl;
      }
    }
  } else if (isMobilePath(imageUrl)) {
    // If imageUrl is a raw mobile path with no S3 URL, clean it up
    imageUrl = '';
    for (const [k, v] of Object.entries(updatedFieldsData)) {
      if (isMobilePath(v)) {
        updatedFieldsData[k] = '';
      }
    }
  }

  updateJobRecord(jobId, {
    progress: 60,
    statusMessage: 'Saving to MongoDB and generating Work ID...',
  });

  const recordId = data.id || `iw_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const nowIso = new Date().toISOString();

  // Check if an existing work already exists for this client UUID (id) or workId
  const existingWork = await findExistingInspectionWork(recordId, data.workId);

  let workId = data.workId;
  let userSeq: number;

  if (existingWork) {
    // Re-use existing Work ID and sequence - DO NOT CREATE A DUPLICATE WORK ID!
    workId = existingWork.workId || workId || generateUserWorkId(username, new Date());
    if (workId && (workId.toUpperCase().startsWith('TP01-') || workId.toUpperCase().startsWith('TP-') || workId.toUpperCase().startsWith('TP'))) {
      workId = workId.replace(/^TP01-/i, 'WRK-').replace(/^TP-/i, 'WRK-').replace(/^TP/i, 'WRK-');
    }
    userSeq = existingWork.userSequence || (await getNextUserInspectionSeq(username));

    // Preserve existing valid S3 image URL if the incoming request has empty or local mobile path
    if ((!imageUrl || isMobilePath(imageUrl)) && existingWork.imageUrl && !isMobilePath(existingWork.imageUrl)) {
      imageUrl = existingWork.imageUrl;
    }

    // Preserve existing S3 image URLs in fieldsData
    if (existingWork.fieldsData) {
      for (const [k, v] of Object.entries(existingWork.fieldsData)) {
        if (typeof v === 'string' && !isMobilePath(v) && (v.startsWith('http') || v.includes('s3.amazonaws.com'))) {
          const cur = updatedFieldsData[k];
          if (!cur || isMobilePath(cur)) {
            updatedFieldsData[k] = v;
          }
        }
      }
    }
  } else {
    if (!workId || workId.toUpperCase().startsWith('TP') || !workId.startsWith('WRK-')) {
      workId = generateUserWorkId(username, new Date());
    }
    userSeq = data.userSequence || (await getNextUserInspectionSeq(username));
  }

  // Clean any remaining local mobile device paths from imageUrl and updatedFieldsData so mobile paths never get saved
  if (isMobilePath(imageUrl)) {
    imageUrl = null;
  }
  for (const [k, v] of Object.entries(updatedFieldsData)) {
    if (isMobilePath(v)) {
      updatedFieldsData[k] = imageUrl || '';
    }
  }

  const finalWork = {
    ...data,
    id: recordId,
    workId,
    userSequence: userSeq,
    submittedByUserName: data.submittedByUserName || username,
    submittedByUserId: data.submittedByUserId || username,
    username,
    imageUrl,
    fieldsData: updatedFieldsData,
    submittedAt: (existingWork && existingWork.submittedAt) || data.submittedAt || nowIso,
    status: data.status || 'Completed',
  };

  // Save to MongoDB with retry
  await saveSingleInspectionWork(finalWork);

  // Strictly save single JSON metadata backup to S3 (inspection/{username}/{workId}_details.json)
  await saveInspectionDetailsToS3(finalWork, username);

  updateJobRecord(jobId, {
    status: 'COMPLETED',
    progress: 100,
    statusMessage: `Work successfully submitted! Work ID: ${workId}`,
    workId,
    result: finalWork,
  });

  logServerProcess({
    category: 'QUEUE_PROCESS',
    action: 'JOB_COMPLETED_SUCCESS',
    username,
    status: 'SUCCESS',
    details: `Job ID: ${jobId} | Work ID: ${workId} | Ward: ${finalWork.ward || finalWork.wardNo || '-'} | Street: ${finalWork.street || finalWork.streetName || '-'}`,
  });

  return { workId, userSequence: userSeq, finalWork };
}

function updateJobRecord(jobId: string, updates: Partial<JobRecord>) {
  const current = queueState.jobs[jobId] || {
    jobId,
    status: 'QUEUED',
    progress: 0,
    statusMessage: 'In queue',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    attempts: 0,
  };

  queueState.jobs[jobId] = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  savePersistentState(queueState);
}

/**
 * Background loop processor for the persistent disk FIFO queue
 * Guarantees 1-by-1 processing, auto-retry with exponential backoff,
 * and rejection to back-of-the-queue if a task persistently fails or times out.
 */
async function processQueueLoop() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    while (queueState.waitingQueue.length > 0) {
      const job = queueState.waitingQueue.shift()!;
      queueState.activeJob = job;
      savePersistentState(queueState);

      const jobRecord = queueState.jobs[job.jobId];
      if (jobRecord) {
        jobRecord.status = 'PROCESSING';
        jobRecord.progress = 10;
        jobRecord.statusMessage = 'Job picked by server queue worker';
        jobRecord.attempts += 1;
        savePersistentState(queueState);
      }

      let succeeded = false;
      const MAX_ATTEMPTS = job.maxAttempts || 3;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          console.log(`[ServerQueue] Processing job ${job.jobId} (Attempt ${attempt}/${MAX_ATTEMPTS})`);
          
          // Timeout protection: 45 seconds per attempt
          const processPromise = processInspectionJob(job);
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Job processing timed out after 45s')), 45000)
          );

          await Promise.race([processPromise, timeoutPromise]);
          succeeded = true;
          break;
        } catch (err: any) {
          console.error(`[ServerQueue] Job ${job.jobId} attempt ${attempt} failed:`, err?.message || err);
          if (attempt < MAX_ATTEMPTS) {
            updateJobRecord(job.jobId, {
              status: 'PROCESSING',
              statusMessage: `Retry ${attempt}/${MAX_ATTEMPTS} in progress...`,
            });
            await waitWithBackoff(attempt);
          } else {
            // All retries failed: As requested, mark rejected for app retry and place at the end of queue!
            console.warn(`[ServerQueue] Job ${job.jobId} exhausted retries. Rejecting and notifying app to retry.`);
            updateJobRecord(job.jobId, {
              status: 'REJECTED_RETRY_FROM_APP',
              statusMessage: 'Server processing took too long or timed out. Rejected for client to retry.',
              error: err?.message || 'Processing timeout / network issue',
            });
          }
        }
      }

      queueState.activeJob = null;
      savePersistentState(queueState);

      // Brief gentle pause between jobs to let I/O and sockets settle
      await new Promise((r) => setTimeout(r, 200));
    }
  } finally {
    isProcessing = false;
  }
}

/**
 * Enqueue a new inspection work submission.
 * Enters FIFO queue, returns immediately with Job ID.
 */
export async function enqueueInspectionWork(data: any): Promise<{ jobId: string; queuePosition: number }> {
  const username = await resolveInspectionUsername(
    data.submittedByUserId,
    data.submittedByUserName || data.username
  );

  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const nowIso = new Date().toISOString();

  const jobData: InspectionJobData = {
    jobId,
    data,
    submittedByUserId: data.submittedByUserId || username,
    submittedByUserName: data.submittedByUserName || username,
    username,
    createdAt: nowIso,
    attempts: 0,
    maxAttempts: 3,
  };

  // Register in jobs directory
  queueState.jobs[jobId] = {
    jobId,
    status: 'QUEUED',
    progress: 0,
    statusMessage: 'Waiting in server FIFO queue...',
    createdAt: nowIso,
    updatedAt: nowIso,
    attempts: 0,
  };

  if (isRedisAvailable && bullQueue) {
    try {
      await bullQueue.add('process-work', jobData, { jobId });
      console.log(`[ServerQueue] Job ${jobId} added to BullMQ Redis Queue`);
    } catch (e) {
      console.warn('[ServerQueue] BullMQ add error, pushing to persistent FIFO queue:', e);
      queueState.waitingQueue.push(jobData);
    }
  } else {
    queueState.waitingQueue.push(jobData);
  }

  savePersistentState(queueState);

  const queuePosition = queueState.waitingQueue.length;

  // Trigger background processor non-blockingly
  setTimeout(() => {
    processQueueLoop().catch((e) => console.error('[ServerQueue] Loop error:', e));
  }, 10);

  return { jobId, queuePosition };
}

/**
 * Get current status of a queued job
 */
export async function getJobStatus(jobId: string): Promise<JobRecord | null> {
  const record = queueState.jobs[jobId];
  if (!record) return null;

  if (record.status === 'QUEUED') {
    const pos = queueState.waitingQueue.findIndex((j) => j.jobId === jobId);
    record.queuePosition = pos >= 0 ? pos + 1 : 1;
  }

  return record;
}

/**
 * Get overall queue statistics
 */
export function getQueueStatistics() {
  return {
    waiting: queueState.waitingQueue.length,
    isProcessing,
    activeJobId: queueState.activeJob?.jobId || null,
    totalTrackedJobs: Object.keys(queueState.jobs).length,
    isRedisConnected: isRedisAvailable,
  };
}
