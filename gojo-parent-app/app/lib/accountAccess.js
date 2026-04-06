import AsyncStorage from "@react-native-async-storage/async-storage";
import { ref, get } from "firebase/database";
import { database } from "../../constants/firebaseConfig";
import { getUserSnapshot, queryUserByChildInSchool } from "./userHelpers";

export const PARENT_SESSION_KEYS = [
  "userId",
  "userNodeKey",
  "username",
  "role",
  "parentId",
  "schoolKey",
  "lastLogin",
];

export const BLOCKED_ACCOUNT_MESSAGE =
  "You cannot open the app right now. Your school has blocked this account. Contact the school to open it again.";

export async function readParentSession() {
  try {
    const entries = await AsyncStorage.multiGet(PARENT_SESSION_KEYS);
    return entries.reduce((session, [key, value]) => {
      session[key] = value || "";
      return session;
    }, {});
  } catch (error) {
    console.warn("[Account Access] readParentSession error:", error);
    return {};
  }
}

export async function clearParentSession() {
  try {
    await AsyncStorage.multiRemove(PARENT_SESSION_KEYS);
  } catch (error) {
    console.warn("[Account Access] clearParentSession error:", error);
  }
}

export function normalizePhoneNumber(rawPhone) {
  return String(rawPhone || "").replace(/[^\d+]/g, "");
}

export function getBlockedContactCaption(contact = {}) {
  const schoolName = String(contact.schoolName || "").trim();
  const phoneLabel = String(contact.phoneLabel || "").trim();

  if (phoneLabel) {
    return `${schoolName ? `${schoolName} contact: ` : "School contact: "}${phoneLabel}`;
  }

  if (schoolName) {
    return `${schoolName} can reopen your access.`;
  }

  return "Contact your school to reopen your access.";
}

export async function getSchoolContactInfo(explicitSchoolKey = null) {
  let schoolKey = explicitSchoolKey || null;

  if (!schoolKey) {
    try {
      schoolKey = await AsyncStorage.getItem("schoolKey");
    } catch {}
  }

  if (!schoolKey) {
    return { schoolKey: null, schoolName: "", phone: "", phoneLabel: "" };
  }

  try {
    const infoSnap = await get(ref(database, `Platform1/Schools/${schoolKey}/schoolInfo`));
    if (!infoSnap.exists()) {
      return { schoolKey, schoolName: "", phone: "", phoneLabel: "" };
    }

    const info = infoSnap.val() || {};
    const rawPhone = info.phone || info.alternativePhone || "";

    return {
      schoolKey,
      schoolName: info.name || "",
      phone: normalizePhoneNumber(rawPhone),
      phoneLabel: String(rawPhone || "").trim(),
    };
  } catch (error) {
    console.warn("[Account Access] getSchoolContactInfo error:", error);
    return { schoolKey, schoolName: "", phone: "", phoneLabel: "" };
  }
}

export async function getParentUserRecord(sessionOverrides = null) {
  const session = sessionOverrides || (await readParentSession());
  const schoolKey = session?.schoolKey || null;
  const savedNodeKey = session?.userNodeKey || "";
  const savedUserId = session?.userId || "";

  if (savedNodeKey) {
    try {
      if (schoolKey) {
        const directSnap = await get(ref(database, `Platform1/Schools/${schoolKey}/Users/${savedNodeKey}`));
        if (directSnap.exists()) {
          return {
            user: directSnap.val() || {},
            nodeKey: savedNodeKey,
            schoolKey,
          };
        }
      }
    } catch (error) {
      console.warn("[Account Access] direct user lookup error:", error);
    }

    const fallbackSnap = await getUserSnapshot(savedNodeKey);
    if (fallbackSnap?.exists()) {
      return {
        user: fallbackSnap.val() || {},
        nodeKey: savedNodeKey,
        schoolKey,
      };
    }
  }

  if (savedUserId) {
    try {
      const querySnap = await queryUserByChildInSchool("userId", savedUserId, schoolKey || null);
      if (querySnap?.exists()) {
        let user = null;
        let nodeKey = null;

        querySnap.forEach((child) => {
          user = child.val() || {};
          nodeKey = child.key;
          return true;
        });

        if (user && nodeKey) {
          return { user, nodeKey, schoolKey };
        }
      }
    } catch (error) {
      console.warn("[Account Access] userId lookup error:", error);
    }
  }

  return null;
}

export async function getParentAccessState(sessionOverrides = null) {
  const session = sessionOverrides || (await readParentSession());

  if (String(session?.role || "").toLowerCase() !== "parent") {
    return { status: "missing", schoolKey: session?.schoolKey || null };
  }

  const record = await getParentUserRecord(session);
  if (!record?.user) {
    return { status: "missing", schoolKey: session?.schoolKey || null };
  }

  return {
    status: record.user.isActive === false ? "blocked" : "active",
    ...record,
  };
}