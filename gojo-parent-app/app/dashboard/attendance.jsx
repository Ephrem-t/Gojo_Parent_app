import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
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

const PRIMARY = "#1E90FF";
const PRIMARY_DARK = "#1E90FF";
const PRIMARY_SOFT = "#EEF4FF";
const BG = "#FFFFFF";
const CARD = "#FFFFFF";
const TEXT = "#0F172A";
const MUTED = "#64748B";
const BORDER = "#E5EAF2";

const PRESENT = "#2563EB";
const LATE = "#F59E0B";
const ABSENT = "#94A3B8";

const defaultProfile = "https://cdn-icons-png.flaticon.com/512/847/847969.png";
const CACHE_KEY = "attendance_cache_v6";
const RING_SIZE = 58;
const RING_STROKE = 5;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const getPathPrefix = async () => {
  const sk = (await AsyncStorage.getItem("schoolKey")) || null;
  return sk ? `Platform1/Schools/${sk}/` : "";
};

const normalizeKey = (value) => String(value || "").trim().toLowerCase();

const statusColor = (status) => {
  switch (String(status || "").toLowerCase()) {
    case "present":
      return PRESENT;
    case "late":
      return LATE;
    case "absent":
      return ABSENT;
    default:
      return MUTED;
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

const percentColor = (p) => {
  if (p >= 75) return PRIMARY_DARK;
  if (p >= 50) return PRIMARY;
  return ABSENT;
};

const ProgressRing = ({ percent, color, label }) => {
  const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
  const dashOffset = RING_CIRCUMFERENCE - (RING_CIRCUMFERENCE * safePercent) / 100;

  return (
    <View style={styles.ringWrap}>
      <Svg width={RING_SIZE} height={RING_SIZE} style={styles.ringSvg}>
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke="#E2E8F0"
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
  const tabOptions = ["daily", "weekly", "monthly"];
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
  }, [tab]);

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

  const fetchChildBundle = useCallback(async ({ prefix, studentId, childInfo }) => {
    try {
      const studentSnap = await get(ref(database, `${prefix}Students/${studentId}`));
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
        grade: grade || "--",
        section: section || "--",
        name:
          user?.name ||
          student?.name ||
          student?.basicStudentInformation?.name ||
          childInfo?.name ||
          "Student",
        profileImage: user?.profileImage || student?.profileImage || defaultProfile,
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

      return {
        childUser: childUserObj,
        courses: courseList,
        attendanceByCourse: attendanceMap,
      };
    } catch (e) {
      console.warn("fetchChildBundle error:", e);
      return null;
    }
  }, []);

  const applyBundleToState = useCallback(
    async (bundle, index, kids) => {
      setCurrentIndex(index);
      setChildUser(bundle?.childUser || null);
      setCourses(bundle?.courses || []);
      setAttendanceByCourse(bundle?.attendanceByCourse || {});

      await saveCache({
        children: kids || [],
        currentIndex: index || 0,
        childUser: bundle?.childUser || null,
        courses: bundle?.courses || [],
        attendanceByCourse: bundle?.attendanceByCourse || {},
        tab,
        ts: Date.now(),
      });
    },
    [tab]
  );

  const loadFreshData = useCallback(
    async ({ background = false, forcedIndex = null } = {}) => {
      if (!parentId) {
        setLoading(false);
        return;
      }

      if (background) setBackgroundRefreshing(true);
      else setRefreshing(true);

      try {
        const prefix = await getPathPrefix();
        const kids = await getLinkedChildrenForParent(prefix, parentId);

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

  useEffect(() => {
    if (parentId === null) return;

    let mounted = true;

    (async () => {
      const cached = await loadCache();

      if (cached && mounted) {
        setChildren(cached.children || []);
        setCurrentIndex(cached.currentIndex || 0);
        setChildUser(cached.childUser || null);
        setCourses(cached.courses || []);
        setAttendanceByCourse(cached.attendanceByCourse || {});
        setTab(cached.tab || "daily");
        setLoading(false);
      }

      if (mounted) {
        await loadFreshData({ background: true });
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
    await loadFreshData({ background: false });
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
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={styles.loadingText}>Loading attendance...</Text>
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

  const fixedHeaderCard = (
    <LinearGradient
      colors={["#FFFFFF", "#F9FBFF", "#EEF5FF"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.heroCard}
    >
      <View style={styles.heroGlowOne} />
      <View style={styles.heroGlowTwo} />

      <View style={styles.heroTop}>
        <Image
          source={{ uri: childUser?.profileImage || defaultProfile }}
          style={[styles.avatar, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}
        />

        <View style={styles.heroInfo}>
          <Text style={[styles.name, { fontSize: Math.round(20 * fontScale) }]} numberOfLines={1}>
            {childUser?.name || "Student"}
          </Text>
          <Text style={styles.subText}>
            Grade {childUser?.grade ?? "--"} • Section {childUser?.section ?? "--"}
          </Text>

          <View style={{ flexDirection: "row", marginTop: 8, alignItems: "center" }}>
            <View style={[styles.statusDot, { backgroundColor: PRIMARY }]} />
            <Text style={[styles.statusText, { color: PRIMARY }]}>Attendance Overview</Text>
          </View>
        </View>

        {children.length > 1 && (
          <TouchableOpacity onPress={() => setShowChildPicker((s) => !s)} style={styles.switchBtn}>
            <Ionicons name={showChildPicker ? "chevron-up" : "chevron-down"} size={20} color={PRIMARY} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.metricGrid}>
        <MetricCard label="Present" value={attendanceTotalsAll.present} valueColor={PRESENT} />
        <MetricCard label="Late" value={attendanceTotalsAll.late} valueColor={LATE} />
        <MetricCard label="Absent" value={attendanceTotalsAll.absent} valueColor={ABSENT} />
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
                {t.charAt(0).toUpperCase() + t.slice(1)}
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
            colors={[PRIMARY]}
            tintColor={PRIMARY}
          />
        }
      >
        {showChildPicker && children.length > 1 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Choose Child</Text>
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
                      {c.name || `Child ${i + 1}`}
                    </Text>
                    {active && <Ionicons name="checkmark-circle" size={18} color={PRIMARY} />}
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
            const ringColor = percentColor(attendancePercent);
            const ringValue = attendancePercent;
            const ringLabel = `${attendancePercent}%`;
            const summaryLabel = "Total";
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
                      <Text style={styles.teacher}>Teacher: {course.teacherName}</Text>
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
                              ? "Present"
                              : dailyStatusKey === "late"
                              ? "Late"
                              : dailyStatusKey === "absent"
                              ? "Absent"
                              : "No Record"}
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
                      <Text style={styles.noRecords}>No attendance recorded</Text>
                    ) : (
                      entries.map(([date, status]) => {
                        const sc = statusColor(status);
                        const icon = statusIcon(status);
                        return (
                          <View key={date} style={styles.attRow}>
                            <View style={[styles.statusDotMini, { backgroundColor: sc }]} />
                            <Text style={styles.attDate}>{moment(date).format("DD MMM, ddd")}</Text>
                            <View style={styles.statusWrap}>
                              <Ionicons name={icon} size={16} color={sc} style={{ marginRight: 6 }} />
                              <Text style={[styles.attStatus, { color: sc }]}>
                                {String(status || "").toUpperCase()}
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
            <Text style={styles.cardTitle}>Attendance</Text>
            <Text style={styles.emptyQuarterText}>No courses found for this student yet.</Text>
          </View>
        )}

        {backgroundRefreshing && !refreshing && (
          <View style={styles.refreshingBgWrap}>
            <Text style={styles.refreshingBgText}>Refreshing latest attendance…</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function MetricCard({ label, value, valueColor = TEXT }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  fixedHeaderWrap: {
    padding: 14,
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
    backgroundColor: BG,
  },
  loadingText: {
    marginTop: 10,
    color: MUTED,
    fontSize: 14,
    fontWeight: "600",
  },

  heroCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DDE8F7",
    padding: 16,
    overflow: "hidden",
    shadowColor: "#9FBFE6",
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
    backgroundColor: "rgba(30,144,255,0.08)",
    top: -72,
    right: -18,
  },
  heroGlowTwo: {
    position: "absolute",
    width: 118,
    height: 118,
    borderRadius: 999,
    backgroundColor: "rgba(96,165,250,0.08)",
    bottom: -34,
    left: -20,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    marginRight: 12,
    backgroundColor: "#E5E7EB",
  },
  heroInfo: {
    flex: 1,
  },
  name: {
    color: TEXT,
    fontWeight: "800",
  },
  subText: {
    color: MUTED,
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
    backgroundColor: PRIMARY_SOFT,
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
    backgroundColor: "rgba(255,255,255,0.74)",
    borderWidth: 1,
    borderColor: "rgba(220,233,250,0.95)",
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  metricLabel: {
    color: MUTED,
    fontSize: 12,
    fontWeight: "600",
  },
  metricValue: {
    marginTop: 3,
    fontSize: 16,
    fontWeight: "800",
  },

  stickyTabsWrap: {
    backgroundColor: BG,
    paddingTop: 2,
    paddingBottom: 4,
    zIndex: 5,
  },
  filterTabs: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8EEF9",
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
    color: "#475569",
    letterSpacing: 0.2,
  },
  filterTextActive: {
    color: TEXT,
  },
  filterIndicator: {
    position: "absolute",
    top: 4,
    bottom: 4,
    left: 0,
    backgroundColor: PRIMARY_SOFT,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },

  dateCard: {
    marginTop: 8,
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
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
    backgroundColor: PRIMARY_SOFT,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  todayBtnText: {
    color: PRIMARY,
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
    backgroundColor: PRIMARY_SOFT,
    alignItems: "center",
    justifyContent: "center",
  },
  dateNavBtnDisabled: {
    backgroundColor: "#F1F5F9",
  },
  dateCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dateMain: {
    color: TEXT,
    fontSize: 15,
    fontWeight: "900",
  },
  dateSub: {
    color: MUTED,
    fontSize: 12,
    marginTop: 2,
    fontWeight: "600",
  },

  card: {
    marginTop: 8,
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
  },
  cardTitle: {
    color: TEXT,
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
    backgroundColor: PRIMARY_SOFT,
    borderColor: "#BFDBFE",
  },
  childName: {
    fontSize: 14,
    color: TEXT,
    fontWeight: "700",
  },
  childNameActive: {
    color: PRIMARY,
  },

  courseCard: {
    marginBottom: 8,
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 10,
  },
  courseHead: {
    flexDirection: "row",
    alignItems: "center",
  },
  courseName: {
    fontSize: 14,
    color: TEXT,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  teacher: {
    marginTop: 2,
    fontSize: 12,
    color: MUTED,
    fontWeight: "600",
  },
  courseMetaRight: {
    alignItems: "center",
    justifyContent: "center",
  },
  dailyStatusPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D5DEE9",
    backgroundColor: "#F8FAFC",
    minWidth: 92,
    paddingVertical: 5,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  dailyStatusPillPresent: {
    borderColor: "#93C5FD",
    backgroundColor: "#DBEAFE",
  },
  dailyStatusPillLate: {
    borderColor: "#FCD34D",
    backgroundColor: "#FEF3C7",
  },
  dailyStatusPillAbsent: {
    borderColor: "#CBD5E1",
    backgroundColor: "#E2E8F0",
  },
  dailyStatusText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748B",
  },
  dailyStatusTextActive: {
    color: "#0F172A",
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
    color: MUTED,
    paddingVertical: 4,
  },

  attRow: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
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
    color: TEXT,
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
    borderTopColor: "#E2E8F0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 12,
    color: MUTED,
    fontWeight: "700",
  },
  summaryValue: {
    fontSize: 12,
    color: TEXT,
    fontWeight: "900",
  },

  emptyTitle: {
    fontSize: 18,
    color: TEXT,
    fontWeight: "800",
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    color: MUTED,
    textAlign: "center",
    marginTop: 6,
  },
  emptyQuarterText: {
    color: MUTED,
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
    color: MUTED,
    fontWeight: "600",
  },
});