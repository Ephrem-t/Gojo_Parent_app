import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  RefreshControl,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ref, get } from "firebase/database";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { database } from "../../constants/firebaseConfig";
import { getLinkedChildrenForParent } from "../lib/parentChildren";
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
  success: colors.success,
  warning: colors.warning,
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
  line: colors.line,
  lineStrong: colors.borderSoft,
});

function useClassMarkThemeConfig() {
  const { colors, isDark } = useParentTheme();

  const PALETTE = useMemo(() => makePalette(colors, isDark), [colors, isDark]);
  const styles = useMemo(() => createStyles(PALETTE), [PALETTE]);

  return { PALETTE, styles };
}

const defaultProfile = "https://cdn-icons-png.flaticon.com/512/847/847969.png";
const CACHE_KEY = "classMark_cache_v6";
const DIRECT_SEMESTER_KEY = "__semester_total__";
const AVERAGE_SEMESTER_KEY = "average";
const RING_SIZE = 58;
const RING_STROKE = 5;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const getPathPrefix = async () => {
  const sk = (await AsyncStorage.getItem("schoolKey")) || null;
  return sk ? `Platform1/Schools/${sk}/` : "";
};

const chipColorByPercent = (p, PALETTE) => {
  if (p >= 75) return PALETTE.success;
  if (p >= 50) return PALETTE.accent;
  return PALETTE.warning;
};

const normalizeKey = (value) => String(value || "").trim().toLowerCase();

const hasAssessments = (node) => {
  return !!(
    node &&
    typeof node === "object" &&
    !Array.isArray(node) &&
    node.assessments &&
    typeof node.assessments === "object"
  );
};

const semesterHasMarks = (semesterNode) => {
  if (!semesterNode || typeof semesterNode !== "object") return false;
  if (hasAssessments(semesterNode)) return true;
  return Object.values(semesterNode).some((value) => hasAssessments(value));
};

const getMarksNodeForSelection = (marksNode, semesterKey, quarterKey) => {
  const semesterNode = marksNode?.[semesterKey];
  if (!semesterNode || typeof semesterNode !== "object") return null;

  if (quarterKey === DIRECT_SEMESTER_KEY && hasAssessments(semesterNode)) {
    return semesterNode;
  }

  if (quarterKey && hasAssessments(semesterNode?.[quarterKey])) {
    return semesterNode[quarterKey];
  }

  if (hasAssessments(semesterNode)) {
    return semesterNode;
  }

  if (!quarterKey) {
    return Object.values(semesterNode).find((value) => hasAssessments(value)) || null;
  }

  return null;
};

const collectAssessmentsFromNode = (node, quarterKey) => {
  if (!node || typeof node !== "object") return [];

  if (quarterKey === DIRECT_SEMESTER_KEY && hasAssessments(node)) {
    return Object.values(node.assessments || {});
  }

  if (quarterKey && hasAssessments(node?.[quarterKey])) {
    return Object.values(node[quarterKey].assessments || {});
  }

  if (hasAssessments(node)) {
    return Object.values(node.assessments || {});
  }

  if (!quarterKey) {
    return Object.values(node).flatMap((value) => {
      if (!hasAssessments(value)) return [];
      return Object.values(value.assessments || {});
    });
  }

  return [];
};

const getAssessmentItemsForSelection = (marksNode, semesterKey, quarterKey) => {
  if (!marksNode || typeof marksNode !== "object") return [];

  if (semesterKey === AVERAGE_SEMESTER_KEY) {
    return ["semester1", "semester2"].flatMap((key) => collectAssessmentsFromNode(marksNode[key], null));
  }

  return collectAssessmentsFromNode(marksNode[semesterKey], quarterKey);
};

const prettifyQuarterLabel = (q) => {
  if (q === DIRECT_SEMESTER_KEY) return "Semester Total";
  const raw = String(q || "").toLowerCase().trim();
  const match = raw.match(/\d+/);
  if (match) return `Quarter ${match[0]}`;
  return String(q || "");
};

const ProgressRing = ({ percent, color }) => {
  const { PALETTE, styles } = useClassMarkThemeConfig();
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
        <Text style={[styles.ringPercent, { color }]}>{safePercent}%</Text>
      </View>
    </View>
  );
};

export default function ClassMark() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { PALETTE, styles } = useClassMarkThemeConfig();

  const [parentId, setParentId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingBg, setRefreshingBg] = useState(false);

  const [children, setChildren] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [childUser, setChildUser] = useState(null);
  const [rank, setRank] = useState(null);

  const [courses, setCourses] = useState([]);
  const [marksByCourse, setMarksByCourse] = useState({});
  const [showList, setShowList] = useState(false);

  const [selectedSemester, setSelectedSemester] = useState(null);
  const [selectedQuarter, setSelectedQuarter] = useState(null);
  const [expanded, setExpanded] = useState({});
  const semesterOptions = ["semester1", "semester2", AVERAGE_SEMESTER_KEY];
  const semesterAnim = useRef(new Animated.Value(0)).current;
  const [semesterTabsWidth, setSemesterTabsWidth] = useState(0);

  const shimmerAnim = useRef(new Animated.Value(-120)).current;

  const scale = width < 360 ? 0.92 : width >= 768 ? 1.1 : 1.0;
  const fontScale = width < 360 ? 0.92 : width >= 768 ? 1.08 : 1.0;
  const screenZoom = width < 360 ? 0.98 : width >= 768 ? 1.03 : 1.01;
  const avatarSize = Math.round(72 * scale);

  const zoomedContentStyle = useMemo(
    () => ({
      paddingHorizontal: 14,
      paddingTop: 4,
      // Keep content clear of the floating bottom navigation bar while scrolling.
      paddingBottom: 110 + insets.bottom,
      transform: [{ scale: screenZoom }],
      width: `${100 / screenZoom}%`,
      alignSelf: "center",
    }),
    [screenZoom, insets.bottom]
  );

  useEffect(() => {
    AsyncStorage.getItem("parentId").then((id) => {
      if (id) setParentId(id);
    });

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 220,
          duration: 1100,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: -120,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);

  const saveCache = async (payload) => {
    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    } catch {}
  };

  const loadCache = async () => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const fetchChildBundle = async ({ prefix, studentId, childInfo }) => {
    const [studentSnap, rankSnap] = await Promise.all([
      get(ref(database, `${prefix}Students/${studentId}`)),
      get(ref(database, `${prefix}Ranks/${studentId}`)),
    ]);

    const student = studentSnap.exists() ? studentSnap.val() : null;
    if (!student) return null;

    const studentUserId = student.userId || student.systemAccountInformation?.userId || null;
    const studentUserSnap = studentUserId
      ? await get(ref(database, `${prefix}Users/${studentUserId}`))
      : null;
    const user = studentUserSnap?.exists() ? studentUserSnap.val() : {};

    const grade = String(student.grade || student.basicStudentInformation?.grade || "");
    const section = String(student.section || student.basicStudentInformation?.section || "");

    const childUserObj = {
      ...user,
      studentId,
      name:
        user?.name ||
        student?.name ||
        student?.basicStudentInformation?.name ||
        childInfo?.name ||
        "Student",
      profileImage:
        user?.profileImage ||
        student?.profileImage ||
        student?.basicStudentInformation?.studentPhoto ||
        childInfo?.profileImage ||
        defaultProfile,
      grade: grade || "--",
      section: section || "--",
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
        "Course";

      return {
        courseId,
        name: courseDisplayName,
        subject: subjectNode?.name || assignment?.subject || courseDisplayName,
        grade,
        section,
        teacherId: assignment?.teacherId || null,
        teacherUserId: assignment?.teacherUserId || null,
        teacherName: assignment?.teacherName || teacherUser?.name || "Teacher",
      };
    });

    const markSnaps = await Promise.all(
      courseList.map(async (course) => {
        const s = await get(ref(database, `${prefix}ClassMarks/${course.courseId}/${studentId}`));
        return [course.courseId, s.exists() ? s.val() : {}];
      })
    );

    const marksMap = Object.fromEntries(markSnaps);

    return {
      childUser: childUserObj,
      rank: rankSnap.exists() ? rankSnap.val() : null,
      courses: courseList,
      marksByCourse: marksMap,
    };
  };

  const applyBundleToState = async (bundle, index, kids) => {
    setCurrentIndex(index);
    setChildUser(bundle.childUser);
    setRank(bundle.rank);
    setCourses(bundle.courses);
    setMarksByCourse(bundle.marksByCourse);

    await saveCache({
      children: kids,
      currentIndex: index,
      childUser: bundle.childUser,
      rank: bundle.rank,
      courses: bundle.courses,
      marksByCourse: bundle.marksByCourse,
      selectedSemester,
      selectedQuarter,
      ts: Date.now(),
    });
  };

  const loadFreshData = async ({
    background = false,
    keepCurrent = true,
    forcedIndex = null,
  } = {}) => {
    if (!parentId) return;

    if (background) setRefreshingBg(true);
    else setRefreshing(true);

    try {
      const prefix = await getPathPrefix();
      const kids = await getLinkedChildrenForParent(prefix, parentId);

      setChildren(kids);

      if (!kids.length) {
        setChildUser(null);
        setRank(null);
        setCourses([]);
        setMarksByCourse({});
        setLoading(false);
        return;
      }

      let idx = 0;
      if (typeof forcedIndex === "number" && kids[forcedIndex]) idx = forcedIndex;
      else if (keepCurrent && kids[currentIndex]) idx = currentIndex;

      const chosen = kids[idx];

      const bundle = await fetchChildBundle({
        prefix,
        studentId: chosen.studentId,
        childInfo: chosen,
      });

      if (!bundle) {
        setLoading(false);
        return;
      }

      await applyBundleToState(bundle, idx, kids);
      setLoading(false);
    } catch (e) {
      console.warn("ClassMark load error:", e);
      setLoading(false);
    } finally {
      setRefreshing(false);
      setRefreshingBg(false);
    }
  };

  useEffect(() => {
    if (!parentId) return;

    let mounted = true;

    (async () => {
      const cached = await loadCache();

      if (cached && mounted) {
        setChildren(cached.children || []);
        setCurrentIndex(cached.currentIndex || 0);
        setChildUser(cached.childUser || null);
        setRank(cached.rank ?? null);
        setCourses(cached.courses || []);
        setMarksByCourse(cached.marksByCourse || {});
        setSelectedSemester(cached.selectedSemester || null);
        setSelectedQuarter(cached.selectedQuarter || null);
        setLoading(false);
      }

      if (mounted) {
        await loadFreshData({ background: true, keepCurrent: true });
      }
    })();

    return () => {
      mounted = false;
    };
    // intentionally only parentId
    // to avoid refresh loop
  }, [parentId]);

  const switchChild = async (child, index) => {
    try {
      setLoading(true);
      setExpanded({});
      setShowList(false);

      const prefix = await getPathPrefix();
      const bundle = await fetchChildBundle({
        prefix,
        studentId: child.studentId,
        childInfo: child,
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
    await loadFreshData({ background: false, keepCurrent: true });
  };

  const availableSemesterKeys = useMemo(() => {
    const semesterSet = new Set();

    courses.forEach((course) => {
      const courseMarks = marksByCourse?.[course.courseId];
      if (!courseMarks || typeof courseMarks !== "object") return;

      Object.keys(courseMarks).forEach((semesterKey) => {
        if (semesterHasMarks(courseMarks[semesterKey])) {
          semesterSet.add(semesterKey);
        }
      });
    });

    return Array.from(semesterSet).sort((a, b) => {
      const aNum = Number(String(a).match(/\d+/)?.[0] || 0);
      const bNum = Number(String(b).match(/\d+/)?.[0] || 0);
      return aNum - bNum;
    });
  }, [courses, marksByCourse]);

  const semesterCoverage = useMemo(() => {
    const coverage = {};

    courses.forEach((course) => {
      const courseMarks = marksByCourse?.[course.courseId];
      if (!courseMarks || typeof courseMarks !== "object") return;

      Object.entries(courseMarks).forEach(([semesterKey, semesterNode]) => {
        if (semesterHasMarks(semesterNode)) {
          coverage[semesterKey] = (coverage[semesterKey] || 0) + 1;
        }
      });
    });

    return coverage;
  }, [courses, marksByCourse]);

  useEffect(() => {
    if (!availableSemesterKeys.length) return;

    if (
      !selectedSemester ||
      (!availableSemesterKeys.includes(selectedSemester) && selectedSemester !== AVERAGE_SEMESTER_KEY)
    ) {
      const bestSemester = availableSemesterKeys.reduce((bestKey, currentKey) => {
        if (!bestKey) return currentKey;

        const bestCount = semesterCoverage[bestKey] || 0;
        const currentCount = semesterCoverage[currentKey] || 0;
        if (currentCount !== bestCount) {
          return currentCount > bestCount ? currentKey : bestKey;
        }

        const bestNum = Number(String(bestKey).match(/\d+/)?.[0] || 0);
        const currentNum = Number(String(currentKey).match(/\d+/)?.[0] || 0);
        return currentNum > bestNum ? currentKey : bestKey;
      }, null);

      setSelectedSemester(bestSemester || availableSemesterKeys[0]);
    }
  }, [availableSemesterKeys, selectedSemester, semesterCoverage]);

  useEffect(() => {
    const targetIndex = Math.max(0, semesterOptions.indexOf(selectedSemester));
    Animated.spring(semesterAnim, {
      toValue: targetIndex,
      useNativeDriver: true,
      speed: 18,
      bounciness: 6,
    }).start();
  }, [selectedSemester, semesterAnim]);

  const availableQuarterKeys = useMemo(() => {
    if (!childUser?.studentId) return [];
    if (selectedSemester === AVERAGE_SEMESTER_KEY) return [];
    const qSet = new Set();

    courses.forEach((course) => {
      const semNode = marksByCourse?.[course.courseId]?.[selectedSemester];
      if (!semNode || typeof semNode !== "object") return;

       if (hasAssessments(semNode)) {
        qSet.add(DIRECT_SEMESTER_KEY);
        return;
      }

      Object.entries(semNode).forEach(([k, val]) => {
        if (val && typeof val === "object" && val.assessments) qSet.add(k);
      });
    });

    return Array.from(qSet).sort((a, b) => {
      if (a === DIRECT_SEMESTER_KEY) return -1;
      if (b === DIRECT_SEMESTER_KEY) return 1;
      const aNum = Number(String(a).match(/\d+/)?.[0] || 0);
      const bNum = Number(String(b).match(/\d+/)?.[0] || 0);
      return aNum - bNum;
    });
  }, [courses, marksByCourse, selectedSemester, childUser?.studentId]);

  const visibleQuarterKeys = useMemo(() => {
    return availableQuarterKeys.filter((key) => key !== DIRECT_SEMESTER_KEY);
  }, [availableQuarterKeys]);

  useEffect(() => {
    if (visibleQuarterKeys.length === 0) {
      setSelectedQuarter(null);
      return;
    }

    if (
      !selectedQuarter ||
      selectedQuarter === DIRECT_SEMESTER_KEY ||
      !visibleQuarterKeys.includes(selectedQuarter)
    ) {
      setSelectedQuarter(visibleQuarterKeys[0]);
    }
  }, [visibleQuarterKeys, selectedQuarter]);

  const effectiveQuarter = visibleQuarterKeys.length > 0 ? selectedQuarter : null;

  const stats = useMemo(() => {
    let overallScore = 0;
    let overallMax = 0;
    let assessmentsCount = 0;

    courses.forEach((course) => {
      const assessments = getAssessmentItemsForSelection(
        marksByCourse?.[course.courseId],
        selectedSemester,
        effectiveQuarter
      );
      if (!assessments.length) return;

      assessments.forEach((a) => {
        overallScore += Number(a.score || 0);
        overallMax += Number(a.max || 0);
        assessmentsCount += 1;
      });
    });

    const overallPercent = overallMax > 0 ? Math.round((overallScore / overallMax) * 100) : 0;
    const averagePoint = assessmentsCount > 0 ? Math.round(overallScore / assessmentsCount) : 0;

    return { overallScore, overallMax, assessmentsCount, overallPercent, averagePoint };
  }, [courses, marksByCourse, selectedSemester, effectiveQuarter]);

  if (loading && !childUser) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={PALETTE.accent} />
      </View>
    );
  }

  if (!children.length) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.emptyTitle}>No child is linked yet</Text>
        <Text style={styles.emptySubtitle}>Please contact school admin to link child profile.</Text>
      </View>
    );
  }

  const overallStatusColor = chipColorByPercent(stats.overallPercent, PALETTE);
  const overallStatus =
    stats.overallPercent >= 75
      ? "Great progress"
      : stats.overallPercent >= 50
      ? "On track"
      : "Needs support";
  const isQuarterBasedSemester = selectedSemester !== AVERAGE_SEMESTER_KEY && visibleQuarterKeys.length > 0;
  const fixedHeaderCard = (
    <LinearGradient
      colors={[PALETTE.heroGradientStart, PALETTE.heroGradientMid, PALETTE.heroGradientEnd]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.headerCard}
    >
      <View style={styles.headerGlowOne} />
      <View style={styles.headerGlowTwo} />

      <View style={styles.headerTop}>
        <Image
          source={{ uri: childUser?.profileImage || defaultProfile }}
          style={[styles.avatar, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}
        />
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { fontSize: Math.round(20 * fontScale) }]} numberOfLines={1}>
            {childUser?.name || "Student"}
          </Text>
          <Text style={styles.subText}>
            Grade {childUser?.grade ?? "--"} • Section {childUser?.section ?? "--"}
          </Text>

          <View style={{ flexDirection: "row", marginTop: 8, alignItems: "center" }}>
            <View style={[styles.statusDot, { backgroundColor: overallStatusColor }]} />
            <Text style={[styles.statusText, { color: overallStatusColor }]}>{overallStatus}</Text>
          </View>
        </View>

        {children.length > 1 && (
          <TouchableOpacity onPress={() => setShowList((s) => !s)} style={styles.switchBtn}>
            <Ionicons name={showList ? "chevron-up" : "chevron-down"} size={20} color={PALETTE.accent} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.metricRow}>
        <View style={styles.metricPill}>
          <Text style={styles.metricLabel}>Rank</Text>
          <Text style={styles.metricValue}>{rank ?? "--"}</Text>
        </View>
        <View style={styles.metricPill}>
          <Text style={styles.metricLabel}>Average</Text>
          <Text style={styles.metricValue}>{stats.averagePoint || 0}</Text>
        </View>
        <View style={styles.metricPill}>
          <Text style={styles.metricLabel}>Percent</Text>
          <Text style={[styles.metricValue, { color: overallStatusColor }]}>{stats.overallPercent}%</Text>
        </View>
      </View>
    </LinearGradient>
  );
  const fixedFilterCard = (
    <View style={styles.stickyHeaderShell}>
      <View style={styles.academicTermCard}>
        <View style={styles.stickyTabsWrap}>
          <View
            style={styles.filterTabs}
            onLayout={(e) => setSemesterTabsWidth(e.nativeEvent.layout.width)}
          >
            {semesterTabsWidth > 0 && (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.filterIndicator,
                  {
                    width: semesterTabsWidth / semesterOptions.length,
                    transform: [
                      {
                        translateX: Animated.multiply(
                          semesterAnim,
                          semesterTabsWidth / semesterOptions.length
                        ),
                      },
                    ],
                  },
                ]}
              />
            )}

            {semesterOptions.map((semesterKey, index) => {
              const active = selectedSemester === semesterKey;
              const label =
                semesterKey === AVERAGE_SEMESTER_KEY
                  ? "Average"
                  : `Semester ${index + 1}`;
              return (
                <TouchableOpacity
                  key={semesterKey}
                  style={styles.filterTab}
                  onPress={() => setSelectedSemester(semesterKey)}
                  activeOpacity={0.86}
                >
                  <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {isQuarterBasedSemester && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 16, marginBottom: 2 }]}>Quarter</Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quarterRow}
            >
              {visibleQuarterKeys.map((q) => {
                const active = effectiveQuarter === q;
                return (
                  <TouchableOpacity
                    key={q}
                    style={[styles.quarterCard, active && styles.quarterCardActive]}
                    onPress={() => setSelectedQuarter(q)}
                    activeOpacity={0.88}
                  >
                    <Text style={[styles.quarterTitle, active && styles.quarterTitleActive]}>
                      {prettifyQuarterLabel(q)}
                    </Text>
                    <Text style={[styles.quarterSub, active && styles.quarterSubActive]}>
                      View marks
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.fixedHeaderWrap}>{fixedHeaderCard}</View>
      <View style={styles.fixedFilterWrap}>{fixedFilterCard}</View>
      <ScrollView
        contentContainerStyle={zoomedContentStyle}
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
        {showList && children.length > 1 && (
          <View style={[styles.card, { marginTop: 8 }]}>
            <Text style={styles.sectionTitle}>Choose Child</Text>
            <View style={{ marginTop: 8 }}>
              {children.map((c, i) => {
                const active = i === currentIndex;
                return (
                  <TouchableOpacity
                    key={c.studentId}
                    style={[styles.childRow, active && styles.childRowActive]}
                    onPress={() => switchChild(c, i)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.childName, active && { color: PALETTE.accent }]}>
                      {c.name || `Child ${i + 1}`}
                    </Text>
                    {active && <Ionicons name="checkmark-circle" size={18} color={PALETTE.accent} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {courses.map((course) => {
          const quarterMarks = getMarksNodeForSelection(
            marksByCourse?.[course.courseId],
            selectedSemester,
            effectiveQuarter
          );

          const selectedAssessments = getAssessmentItemsForSelection(
            marksByCourse?.[course.courseId],
            selectedSemester,
            effectiveQuarter
          );

          if (!selectedAssessments.length) return null;

          let totalScore = 0;
          let totalMax = 0;

          selectedAssessments.forEach((a) => {
            totalScore += Number(a.score || 0);
            totalMax += Number(a.max || 0);
          });

          const percent = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
          const isOpen = !!expanded[course.courseId];
          const pcColor = chipColorByPercent(percent, PALETTE);

          return (
            <View key={course.courseId} style={[styles.card, styles.subjectCard, { marginTop: 8 }]}>
              <TouchableOpacity
                onPress={() =>
                  setExpanded((prev) => ({ ...prev, [course.courseId]: !prev[course.courseId] }))
                }
                activeOpacity={0.85}
              >
                <View style={styles.courseHead}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.courseName}>{course.name}</Text>
                    <Text style={styles.teacher}>Teacher: {course.teacherName}</Text>
                  </View>

                  <View style={styles.courseMeta}>
                    <ProgressRing percent={percent} color={pcColor} />
                  </View>
                </View>
              </TouchableOpacity>

              {isOpen && (
                <View style={{ marginTop: 10 }}>
                  {selectedAssessments.map((a, idx) => (
                    <View key={`${course.courseId}-${idx}-${a.name || "assessment"}`} style={styles.assessRow}>
                      <Text style={styles.assessName}>{a.name}</Text>
                      <Text style={styles.assessScore}>{a.score}/{a.max}</Text>
                    </View>
                  ))}

                  <View style={styles.assessTotalRow}>
                    <Text style={styles.assessTotalLabel}>Total</Text>
                    <Text style={styles.assessTotalValue}>{totalScore}/{totalMax}</Text>
                  </View>
                </View>
              )}
            </View>
          );
        })}

        {!courses.length && (
          <View style={[styles.card, { marginTop: 8 }]}>
            <Text style={styles.sectionTitle}>Marks</Text>
            <Text style={styles.subText}>No courses or marks found for this child yet.</Text>
          </View>
        )}

        {refreshingBg && !refreshing && (
          <View style={{ marginTop: 8, alignItems: "center" }}>
            <Text style={{ fontSize: 12, color: PALETTE.muted }}>Refreshing latest marks…</Text>
          </View>
        )}
      </ScrollView>
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
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },

  headerCard: {
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
  headerGlowOne: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 999,
    backgroundColor: PALETTE.heroGlowOne,
    top: -72,
    right: -18,
  },
  headerGlowTwo: {
    position: "absolute",
    width: 118,
    height: 118,
    borderRadius: 999,
    backgroundColor: PALETTE.heroGlowTwo,
    bottom: -34,
    left: -20,
  },
  headerTop: { flexDirection: "row", alignItems: "center" },
  avatar: { marginRight: 12, backgroundColor: PALETTE.avatarBg },
  name: { color: PALETTE.text, fontWeight: "800" },
  subText: { color: PALETTE.muted, fontSize: 13, marginTop: 2 },
  switchBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: PALETTE.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { fontSize: 12, fontWeight: "700" },

  metricRow: { flexDirection: "row", marginTop: 14, gap: 8 },
  metricPill: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: PALETTE.metricSurface,
    borderWidth: 1,
    borderColor: PALETTE.metricBorder,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  metricLabel: { fontSize: 12, color: PALETTE.muted, fontWeight: "600" },
  metricValue: { marginTop: 3, fontSize: 16, color: PALETTE.text, fontWeight: "800" },

  card: {
    backgroundColor: PALETTE.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PALETTE.border,
    padding: 14,
  },
  subjectCard: {
    borderRadius: 14,
    padding: 10,
  },
  sectionTitle: { fontSize: 14, color: PALETTE.text, fontWeight: "800" },

  academicTermCard: {
    width: "92%",
    alignSelf: "center",
    padding: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
  },

  stickyHeaderShell: {
    marginTop: 2,
    backgroundColor: PALETTE.background,
    paddingTop: 2,
    paddingBottom: 4,
    zIndex: 5,
  },

  stickyTabsWrap: {
    marginTop: 0,
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

  quarterRow: {
    marginTop: 10,
    paddingRight: 4,
    gap: 10,
  },
  quarterCard: {
    minWidth: 124,
    backgroundColor: PALETTE.surfaceMuted,
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  quarterCardActive: {
    backgroundColor: PALETTE.activeSurface,
    borderColor: PALETTE.activeBorder,
  },
  quarterTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: PALETTE.text,
  },
  quarterTitleActive: {
    color: PALETTE.accent,
  },
  quarterSub: {
    fontSize: 11,
    color: PALETTE.muted,
    marginTop: 3,
    fontWeight: "600",
  },
  quarterSubActive: {
    color: PALETTE.accent,
  },

  childRow: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  childRowActive: { backgroundColor: PALETTE.activeSurface, borderColor: PALETTE.activeBorder },
  childName: { fontSize: 14, color: PALETTE.text, fontWeight: "700" },

  courseHead: { flexDirection: "row", alignItems: "center" },
  courseName: { fontSize: 14, color: PALETTE.text, fontWeight: "800", textTransform: "capitalize" },
  teacher: { marginTop: 2, fontSize: 12, color: PALETTE.muted, fontWeight: "600" },

  courseMeta: {
    alignItems: "center",
    justifyContent: "center",
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
  assessRow: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.line,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  assessName: { color: PALETTE.text, fontSize: 12, flex: 1, paddingRight: 8 },
  assessScore: { color: PALETTE.text, fontSize: 12, fontWeight: "700" },
  assessTotalRow: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: PALETTE.lineStrong,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  assessTotalLabel: {
    fontSize: 12,
    color: PALETTE.muted,
    fontWeight: "700",
  },
  assessTotalValue: {
    fontSize: 12,
    color: PALETTE.text,
    fontWeight: "900",
  },

  emptyTitle: { fontSize: 18, color: PALETTE.text, fontWeight: "800", textAlign: "center" },
  emptySubtitle: { fontSize: 14, color: PALETTE.muted, textAlign: "center", marginTop: 6 },
});