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
  View,
  useWindowDimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ref, get } from "firebase/database";
import { Ionicons } from "@expo/vector-icons";
import moment from "moment";
import { database } from "../../constants/firebaseConfig";

const PRIMARY = "#1E90FF";
const BG = "#FFFFFF";
const CARD = "#FFFFFF";
const TEXT = "#0F172A";
const MUTED = "#64748B";
const BORDER = "#E2E8F0";

const SUCCESS = "#16A34A";
const WARNING = "#F59E0B";
const DANGER = "#DC2626";

const defaultProfile = "https://cdn-icons-png.flaticon.com/512/847/847969.png";
const CACHE_KEY = "attendance_cache_v2";

const getPathPrefix = async () => {
  const sk = (await AsyncStorage.getItem("schoolKey")) || null;
  return sk ? `Platform1/Schools/${sk}/` : "";
};

const statusColor = (status) => {
  switch (String(status || "").toLowerCase()) {
    case "present":
      return SUCCESS;
    case "late":
      return WARNING;
    case "absent":
      return DANGER;
    default:
      return MUTED;
  }
};

export default function Attendance() {
  const { width } = useWindowDimensions();
  const scale = width < 360 ? 0.92 : width >= 768 ? 1.1 : 1.0;
  const fontScale = width < 360 ? 0.92 : width >= 768 ? 1.08 : 1.0;
  const avatarSize = Math.round(72 * scale);

  const [parentId, setParentId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshingBg, setRefreshingBg] = useState(false);

  const [children, setChildren] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showList, setShowList] = useState(false);

  const [childUser, setChildUser] = useState(null);
  const [courses, setCourses] = useState([]);
  const [attendanceByCourse, setAttendanceByCourse] = useState({});
  const [expandedCourses, setExpandedCourses] = useState({});

  const [tab, setTab] = useState("daily"); // daily | weekly | monthly
  const tabOptions = ["daily", "weekly", "monthly"];
  const tabAnim = useRef(new Animated.Value(0)).current;
  const [tabWidthState, setTabWidthState] = useState(0);

  const shimmerAnim = useRef(new Animated.Value(-120)).current;

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
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const fetchChildBundle = async ({ prefix, studentId, childInfo }) => {
    const studentSnap = await get(ref(database, `${prefix}Students/${studentId}`));
    const student = studentSnap.exists() ? studentSnap.val() : null;
    if (!student) return null;

    const userSnap = await get(ref(database, `${prefix}Users/${student.userId}`));
    const user = userSnap.exists() ? userSnap.val() : {};

    const childUserObj = {
      ...user,
      studentId,
      grade: student.grade,
      section: student.section,
      _childInfo: childInfo,
    };

    const [coursesSnap, assignSnap, teachersSnap] = await Promise.all([
      get(ref(database, `${prefix}Courses`)),
      get(ref(database, `${prefix}TeacherAssignments`)),
      get(ref(database, `${prefix}Teachers`)),
    ]);

    const allCourses = coursesSnap.exists() ? coursesSnap.val() : {};
    const allAssignments = assignSnap.exists() ? assignSnap.val() : {};
    const allTeachers = teachersSnap.exists() ? teachersSnap.val() : {};

    const relevantCourses = Object.keys(allCourses)
      .map((id) => ({ courseId: id, ...allCourses[id] }))
      .filter((c) => String(c.grade) === String(student.grade) && String(c.section || "") === String(student.section || ""));

    const teacherUserIds = new Set();
    const courseList = relevantCourses.map((course) => {
      const assign = Object.values(allAssignments).find((a) => a.courseId === course.courseId);
      const teacherId = assign?.teacherId || null;
      const teacherUserId = teacherId ? allTeachers?.[teacherId]?.userId : null;
      if (teacherUserId) teacherUserIds.add(teacherUserId);

      return {
        ...course,
        teacherId,
        teacherUserId,
        teacherName: "Teacher",
      };
    });

    if (teacherUserIds.size > 0) {
      const users = await Promise.all(
        Array.from(teacherUserIds).map(async (uid) => {
          const s = await get(ref(database, `${prefix}Users/${uid}`));
          return [uid, s.exists() ? s.val() : null];
        })
      );
      const tUserMap = Object.fromEntries(users);

      courseList.forEach((c) => {
        c.teacherName = c.teacherUserId ? tUserMap?.[c.teacherUserId]?.name || "Teacher" : "Teacher";
      });
    }

    const attendanceSnap = await get(ref(database, `${prefix}Attendance`));
    const allAttendance = attendanceSnap.exists() ? attendanceSnap.val() : {};

    const attendanceMap = {};
    courseList.forEach((c) => {
      const byDate = allAttendance?.[c.courseId] || {};
      const studentOnly = {};
      Object.entries(byDate).forEach(([date, studentsMap]) => {
        const s = studentsMap?.[studentId];
        if (s) studentOnly[date] = s;
      });
      attendanceMap[c.courseId] = studentOnly;
    });

    return {
      childUser: childUserObj,
      courses: courseList,
      attendanceByCourse: attendanceMap,
    };
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
        setCourses(cached.courses || []);
        setAttendanceByCourse(cached.attendanceByCourse || {});
        setTab(cached.tab || "daily");
        setLoading(false);
      }

      setRefreshingBg(true);
      try {
        const prefix = await getPathPrefix();

        const parentSnap = await get(ref(database, `${prefix}Parents/${parentId}`));
        const parent = parentSnap.exists() ? parentSnap.val() : null;
        const kids = parent?.children ? Object.values(parent.children) : [];

        if (!mounted) return;
        setChildren(kids);

        if (kids.length === 0) {
          setLoading(false);
          setRefreshingBg(false);
          return;
        }

        const idx = cached?.currentIndex && kids[cached.currentIndex] ? cached.currentIndex : 0;
        const chosen = kids[idx];

        const bundle = await fetchChildBundle({
          prefix,
          studentId: chosen.studentId,
          childInfo: chosen,
        });

        if (!bundle || !mounted) return;

        setCurrentIndex(idx);
        setChildUser(bundle.childUser);
        setCourses(bundle.courses);
        setAttendanceByCourse(bundle.attendanceByCourse);
        setExpandedCourses({});
        setLoading(false);

        saveCache({
          children: kids,
          currentIndex: idx,
          childUser: bundle.childUser,
          courses: bundle.courses,
          attendanceByCourse: bundle.attendanceByCourse,
          tab,
          ts: Date.now(),
        });
      } catch (e) {
        console.warn("Attendance load error:", e);
        setLoading(false);
      } finally {
        if (mounted) setRefreshingBg(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [parentId]);

  const switchChild = async (child, index) => {
    try {
      setLoading(true);
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

      setCurrentIndex(index);
      setChildUser(bundle.childUser);
      setCourses(bundle.courses);
      setAttendanceByCourse(bundle.attendanceByCourse);
      setExpandedCourses({});
      setShowList(false);

      saveCache({
        children,
        currentIndex: index,
        childUser: bundle.childUser,
        courses: bundle.courses,
        attendanceByCourse: bundle.attendanceByCourse,
        tab,
        ts: Date.now(),
      });
    } catch (e) {
      console.warn("switchChild error:", e);
    } finally {
      setLoading(false);
    }
  };

  const filteredAttendance = useMemo(() => {
    if (!childUser?.studentId) return {};

    const now = moment();
    return courses.reduce((acc, course) => {
      const courseAttendance = attendanceByCourse?.[course.courseId] || {};
      const filtered = {};

      if (tab === "daily") {
        const today = now.format("YYYY-MM-DD");
        if (courseAttendance[today]) filtered[today] = courseAttendance[today];
      } else {
        Object.entries(courseAttendance).forEach(([date, status]) => {
          const m = moment(date, "YYYY-MM-DD");
          if ((tab === "weekly" && m.isSame(now, "week")) || (tab === "monthly" && m.isSame(now, "month"))) {
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

  if (loading && !childUser) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={PRIMARY} />
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

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 20 }} stickyHeaderIndices={[1]}>
        {/* Summary header */}
        <View style={styles.headerCard}>
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
            </View>

            {children.length > 1 && (
              <TouchableOpacity onPress={() => setShowList((s) => !s)} style={styles.switchBtn}>
                <Ionicons name={showList ? "chevron-up" : "chevron-down"} size={20} color={PRIMARY} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.metricRow}>
            <View style={styles.metricPill}>
              <Text style={styles.metricLabel}>Present</Text>
              <Text style={[styles.metricValue, { color: SUCCESS }]}>{attendanceTotalsAll.present}</Text>
            </View>
            <View style={styles.metricPill}>
              <Text style={styles.metricLabel}>Late</Text>
              <Text style={[styles.metricValue, { color: WARNING }]}>{attendanceTotalsAll.late}</Text>
            </View>
            <View style={styles.metricPill}>
              <Text style={styles.metricLabel}>Absent</Text>
              <Text style={[styles.metricValue, { color: DANGER }]}>{attendanceTotalsAll.absent}</Text>
            </View>
          </View>
        </View>

        {/* Sticky filter tabs */}
        <View style={styles.tabsWrapper}>
          <View
            style={[styles.filterTabs, { height: 44 }]}
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
                        translateX: Animated.multiply(tabAnim, tabWidthState / tabOptions.length || 0),
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
                  activeOpacity={0.85}
                >
                  <Text style={[styles.filterText, active && styles.filterTextActive]}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Child list */}
        {showList && children.length > 1 && (
          <View style={[styles.card, { marginTop: 12 }]}>
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
                    <Text style={[styles.childName, active && { color: PRIMARY }]}>
                      {c.name || `Child ${i + 1}`}
                    </Text>
                    {active && <Ionicons name="checkmark-circle" size={18} color={PRIMARY} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Course cards */}
        <View style={{ marginTop: 12 }}>
          {courses.map((c) => {
            const courseAttendance = filteredAttendance[c.courseId] || {};
            const entries = Object.entries(courseAttendance).sort((a, b) => moment(b[0]).valueOf() - moment(a[0]).valueOf());

            let attendancePercent = 0;
            if (tab !== "daily") {
              const total = entries.length;
              const attended = entries.filter(([, s]) => String(s).toLowerCase() === "present" || String(s).toLowerCase() === "late").length;
              attendancePercent = total > 0 ? Math.round((attended / total) * 100) : 0;
            }

            const isExpanded = !!expandedCourses[c.courseId];

            return (
              <View key={c.courseId} style={[styles.card, { marginBottom: 12 }]}>
                <TouchableOpacity
                  onPress={() =>
                    setExpandedCourses((prev) => ({ ...prev, [c.courseId]: !prev[c.courseId] }))
                  }
                  activeOpacity={0.88}
                >
                  <View style={styles.courseHead}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.courseName}>{c.name}</Text>
                      <Text style={styles.teacher}>Teacher: {c.teacherName}</Text>
                    </View>

                    <View style={styles.percentChip}>
                      <Text style={styles.percentText}>
                        {tab === "daily" ? "Today" : `${attendancePercent}%`}
                      </Text>
                      <Ionicons
                        name={isExpanded ? "chevron-up" : "chevron-down"}
                        size={16}
                        color={PRIMARY}
                        style={{ marginLeft: 6 }}
                      />
                    </View>
                  </View>

                  {tab !== "daily" && (
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${attendancePercent}%`,
                            backgroundColor:
                              attendancePercent >= 80 ? SUCCESS : attendancePercent >= 50 ? WARNING : DANGER,
                          },
                        ]}
                      />
                    </View>
                  )}
                </TouchableOpacity>

                {(tab === "daily" || isExpanded) && (
                  <View style={{ marginTop: 10 }}>
                    {entries.length === 0 ? (
                      <Text style={styles.noRecords}>No attendance recorded</Text>
                    ) : (
                      entries.map(([date, status]) => {
                        const sc = statusColor(status);
                        const s = String(status || "").toUpperCase();
                        const icon =
                          s === "PRESENT"
                            ? "checkmark-circle"
                            : s === "LATE"
                            ? "time"
                            : "close-circle";

                        return (
                          <View key={date} style={styles.attRow}>
                            <View style={[styles.statusDot, { backgroundColor: sc }]} />
                            <Text style={styles.attDate}>{moment(date).format("DD MMM, ddd")}</Text>
                            <View style={styles.statusWrap}>
                              <Ionicons name={icon} size={16} color={sc} style={{ marginRight: 6 }} />
                              <Text style={[styles.attStatus, { color: sc }]}>{s}</Text>
                            </View>
                          </View>
                        );
                      })
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {refreshingBg && (
          <View style={{ marginTop: 8, alignItems: "center" }}>
            <Text style={{ fontSize: 12, color: MUTED }}>Refreshing latest attendance…</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },

  headerCard: {
    backgroundColor: CARD,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
  },
  headerTop: { flexDirection: "row", alignItems: "center" },
  avatar: { marginRight: 12, backgroundColor: "#E5E7EB" },
  name: { color: TEXT, fontWeight: "800" },
  subText: { color: MUTED, fontSize: 13, marginTop: 2 },
  switchBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#EEF4FF",
    alignItems: "center",
    justifyContent: "center",
  },

  metricRow: { flexDirection: "row", marginTop: 14, gap: 8 },
  metricPill: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  metricLabel: { fontSize: 12, color: MUTED, fontWeight: "600" },
  metricValue: { marginTop: 3, fontSize: 16, color: TEXT, fontWeight: "800" },

  tabsWrapper: {
    backgroundColor: "#FFFFFF",
    paddingTop: 6,
    paddingBottom: 6,
    zIndex: 5,
  },
  filterTabs: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DCE3F5",
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
    marginHorizontal: 2,
  },
  filterTab: { flex: 1, paddingVertical: 10, alignItems: "center", backgroundColor: "transparent" },
  filterText: { fontWeight: "700", fontSize: 13, color: "#475569", letterSpacing: 0.3 },
  filterTextActive: { color: "#0F172A" },
  filterIndicator: {
    position: "absolute",
    top: 4,
    bottom: 4,
    left: 0,
    backgroundColor: "rgba(30,144,255,0.18)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(30,144,255,0.45)",
  },

  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
  },
  sectionTitle: { fontSize: 14, color: TEXT, fontWeight: "800" },

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
  childRowActive: { backgroundColor: "#EEF4FF", borderColor: "#BFDBFE" },
  childName: { fontSize: 14, color: TEXT, fontWeight: "700" },

  courseHead: { flexDirection: "row", alignItems: "flex-start" },
  courseName: { fontSize: 16, color: TEXT, fontWeight: "800" },
  teacher: { marginTop: 3, fontSize: 13, color: MUTED, fontWeight: "600" },

  percentChip: {
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FBFF",
  },
  percentText: { fontSize: 14, fontWeight: "800", color: PRIMARY },

  progressTrack: {
    marginTop: 10,
    height: 8,
    borderRadius: 99,
    backgroundColor: "#E5E7EB",
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 99 },

  attRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: { width: 9, height: 9, borderRadius: 4.5, marginRight: 8 },
  attDate: { flex: 1, fontSize: 13, color: TEXT },
  statusWrap: { flexDirection: "row", alignItems: "center" },
  attStatus: { fontSize: 12, fontWeight: "700" },

  noRecords: { fontSize: 13, color: MUTED, paddingVertical: 4 },

  emptyTitle: { fontSize: 18, color: TEXT, fontWeight: "800", textAlign: "center" },
  emptySubtitle: { fontSize: 14, color: MUTED, textAlign: "center", marginTop: 6 },
});