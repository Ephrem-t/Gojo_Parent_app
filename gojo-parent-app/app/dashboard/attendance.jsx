import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  RefreshControl,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ref, get } from "firebase/database";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import moment from "moment";
import Svg, { Circle } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { database } from "../../constants/firebaseConfig";
import { getLinkedChildrenForParent } from "../lib/parentChildren";
import { readCachedJsonRecord, writeCachedJson } from "../lib/dataCache";
import { isInternetReachableNow } from "../lib/networkGuard";
import { queryUserByChildInSchool } from "../lib/userHelpers";
import AppImage from "../../components/ui/AppImage";
import { AttendanceScreenSkeleton } from "../../components/ui/AppSkeletons";
import { useParentTheme } from "../../hooks/use-parent-theme";

const makePalette = (colors, isDark) => ({
  background: colors.background,
  card: colors.card,
  cardMuted: colors.cardMuted,
  surfaceMuted: colors.surfaceMuted,
  accent: colors.primary,
  accentDark: colors.primaryDark,
  accentSoft: colors.primarySoft,
  text: colors.text,
  muted: colors.muted,
  mutedAlt: colors.mutedAlt,
  border: colors.border,
  borderSoft: colors.borderSoft,
  borderStrong: colors.borderStrong,
  present: isDark ? colors.primaryDark : "#2563EB",
  late: colors.warning,
  absent: colors.offline,
  ringTrack: colors.borderSoft,
  heroGradientStart: colors.heroSurface,
  heroGradientMid: colors.cardMuted,
  heroGradientEnd: colors.primarySoft,
  heroBorder: isDark ? colors.borderStrong : "#DDE8F7",
  heroGlowOne: colors.heroOrbPrimary,
  heroGlowTwo: colors.heroOrbSecondary,
  heroShadow: isDark ? "#000000" : "#9FBFE6",
  avatarBg: colors.avatarPlaceholder,
  metricSurface: isDark ? colors.cardMuted : "rgba(255,255,255,0.74)",
  metricBorder: isDark ? colors.borderStrong : "rgba(220,233,250,0.95)",
  filterTabsBg: isDark ? colors.cardMuted : "#E8EEF9",
  filterTextInactive: colors.mutedAlt,
  indicatorBorder: isDark ? colors.borderStrong : "#BFDBFE",
  activeSurface: isDark ? "#102742" : "#EEF6FF",
  activeBorder: isDark ? colors.borderStrong : "#BFDBFE",
  noRecordSurface: isDark ? colors.surfaceMuted : "#F8FAFC",
  noRecordBorder: isDark ? colors.borderStrong : "#D5DEE9",
  presentSurface: isDark ? "#102742" : "#DBEAFE",
  lateSurface: isDark ? "#3B2A0B" : "#FEF3C7",
  absentSurface: isDark ? "#1F2937" : "#E2E8F0",
  line: colors.line,
  lineStrong: colors.borderSoft,
});

function useAttendanceThemeConfig() {
  const { colors, isDark } = useParentTheme();

  const PALETTE = useMemo(() => makePalette(colors, isDark), [colors, isDark]);
  const styles = useMemo(() => createStyles(PALETTE), [PALETTE]);

  return { PALETTE, styles };
}

const getAttendanceLabels = (amharic) =>
  amharic
    ? {
        loading: "ክትትል በመጫን ላይ...",
        noLinkedTitle: "እስካሁን የተገናኘ ልጅ የለም",
        noLinkedSubtitle: "የልጅ ፕሮፋይልን ለማገናኘት እባክዎ የትምህርት ቤት አስተዳዳሪን ያነጋግሩ።",
        student: "ተማሪ",
        course: "ኮርስ",
        teacher: "መምህር",
        grade: "ክፍል",
        section: "ክፍለ ክፍል",
        overview: "የክትትል አጠቃላይ እይታ",
        present: "ተገኝቷል",
        late: "ዘግይቷል",
        absent: "ቀርቷል",
        daily: "ዕለታዊ",
        weekly: "ሳምንታዊ",
        monthly: "ወርሃዊ",
        chooseChild: "ልጅ ይምረጡ",
        child: "ልጅ",
        total: "ጠቅላላ",
        noRecord: "ምንም መዝገብ የለም",
        noAttendance: "ምንም የክትትል መዝገብ የለም",
        attendance: "ክትትል",
        noCourses: "ለዚህ ተማሪ ኮርሶች እስካሁን አልተገኙም።",
        refreshing: "የቅርብ ጊዜ ክትትል በመዘመን ላይ…",
        statusByKey: {
          present: "ተገኝቷል",
          late: "ዘግይቷል",
          absent: "ቀርቷል",
          noRecord: "ምንም መዝገብ የለም",
        },
      }
    : {
        loading: "Loading attendance...",
        noLinkedTitle: "No child is linked yet",
        noLinkedSubtitle: "Please contact school admin to link child profile.",
        student: "Student",
        course: "Course",
        teacher: "Teacher",
        grade: "Grade",
        section: "Section",
        overview: "Attendance Overview",
        present: "Present",
        late: "Late",
        absent: "Absent",
        daily: "Daily",
        weekly: "Weekly",
        monthly: "Monthly",
        chooseChild: "Choose Child",
        child: "Child",
        total: "Total",
        noRecord: "No Record",
        noAttendance: "No attendance recorded",
        attendance: "Attendance",
        noCourses: "No courses found for this student yet.",
        refreshing: "Refreshing latest attendance…",
        statusByKey: {
          present: "Present",
          late: "Late",
          absent: "Absent",
          noRecord: "No Record",
        },
      };

const defaultProfile = "https://cdn-icons-png.flaticon.com/512/847/847969.png";
const CACHE_KEY = "attendance_cache_v6";
const CACHE_TTL_MS = 30 * 60 * 1000;
const CHILD_BUNDLE_CACHE_TTL_MS = 30 * 60 * 1000;
const RING_SIZE = 58;
const RING_STROKE = 5;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const getPathPrefix = async () => {
  const sk = (await AsyncStorage.getItem("schoolKey")) || null;
  return sk ? `Platform1/Schools/${sk}/` : "";
};

const getAttendanceBundleCacheKey = (prefix, studentId) =>
  `cache:attendance:bundle:${String(prefix || "root")}:${String(studentId || "unknown")}`;

const normalizeKey = (value) => String(value || "").trim().toLowerCase();

const statusColor = (status, PALETTE) => {
  switch (String(status || "").toLowerCase()) {
    case "present":
      return PALETTE.present;
    case "late":
      return PALETTE.late;
    case "absent":
      return PALETTE.absent;
    default:
      return PALETTE.muted;
  }
};

const statusIcon = (status) => {
  switch (String(status || "").toLowerCase()) {
    case "present":
      return "checkmark-circle";
    case "late":
      return "time";
    case "absent":
      return "remove-circle";
    default:
      return "ellipse";
  }
};

const percentColor = (p, PALETTE) => {
  if (p >= 75) return PALETTE.accentDark;
  if (p >= 50) return PALETTE.accent;
  return PALETTE.absent;
};

const ProgressRing = ({ percent, color, label }) => {
  const { PALETTE, styles } = useAttendanceThemeConfig();
  const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
  const dashOffset = RING_CIRCUMFERENCE - (RING_CIRCUMFERENCE * safePercent) / 100;

  return (
    <View style={styles.ringWrap}>
      <Svg width={RING_SIZE} height={RING_SIZE} style={styles.ringSvg}>
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke={PALETTE.ringTrack}
          strokeWidth={RING_STROKE}
          fill="none"
        />
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke={color}
          strokeWidth={RING_STROKE}
          fill="none"
          strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
        />
      </Svg>

      <View style={styles.ringCenter}>
        <Text style={[styles.ringPercent, { color }]}>{label ?? `${safePercent}%`}</Text>
      </View>
    </View>
  );
};

export default function Attendance() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { amharic, oromo } = useParentTheme();
  const { PALETTE, styles } = useAttendanceThemeConfig();
  const labels = useMemo(
    () =>
      oromo
        ? {
            ...getAttendanceLabels(false),
            loading: "Argama fe'aa jira...",
            noLinkedTitle: "Ijoolleen walqabatan hin jiran",
            noLinkedSubtitle: "Profaayilii ijoollee walqabsiisuuf bulchaa mana barumsaa qunnami.",
            student: "Barataa",
            course: "Koorsii",
            teacher: "Barsiisaa",
            grade: "Kutaa",
            section: "Kutaa xiqqaa",
            overview: "Ilaalcha Argamaa",
            present: "Argame",
            late: "Barfate",
            absent: "Hin argamne",
            daily: "Guyyaa",
            weekly: "Torban",
            monthly: "Ji'a",
            chooseChild: "Ijoollee filadhu",
            child: "Ijoollee",
            total: "Waliigala",
            noRecord: "Galmeen hin jiru",
            noAttendance: "Galmeen argamaa hin jiru",
            attendance: "Argama",
            noCourses: "Koorsiin barataa kanaaf hin argamne.",
            refreshing: "Argama haarawa deebi'ee fe'aa jira…",
            statusByKey: {
              present: "Argame",
              late: "Barfate",
              absent: "Hin argamne",
              noRecord: "Galmeen hin jiru",
            },
          }
        : getAttendanceLabels(amharic),
    [amharic, oromo]
  );
  const scale = width < 360 ? 0.92 : width >= 768 ? 1.08 : 1;
  const fontScale = width < 360 ? 0.92 : width >= 768 ? 1.08 : 1;
  const avatarSize = Math.round(72 * scale);

  const contentStyle = useMemo(
    () => ({
      padding: 14,
      paddingBottom: 110 + insets.bottom,
    }),
    [insets.bottom]
  );

  const [parentId, setParentId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [backgroundRefreshing, setBackgroundRefreshing] = useState(false);

  const [children, setChildren] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showChildPicker, setShowChildPicker] = useState(false);

  const [childUser, setChildUser] = useState(null);
  const [courses, setCourses] = useState([]);
  const [attendanceByCourse, setAttendanceByCourse] = useState({});
  const [expandedCourses, setExpandedCourses] = useState({});

  const [tab, setTab] = useState("daily");
  const tabOptions = useMemo(() => ["daily", "weekly", "monthly"], []);
  const tabAnim = useRef(new Animated.Value(0)).current;
  const [tabWidthState, setTabWidthState] = useState(0);

  const shimmerAnim = useRef(new Animated.Value(-140)).current;

  useEffect(() => {
    (async () => {
      const id = await AsyncStorage.getItem("parentId");
      setParentId(id || null);
    })();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 240,
          duration: 1100,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: -140,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);

  useEffect(() => {
    const target = tabOptions.indexOf(tab);
    Animated.spring(tabAnim, {
      toValue: target,
      useNativeDriver: true,
      stiffness: 140,
      damping: 18,
      mass: 0.6,
    }).start();
  }, [tab, tabAnim, tabOptions]);

  const saveCache = async (payload) => {
    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    } catch {}
  };

  const loadCache = async () => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const fetchChildBundle = useCallback(async ({ prefix, studentId, childInfo, forceNetwork = false }) => {
    const cacheKey = getAttendanceBundleCacheKey(prefix, studentId);
    const cachedRecord = await readCachedJsonRecord(cacheKey);
    const cachedBundle = cachedRecord?.value || null;
    const cacheFresh = cachedRecord
      ? Date.now() - cachedRecord.savedAt <= CHILD_BUNDLE_CACHE_TTL_MS
      : false;

    if (!forceNetwork && cachedBundle && cacheFresh) {
      return cachedBundle;
    }

    const onlineNow = await isInternetReachableNow();
    if (!onlineNow) {
      return cachedBundle;
    }

    try {
      const studentSnap = await get(ref(database, `${prefix}Students/${studentId}`));
      const student = studentSnap.exists() ? studentSnap.val() : null;
      if (!student) return cachedBundle;

      const studentUserId = student.userId || student.systemAccountInformation?.userId || null;
      let user = {};
      if (studentUserId) {
        try {
          const studentUserSnap = await queryUserByChildInSchool("userId", studentUserId);
          if (studentUserSnap?.exists()) {
            studentUserSnap.forEach((childSnap) => {
              user = childSnap.val() || {};
              return true;
            });
          }
        } catch {}
      }

      const grade = String(student.grade || student.basicStudentInformation?.grade || "");
      const section = String(student.section || student.basicStudentInformation?.section || "");

      const childUserObj = {
        ...user,
        studentId,
        grade: grade || "--",
        section: section || "--",
        name:
          user?.name ||
          student?.name ||
          student?.basicStudentInformation?.name ||
          childInfo?.name ||
          labels.student,
        profileImage: user?.profileImage || student?.profileImage || student?.basicStudentInformation?.studentPhoto || defaultProfile,
        _childInfo: childInfo,
      };

      const [gradeNodeSnap, usersSnap] = await Promise.all([
        get(ref(database, `${prefix}GradeManagement/grades/${grade}`)),
        get(ref(database, `${prefix}Users`)),
      ]);

      const usersData = usersSnap.exists() ? usersSnap.val() : {};
      const gradeNode = gradeNodeSnap.exists() ? gradeNodeSnap.val() : {};

      const sectionNode = gradeNode?.sections?.[section] || {};
      const sectionCoursesMap = sectionNode?.courses || {};
      const sectionTeacherMap = gradeNode?.sectionSubjectTeachers?.[section] || {};
      const gradeSubjectsMap = gradeNode?.subjects || {};

      const courseIdSet = new Set();

      Object.keys(sectionCoursesMap || {}).forEach((cid) => {
        if (sectionCoursesMap[cid]) courseIdSet.add(cid);
      });

      Object.values(sectionTeacherMap || {}).forEach((assignment) => {
        if (assignment?.courseId) courseIdSet.add(assignment.courseId);
      });

      const teacherEntries = Object.entries(sectionTeacherMap || {});
      const teacherMapByCourseId = {};
      const teacherMapBySubjectKey = {};

      teacherEntries.forEach(([subjectKey, assignment]) => {
        if (assignment?.courseId) {
          teacherMapByCourseId[assignment.courseId] = {
            subjectKey,
            ...assignment,
          };
        }

        teacherMapBySubjectKey[normalizeKey(subjectKey)] = {
          subjectKey,
          ...assignment,
        };

        if (assignment?.subject) {
          teacherMapBySubjectKey[normalizeKey(assignment.subject)] = {
            subjectKey,
            ...assignment,
          };
        }
      });

      const courseIds = Array.from(courseIdSet);

      const courseList = courseIds.map((courseId) => {
        const directAssignment = teacherMapByCourseId[courseId] || null;

        let inferredSubjectKey = null;
        if (!directAssignment) {
          const parts = String(courseId).split("_");
          if (parts.length >= 2) {
            inferredSubjectKey = normalizeKey(parts[1]);
          }
        }

        const inferredAssignment =
          (!directAssignment && inferredSubjectKey && teacherMapBySubjectKey[inferredSubjectKey]) || null;

        const assignment = directAssignment || inferredAssignment || null;

        const subjectKey = assignment?.subjectKey
          ? normalizeKey(assignment.subjectKey)
          : assignment?.subject
          ? normalizeKey(assignment.subject)
          : inferredSubjectKey;

        const subjectNode = subjectKey ? gradeSubjectsMap?.[subjectKey] || null : null;
        const teacherUser = assignment?.teacherUserId
          ? usersData?.[assignment.teacherUserId] || null
          : null;

        const fallbackNameFromCourseId = String(courseId)
          .replace(/^course_/, "")
          .replace(/_[^_]+$/, "")
          .replace(/_/g, " ");

        const courseDisplayName =
          subjectNode?.name ||
          assignment?.subject ||
          fallbackNameFromCourseId ||
          labels.course;

        return {
          courseId,
          name: courseDisplayName,
          subject: subjectNode?.name || assignment?.subject || courseDisplayName,
          grade,
          section,
          teacherId: assignment?.teacherId || null,
          teacherUserId: assignment?.teacherUserId || null,
          teacherName: assignment?.teacherName || teacherUser?.name || labels.teacher,
        };
      });

      const attendanceMap = {};

      await Promise.all(
        courseList.map(async (course) => {
          try {
            const attendanceSnap = await get(ref(database, `${prefix}Attendance/${course.courseId}`));
            const byDate = attendanceSnap.exists() ? attendanceSnap.val() : {};
            const studentOnly = {};

            Object.entries(byDate).forEach(([date, studentsMap]) => {
              const record = studentsMap?.[studentId];
              if (record) studentOnly[date] = record;
            });

            attendanceMap[course.courseId] = studentOnly;
          } catch {
            attendanceMap[course.courseId] = {};
          }
        })
      );

      const bundle = {
        childUser: childUserObj,
        courses: courseList,
        attendanceByCourse: attendanceMap,
      };

      writeCachedJson(cacheKey, bundle).catch(() => {});
      return bundle;
    } catch (e) {
      console.warn("fetchChildBundle error:", e);
      return cachedBundle || null;
    }
  }, [labels]);

  const applyBundleToState = useCallback(
    async (bundle, index, kids) => {
      setCurrentIndex(index);
      setChildUser(bundle?.childUser || null);
      setCourses(bundle?.courses || []);
      setAttendanceByCourse(bundle?.attendanceByCourse || {});

      await saveCache({
        parentId,
        children: kids || [],
        currentIndex: index || 0,
        childUser: bundle?.childUser || null,
        courses: bundle?.courses || [],
        attendanceByCourse: bundle?.attendanceByCourse || {},
        tab,
        ts: Date.now(),
      });
    },
    [parentId, tab]
  );

  const loadFreshData = useCallback(
    async ({ background = false, forcedIndex = null, forceNetwork = false } = {}) => {
      if (!parentId) {
        setLoading(false);
        return;
      }

      if (background) setBackgroundRefreshing(true);
      else setRefreshing(true);

      try {
        const prefix = await getPathPrefix();
        const kids = await getLinkedChildrenForParent(prefix, parentId, forceNetwork ? { forceNetwork: true } : {});

        setChildren(kids);

        if (!kids.length) {
          setChildUser(null);
          setCourses([]);
          setAttendanceByCourse({});
          setLoading(false);
          return;
        }

        let idx = 0;
        if (typeof forcedIndex === "number" && kids[forcedIndex]) idx = forcedIndex;
        else if (kids[currentIndex]) idx = currentIndex;

        const chosen = kids[idx];
        const bundle = await fetchChildBundle({
          prefix,
          studentId: chosen.studentId,
          childInfo: chosen,
          forceNetwork,
        });

        if (!bundle) {
          setLoading(false);
          return;
        }

        await applyBundleToState(bundle, idx, kids);
        setLoading(false);
      } catch (e) {
        console.warn("Attendance load error:", e);
        setLoading(false);
      } finally {
        setRefreshing(false);
        setBackgroundRefreshing(false);
      }
    },
    [parentId, currentIndex, fetchChildBundle, applyBundleToState]
  );

  const loadFreshDataRef = useRef(loadFreshData);

  useEffect(() => {
    loadFreshDataRef.current = loadFreshData;
  }, [loadFreshData]);

  useEffect(() => {
    if (parentId === null) return;

    let mounted = true;

    (async () => {
      const cached = await loadCache();
      const cacheMatchesParent = cached && String(cached.parentId || "") === String(parentId || "");
      const cacheFresh = cacheMatchesParent
        && Number.isFinite(Number(cached?.ts || 0))
        && Date.now() - Number(cached.ts || 0) <= CACHE_TTL_MS;

      if (cacheMatchesParent && mounted) {
        setChildren(cached.children || []);
        setCurrentIndex(cached.currentIndex || 0);
        setChildUser(cached.childUser || null);
        setCourses(cached.courses || []);
        setAttendanceByCourse(cached.attendanceByCourse || {});
        setTab(cached.tab || "daily");
        setLoading(false);
      }

      if (mounted && !cacheFresh) {
        await loadFreshDataRef.current({ background: true });
      }
    })();

    return () => {
      mounted = false;
    };
  }, [parentId]);

  const switchChild = async (child, index) => {
    try {
      setLoading(true);
      setExpandedCourses({});
      setShowChildPicker(false);

      const prefix = await getPathPrefix();
      const bundle = await fetchChildBundle({
        prefix,
        studentId: child.studentId,
        childInfo: child,
        forceNetwork: false,
      });

      if (!bundle) {
        setLoading(false);
        return;
      }

      await applyBundleToState(bundle, index, children);
    } catch (e) {
      console.warn("switchChild error:", e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    await loadFreshData({ background: false, forceNetwork: true });
  };

  const filteredAttendance = useMemo(() => {
    if (!childUser?.studentId) return {};

    const now = moment();
    const todayKey = now.format("YYYY-MM-DD");

    return courses.reduce((acc, course) => {
      const courseAttendance = attendanceByCourse?.[course.courseId] || {};
      const filtered = {};

      if (tab === "daily") {
        if (courseAttendance[todayKey]) filtered[todayKey] = courseAttendance[todayKey];
      } else {
        Object.entries(courseAttendance).forEach(([date, status]) => {
          const m = moment(date, "YYYY-MM-DD");
          if (
            (tab === "weekly" && m.isSame(now, "week")) ||
            (tab === "monthly" && m.isSame(now, "month"))
          ) {
            filtered[date] = status;
          }
        });
      }

      acc[course.courseId] = filtered;
      return acc;
    }, {});
  }, [attendanceByCourse, courses, tab, childUser?.studentId]);

  const attendanceTotalsAll = useMemo(() => {
    const totals = { present: 0, late: 0, absent: 0 };

    Object.values(attendanceByCourse).forEach((courseAttendance) => {
      Object.values(courseAttendance).forEach((status) => {
        const s = String(status || "").toLowerCase();
        if (s === "present") totals.present += 1;
        else if (s === "late") totals.late += 1;
        else if (s === "absent") totals.absent += 1;
      });
    });

    return totals;
  }, [attendanceByCourse]);

  if (loading && !childUser && !children.length) {
    return <AttendanceScreenSkeleton />;
  }

  if (!children.length) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.emptyTitle}>{labels.noLinkedTitle}</Text>
        <Text style={styles.emptySubtitle}>{labels.noLinkedSubtitle}</Text>
      </View>
    );
  }

  const fixedHeaderCard = (
    <LinearGradient
      colors={[PALETTE.heroGradientStart, PALETTE.heroGradientMid, PALETTE.heroGradientEnd]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.heroCard}
    >
      <View style={styles.heroGlowOne} />
      <View style={styles.heroGlowTwo} />

      <View style={styles.heroTop}>
        <AppImage
          uri={childUser?.profileImage || defaultProfile}
          fallbackSource={require("../../assets/images/avatar_placeholder.png")}
          style={[styles.avatar, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}
        />

        <View style={styles.heroInfo}>
          <Text style={[styles.name, { fontSize: Math.round(20 * fontScale) }]} numberOfLines={1}>
            {childUser?.name || labels.student}
          </Text>
          <Text style={styles.subText}>
            {labels.grade} {childUser?.grade ?? "--"} • {labels.section} {childUser?.section ?? "--"}
          </Text>

          <View style={{ flexDirection: "row", marginTop: 8, alignItems: "center" }}>
            <View style={[styles.statusDot, { backgroundColor: PALETTE.accent }]} />
            <Text style={[styles.statusText, { color: PALETTE.accent }]}>{labels.overview}</Text>
          </View>
        </View>

        {children.length > 1 && (
          <TouchableOpacity onPress={() => setShowChildPicker((s) => !s)} style={styles.switchBtn}>
            <Ionicons name={showChildPicker ? "chevron-up" : "chevron-down"} size={20} color={PALETTE.accent} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.metricGrid}>
        <MetricCard label={labels.present} value={attendanceTotalsAll.present} valueColor={PALETTE.present} />
        <MetricCard label={labels.late} value={attendanceTotalsAll.late} valueColor={PALETTE.late} />
        <MetricCard label={labels.absent} value={attendanceTotalsAll.absent} valueColor={PALETTE.absent} />
      </View>
    </LinearGradient>
  );
  const fixedFilterCard = (
    <View style={styles.stickyTabsWrap}>
      <View
        style={styles.filterTabs}
        onLayout={(e) => setTabWidthState(e.nativeEvent.layout.width)}
      >
        {tabWidthState > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.filterIndicator,
              {
                width: tabWidthState / tabOptions.length,
                transform: [
                  {
                    translateX: Animated.multiply(tabAnim, tabWidthState / tabOptions.length),
                  },
                ],
              },
            ]}
          />
        )}

        {tabOptions.map((t) => {
          const active = tab === t;
          return (
            <TouchableOpacity
              key={t}
              style={styles.filterTab}
              onPress={() => setTab(t)}
              activeOpacity={0.86}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>
                {labels[t]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.fixedHeaderWrap}>{fixedHeaderCard}</View>
      <View style={styles.fixedFilterWrap}>{fixedFilterCard}</View>
      <ScrollView
        contentContainerStyle={contentStyle}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[PALETTE.accent]}
            tintColor={PALETTE.accent}
          />
        }
      >
        {showChildPicker && children.length > 1 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{labels.chooseChild}</Text>
            <View style={styles.childList}>
              {children.map((c, i) => {
                const active = i === currentIndex;
                return (
                  <TouchableOpacity
                    key={c.studentId}
                    style={[styles.childRow, active && styles.childRowActive]}
                    onPress={() => switchChild(c, i)}
                    activeOpacity={0.86}
                  >
                    <Text style={[styles.childName, active && styles.childNameActive]}>
                      {c.name || `${labels.child} ${i + 1}`}
                    </Text>
                    {active && <Ionicons name="checkmark-circle" size={18} color={PALETTE.accent} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        <View style={{ marginTop: 8 }}>
          {courses.map((course) => {
            const courseAttendance = filteredAttendance[course.courseId] || {};
            const entries = Object.entries(courseAttendance).sort(
              (a, b) => moment(b[0]).valueOf() - moment(a[0]).valueOf()
            );

            let attendancePercent = 0;
            let attendedCount = 0;
            if (tab !== "daily") {
              const total = entries.length;
              attendedCount = entries.filter(([, s]) => {
                const st = String(s || "").toLowerCase();
                return st === "present" || st === "late";
              }).length;
              attendancePercent = total > 0 ? Math.round((attendedCount / total) * 100) : 0;
            }

            const isExpanded = !!expandedCourses[course.courseId];
            const dailyStatus = entries[0]?.[1] || null;
            const dailyStatusKey = String(dailyStatus || "").toLowerCase();
            const ringColor = percentColor(attendancePercent, PALETTE);
            const ringValue = attendancePercent;
            const ringLabel = `${attendancePercent}%`;
            const summaryLabel = labels.total;
            const summaryValue = `${attendedCount}/${entries.length}`;
            const summaryColor = ringColor;

            return (
              <View key={course.courseId} style={styles.courseCard}>
                <TouchableOpacity
                  onPress={
                    tab === "daily"
                      ? undefined
                      : () =>
                          setExpandedCourses((prev) => ({ ...prev, [course.courseId]: !prev[course.courseId] }))
                  }
                  activeOpacity={0.86}
                >
                  <View style={styles.courseHead}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={styles.courseName}>{course.name}</Text>
                      <Text style={styles.teacher}>{labels.teacher}: {course.teacherName}</Text>
                    </View>

                    <View style={styles.courseMetaRight}>
                      {tab === "daily" ? (
                        <View
                          style={[
                            styles.dailyStatusPill,
                            dailyStatusKey === "present" && styles.dailyStatusPillPresent,
                            dailyStatusKey === "late" && styles.dailyStatusPillLate,
                            dailyStatusKey === "absent" && styles.dailyStatusPillAbsent,
                          ]}
                        >
                          <Text
                            style={[
                              styles.dailyStatusText,
                              (dailyStatusKey === "present" ||
                                dailyStatusKey === "late" ||
                                dailyStatusKey === "absent") && styles.dailyStatusTextActive,
                            ]}
                          >
                            {dailyStatusKey === "present"
                              ? labels.statusByKey.present
                              : dailyStatusKey === "late"
                              ? labels.statusByKey.late
                              : dailyStatusKey === "absent"
                              ? labels.statusByKey.absent
                              : labels.statusByKey.noRecord}
                          </Text>
                        </View>
                      ) : (
                        <ProgressRing percent={ringValue} color={ringColor} label={ringLabel} />
                      )}
                    </View>
                  </View>
                </TouchableOpacity>

                {tab !== "daily" && isExpanded && (
                  <View style={styles.entriesWrap}>
                    {entries.length === 0 ? (
                      <Text style={styles.noRecords}>{labels.noAttendance}</Text>
                    ) : (
                      entries.map(([date, status]) => {
                        const sc = statusColor(status, PALETTE);
                        const icon = statusIcon(status);
                        const statusKey = String(status || "").toLowerCase();
                        return (
                          <View key={date} style={styles.attRow}>
                            <View style={[styles.statusDotMini, { backgroundColor: sc }]} />
                            <Text style={styles.attDate}>{moment(date).format("DD MMM, ddd")}</Text>
                            <View style={styles.statusWrap}>
                              <Ionicons name={icon} size={16} color={sc} style={{ marginRight: 6 }} />
                              <Text style={[styles.attStatus, { color: sc }]}>
                                {labels.statusByKey[statusKey] || String(status || "").toUpperCase()}
                              </Text>
                            </View>
                          </View>
                        );
                      })
                    )}

                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>{summaryLabel}</Text>
                      <Text style={[styles.summaryValue, { color: summaryColor }]}>{summaryValue}</Text>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {!courses.length && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{labels.attendance}</Text>
            <Text style={styles.emptyQuarterText}>{labels.noCourses}</Text>
          </View>
        )}

        {backgroundRefreshing && !refreshing && (
          <View style={styles.refreshingBgWrap}>
            <Text style={styles.refreshingBgText}>{labels.refreshing}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function MetricCard({ label, value, valueColor }) {
  const { PALETTE, styles } = useAttendanceThemeConfig();

  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color: valueColor ?? PALETTE.text }]}>{value}</Text>
    </View>
  );
}

const createStyles = (PALETTE) => StyleSheet.create({
  container: { flex: 1, backgroundColor: PALETTE.background },
  fixedHeaderWrap: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 0,
  },
  fixedFilterWrap: {
    paddingHorizontal: 14,
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: PALETTE.background,
  },
  loadingText: {
    marginTop: 10,
    color: PALETTE.muted,
    fontSize: 14,
    fontWeight: "600",
  },

  heroCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: PALETTE.heroBorder,
    padding: 16,
    overflow: "hidden",
    shadowColor: PALETTE.heroShadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 7,
  },
  heroGlowOne: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 999,
    backgroundColor: PALETTE.heroGlowOne,
    top: -72,
    right: -18,
  },
  heroGlowTwo: {
    position: "absolute",
    width: 118,
    height: 118,
    borderRadius: 999,
    backgroundColor: PALETTE.heroGlowTwo,
    bottom: -34,
    left: -20,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    marginRight: 12,
    backgroundColor: PALETTE.avatarBg,
  },
  heroInfo: {
    flex: 1,
  },
  name: {
    color: PALETTE.text,
    fontWeight: "800",
  },
  subText: {
    color: PALETTE.muted,
    fontSize: 13,
    marginTop: 2,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  switchBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: PALETTE.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  metricGrid: {
    flexDirection: "row",
    marginTop: 14,
    gap: 8,
  },
  metricCard: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: PALETTE.metricSurface,
    borderWidth: 1,
    borderColor: PALETTE.metricBorder,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  metricLabel: {
    color: PALETTE.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  metricValue: {
    marginTop: 3,
    fontSize: 16,
    fontWeight: "800",
  },

  stickyTabsWrap: {
    backgroundColor: PALETTE.background,
    paddingTop: 2,
    paddingBottom: 4,
    zIndex: 5,
  },
  filterTabs: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: PALETTE.filterTabsBg,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
  },
  filterTab: {
    flex: 1,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  filterText: {
    fontWeight: "700",
    fontSize: 12,
    color: PALETTE.filterTextInactive,
    letterSpacing: 0.2,
  },
  filterTextActive: {
    color: PALETTE.text,
  },
  filterIndicator: {
    position: "absolute",
    top: 4,
    bottom: 4,
    left: 0,
    backgroundColor: PALETTE.accentSoft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PALETTE.indicatorBorder,
  },

  dateCard: {
    marginTop: 8,
    backgroundColor: PALETTE.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PALETTE.border,
    padding: 14,
  },
  dateTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateTopRowRight: {
    justifyContent: "flex-end",
  },
  todayBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: PALETTE.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  todayBtnText: {
    color: PALETTE.accent,
    fontSize: 12,
    fontWeight: "800",
    marginLeft: 5,
  },
  dateNavRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  dateNavBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: PALETTE.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  dateNavBtnDisabled: {
    backgroundColor: PALETTE.surfaceMuted,
  },
  dateCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dateMain: {
    color: PALETTE.text,
    fontSize: 15,
    fontWeight: "900",
  },
  dateSub: {
    color: PALETTE.muted,
    fontSize: 12,
    marginTop: 2,
    fontWeight: "600",
  },

  card: {
    marginTop: 8,
    backgroundColor: PALETTE.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PALETTE.border,
    padding: 14,
  },
  cardTitle: {
    color: PALETTE.text,
    fontSize: 14,
    fontWeight: "800",
  },

  childList: {
    marginTop: 8,
  },
  childRow: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  childRowActive: {
    backgroundColor: PALETTE.activeSurface,
    borderColor: PALETTE.activeBorder,
  },
  childName: {
    fontSize: 14,
    color: PALETTE.text,
    fontWeight: "700",
  },
  childNameActive: {
    color: PALETTE.accent,
  },

  courseCard: {
    marginBottom: 8,
    backgroundColor: PALETTE.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PALETTE.border,
    padding: 10,
  },
  courseHead: {
    flexDirection: "row",
    alignItems: "center",
  },
  courseName: {
    fontSize: 14,
    color: PALETTE.text,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  teacher: {
    marginTop: 2,
    fontSize: 12,
    color: PALETTE.muted,
    fontWeight: "600",
  },
  courseMetaRight: {
    alignItems: "center",
    justifyContent: "center",
  },
  dailyStatusPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: PALETTE.noRecordBorder,
    backgroundColor: PALETTE.noRecordSurface,
    minWidth: 92,
    paddingVertical: 5,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  dailyStatusPillPresent: {
    borderColor: PALETTE.present,
    backgroundColor: PALETTE.presentSurface,
  },
  dailyStatusPillLate: {
    borderColor: PALETTE.late,
    backgroundColor: PALETTE.lateSurface,
  },
  dailyStatusPillAbsent: {
    borderColor: PALETTE.absent,
    backgroundColor: PALETTE.absentSurface,
  },
  dailyStatusText: {
    fontSize: 11,
    fontWeight: "800",
    color: PALETTE.mutedAlt,
  },
  dailyStatusTextActive: {
    color: PALETTE.text,
  },

  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  ringSvg: {
    position: "absolute",
  },
  ringCenter: {
    alignItems: "center",
    justifyContent: "center",
  },
  ringPercent: {
    fontSize: 12,
    fontWeight: "800",
  },

  entriesWrap: {
    marginTop: 8,
  },
  noRecords: {
    fontSize: 12,
    color: PALETTE.muted,
    paddingVertical: 4,
  },

  attRow: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.line,
    flexDirection: "row",
    alignItems: "center",
  },
  statusDotMini: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    marginRight: 8,
  },
  attDate: {
    flex: 1,
    fontSize: 12,
    color: PALETTE.text,
    fontWeight: "500",
  },
  statusWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  attStatus: {
    fontSize: 11,
    fontWeight: "800",
  },
  summaryRow: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: PALETTE.lineStrong,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 12,
    color: PALETTE.muted,
    fontWeight: "700",
  },
  summaryValue: {
    fontSize: 12,
    color: PALETTE.text,
    fontWeight: "900",
  },

  emptyTitle: {
    fontSize: 18,
    color: PALETTE.text,
    fontWeight: "800",
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    color: PALETTE.muted,
    textAlign: "center",
    marginTop: 6,
  },
  emptyQuarterText: {
    color: PALETTE.muted,
    fontSize: 13,
    marginTop: 8,
    fontWeight: "500",
  },

  refreshingBgWrap: {
    marginTop: 8,
    alignItems: "center",
  },
  refreshingBgText: {
    fontSize: 12,
    color: PALETTE.muted,
    fontWeight: "600",
  },
});