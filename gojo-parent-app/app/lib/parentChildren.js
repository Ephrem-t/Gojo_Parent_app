import { get, ref } from "firebase/database";
import { database } from "../../constants/firebaseConfig";

const normalizeId = (value) => String(value ?? "").trim();

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

function buildChildRecord({ parentId, studentId, student, usersData, link }) {
  if (!studentId || !student) return null;

  const studentUserId = link?.userId || student?.userId || student?.systemAccountInformation?.userId || null;
  const studentUser = studentUserId ? usersData?.[studentUserId] || {} : {};

  return {
    ...link,
    parentId: normalizeId(link?.parentId) || normalizeId(parentId),
    studentId,
    userId: studentUserId,
    relationship: link?.relationship || null,
    linkedAt: link?.linkedAt || null,
    name:
      studentUser?.name ||
      student?.name ||
      student?.basicStudentInformation?.name ||
      `Student ${studentId}`,
    profileImage:
      studentUser?.profileImage ||
      student?.profileImage ||
      student?.basicStudentInformation?.studentPhoto ||
      null,
    grade: String(student?.grade || student?.basicStudentInformation?.grade || "--"),
    section: String(student?.section || student?.basicStudentInformation?.section || "--"),
  };
}

export async function getLinkedChildrenForParent(prefix, parentId) {
  if (!parentId) return [];

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
    ? Object.values(parent.children)
        .map((childLink) => {
          const studentId = childLink?.studentId;
          const student = studentId ? studentsData?.[studentId] || null : null;

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
    return legacyChildren.sort(sortChildren);
  }

  return Object.entries(studentsData)
    .map(([studentId, student]) => {
      const link = getStudentParentLink(student, parentId);
      if (!link) return null;

      return buildChildRecord({
        parentId,
        studentId,
        student,
        usersData,
        link,
      });
    })
    .filter(Boolean)
    .sort(sortChildren);
}