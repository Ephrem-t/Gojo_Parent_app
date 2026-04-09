import AsyncStorage from "@react-native-async-storage/async-storage";
import { ref, update } from "firebase/database";
import { database } from "../../constants/firebaseConfig";
import { isInternetReachableNow } from "./networkGuard";

const POST_ACTION_QUEUE_KEY = "queue:postActions:v1";

function normalizeQueue(queue) {
  if (!Array.isArray(queue)) return [];

  return queue.filter((action) => {
    if (!action || typeof action !== "object") return false;
    if (!action.type || !action.postId || !action.userId) return false;
    return true;
  });
}

async function readPostActionQueue() {
  try {
    const raw = await AsyncStorage.getItem(POST_ACTION_QUEUE_KEY);
    if (!raw) return [];
    return normalizeQueue(JSON.parse(raw));
  } catch {
    return [];
  }
}

async function writePostActionQueue(queue) {
  try {
    await AsyncStorage.setItem(POST_ACTION_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // noop
  }
}

function getActionKey(action) {
  return [
    action?.type || "unknown",
    String(action?.schoolKey || "root"),
    String(action?.postId || "unknown"),
    String(action?.userId || "unknown"),
  ].join(":");
}

function mergeQueuedAction(queue, action) {
  const actionKey = getActionKey(action);
  const nextQueue = queue.filter((existingAction) => getActionKey(existingAction) !== actionKey);
  nextQueue.push({
    ...action,
    queuedAt: action?.queuedAt || Date.now(),
  });
  return nextQueue;
}

function getPostPath(schoolKey, postId) {
  return schoolKey ? `Platform1/Schools/${schoolKey}/Posts/${postId}` : `Posts/${postId}`;
}

export async function commitPostLikeAction(action) {
  if (!action?.postId || !action?.userId) return;

  const postPath = getPostPath(action.schoolKey || null, action.postId);
  const updates = {};
  updates[`${postPath}/likes/${action.userId}`] = action.liked ? true : null;
  await update(ref(database), updates);
}

export async function commitPostReportAction(action) {
  if (!action?.postId || !action?.userId) return;

  const postPath = getPostPath(action.schoolKey || null, action.postId);
  const updates = {};
  updates[`${postPath}/reportBy/${action.userId}`] = true;
  await update(ref(database), updates);
}

export async function enqueuePostLikeAction({ schoolKey = null, postId, userId, liked }) {
  const queue = await readPostActionQueue();
  const nextQueue = mergeQueuedAction(queue, {
    type: "post-like",
    schoolKey,
    postId,
    userId,
    liked: !!liked,
    queuedAt: Date.now(),
  });

  await writePostActionQueue(nextQueue);
  return nextQueue.length;
}

export async function enqueuePostReportAction({ schoolKey = null, postId, userId }) {
  const queue = await readPostActionQueue();
  const nextQueue = mergeQueuedAction(queue, {
    type: "post-report",
    schoolKey,
    postId,
    userId,
    queuedAt: Date.now(),
  });

  await writePostActionQueue(nextQueue);
  return nextQueue.length;
}

export async function clearQueuedPostAction(action) {
  const queue = await readPostActionQueue();
  const actionKey = getActionKey(action);
  const nextQueue = queue.filter((queuedAction) => getActionKey(queuedAction) !== actionKey);

  if (nextQueue.length !== queue.length) {
    await writePostActionQueue(nextQueue);
  }

  return nextQueue.length;
}

export async function flushQueuedPostActions() {
  const queue = await readPostActionQueue();
  if (!queue.length) {
    return { online: await isInternetReachableNow(), flushed: 0, remaining: 0 };
  }

  const onlineNow = await isInternetReachableNow();
  if (!onlineNow) {
    return { online: false, flushed: 0, remaining: queue.length };
  }

  const remainingActions = [];
  let flushed = 0;

  for (let index = 0; index < queue.length; index += 1) {
    const action = queue[index];

    try {
      if (action.type === "post-like") {
        await commitPostLikeAction(action);
      } else if (action.type === "post-report") {
        await commitPostReportAction(action);
      }

      flushed += 1;
    } catch {
      remainingActions.push(action);

      const stillOnline = await isInternetReachableNow();
      if (!stillOnline) {
        remainingActions.push(...queue.slice(index + 1));
        break;
      }
    }
  }

  await writePostActionQueue(remainingActions);
  return { online: true, flushed, remaining: remainingActions.length };
}