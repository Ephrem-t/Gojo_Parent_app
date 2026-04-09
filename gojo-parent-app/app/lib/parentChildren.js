import { get, ref } from "firebase/database";
import { database } from "../../constants/firebaseConfig";
import { readCachedJsonRecord, writeCachedJson } from "./dataCache";
import { isInternetReachableNow } from "./networkGuard";

const LINKED_CHILDREN_CACHE_TTL_MS = 10 * 60 * 1000;

const normalizeId = (value) => String(value ?? "").trim();

function resolveStudentEntry(studentsData, studentLookup) {
  const normalizedStudentLookup = normalizeId(studentLookup);
  if (!normalizedStudentLookup || !studentsData || typeof studentsData !== "object") {
    return { studentId: normalizedStudentLookup, student: null };
  }

  const directStudent = studentsData?.[normalizedStudentLookup] || null;
  if (directStudent) {
    return {
      studentId: normalizeId(directStudent?.studentId) || normalizedStudentLookup,
      student: directStudent,
    };
  }

  const matchedStudentEntry = Object.entries(studentsData).find(([studentNodeKey, studentValue]) => {
    return (
      normalizeId(studentNodeKey) === normalizedStudentLookup ||
      normalizeId(studentValue?.studentId) === normalizedStudentLookup
    );
  });

  if (!matchedStudentEntry) {
    return { studentId: normalizedStudentLookup, student: null };
  }

  const [studentNodeKey, studentValue] = matchedStudentEntry;
  return {
    studentId: normalizeId(studentValue?.studentId) || normalizeId(studentNodeKey),
    student: studentValue,
  };
}

function sortChildren(left, right) {
  const leftKey = String(left?.name || left?.studentId || "");
  const rightKey = String(right?.name || right?.studentId || "");
  return leftKey.localeCompare(rightKey, undefined, { sensitivity: "base" });
}

function getStudentParentLink(student, parentId) {
  const normalizedParentId = normalizeId(parentId);
  const studentParents = student?.parents;

  if (studentParents && typeof studentParents === "object" && !Array.isArray(studentParents)) {
    const directLink = studentParents[normalizedParentId];
    if (directLink && typeof directLink === "object") return directLink;

    const matchedLink = Object.entries(studentParents).find(([key, value]) => {
      return normalizeId(key) === normalizedParentId || normalizeId(value?.parentId) === normalizedParentId;
    });

    if (matchedLink?.[1]) return matchedLink[1];
  }

  const guardianEntries = Array.isArray(student?.parentGuardianInformation?.parents)
    ? student.parentGuardianInformation.parents
    : [];

  return guardianEntries.find((entry) => normalizeId(entry?.parentId) === normalizedParentId) || null;
}

function getStudentUserId(student, link, usersData) {
  const directStudentUserId =
    normalizeId(student?.userId) || normalizeId(student?.systemAccountInformation?.userId);
  if (directStudentUserId) {
    return directStudentUserId;
  }

  const linkedStudentUserId = normalizeId(link?.studentUserId);
  if (linkedStudentUserId) {
    return linkedStudentUserId;
  }

  const linkedUserId = normalizeId(link?.userId);
  if (!linkedUserId) {
    return null;
  }

  const linkedUserRole = String(usersData?.[linkedUserId]?.role || "").trim().toLowerCase();
  return linkedUserRole === "student" ? linkedUserId : null;
}

function buildChildRecord({ parentId, studentId, student, usersData, link }) {
  const normalizedStudentId = normalizeId(student?.studentId) || normalizeId(studentId);
  if (!normalizedStudentId || !student) return null;

  const studentUserId = getStudentUserId(student, link, usersData);
  const studentUser = studentUserId ? usersData?.[studentUserId] || {} : {};

  return {
    ...link,
    parentId: normalizeId(link?.parentId) || normalizeId(parentId),
    studentId: normalizedStudentId,
    userId: studentUserId,
    relationship: link?.relationship || null,
    linkedAt: link?.linkedAt || null,
    name:
      student?.name ||
      student?.basicStudentInformation?.name ||
      studentUser?.name ||
      `Student ${normalizedStudentId}`,
    profileImage:
      student?.profileImage ||
      student?.basicStudentInformation?.studentPhoto ||
      studentUser?.profileImage ||
      null,
    grade: String(student?.grade || student?.basicStudentInformation?.grade || "--"),
    section: String(student?.section || student?.basicStudentInformation?.section || "--"),
  };
}

export async function getLinkedChildrenForParent(prefix, parentId, options = {}) {
  const forceNetwork = !!options.forceNetwork;
  if (!parentId) return [];

  const cacheKey = `cache:linkedChildren:${String(prefix || "root")}:${String(parentId)}`;

  const cachedChildrenRecord = await readCachedJsonRecord(cacheKey);
  const cachedChildren = Array.isArray(cachedChildrenRecord?.value) ? cachedChildrenRecord.value : null;
  const cacheFresh = cachedChildrenRecord
    ? Date.now() - cachedChildrenRecord.savedAt <= LINKED_CHILDREN_CACHE_TTL_MS
    : false;

  if (!forceNetwork && cachedChildren && cacheFresh) {
    return cachedChildren;
  }

  const onlineNow = await isInternetReachableNow();
  if (!onlineNow) {
    return cachedChildren || [];
  }

  const [parentSnap, studentsSnap, usersSnap] = await Promise.all([
    get(ref(database, `${prefix}Parents/${parentId}`)),
    get(ref(database, `${prefix}Students`)),
    get(ref(database, `${prefix}Users`)),
  ]);

  const parent = parentSnap.exists() ? parentSnap.val() : null;
  const studentsData = studentsSnap.exists() ? studentsSnap.val() : {};
  const usersData = usersSnap.exists() ? usersSnap.val() : {};

  if (!parent) return [];

  const legacyChildren = parent?.children && typeof parent.children === "object"
    ? Object.entries(parent.children)
        .map(([childKey, childLink]) => {
          const { studentId, student } = resolveStudentEntry(
            studentsData,
            childLink?.studentId || childKey
          );

          return buildChildRecord({
            parentId,
            studentId,
            student,
            usersData,
            link: childLink,
          });
        })
        .filter(Boolean)
    : [];

  if (legacyChildren.length) {
    const sortedLegacyChildren = legacyChildren.sort(sortChildren);
    writeCachedJson(cacheKey, sortedLegacyChildren).catch(() => {});
    return sortedLegacyChildren;
  }

  const resolvedChildren = Object.entries(studentsData)
    .map(([studentNodeKey, student]) => {
      const link = getStudentParentLink(student, parentId);
      if (!link) return null;

      return buildChildRecord({
        parentId,
        studentId: normalizeId(student?.studentId) || normalizeId(studentNodeKey),
        student,
        usersData,
        link,
      });
    })
    .filter(Boolean)
    .sort(sortChildren);

  writeCachedJson(cacheKey, resolvedChildren).catch(() => {});
  return resolvedChildren;
}