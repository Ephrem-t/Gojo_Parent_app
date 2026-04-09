import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { child, get, push, ref, set } from "firebase/database";
import { database } from "../constants/firebaseConfig";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppImage from "../components/ui/AppImage";
import { useParentTheme } from "../hooks/use-parent-theme";
import { readCachedJsonRecord, writeCachedJson } from "./lib/dataCache";
import { isInternetReachableNow } from "./lib/networkGuard";
import { resolveUserIdentity } from "./lib/userHelpers";

const makePalette = (colors, isDark) => ({
  background: colors.background,
  card: colors.card,
  cardMuted: colors.cardMuted,
  surfaceMuted: colors.surfaceMuted,
  inputBackground: colors.inputBackground,
  accent: colors.primary,
  accentDark: colors.primaryDark,
  accentSoft: colors.primarySoft,
  text: colors.text,
  subtext: colors.mutedAlt,
  muted: colors.muted,
  border: colors.border,
  borderSoft: colors.borderSoft,
  line: colors.line,
  white: colors.white,
  danger: colors.danger,
  dangerSoft: colors.dangerSoft,
  success: colors.success,
  successSoft: colors.successSoft,
  offline: colors.offline,
  overlay: colors.overlay,
  overlayStrong: colors.overlayStrong,
  heroSurface: colors.heroSurface,
  heroBannerTint: colors.heroBannerTint,
  heroOrbPrimary: colors.heroOrbPrimary,
  heroOrbSecondary: colors.heroOrbSecondary,
  heroTopButton: colors.heroTopButton,
  heroTopBorder: colors.heroTopBorder,
  heroPillBg: colors.heroPillBg,
  heroPillBorder: colors.heroPillBorder,
  heroPillText: colors.heroPillText,
  heroSubtleText: colors.heroSubtleText,
  shadowBlue: isDark ? "#000000" : "#BED3EE",
  shadowSoft: isDark ? "#000000" : "#D9E7F6",
  topIconSurface: isDark ? colors.cardMuted : "rgba(15, 23, 42, 0.28)",
  topIconBorder: isDark ? colors.border : "rgba(255,255,255,0.24)",
  purpleAction: isDark ? colors.primary : "#5865F2",
  darkSurface: isDark ? "#08182E" : "#0F172A",
  darkSurfaceSubtext: isDark ? "#C8DBF6" : "#CBD5E1",
  badgeSurface: isDark ? "#102742" : "#E0F2FE",
  scheduleSurface: isDark ? colors.cardMuted : "#F7FBFF",
  scheduleSurfaceAlt: isDark ? colors.cardMuted : "#F4F9FF",
  scheduleActiveSurface: isDark ? "#102742" : "#EEF6FF",
});

const defaultProfile = "https://cdn-icons-png.flaticon.com/512/847/847969.png";
const USER_PROFILE_CACHE_TTL_MS = 30 * 60 * 1000;
const WEEK_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const MINI_AVATAR = 18;

function getUserProfileCacheKey(schoolKey, recordId, userId) {
  return `cache:userProfile:${String(schoolKey || "root")}:${String(recordId || "none")}:${String(userId || "none")}`;
}

function getPeriodOrder(periodName) {
  const match = String(periodName || "").match(/\d+/);
  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
}

function normalizeIdentityValue(value) {
  return String(value ?? "").trim().toLowerCase();
}

function findTeacherMapKey(teacherMap, { teacherId, userId, name }) {
  const normalizedTeacherId = String(teacherId ?? "").trim();
  const normalizedUserId = String(userId ?? "").trim();
  const normalizedName = normalizeIdentityValue(name);

  return Object.keys(teacherMap).find((candidateKey) => {
    const teacher = teacherMap[candidateKey] || {};
    return (
      (normalizedTeacherId && String(teacher.teacherId ?? "").trim() === normalizedTeacherId) ||
      (normalizedUserId && String(teacher.userId ?? "").trim() === normalizedUserId) ||
      (normalizedName && normalizeIdentityValue(teacher.name) === normalizedName)
    );
  }) || null;
}

function dedupeTeacherRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const mergedTeachers = new Map();

  rows.forEach((teacher) => {
    if (!teacher || typeof teacher !== "object") return;

    const mergeKey =
      String(teacher.userId || "").trim() ||
      String(teacher.teacherId || "").trim() ||
      normalizeIdentityValue(teacher.name) ||
      JSON.stringify(teacher);

    const existingTeacher = mergedTeachers.get(mergeKey);
    const nextSubjects = Array.from(
      new Set([
        ...(Array.isArray(existingTeacher?.subjects) ? existingTeacher.subjects : []),
        ...(Array.isArray(teacher.subjects) ? teacher.subjects : []),
      ].filter(Boolean))
    );

    mergedTeachers.set(mergeKey, {
      ...(existingTeacher || {}),
      ...teacher,
      teacherId: teacher.teacherId || existingTeacher?.teacherId || null,
      userId: teacher.userId || existingTeacher?.userId || null,
      name: teacher.name || existingTeacher?.name || "Teacher",
      profileImage: teacher.profileImage || existingTeacher?.profileImage || defaultProfile,
      subjects: nextSubjects,
    });
  });

  return Array.from(mergedTeachers.values());
}

function useUserProfileThemeConfig() {
  const { colors, isDark, statusBarStyle, amharic, oromo } = useParentTheme();

  const PALETTE = useMemo(() => makePalette(colors, isDark), [colors, isDark]);
  const styles = useMemo(() => createStyles(PALETTE), [PALETTE]);

  return { PALETTE, styles, statusBarStyle, amharic, oromo };
}

function getDayLabel(day, labels) {
  return labels.dayLabels[day] || day;
}

function getUserProfileLabels(amharic, oromo) {
  if (oromo) {
    return {
      ...getUserProfileLabels(false, false),
      main: "Ijo",
      info: "Odeeffannoo",
      share: "Qoodi",
      reportUser: "Fayyadamaa gabaasi",
      profileFallback: "Profaayilii",
      userFallback: "Fayyadamaa",
      selfProfile: "Kun profaayilii kee dha",
      studentProfile: "Profaayilii Barataa",
      parentProfile: "Profaayilii Maatii",
      schoolManagement: "Bulchiinsa Mana Barumsaa",
      schoolProfile: "Profaayilii Mana Barumsaa",
      notAllowed: "Hin eeyyamamu",
      cannotMessageYourself: "Ofiif ergaa erguu hin dandeessu.",
      chatUnavailable: "Chat hin argamu",
      noPhoneTitle: "Lakkoofsi bilbilaa hin jiru",
      noPhoneBody: "Lakkoofsi bilbilaa hin argamu.",
      profileInfo: "Odeeffannoo Profaayilii",
      name: "Maqaa",
      username: "Maqaa fayyadamaa",
      role: "Gahee hojii",
      summary: "Cuunfaa",
      classLabel: "Kutaa",
      phone: "Bilbila",
      email: "Imeelii",
      loadingProfile: "Profaayilii fe'aa jira...",
      profileUnavailable: "Profaayiliin hin argamne",
      profileUnavailableBody: "Profaayilii kana fe'uu hin dandeenye.",
      backToDashboard: "Gara daashboordii deebi'i",
      classSchedule: "Sagantaa Kutaa",
      grade: "Kutaa",
      section: "Kutaa xiqqaa",
      todayPill: "Har'a",
      freePeriod: "Yeroo Bilisaa",
      unassigned: "Hin ramadamne",
      noPeriodsScheduled: "Yeroon hin qabamne.",
      noClassesScheduledToday: "Har'a kutaan hin qabamne",
    };
  }

  if (amharic) {
    return {
      roleLabels: {
        Student: "ተማሪ",
        Teacher: "መምህር",
        Parent: "ወላጅ",
        Admin: "አስተዳደር",
        Profile: "መገለጫ",
      },
      dayLabels: {
        Monday: "ሰኞ",
        Tuesday: "ማክሰኞ",
        Wednesday: "ረቡዕ",
        Thursday: "ሐሙስ",
        Friday: "ዓርብ",
      },
      main: "ዋና",
      info: "መረጃ",
      share: "አጋራ",
      reportUser: "ተጠቃሚውን ሪፖርት አድርግ",
      profileFallback: "መገለጫ",
      userFallback: "ተጠቃሚ",
      selfProfile: "ይህ የእርስዎ መገለጫ ነው",
      studentProfile: "የተማሪ መገለጫ",
      parentProfile: "የወላጅ መገለጫ",
      schoolManagement: "የትምህርት ቤት አስተዳደር",
      schoolProfile: "የትምህርት ቤት መገለጫ",
      teacherSuffix: "መምህር",
      notAllowed: "አይፈቀድም",
      cannotMessageYourself: "ራስዎን መልዕክት መላክ አይችሉም።",
      chatUnavailable: "ውይይት አይገኝም",
      noChatAvailable: (name) => `${name || "ይህ ተጠቃሚ"} ጋር ውይይት አይገኝም።`,
      noPhoneTitle: "ስልክ ቁጥር የለም",
      noPhoneBody: "ምንም ስልክ ቁጥር አይገኝም።",
      sharingFailed: "ማጋራት አልተሳካም",
      shareFailedBody: "ይህን መገለጫ ማጋራት አልተቻለም።",
      shareMessage: (name, link) => `የ${name || "ይህ ተጠቃሚ"} መገለጫ ይመልከቱ\n${link}`,
      reportedTitle: "ሪፖርት ተደርጓል",
      reportedBody: "ይህን ተጠቃሚ እንመለከታለን።",
      reportFailedTitle: "ስህተት",
      reportFailedBody: "ሪፖርቱን መላክ አልተቻለም።",
      contactCountText: (count) => `${count} ${count === 1 ? "ግንኙነት" : "ግንኙነቶች"}`,
      subjectCountText: (count) => `${count} ${count === 1 ? "ትምህርት" : "ትምህርቶች"}`,
      classCountText: (count) => `${count} ክፍል${count === 1 ? "" : "ች"}`,
      assigned: "ተመድቧል",
      reachable: "ሊደረስበት ይችላል",
      school: "ትምህርት ቤት",
      sendMessage: "መልዕክት ላክ",
      callUser: "ተጠቃሚውን ይደውሉ",
      shareProfile: "መገለጫ አጋራ",
      startChatWith: (name) => `${name || "ይህ ተጠቃሚ"} ጋር ውይይት ይጀምሩ`,
      reachByPhone: "ይህን መገለጫ በስልክ ያግኙ",
      sendLink: "የዚህን መገለጫ አገናኝ ያጋሩ",
      sendReviewRequest: "ለዚህ መገለጫ የግምገማ ጥያቄ ይላኩ",
      todayAtSchool: "ዛሬ በትምህርት ቤት",
      schedule: "መርሃ ግብር",
      parents: "ወላጆች",
      teachers: "መምህራን",
      account: "መለያ",
      subjects: "ትምህርቶች",
      relation: "ግንኙነት",
      noLinkedParents: "የተገናኙ ወላጆች አልተገኙም።",
      noAssignedTeachers: "የተመደቡ መምህራን አልተገኙም።",
      noAssignedSubjects: "የተመደቡ ትምህርቶች አልተገኙም።",
      profileInfo: "የመገለጫ መረጃ",
      name: "ስም",
      username: "የተጠቃሚ ስም",
      role: "ሚና",
      summary: "ማጠቃለያ",
      classLabel: "ክፍል",
      assignedSubjects: "የተመደቡ ትምህርቶች",
      phone: "ስልክ",
      email: "ኢሜይል",
      classOverview: "የክፍል አጠቃላይ እይታ",
      todayLabel: "ዛሬ",
      plannedPeriods: "የታቀዱ ክፍለ ጊዜዎች",
      classes: "ክፍሎች",
      freePeriods: "ነጻ ጊዜዎች",
      teachingOverview: "የማስተማር አጠቃላይ እይታ",
      firstSubject: "የመጀመሪያ ትምህርት",
      primaryClass: "ዋና ክፍል",
      actions: "እርምጃዎች",
      loadingProfile: "መገለጫ በመጫን ላይ...",
      profileUnavailable: "መገለጫው አልተገኘም",
      profileUnavailableBody: "ይህን መገለጫ መጫን አልቻልንም።",
      backToDashboard: "ወደ ዳሽቦርድ ተመለስ",
      classSchedule: "የክፍል መርሃ ግብር",
      grade: "ክፍል",
      section: "ክፍለ ክፍል",
      todayPill: "ዛሬ",
      freePeriod: "ነጻ ጊዜ",
      unassigned: "አልተመደበም",
      noPeriodsScheduled: "ምንም ክፍለ ጊዜ አልተያዘም።",
      tapToViewDay: "ይህን ቀን ለማየት ይጫኑ",
      tapToViewPeriods: (count) => `${count} ክፍለ ጊዜ${count === 1 ? "" : "ዎች"} ለማየት ይጫኑ`,
      noClassesScheduledToday: "ዛሬ ምንም ክፍሎች አልተያዙም",
      noClassesScheduledOn: (day) => `${day} ምንም ክፍሎች አልተያዙም`,
      scheduledToday: (count) => `${count} ክፍለ ጊዜ${count === 1 ? "" : "ዎች"} ዛሬ`,
      scheduledOn: (count, day) => `${count} ክፍለ ጊዜ${count === 1 ? "" : "ዎች"} በ${day}`,
    };
  }

  return {
    roleLabels: {
      Student: "Student",
      Teacher: "Teacher",
      Parent: "Parent",
      Admin: "Admin",
      Profile: "Profile",
    },
    dayLabels: {
      Monday: "Monday",
      Tuesday: "Tuesday",
      Wednesday: "Wednesday",
      Thursday: "Thursday",
      Friday: "Friday",
    },
    main: "Main",
    info: "Info",
    share: "Share",
    reportUser: "Report User",
    profileFallback: "Profile",
    userFallback: "User",
    selfProfile: "This is your profile",
    studentProfile: "Student Profile",
    parentProfile: "Parent Profile",
    schoolManagement: "School Management",
    schoolProfile: "School Profile",
    teacherSuffix: "Teacher",
    notAllowed: "Not allowed",
    cannotMessageYourself: "You cannot message yourself.",
    chatUnavailable: "Chat unavailable",
    noChatAvailable: (name) => `No chat available for ${name || "this user"}.`,
    noPhoneTitle: "No phone number",
    noPhoneBody: "No phone number available.",
    sharingFailed: "Sharing failed",
    shareFailedBody: "Unable to share this profile.",
    shareMessage: (name, link) => `View ${name || "this user"}'s profile\n${link}`,
    reportedTitle: "Reported",
    reportedBody: "Reported. We will review this user.",
    reportFailedTitle: "Error",
    reportFailedBody: "Could not submit the report.",
    contactCountText: (count) => `${count} ${count === 1 ? "Contact" : "Contacts"}`,
    subjectCountText: (count) => `${count} ${count === 1 ? "Subject" : "Subjects"}`,
    classCountText: (count) => `${count} ${count === 1 ? "class" : "classes"}`,
    assigned: "assigned",
    reachable: "Reachable",
    school: "School",
    sendMessage: "Send Message",
    callUser: "Call User",
    shareProfile: "Share Profile",
    startChatWith: (name) => `Start a chat with ${name || "this user"}`,
    reachByPhone: "Reach this profile by phone",
    sendLink: "Send a link to this profile",
    sendReviewRequest: "Send a review request for this profile",
    todayAtSchool: "Today at school",
    schedule: "Schedule",
    parents: "Parents",
    teachers: "Teachers",
    account: "Account",
    subjects: "Subjects",
    relation: "Relation",
    noLinkedParents: "No linked parents found.",
    noAssignedTeachers: "No assigned teachers found.",
    noAssignedSubjects: "No assigned subjects found.",
    profileInfo: "Profile info",
    name: "Name",
    username: "Username",
    role: "Role",
    summary: "Summary",
    classLabel: "Class",
    assignedSubjects: "Assigned subjects",
    phone: "Phone",
    email: "Email",
    classOverview: "Class overview",
    todayLabel: "Today",
    plannedPeriods: "Planned periods",
    classes: "Classes",
    freePeriods: "Free periods",
    teachingOverview: "Teaching overview",
    firstSubject: "First subject",
    primaryClass: "Primary class",
    actions: "Actions",
    loadingProfile: "Loading profile...",
    profileUnavailable: "Profile unavailable",
    profileUnavailableBody: "We could not load this profile.",
    backToDashboard: "Back to dashboard",
    classSchedule: "Class Schedule",
    grade: "Grade",
    section: "Section",
    todayPill: "Today",
    freePeriod: "Free Period",
    unassigned: "Unassigned",
    noPeriodsScheduled: "No periods scheduled.",
    tapToViewDay: "Tap to view this day",
    tapToViewPeriods: (count) => `Tap to view ${count} period${count === 1 ? "" : "s"}`,
    noClassesScheduledToday: "No classes scheduled today",
    noClassesScheduledOn: (day) => `No classes scheduled on ${day}`,
    scheduledToday: (count) => `${count} period${count === 1 ? "" : "s"} today`,
    scheduledOn: (count, day) => `${count} period${count === 1 ? "" : "s"} on ${day}`,
  };
}

export default function UserProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const { PALETTE, styles, statusBarStyle, amharic, oromo } = useUserProfileThemeConfig();
  const labels = useMemo(() => getUserProfileLabels(amharic, oromo), [amharic, oromo]);

  const { recordId: paramRecordId, userId: paramUserId, roleName: paramRoleName } = params ?? {};

  const [schoolKey, setSchoolKey] = useState(null);
  const [loading, setLoading] = useState(true);

  const [user, setUser] = useState(null);
  const [roleName, setRoleName] = useState(paramRoleName ?? null);
  const [resolvedUserId, setResolvedUserId] = useState(paramUserId ?? null);

  const [parentUserId, setParentUserId] = useState(null);
  const [parentRecordId, setParentRecordId] = useState(null);

  const [parents, setParents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [teacherCourses, setTeacherCourses] = useState([]);

  const [studentWeeklySchedule, setStudentWeeklySchedule] = useState({});
  const [studentGradeSection, setStudentGradeSection] = useState(null);
  const [selectedScheduleDay, setSelectedScheduleDay] = useState(null);
  const [expandedScheduleDays, setExpandedScheduleDays] = useState({});
  const [scheduleSheetVisible, setScheduleSheetVisible] = useState(false);

  const [showMenu, setShowMenu] = useState(false);
  const [profileSectionTab, setProfileSectionTab] = useState("main");

  const schoolAwarePath = useCallback(
    (subPath) => (schoolKey ? `Platform1/Schools/${schoolKey}/${subPath}` : subPath),
    [schoolKey]
  );

  const applyCachedProfile = useCallback((cachedProfile) => {
    if (!cachedProfile || typeof cachedProfile !== "object") return;

    setUser(cachedProfile.user || null);
    setRoleName(cachedProfile.roleName || paramRoleName || null);
    setResolvedUserId(cachedProfile.resolvedUserId || null);
    setParents(Array.isArray(cachedProfile.parents) ? cachedProfile.parents : []);
    setTeachers(dedupeTeacherRows(Array.isArray(cachedProfile.teachers) ? cachedProfile.teachers : []));
    setTeacherCourses(Array.isArray(cachedProfile.teacherCourses) ? cachedProfile.teacherCourses : []);
    setStudentWeeklySchedule(
      cachedProfile.studentWeeklySchedule && typeof cachedProfile.studentWeeklySchedule === "object"
        ? cachedProfile.studentWeeklySchedule
        : {}
    );
    setStudentGradeSection(cachedProfile.studentGradeSection || null);
    setSelectedScheduleDay(cachedProfile.selectedScheduleDay || null);
  }, [paramRoleName]);

  useEffect(() => {
    (async () => {
      const [sk, parentId] = await Promise.all([
        AsyncStorage.getItem("schoolKey"),
        AsyncStorage.getItem("parentId"),
      ]);
      setSchoolKey(sk || null);

      if (parentId) {
        setParentRecordId(parentId);
        const parentSnap = await get(
          child(ref(database), `${sk ? `Platform1/Schools/${sk}/` : ""}Parents/${parentId}`)
        );
        if (parentSnap.exists()) {
          setParentUserId(parentSnap.val()?.userId || null);
        }
      }
    })();
  }, []);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const cacheKey = getUserProfileCacheKey(schoolKey, paramRecordId, paramUserId);
      const cachedProfileRecord = await readCachedJsonRecord(cacheKey);
      const cachedProfile = cachedProfileRecord?.value || null;
      const cacheFresh = cachedProfileRecord
        ? Date.now() - cachedProfileRecord.savedAt <= USER_PROFILE_CACHE_TTL_MS
        : false;

      if (cachedProfile && mounted) {
        applyCachedProfile(cachedProfile);
        setLoading(false);

        if (cacheFresh) {
          return;
        }
      } else {
        setLoading(true);
      }

      const onlineNow = await isInternetReachableNow();
      if (!onlineNow) {
        if (mounted) setLoading(false);
        return;
      }

      try {
        let localResolvedUserId = paramUserId ?? null;
        const rId = paramRecordId ?? null;
        let detectedRole = paramRoleName ?? null;
        let resolvedUser = null;
        let nextUser = null;
        let nextParents = [];
        let nextTeachers = [];
        let nextTeacherCourses = [];
        let nextStudentWeeklySchedule = {};
        let nextStudentGradeSection = null;
        let nextSelectedScheduleDay = null;

        if (!localResolvedUserId && rId) {
          const resolvedRecordIdentity = await resolveUserIdentity(rId, schoolKey);
          if (resolvedRecordIdentity) {
            localResolvedUserId = resolvedRecordIdentity._nodeKey || resolvedRecordIdentity.userId || null;
            resolvedUser = resolvedRecordIdentity;
            detectedRole = detectedRole || resolvedRecordIdentity.role || detectedRole;
            if (detectedRole) setRoleName(detectedRole);
          }
        }

        if (rId && !resolvedUser) {
          const roleNodes = ["Students", "Teachers", "School_Admins", "Registerers", "Finances", "HR", "Parents"];
          for (const node of roleNodes) {
            const snap = await get(child(ref(database), `${schoolAwarePath(node)}/${rId}`));
            if (snap.exists()) {
              const row = snap.val() || {};
              if (!localResolvedUserId) {
                localResolvedUserId = row.userId || null;
              }
              detectedRole =
                node === "Students"
                  ? "Student"
                  : node === "Teachers"
                  ? "Teacher"
                  : node === "Parents"
                  ? "Parent"
                  : "Admin";
              setRoleName(detectedRole);
              break;
            }
          }
        }

        if (!resolvedUser && localResolvedUserId) {
          const resolvedIdentity = await resolveUserIdentity(localResolvedUserId, schoolKey);
          if (resolvedIdentity) {
            localResolvedUserId = resolvedIdentity._nodeKey || localResolvedUserId;
            resolvedUser = resolvedIdentity;
          }
        }

        if (mounted) setResolvedUserId(localResolvedUserId || null);

        const usersSnap = await get(child(ref(database), schoolAwarePath("Users")));
        const usersData = usersSnap.exists() ? usersSnap.val() : {};
        nextUser = localResolvedUserId ? resolvedUser || usersData[localResolvedUserId] || null : resolvedUser || null;

        if (rId && detectedRole === "Student") {
          // fetch student, teachers node, schedules and grade management
          const [studentSnap, teachersSnap, schedulesSnap, gradesSnap] = await Promise.all([
            get(child(ref(database), `${schoolAwarePath("Students")}/${rId}`)),
            get(child(ref(database), schoolAwarePath("Teachers"))),
            get(child(ref(database), schoolAwarePath("Schedules"))),
            get(child(ref(database), schoolAwarePath("GradeManagement/grades"))),
          ]);

          const student = studentSnap.exists() ? studentSnap.val() : null;
          const teachersData = teachersSnap.exists() ? teachersSnap.val() : {};
          const schedulesData = schedulesSnap.exists() ? schedulesSnap.val() : {};
          const gradesData = gradesSnap.exists() ? gradesSnap.val() : {};

          if (student) {
            const grade = student?.grade;
            const section = student?.section;
            const gradeSectionKey = `Grade ${grade}${section || ""}`;
            nextStudentGradeSection = { grade, section, key: gradeSectionKey };

            // Parents resolution (unchanged)
            let parentRows = [];
            const parentMap = student.parents || {};
            for (const pid of Object.keys(parentMap)) {
              const pSnap = await get(child(ref(database), `${schoolAwarePath("Parents")}/${pid}`));
              if (pSnap.exists()) {
                const pNode = pSnap.val();
                const pUser = usersData[pNode.userId] || {};
                parentRows.push({
                  parentId: pid,
                  userId: pNode.userId,
                  name: pUser.name || pUser.username || "Parent",
                  profileImage: pUser.profileImage || defaultProfile,
                  relationship: parentMap[pid]?.relationship || "Parent",
                });
              }
            }

            if (!parentRows.length) {
              const parentsSnap = await get(child(ref(database), schoolAwarePath("Parents")));
              const parentsData = parentsSnap.exists() ? parentsSnap.val() : {};
              parentRows = Object.keys(parentsData).reduce((acc, pid) => {
                const pNode = parentsData[pid];
                const links = pNode?.children ? Object.values(pNode.children) : [];
                const match = links.find((link) => link?.studentId === rId);
                if (match) {
                  const pUser = usersData[pNode.userId] || {};
                  acc.push({
                    parentId: pid,
                    userId: pNode.userId,
                    name: pUser.name || pUser.username || "Parent",
                    profileImage: pUser.profileImage || defaultProfile,
                    relationship: match.relationship || "Parent",
                  });
                }
                return acc;
              }, []);
            }

            // Build teacher map from schedules (existing logic)
            const teacherMap = {};

            Object.keys(schedulesData || {}).forEach((day) => {
              const dayNode = schedulesData?.[day]?.[gradeSectionKey] || {};
              Object.values(dayNode).forEach((period) => {
                if (!period?.teacherName || period.teacherName === "Unassigned") return;

                // try match teacher by name in teachersData -> usersData
                const teacherEntry =
                  Object.values(teachersData).find((t) => {
                    const userRow = usersData[t?.userId] || {};
                    return (
                      String(userRow?.name || "").trim().toLowerCase() ===
                      String(period.teacherName || "").trim().toLowerCase()
                    );
                  }) || null;

                const teacherMapKey =
                  findTeacherMapKey(teacherMap, {
                    teacherId: teacherEntry?.teacherId || null,
                    userId: teacherEntry?.userId || null,
                    name: period.teacherName,
                  }) ||
                  teacherEntry?.teacherId ||
                  teacherEntry?.userId ||
                  String(period.teacherName || "").trim();

                if (!teacherMap[teacherMapKey]) {
                  teacherMap[teacherMapKey] = {
                    teacherId: teacherEntry?.teacherId || null,
                    userId: teacherEntry?.userId || null,
                    name: period.teacherName || "Teacher",
                    profileImage: teacherEntry?.userId
                      ? usersData[teacherEntry.userId]?.profileImage || defaultProfile
                      : defaultProfile,
                    subjects: new Set(),
                  };
                }

                if (period?.subject && period.subject !== "Free Period") {
                  teacherMap[teacherMapKey].subjects.add(period.subject);
                }
              });
            });

            // --- NEW: merge GradeManagement assignments so assigned teachers show up ---
            if (gradesData && grade) {
              try {
                const gradeNode = gradesData?.[grade] || {};
                const sectionTeacherMap = gradeNode?.sectionSubjectTeachers || {};
                const sectionAssignments = sectionTeacherMap?.[section] || {};

                Object.keys(sectionAssignments || {}).forEach((subjectKey) => {
                  const assignment = sectionAssignments[subjectKey] || {};
                  const assignedTeacherId = assignment?.teacherId || null;
                  const assignedSubject = assignment?.subject || subjectKey;

                  if (!assignedTeacherId) return;

                  // teachersData may be keyed by teacher record id. Find teacher node by key or by teacherId field
                  let teacherNode = teachersData?.[assignedTeacherId] || null;
                  if (!teacherNode) {
                    // fallback: teachersData values might include teacherId field
                    teacherNode =
                      Object.values(teachersData || {}).find((t) => String(t?.teacherId) === String(assignedTeacherId)) ||
                      null;
                  }

                  const teacherUser = teacherNode ? usersData[teacherNode.userId] || {} : {};
                  const teacherName = teacherUser?.name || assignment?.teacherName || assignedTeacherId || "Teacher";
                  const mapKey =
                    findTeacherMapKey(teacherMap, {
                      teacherId: teacherNode?.teacherId || assignedTeacherId,
                      userId: teacherNode?.userId || null,
                      name: teacherName,
                    }) ||
                    teacherNode?.teacherId ||
                    teacherNode?.userId ||
                    assignedTeacherId;

                  if (!teacherMap[mapKey]) {
                    teacherMap[mapKey] = {
                      teacherId: teacherNode?.teacherId || assignedTeacherId || null,
                      userId: teacherNode?.userId || null,
                      name: teacherName,
                      profileImage: teacherUser?.profileImage || defaultProfile,
                      subjects: new Set(),
                    };
                  }

                  // add the assigned subject
                  if (assignedSubject && assignedSubject !== "Free Period") {
                    teacherMap[mapKey].subjects.add(assignedSubject);
                  }
                });
              } catch (e) {
                // non-fatal, continue with whatever teacherMap we have
                console.warn("GradeManagement merge error", e);
              }
            }

            // Convert teacherMap subjects sets -> arrays
            const teacherRows = Object.values(teacherMap).map((t) => ({
              ...t,
              subjects: Array.from(t.subjects),
            }));

            // Build weekly schedule (unchanged)
            const weekly = {};
            WEEK_DAYS.forEach((day) => {
              const dayPeriods = schedulesData?.[day]?.[gradeSectionKey] || {};
              const sorted = Object.entries(dayPeriods)
                .map(([periodName, info]) => ({
                  periodName,
                  subject: info?.subject || "Free Period",
                  teacherName: info?.teacherName || "Unassigned",
                  isFree: (info?.subject || "Free Period") === "Free Period",
                }))
                .sort((a, b) => getPeriodOrder(a.periodName) - getPeriodOrder(b.periodName));

              weekly[day] = sorted;
            });

            const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
            const defaultDay = WEEK_DAYS.includes(todayName) ? todayName : "Monday";

            nextParents = parentRows;
            nextTeachers = dedupeTeacherRows(teacherRows);
            nextStudentWeeklySchedule = weekly;
            nextSelectedScheduleDay = defaultDay;
          }
        }

        if (rId && detectedRole === "Teacher") {
          const gradeSnap = await get(child(ref(database), schoolAwarePath("GradeManagement/grades")));
          const gradesData = gradeSnap.exists() ? gradeSnap.val() : {};

          const courseRows = [];
          Object.keys(gradesData || {}).forEach((gradeKey) => {
            const gradeNode = gradesData[gradeKey] || {};
            const sectionTeacherMap = gradeNode?.sectionSubjectTeachers || {};

            Object.keys(sectionTeacherMap).forEach((sectionKey) => {
              const sectionAssignments = sectionTeacherMap[sectionKey] || {};
              Object.keys(sectionAssignments).forEach((subjectKey) => {
                const assignment = sectionAssignments[subjectKey];
                if (assignment?.teacherId === rId) {
                  courseRows.push({
                    courseId: assignment?.courseId || `${gradeKey}-${sectionKey}-${subjectKey}`,
                    subject: assignment?.subject || subjectKey,
                    grade: gradeKey,
                    section: sectionKey,
                  });
                }
              });
            });
          });

          nextTeacherCourses = courseRows;
        }

        if (mounted) {
          setResolvedUserId(localResolvedUserId || null);
          setRoleName(detectedRole || null);
          setUser(nextUser || null);
          setParents(nextParents);
          setTeachers(dedupeTeacherRows(nextTeachers));
          setTeacherCourses(nextTeacherCourses);
          setStudentWeeklySchedule(nextStudentWeeklySchedule);
          setStudentGradeSection(nextStudentGradeSection);
          setSelectedScheduleDay(nextSelectedScheduleDay || null);
        }

        const cachedTeachers = dedupeTeacherRows(nextTeachers);
        writeCachedJson(cacheKey, {
          user: nextUser || null,
          roleName: detectedRole || null,
          resolvedUserId: localResolvedUserId || null,
          parents: nextParents,
          teachers: cachedTeachers,
          teacherCourses: nextTeacherCourses,
          studentWeeklySchedule: nextStudentWeeklySchedule,
          studentGradeSection: nextStudentGradeSection,
          selectedScheduleDay: nextSelectedScheduleDay,
          fetchedAt: Date.now(),
        }).catch(() => {});
      } catch (e) {
        console.warn("userProfile load error:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    if (schoolKey !== undefined) load();
    return () => {
      mounted = false;
    };
  }, [applyCachedProfile, paramRecordId, paramRoleName, paramUserId, schoolKey, schoolAwarePath]);

  const isSelfProfile =
    !!parentUserId && !!resolvedUserId && String(parentUserId) === String(resolvedUserId);

  const canMessageMain = !!resolvedUserId && !isSelfProfile;

  const profileSubtitle = useMemo(() => {
    if (isSelfProfile) return "This is your profile";
    if (roleName === "Teacher" && teacherCourses.length) return `${teacherCourses[0].subject} Teacher`;
    if (roleName === "Student") return "Student Profile";
    if (roleName === "Parent") return "Parent Profile";
    if (roleName === "Admin") return "School Management";
    return "School Profile";
  }, [isSelfProfile, roleName, teacherCourses]);

  const selectedDayPeriods = useMemo(() => {
    if (!selectedScheduleDay) return [];
    return studentWeeklySchedule?.[selectedScheduleDay] || [];
  }, [selectedScheduleDay, studentWeeklySchedule]);

  const selectedDaySummary = useMemo(() => {
    const total = selectedDayPeriods.length;
    const classCount = selectedDayPeriods.filter((period) => !period.isFree).length;
    const freeCount = total - classCount;

    return {
      total,
      classCount,
      freeCount,
    };
  }, [selectedDayPeriods]);

  const todayName = useMemo(() => {
    const currentDay = new Date().toLocaleDateString("en-US", { weekday: "long" });
    return WEEK_DAYS.includes(currentDay) ? currentDay : "Monday";
  }, []);

  const previewScheduleDay = selectedScheduleDay || todayName;

  const previewScheduleSubtitle = useMemo(() => {
    if (selectedDaySummary.total) {
      return previewScheduleDay === todayName
        ? `${selectedDaySummary.total} period${selectedDaySummary.total === 1 ? "" : "s"} today`
        : `${selectedDaySummary.total} period${selectedDaySummary.total === 1 ? "" : "s"} on ${previewScheduleDay}`;
    }

    return previewScheduleDay === todayName
      ? "No classes scheduled today"
      : `No classes scheduled on ${previewScheduleDay}`;
  }, [previewScheduleDay, selectedDaySummary.total, todayName]);

  const openScheduleSheet = useCallback(() => {
    const focusDay = WEEK_DAYS.includes(previewScheduleDay) ? previewScheduleDay : todayName;
    setSelectedScheduleDay(focusDay);
    setExpandedScheduleDays(
      WEEK_DAYS.reduce((acc, day) => {
        acc[day] = day === focusDay;
        return acc;
      }, {})
    );
    setScheduleSheetVisible(true);
  }, [previewScheduleDay, todayName]);

  const closeScheduleSheet = useCallback(() => {
    setScheduleSheetVisible(false);
  }, []);

  const toggleScheduleDay = useCallback((day) => {
    setSelectedScheduleDay(day);
    setExpandedScheduleDays((prev) => ({
      ...prev,
      [day]: !prev[day],
    }));
  }, []);

  const handleBack = useCallback(() => {
    if (router?.canGoBack && router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/dashboard/home");
  }, [router]);

  const openChat = () => {
    if (!canMessageMain) return Alert.alert(labels.notAllowed, labels.cannotMessageYourself);
    router.push({ pathname: "/chat", params: { userId: resolvedUserId } });
    console.log("Opening chat with userId:", resolvedUserId);
  };

  const openChatWith = useCallback(
    (targetUserId, displayName) => {
      if (!targetUserId) {
        return Alert.alert(labels.chatUnavailable, labels.noChatAvailable(displayName || labels.userFallback));
      }
      if (parentUserId && String(targetUserId) === String(parentUserId)) {
        return Alert.alert(labels.notAllowed, labels.cannotMessageYourself);
      }
      console.log("Opening chat with userId:", targetUserId);

      router.push({ pathname: "/chat", params: { userId: targetUserId } });
    },
    [router, parentUserId, labels]
  );

  const handleCall = () => {
    const phone = user?.phone || "";
    if (!phone) return Alert.alert(labels.noPhoneTitle, labels.noPhoneBody);
    Linking.openURL(`tel:${String(phone).trim()}`);
  };

  const handleShare = async () => {
    try {
      const name = user?.name || labels.userFallback;
      const link = `https://gojo.app/userProfile?recordId=${paramRecordId ?? ""}&userId=${paramUserId ?? ""}`;
      await Share.share({ message: labels.shareMessage(name, link) });
    } catch {
      Alert.alert(labels.sharingFailed, labels.shareFailedBody);
    }
  };

  const handleReport = async () => {
    try {
      const reportRef = push(ref(database, schoolAwarePath("Reports")));
      await set(reportRef, {
        targetUserId: resolvedUserId || null,
        targetRecordId: paramRecordId || null,
        targetName: user?.name || null,
        targetRole: roleName || null,
        reporterUserId: parentUserId || null,
        createdAt: Date.now(),
        status: "open",
      });
      const msg = labels.reportedBody;
      if (Platform.OS === "android") ToastAndroid.show(msg, ToastAndroid.SHORT);
      else Alert.alert(labels.reportedTitle, msg);
    } catch {
      const msg = labels.reportFailedBody;
      if (Platform.OS === "android") ToastAndroid.show(msg, ToastAndroid.SHORT);
      else Alert.alert(labels.reportFailedTitle, msg);
    }
  };

  const usernameHandle = useMemo(() => {
    if (!user?.username) return null;
    return String(user.username).startsWith("@") ? String(user.username) : `@${user.username}`;
  }, [user?.username]);

  const heroRoleIcon = useMemo(() => {
    if (roleName === "Student") return "school-outline";
    if (roleName === "Teacher") return "book-outline";
    if (roleName === "Parent") return "people-outline";
    return "briefcase-outline";
  }, [roleName]);

  const heroSecondaryMeta = useMemo(() => {
    if (roleName === "Student" && studentGradeSection?.grade) {
      return `${labels.grade} ${studentGradeSection.grade}${studentGradeSection.section || ""}`;
    }
    if (roleName === "Teacher") {
      return teacherCourses.length ? `${labels.subjectCountText(teacherCourses.length)} ${labels.assigned}` : labels.roleLabels.Teacher;
    }
    if (roleName === "Parent") {
      return user?.phone ? labels.reachable : labels.profileFallback;
    }
    if (roleName === "Admin") {
      return labels.school;
    }
    return null;
  }, [roleName, studentGradeSection, teacherCourses.length, user?.phone, labels]);

  const heroSecondaryIcon = useMemo(() => {
    if (roleName === "Student") return "layers-outline";
    if (roleName === "Teacher") return "albums-outline";
    if (roleName === "Parent") return "call-outline";
    return "sparkles-outline";
  }, [roleName]);

  const primaryActionLabel = canMessageMain ? labels.sendMessage : user?.phone ? labels.callUser : labels.shareProfile;
  const handlePrimaryAction = canMessageMain ? openChat : user?.phone ? handleCall : handleShare;

  const renderMainSection = () => {
    if (roleName === "Student") {
      return (
        <>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{labels.todayAtSchool}</Text>

            <TouchableOpacity style={styles.scheduleCard} activeOpacity={0.9} onPress={openScheduleSheet}>
              <View style={styles.scheduleTop}>
                <View style={styles.scheduleIconWrap}>
                  <Ionicons name="time-outline" size={18} color={PALETTE.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.scheduleTitle}>{`${previewScheduleDay} ${labels.schedule}`}</Text>
                  <Text numberOfLines={1} style={styles.scheduleSub}>
                    {previewScheduleSubtitle}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={PALETTE.muted} />
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{labels.parents}</Text>
            {parents.length ? (
              parents.map((parent) => (
                <PersonRow
                  key={parent.parentId}
                  name={parent.name}
                  subtitle={`${labels.relation}: ${parent.relationship}`}
                  image={parent.profileImage}
                  onPress={() => {
                    if (parentRecordId && parent.parentId === parentRecordId) router.push("/dashboard/profile");
                    else router.push(`/userProfile?recordId=${parent.parentId}`);
                  }}
                  onMessage={
                    parent.userId && (!parentUserId || String(parent.userId) !== String(parentUserId))
                      ? () => openChatWith(parent.userId, parent.name)
                      : null
                  }
                />
              ))
            ) : (
              <View style={styles.noteStateCard}>
                <Ionicons name="people-outline" size={18} color={PALETTE.muted} />
                <Text style={styles.noteStateText}>{labels.noLinkedParents}</Text>
              </View>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{labels.teachers}</Text>
            {teachers.length ? (
              teachers.map((teacher) => (
                <PersonRow
                  key={teacher.userId || teacher.teacherId || `${teacher.name}-${teacher.subjects?.join("|") || "teacher"}`}
                  name={teacher.name}
                  subtitle={teacher.subjects?.length ? teacher.subjects.join(", ") : labels.roleLabels.Teacher}
                  image={teacher.profileImage}
                  onPress={() =>
                    teacher.teacherId ? router.push(`/userProfile?recordId=${teacher.teacherId}`) : null
                  }
                  onMessage={
                    teacher.userId && (!parentUserId || String(teacher.userId) !== String(parentUserId))
                      ? () => openChatWith(teacher.userId, teacher.name)
                      : null
                  }
                />
              ))
            ) : (
              <View style={styles.noteStateCard}>
                <Ionicons name="school-outline" size={18} color={PALETTE.muted} />
                <Text style={styles.noteStateText}>{labels.noAssignedTeachers}</Text>
              </View>
            )}
          </View>
        </>
      );
    }

    if (roleName === "Teacher") {
      return (
        <>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{labels.subjects}</Text>
            {teacherCourses.length ? (
              teacherCourses.map((course) => (
                <View key={course.courseId} style={styles.subjectRow}>
                  <Text style={styles.subjectName}>{course.subject}</Text>
                  <Text style={styles.subjectMeta}>{labels.grade} {course.grade} • {labels.section} {course.section}</Text>
                </View>
              ))
            ) : (
              <View style={styles.noteStateCard}>
                <Ionicons name="book-outline" size={18} color={PALETTE.muted} />
                <Text style={styles.noteStateText}>{labels.noAssignedSubjects}</Text>
              </View>
            )}
          </View>

        </>
      );
    }

    return null;
  };

  const renderInfoSection = () => (
    <>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{labels.profileInfo}</Text>
        <InfoRow label={labels.name} value={user?.name} />
        <InfoRow label={labels.username} value={usernameHandle} />
        <InfoRow label={labels.role} value={roleName || labels.profileFallback} />
        <InfoRow label={labels.summary} value={profileSubtitle} />
        {roleName === "Student" && <InfoRow label={labels.classLabel} value={studentGradeSection?.key} />}
        {roleName === "Teacher" && (
          <InfoRow label={labels.assignedSubjects} value={String(teacherCourses.length)} />
        )}
        <InfoRow label={labels.phone} value={user?.phone} />
        <InfoRow label={labels.email} value={user?.email} />
      </View>

      {roleName === "Student" && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{labels.classOverview}</Text>
          <InfoRow label={labels.todayLabel} value={getDayLabel(selectedScheduleDay || "Monday", labels)} />
          <InfoRow label={labels.plannedPeriods} value={String(selectedDaySummary.total)} />
          <InfoRow label={labels.classes} value={String(selectedDaySummary.classCount)} />
          <InfoRow label={labels.freePeriods} value={String(selectedDaySummary.freeCount)} />
          <InfoRow label={labels.teachers} value={String(teachers.length)} />
          <InfoRow label={labels.parents} value={String(parents.length)} />
        </View>
      )}

      {roleName === "Teacher" && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{labels.teachingOverview}</Text>
          <InfoRow label={labels.assignedSubjects} value={String(teacherCourses.length)} />
          <InfoRow label={labels.firstSubject} value={teacherCourses[0]?.subject} />
          <InfoRow
            label={labels.primaryClass}
            value={
              teacherCourses[0]
                ? `${labels.grade} ${teacherCourses[0].grade} • ${labels.section} ${teacherCourses[0].section}`
                : null
            }
          />
        </View>
      )}

    </>
  );

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={PALETTE.accent} />
        <Text style={styles.loadingText}>{labels.loadingProfile}</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.loadingWrap}>
        <Ionicons name="person-circle-outline" size={56} color={PALETTE.offline} />
        <Text style={styles.loadingTitle}>{labels.profileUnavailable}</Text>
        <Text style={styles.loadingText}>{labels.profileUnavailableBody}</Text>
        <TouchableOpacity style={styles.emptyBackBtn} onPress={handleBack} activeOpacity={0.88}>
          <Text style={styles.emptyBackText}>{labels.backToDashboard}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle={statusBarStyle} />

      {showMenu && (
        <>
          <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setShowMenu(false)} />
          <View style={[styles.dropdownMenu, { top: insets.top + 52 }]}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={async () => {
                setShowMenu(false);
                await handleShare();
              }}
            >
              <Text style={styles.menuText}>{labels.share}</Text>
            </TouchableOpacity>
            {!isSelfProfile && (
              <TouchableOpacity
                style={[styles.menuItem, styles.menuItemNoBorder]}
                onPress={async () => {
                  setShowMenu(false);
                  await handleReport();
                }}
              >
                <Text style={[styles.menuText, { color: "#F59E0B" }]}>{labels.reportUser}</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}

      <View style={styles.contentWrap}>
        <View style={styles.heroCard}>
          <View style={[styles.heroBanner, { height: 110 + insets.top }]}> 
            <View style={styles.heroBannerFallback}>
              <View style={styles.heroBannerOrbPrimary} />
              <View style={styles.heroBannerOrbSecondary} />
            </View>
            <View style={styles.heroBannerOverlay} />

            <View style={[styles.heroTopBar, { top: insets.top + 6 }]}> 
              <TouchableOpacity style={styles.heroTopIconBtn} onPress={handleBack}>
                <Ionicons name="chevron-back" size={20} color={PALETTE.white} />
              </TouchableOpacity>

              <View style={styles.heroTopActions}>
                <TouchableOpacity style={styles.heroTopIconBtn} onPress={() => setShowMenu((value) => !value)}>
                  <Ionicons name="ellipsis-horizontal" size={18} color={PALETTE.white} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.heroAvatarSlot}>
            <View style={styles.avatarWrap}>
              <View style={styles.photoCard}>
                <View style={styles.photoCardImageClip}>
                  <AppImage
                    uri={user.profileImage || defaultProfile}
                    fallbackSource={require("../assets/images/avatar_placeholder.png")}
                    style={styles.photoCardImage}
                  />
                </View>
              </View>
            </View>
          </View>

          <View style={styles.heroIdentityBlock}>
            <View style={styles.identityTopRow}>
              <Text style={styles.name} numberOfLines={1}>
                {user.name || labels.profileFallback}
              </Text>
            </View>

            <View style={styles.subRow}>
              {!!usernameHandle && <Text style={styles.subText}>{usernameHandle}</Text>}
              <MiniPill icon={heroRoleIcon} text={roleName || labels.profileFallback} compact />
              {!!heroSecondaryMeta && <MiniPill icon={heroSecondaryIcon} text={heroSecondaryMeta} compact />}
            </View>

            <TouchableOpacity style={styles.editProfileBtn} onPress={handlePrimaryAction} activeOpacity={0.88}>
              <Text style={styles.editProfileText}>{primaryActionLabel}</Text>
            </TouchableOpacity>

            <View style={styles.profileFilterRow}>
              <TouchableOpacity
                style={[
                  styles.profileFilterBtn,
                  profileSectionTab === "main" && styles.profileFilterBtnActive,
                ]}
                onPress={() => setProfileSectionTab("main")}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.profileFilterText,
                    profileSectionTab === "main" && styles.profileFilterTextActive,
                  ]}
                >
                  {labels.main}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.profileFilterBtn,
                  profileSectionTab === "info" && styles.profileFilterBtnActive,
                ]}
                onPress={() => setProfileSectionTab("info")}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.profileFilterText,
                    profileSectionTab === "info" && styles.profileFilterTextActive,
                  ]}
                >
                  {labels.info}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <ScrollView
          style={styles.sectionScroll}
          contentContainerStyle={[
            styles.sectionScrollContent,
            { paddingBottom: Math.max(88, insets.bottom + 64) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {profileSectionTab === "main" ? renderMainSection() : renderInfoSection()}
        </ScrollView>
      </View>

      <Modal
        visible={scheduleSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={closeScheduleSheet}
      >
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={closeScheduleSheet} />

          <View style={[styles.sheetContainer, { paddingBottom: Math.max(insets.bottom, 18) }]}> 
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderInfo}>
                <Text style={styles.sheetTitle}>{labels.classSchedule}</Text>
                <Text style={styles.sheetSub}>
                  {labels.grade} {studentGradeSection?.grade || "--"} • {labels.section} {studentGradeSection?.section || "--"}
                </Text>
              </View>

              <TouchableOpacity style={styles.sheetCloseButton} onPress={closeScheduleSheet}>
                <Ionicons name="close" size={18} color={PALETTE.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {WEEK_DAYS.map((day) => {
                const entries = studentWeeklySchedule?.[day] || [];
                const isToday = day === todayName;
                const isExpanded = !!expandedScheduleDays[day];

                return (
                  <View key={day} style={[styles.daySection, isToday && styles.daySectionToday]}>
                    <TouchableOpacity
                      activeOpacity={0.9}
                      style={[styles.daySectionHeader, isExpanded && styles.daySectionHeaderExpanded]}
                      onPress={() => toggleScheduleDay(day)}
                    >
                      <View style={styles.daySectionHeaderLeft}>
                        <View style={styles.dayHeaderIconWrap}>
                          <Ionicons name="calendar-clear-outline" size={14} color={PALETTE.accent} />
                        </View>
                        <Text style={styles.daySectionTitle}>{getDayLabel(day, labels)}</Text>
                        {isToday ? (
                          <View style={styles.todayPill}>
                            <Text style={styles.todayPillText}>{labels.todayPill}</Text>
                          </View>
                        ) : null}
                      </View>

                      <View style={styles.daySectionHeaderRight}>
                        <View style={styles.dayCountPill}>
                          <Text style={styles.dayCountPillText}>
                            {labels.classCountText(entries.length)}
                          </Text>
                        </View>
                        <View style={[styles.dayChevronWrap, isExpanded && styles.dayChevronWrapActive]}>
                          <Ionicons
                            name={isExpanded ? "chevron-up" : "chevron-down"}
                            size={16}
                            color={PALETTE.accent}
                          />
                        </View>
                      </View>
                    </TouchableOpacity>

                    {isExpanded ? (
                      entries.length ? (
                        <View style={styles.daySectionBody}>
                          {entries.map((item) => (
                            <View key={`${day}-${item.periodName}`} style={styles.periodRow}>
                              <View style={styles.periodBadge}>
                                <Text style={styles.periodBadgeText}>{item.periodName}</Text>
                              </View>

                              <View style={styles.periodContent}>
                                <Text style={styles.periodSubject}>{item.subject === "Free Period" ? labels.freePeriod : item.subject || labels.freePeriod}</Text>
                                <View style={styles.periodTeacherRow}>
                                  <Ionicons name="person-outline" size={12} color={PALETTE.muted} />
                                  <Text numberOfLines={1} ellipsizeMode="tail" style={styles.periodTeacher}>
                                    {item.teacherName === "Unassigned" ? labels.unassigned : item.teacherName || labels.unassigned}
                                  </Text>
                                </View>
                              </View>

                              <View style={styles.periodArrowWrap}>
                                <Ionicons name="chevron-forward" size={14} color={PALETTE.accent} />
                              </View>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.dayEmptyText}>{labels.noPeriodsScheduled}</Text>
                      )
                    ) : (
                      <Text style={styles.dayCollapsedHint}>
                        {entries.length
                          ? labels.tapToViewPeriods(entries.length)
                          : labels.tapToViewDay}
                      </Text>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MiniPill({ icon, text, compact = false }) {
  const { PALETTE, styles } = useUserProfileThemeConfig();

  return (
    <View style={[styles.miniPill, compact && styles.miniPillCompact]}>
      <Ionicons name={icon} size={compact ? 10 : 13} color={compact ? PALETTE.accent : "#F8FAFC"} />
      <Text style={[styles.miniPillText, compact && styles.miniPillTextCompact]}>{text}</Text>
    </View>
  );
}

function InfoRow({ label, value }) {
  const { styles } = useUserProfileThemeConfig();

  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function PersonRow({ name, subtitle, extra, image, onPress, onMessage }) {
  const { PALETTE, styles } = useUserProfileThemeConfig();

  return (
    <TouchableOpacity style={styles.childCard} onPress={onPress} activeOpacity={0.88}>
      <AppImage
        uri={image || defaultProfile}
        fallbackSource={require("../assets/images/avatar_placeholder.png")}
        style={styles.childImage}
      />
      <View style={styles.childBody}>
        <Text style={styles.childName}>{name}</Text>
        {!!subtitle && <Text style={styles.childMeta}>{subtitle}</Text>}
        {!!extra && <Text style={styles.childMeta}>{extra}</Text>}
      </View>

      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {onMessage && (
          <TouchableOpacity style={styles.msgBtn} onPress={onMessage}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={PALETTE.accent} />
          </TouchableOpacity>
        )}
        <Ionicons name="chevron-forward" size={18} color="#8EA1B5" />
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (PALETTE) => StyleSheet.create({
  container: { flex: 1, backgroundColor: PALETTE.background },

  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: PALETTE.background,
  },
  loadingText: {
    marginTop: 10,
    color: PALETTE.muted,
    fontSize: 14,
    fontWeight: "600",
  },
  loadingTitle: {
    marginTop: 12,
    color: PALETTE.text,
    fontSize: 18,
    fontWeight: "800",
  },
  emptyBackBtn: {
    marginTop: 18,
    backgroundColor: PALETTE.accent,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 10,
  },
  emptyBackText: {
    color: PALETTE.white,
    fontSize: 13,
    fontWeight: "700",
  },

  heroCard: {
    marginHorizontal: -14,
    backgroundColor: PALETTE.card,
    marginBottom: 4,
    overflow: "hidden",
  },
  heroBanner: {
    backgroundColor: PALETTE.heroSurface,
    position: "relative",
    overflow: "hidden",
  },
  heroBannerFallback: {
    flex: 1,
    backgroundColor: PALETTE.heroSurface,
    overflow: "hidden",
  },
  heroBannerOrbPrimary: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: PALETTE.heroOrbPrimary,
    top: -40,
    right: -20,
  },
  heroBannerOrbSecondary: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: PALETTE.heroOrbSecondary,
    bottom: -60,
    left: -20,
  },
  heroBannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },
  heroTopBar: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroTopActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  heroTopIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PALETTE.heroTopButton,
    borderWidth: 1,
    borderColor: PALETTE.heroTopBorder,
  },
  heroQuickStats: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
  },
  miniPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: PALETTE.heroPillBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: PALETTE.heroPillBorder,
  },
  miniPillCompact: {
    backgroundColor: PALETTE.accentSoft,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderColor: PALETTE.border,
  },
  miniPillText: {
    marginLeft: 5,
    color: PALETTE.heroPillText,
    fontSize: 11,
    fontWeight: "700",
  },
  miniPillTextCompact: {
    marginLeft: 3,
    fontSize: 9,
    color: PALETTE.accent,
  },
  heroAvatarSlot: {
    paddingHorizontal: 18,
    marginTop: -44,
  },
  avatarWrap: {
    position: "relative",
    alignSelf: "flex-start",
  },
  heroIdentityBlock: {
    marginTop: -6,
    marginHorizontal: 14,
    paddingHorizontal: 4,
    paddingVertical: 2,
    paddingBottom: 14,
  },
  identityTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  name: {
    fontSize: 21,
    fontWeight: "800",
    color: PALETTE.text,
  },
  subRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  subText: {
    fontSize: 11,
    color: PALETTE.muted,
    fontWeight: "600",
    marginRight: 2,
  },
  editProfileBtn: {
    marginTop: 10,
    width: "100%",
    backgroundColor: PALETTE.purpleAction,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  editProfileText: {
    color: PALETTE.white,
    fontSize: 13,
    fontWeight: "700",
  },
  profileFilterRow: {
    flexDirection: "row",
    backgroundColor: "#F8FBFF",
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 12,
    padding: 4,
    marginTop: 10,
  },
  profileFilterBtn: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  profileFilterBtnActive: {
    backgroundColor: PALETTE.card,
    borderWidth: 1,
    borderColor: PALETTE.accent,
  },
  profileFilterText: {
    fontSize: 13,
    fontWeight: "700",
    color: PALETTE.muted,
  },
  profileFilterTextActive: {
    color: PALETTE.text,
  },

  topActionsRow: {
    position: "absolute",
    left: 12,
    right: 12,
    height: 44,
    zIndex: 150,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PALETTE.topIconSurface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: PALETTE.topIconBorder,
  },

  compactCenter: {
    position: "absolute",
    left: 56,
    right: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  compactAvatar: {
    width: MINI_AVATAR,
    height: MINI_AVATAR,
    borderRadius: 9,
    marginRight: 8,
    borderWidth: 1.5,
    borderColor: PALETTE.heroSurface,
  },
  compactName: {
    color: PALETTE.white,
    fontSize: 14,
    fontWeight: "700",
    maxWidth: 160,
  },
  compactSub: {
    color: PALETTE.heroSubtleText,
    fontSize: 11,
    marginTop: 1,
  },

  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: PALETTE.heroSurface,
    zIndex: 10,
    overflow: "hidden",
  },
  headerBgImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  headerBgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: PALETTE.overlayStrong,
  },

  heroWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 12,
    flexDirection: "row",
    alignItems: "flex-end",
  },

  photoCard: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: "visible",
    borderWidth: 4,
    borderColor: PALETTE.heroSurface,
    backgroundColor: PALETTE.card,
    shadowColor: PALETTE.shadowBlue,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 4,
  },
  photoCardImageClip: {
    width: "100%",
    height: "100%",
    borderRadius: 44,
    overflow: "hidden",
  },
  photoCardImage: {
    width: "100%",
    height: "100%",
  },

  identitySide: {
    flex: 1,
    marginLeft: 12,
    alignSelf: "flex-end",
    justifyContent: "flex-end",
  },
  identityCard: {
    alignSelf: "flex-start",
    backgroundColor: PALETTE.heroTopButton,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PALETTE.heroTopBorder,
    paddingVertical: 12,
    paddingHorizontal: 12,
    minWidth: "76%",
    maxWidth: "100%",
  },
  identityName: {
    color: PALETTE.white,
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  identityUsername: {
    color: PALETTE.heroSubtleText,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 3,
  },
  identityRole: {
    color: PALETTE.heroSubtleText,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 8,
  },

  contentWrap: {
    flex: 1,
    paddingHorizontal: 14,
    gap: 4,
  },
  sectionScroll: {
    flex: 1,
  },
  sectionScrollContent: {
    gap: 4,
  },

  quickActions: {
    backgroundColor: PALETTE.card,
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    shadowColor: "rgba(15,23,42,0.03)",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  quickActionItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PALETTE.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: PALETTE.text,
  },

  card: {
    backgroundColor: PALETTE.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: PALETTE.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: PALETTE.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: PALETTE.text,
    marginBottom: 10,
  },

  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 16,
    backgroundColor: PALETTE.card,
    marginBottom: 10,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: PALETTE.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  iconWrapDanger: {
    backgroundColor: PALETTE.dangerSoft,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: PALETTE.text,
  },
  actionTitleDanger: {
    color: PALETTE.danger,
  },
  actionSub: {
    fontSize: 12,
    color: PALETTE.muted,
    marginTop: 2,
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.line,
  },
  infoLabel: {
    color: PALETTE.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  infoValue: {
    color: PALETTE.text,
    fontSize: 13,
    fontWeight: "700",
    maxWidth: "64%",
    textAlign: "right",
  },

  childCard: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    paddingVertical: 10,
    paddingHorizontal: 11,
    backgroundColor: PALETTE.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PALETTE.borderSoft,
    shadowColor: PALETTE.shadowSoft,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  childImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  childBody: { flex: 1, marginLeft: 10 },
  childName: {
    fontSize: 14,
    fontWeight: "700",
    color: PALETTE.text,
  },
  childMeta: {
    fontSize: 11.5,
    color: PALETTE.muted,
    marginTop: 1,
  },

  noteStateCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.cardMuted,
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  noteStateText: {
    marginTop: 8,
    fontSize: 12,
    color: PALETTE.muted,
    fontWeight: "600",
  },

  accountItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.border,
  },
  accountItemNoBorder: {
    borderBottomWidth: 0,
  },
  accountIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  accountText: {
    fontSize: 15,
    marginLeft: 11,
    flex: 1,
    color: PALETTE.text,
    fontWeight: "650",
  },

  msgBtn: {
    marginRight: 8,
    padding: 6,
    borderRadius: 999,
    backgroundColor: PALETTE.badgeSurface,
  },

  subjectRow: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: PALETTE.surfaceMuted,
    borderWidth: 1,
    borderColor: PALETTE.border,
    marginTop: 8,
  },
  subjectName: { fontSize: 14, color: PALETTE.text, fontWeight: "700" },
  subjectMeta: { fontSize: 12.5, color: PALETTE.muted, marginTop: 3 },

  scheduleCard: {
    backgroundColor: PALETTE.inputBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PALETTE.border,
    padding: 14,
  },
  scheduleTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  scheduleIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: PALETTE.accentSoft,
    borderWidth: 1,
    borderColor: PALETTE.borderSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  scheduleTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: PALETTE.text,
  },
  scheduleSub: {
    marginTop: 2,
    fontSize: 12,
    color: PALETTE.muted,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: PALETTE.overlay,
  },
  sheetBackdrop: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: PALETTE.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 10,
    maxHeight: "84%",
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: PALETTE.border,
    shadowColor: PALETTE.shadowBlue,
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 6,
  },
  sheetHandle: {
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: PALETTE.border,
    alignSelf: "center",
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  sheetHeaderInfo: {
    flex: 1,
    paddingRight: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: PALETTE.text,
  },
  sheetSub: {
    marginTop: 2,
    color: PALETTE.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  sheetCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: PALETTE.inputBackground,
    borderWidth: 1,
    borderColor: PALETTE.border,
    alignItems: "center",
    justifyContent: "center",
  },
  daySection: {
    marginBottom: 14,
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 16,
    padding: 12,
    backgroundColor: PALETTE.card,
  },
  daySectionToday: {
    backgroundColor: PALETTE.inputBackground,
    borderColor: PALETTE.accent,
  },
  daySectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  daySectionHeaderExpanded: {
    backgroundColor: PALETTE.inputBackground,
  },
  daySectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  dayHeaderIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: PALETTE.accentSoft,
    borderWidth: 1,
    borderColor: PALETTE.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  daySectionHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 10,
  },
  daySectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: PALETTE.text,
  },
  todayPill: {
    marginLeft: 8,
    backgroundColor: PALETTE.accentSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  todayPillText: {
    color: PALETTE.accent,
    fontSize: 11,
    fontWeight: "800",
  },
  dayCountPill: {
    backgroundColor: PALETTE.accentSoft,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
  },
  dayCountPillText: {
    color: PALETTE.accent,
    fontSize: 10,
    fontWeight: "800",
  },
  dayChevronWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.card,
    alignItems: "center",
    justifyContent: "center",
  },
  dayChevronWrapActive: {
    backgroundColor: PALETTE.accentSoft,
    borderColor: PALETTE.accent,
  },
  daySectionBody: {
    marginTop: 10,
  },
  dayCollapsedHint: {
    marginTop: 8,
    color: PALETTE.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  periodRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: PALETTE.borderSoft,
    borderRadius: 14,
    backgroundColor: PALETTE.card,
  },
  periodBadge: {
    minWidth: 66,
    backgroundColor: PALETTE.accentSoft,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 7,
    marginRight: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  periodBadgeText: {
    color: PALETTE.accent,
    fontSize: 11,
    fontWeight: "800",
  },
  periodContent: {
    flex: 1,
  },
  periodSubject: {
    fontSize: 14,
    fontWeight: "800",
    color: PALETTE.text,
  },
  periodTeacherRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  periodTeacher: {
    marginLeft: 5,
    flex: 1,
    fontSize: 10,
    color: PALETTE.muted,
    fontWeight: "500",
  },
  periodArrowWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.inputBackground,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  dayEmptyText: {
    fontSize: 13,
    color: PALETTE.muted,
    fontWeight: "600",
  },

  dropdownMenu: {
    position: "absolute",
    right: 10,
    backgroundColor: PALETTE.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PALETTE.border,
    zIndex: 1000,
    minWidth: 205,
    overflow: "hidden",
  },
  menuOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
    zIndex: 999,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.line,
  },
  menuItemNoBorder: { borderBottomWidth: 0 },
  menuText: {
    fontSize: 15,
    color: PALETTE.text,
    fontWeight: "600",
  },

});