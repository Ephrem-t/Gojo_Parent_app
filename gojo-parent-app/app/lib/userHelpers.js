import AsyncStorage from "@react-native-async-storage/async-storage";
import { ref, get, query, orderByChild, equalTo } from "firebase/database";
import { database } from "../../constants/firebaseConfig";
import { readCachedJson, writeCachedJson } from "./dataCache";

/**
 * Helper utilities so all code reads/writes Users under:
 *   Platform1/Schools/{schoolKey}/Users/{userNodeKey}
 *
 * Fallback: if no schoolKey is found in AsyncStorage, operations fall back
 * to old root path: Users/{userNodeKey} or query(ref(database, "Users"), ...)
 * This prevents immediate breakage while you roll out the migration.
 */

const SCHOOL_KEY_STORAGE = "schoolKey";
const USER_VALUE_CACHE_TTL_MS = 5 * 60 * 1000;
const ROLE_DIRECTORY_NODES = [
  { node: "School_Admins", role: "Admin" },
  { node: "Teachers", role: "Teacher" },
  { node: "Registerers", role: "Admin" },
  { node: "Finances", role: "Admin" },
  { node: "HR", role: "Admin" },
  { node: "Parents", role: "Parent" },
  { node: "Students", role: "Student" },
];

async function getSavedSchoolKey() {
  try {
    const sk = await AsyncStorage.getItem(SCHOOL_KEY_STORAGE);
    if (sk) return sk;
  } catch {
    // ignore
  }
  return null;
}

export function usersRefForSchool(schoolKey) {
  if (schoolKey) return ref(database, `Platform1/Schools/${schoolKey}/Users`);
  return ref(database, "Users");
}

function isMissingIndexError(err) {
  return /index not defined/i.test(String(err?.message || ""));
}

function normalizeLookupValue(value) {
  return String(value ?? "").trim();
}

function getFirstSnapshotMatch(snapshot) {
  if (!snapshot || !snapshot.exists()) return null;

  let match = null;
  snapshot.forEach((child) => {
    if (!match) {
      match = { key: child.key, value: child.val() || {} };
    }
    return !!match;
  });

  return match;
}

async function scanUsersByChild(usersRef, childName, value) {
  const snap = await get(usersRef);
  if (!snap.exists()) return null;

  const expected = String(value ?? "").trim().toLowerCase();
  const out = {};

  snap.forEach((child) => {
    const user = child.val() || {};
    const actual = String(user?.[childName] ?? "").trim().toLowerCase();
    if (actual === expected) {
      out[child.key] = user;
    }
    return false;
  });

  if (Object.keys(out).length === 0) return null;

  return {
    exists: () => true,
    val: () => out,
    forEach: (cb) => {
      Object.entries(out).forEach(([key, userVal]) => {
        cb({ key, val: () => userVal });
      });
    },
  };
}

async function queryGlobalUserByChild(childName, value) {
  const usersRef = ref(database, "Users");

  try {
    const q = query(usersRef, orderByChild(childName), equalTo(value));
    return await get(q);
  } catch (err) {
    if (isMissingIndexError(err)) {
      return await scanUsersByChild(usersRef, childName, value);
    }
    throw err;
  }
}

async function getSchoolScopedRecord(nodeName, recordId, explicitSchoolKey = null) {
  const normalizedRecordId = normalizeLookupValue(recordId);
  if (!normalizedRecordId) return null;

  const schoolKey = explicitSchoolKey || (await getSavedSchoolKey());

  if (schoolKey) {
    try {
      const schoolSnap = await get(ref(database, `Platform1/Schools/${schoolKey}/${nodeName}/${normalizedRecordId}`));
      if (schoolSnap.exists()) {
        return { key: normalizedRecordId, value: schoolSnap.val() || {}, schoolKey };
      }
    } catch {
      // ignore
    }
  }

  try {
    const rootSnap = await get(ref(database, `${nodeName}/${normalizedRecordId}`));
    if (rootSnap.exists()) {
      return { key: normalizedRecordId, value: rootSnap.val() || {}, schoolKey: null };
    }
  } catch {
    // ignore
  }

  return null;
}

async function getDirectUserByNodeKey(nodeKey, explicitSchoolKey = null) {
  const normalizedNodeKey = normalizeLookupValue(nodeKey);
  if (!normalizedNodeKey) return null;

  const schoolKey = explicitSchoolKey || (await getSavedSchoolKey());

  if (schoolKey) {
    try {
      const schoolSnap = await get(ref(database, `Platform1/Schools/${schoolKey}/Users/${normalizedNodeKey}`));
      if (schoolSnap.exists()) {
        return { key: normalizedNodeKey, value: schoolSnap.val() || {}, schoolKey };
      }
    } catch {
      // ignore
    }
  }

  try {
    const rootSnap = await get(ref(database, `Users/${normalizedNodeKey}`));
    if (rootSnap.exists()) {
      return { key: normalizedNodeKey, value: rootSnap.val() || {}, schoolKey: null };
    }
  } catch {
    // ignore
  }

  return null;
}

function buildResolvedUser(match, schoolKey, extras = {}) {
  const value = match?.value || {};
  const nodeKey = match?.key || null;

  return {
    ...value,
    userId: extras.userId || value.userId || nodeKey || null,
    _nodeKey: extras._nodeKey === undefined ? nodeKey : extras._nodeKey,
    _recordId: extras._recordId || null,
    _roleNode: extras._roleNode || null,
    _schoolKey: extras._schoolKey === undefined ? schoolKey || null : extras._schoolKey,
    role: extras.role || value.role || null,
  };
}

async function resolveDirectUserMatch(identifier, explicitSchoolKey = null, includeUsername = false) {
  const normalizedIdentifier = normalizeLookupValue(identifier);
  if (!normalizedIdentifier) return null;

  const preferredSchoolKey = explicitSchoolKey || (await getSavedSchoolKey());

  const directNodeMatch = await getDirectUserByNodeKey(normalizedIdentifier, preferredSchoolKey);
  if (directNodeMatch) {
    return buildResolvedUser(directNodeMatch, directNodeMatch.schoolKey);
  }

  try {
    const schoolUserIdMatch = getFirstSnapshotMatch(
      await queryUserByChildInSchool("userId", normalizedIdentifier, preferredSchoolKey)
    );
    if (schoolUserIdMatch) {
      return buildResolvedUser(schoolUserIdMatch, preferredSchoolKey);
    }
  } catch {
    // ignore
  }

  try {
    const globalUserIdMatch = getFirstSnapshotMatch(await queryGlobalUserByChild("userId", normalizedIdentifier));
    if (globalUserIdMatch) {
      return buildResolvedUser(globalUserIdMatch, null);
    }
  } catch {
    // ignore
  }

  if (!includeUsername) {
    return null;
  }

  try {
    const schoolUsernameMatch = getFirstSnapshotMatch(
      await queryUserByUsernameInSchool(normalizedIdentifier, preferredSchoolKey)
    );
    if (schoolUsernameMatch) {
      return buildResolvedUser(schoolUsernameMatch, preferredSchoolKey);
    }
  } catch {
    // ignore
  }

  try {
    const globalUsernameMatch = getFirstSnapshotMatch(await queryGlobalUserByChild("username", normalizedIdentifier));
    if (globalUsernameMatch) {
      return buildResolvedUser(globalUsernameMatch, null);
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Return a Database Reference for a given nodeKey.
 */
export async function userNodeRef(nodeKey) {
  const sk = await getSavedSchoolKey();
  if (sk) return ref(database, `Platform1/Schools/${sk}/Users/${nodeKey}`);
  return ref(database, `Users/${nodeKey}`);
}

/**
 * Return snapshot for a given user node key under the resolved school (or fallback).
 * Caller should check .exists()
 */
export async function getUserSnapshot(nodeKey) {
  try {
    const r = await userNodeRef(nodeKey);
    return await get(r);
  } catch {
    // fallback: try root Users path (older format)
    try {
      return await get(ref(database, `Users/${nodeKey}`));
    } catch {
      return null;
    }
  }
}

/**
 * Convenience: return .val() or null
 */
export async function getUserVal(nodeKey) {
  const schoolKey = await getSavedSchoolKey();
  const cacheKey = `cache:userVal:${schoolKey || "root"}:${String(nodeKey || "")}`;

  const cached = await readCachedJson(cacheKey, USER_VALUE_CACHE_TTL_MS);
  if (cached && typeof cached === "object") {
    return cached;
  }

  const snap = await getUserSnapshot(nodeKey);
  const value = snap && snap.exists() ? snap.val() : null;

  if (value && typeof value === "object") {
    writeCachedJson(cacheKey, value).catch(() => {});
  }

  return value;
}

/**
 * Query a username inside the provided schoolKey, or the saved schoolKey (if omitted).
 * Returns the snapshot (may be empty). Use snapshot.forEach to extract node key and value.
 */
export async function queryUserByUsernameInSchool(username, explicitSchoolKey = null) {
  const sk = explicitSchoolKey || (await getSavedSchoolKey());
  const usersRef = sk ? ref(database, `Platform1/Schools/${sk}/Users`) : ref(database, "Users");

  try {
    const q = query(usersRef, orderByChild("username"), equalTo(username));
    return await get(q);
  } catch (err) {
    if (isMissingIndexError(err)) {
      return await scanUsersByChild(usersRef, "username", username);
    }
    throw err;
  }
}

/**
 * Query by a generic child (e.g. userId) inside the resolved school.
 * If you need to search username or userId, call this and check the snapshot.
 */
export async function queryUserByChildInSchool(childName, value, explicitSchoolKey = null) {
  const sk = explicitSchoolKey || (await getSavedSchoolKey());
  const usersRef = sk ? ref(database, `Platform1/Schools/${sk}/Users`) : ref(database, "Users");

  try {
    const q = query(usersRef, orderByChild(childName), equalTo(value));
    return await get(q);
  } catch (err) {
    if (isMissingIndexError(err)) {
      return await scanUsersByChild(usersRef, childName, value);
    }
    throw err;
  }
}

export async function getRoleRecordById(recordId, explicitSchoolKey = null) {
  const normalizedRecordId = normalizeLookupValue(recordId);
  if (!normalizedRecordId) return null;

  for (const directory of ROLE_DIRECTORY_NODES) {
    const record = await getSchoolScopedRecord(directory.node, normalizedRecordId, explicitSchoolKey);
    if (!record) continue;

    return {
      ...record.value,
      userId: record.value?.userId || null,
      _recordId: normalizedRecordId,
      _roleNode: directory.node,
      _schoolKey: record.schoolKey ?? explicitSchoolKey ?? null,
      role: directory.role,
    };
  }

  return null;
}

export async function resolveUserIdentity(identifier, explicitSchoolKey = null) {
  const normalizedIdentifier = normalizeLookupValue(identifier);
  if (!normalizedIdentifier) return null;

  const preferredSchoolKey = explicitSchoolKey || (await getSavedSchoolKey());
  const exactUser = await resolveDirectUserMatch(normalizedIdentifier, preferredSchoolKey, false);
  if (exactUser) return exactUser;

  const roleRecord = await getRoleRecordById(normalizedIdentifier, preferredSchoolKey);
  if (roleRecord) {
    if (roleRecord.userId) {
      const linkedUser = await resolveDirectUserMatch(roleRecord.userId, roleRecord._schoolKey ?? preferredSchoolKey, false);
      if (linkedUser) {
        return {
          ...linkedUser,
          name: linkedUser.name || roleRecord.name || null,
          username: linkedUser.username || roleRecord.username || roleRecord._recordId || null,
          profileImage:
            linkedUser.profileImage || roleRecord.profileImage || roleRecord.photo || roleRecord.image || null,
          role: linkedUser.role || roleRecord.role || null,
          _recordId: roleRecord._recordId,
          _roleNode: roleRecord._roleNode,
          _schoolKey: linkedUser._schoolKey ?? roleRecord._schoolKey ?? preferredSchoolKey ?? null,
        };
      }
    }

    return {
      ...roleRecord,
      username: roleRecord.username || roleRecord._recordId || null,
      profileImage: roleRecord.profileImage || roleRecord.photo || roleRecord.image || null,
    };
  }

  return await resolveDirectUserMatch(normalizedIdentifier, preferredSchoolKey, true);
}

export async function resolvePostAuthor(postData, explicitSchoolKey = null) {
  const preferredSchoolKey = explicitSchoolKey || (await getSavedSchoolKey());
  const candidateIds = Array.from(
    new Set(
      [
        postData?.adminId,
        postData?.userId,
        postData?.schoolAdminId,
        postData?.teacherId,
        postData?.registererId,
        postData?.financeId,
        postData?.hrId,
      ]
        .map((value) => normalizeLookupValue(value))
        .filter(Boolean)
    )
  );

  const fallbackName = normalizeLookupValue(postData?.adminName) || normalizeLookupValue(postData?.name) || null;
  const fallbackImage = normalizeLookupValue(postData?.adminProfile) || normalizeLookupValue(postData?.profileImage) || null;

  for (const candidateId of candidateIds) {
    const resolved = await resolveUserIdentity(candidateId, preferredSchoolKey);
    if (!resolved) continue;

    return {
      ...resolved,
      name: resolved.name || fallbackName || null,
      username: resolved.username || resolved._recordId || resolved.userId || null,
      profileImage: resolved.profileImage || fallbackImage || null,
      _sourceIdentifier: candidateId,
    };
  }

  if (!fallbackName && !fallbackImage && candidateIds.length === 0) {
    return null;
  }

  return {
    name: fallbackName || null,
    username: candidateIds[0] || null,
    profileImage: fallbackImage || null,
    userId: null,
    _nodeKey: null,
    _recordId: candidateIds[0] || null,
    _sourceIdentifier: candidateIds[0] || null,
    _schoolKey: preferredSchoolKey || null,
    role: null,
  };
}