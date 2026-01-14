import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { ref, get } from "firebase/database";
import AsyncStorage from "@react-native-async-storage/async-storage";
import moment from "moment";
import { database } from "../../constants/firebaseConfig";
import { useRouter } from "expo-router";

export default function Attendance() {
  const router = useRouter();
  const [parentId, setParentId] = useState(null);
  const [children, setChildren] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [childUser, setChildUser] = useState(null);
  const [attendanceData, setAttendanceData] = useState({});
  const [courses, setCourses] = useState([]);
  const [tab, setTab] = useState("daily");
  const [showList, setShowList] = useState(false);
  const [cache, setCache] = useState({});
  const [expandedCourses, setExpandedCourses] = useState({});
  const [loading, setLoading] = useState(true);

  const progressAnim = useRef({}).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const dropdownOpacity = useRef(new Animated.Value(0)).current;
  const dropdownTrans = useRef(new Animated.Value(-10)).current;
  const skeletonAnim = useRef(new Animated.Value(0)).current;
  const tabAnim = useRef(new Animated.Value(0)).current;

  const tabOptions = ["daily", "weekly", "monthly"];

  const { width, height } = useWindowDimensions();
  const isTiny = width < 340;
  const isSmall = width >= 340 && width < 360;
  const isMedium = width >= 360 && width < 400;
  const isTablet = width >= 768;
  const scale = isTiny ? 0.85 : isSmall ? 0.9 : isMedium ? 0.95 : isTablet ? 1.1 : 1.0;
  const fontScale = isTiny ? 0.9 : isSmall ? 0.92 : isMedium ? 0.97 : isTablet ? 1.08 : 1.0;
  const avatarSize = isTiny ? 58 : isSmall ? 64 : isTablet ? 84 : Math.round(74 * scale);
  const headerPadding = Math.round(22 * scale);
  const headerRadius = Math.round(20 * scale);
  const headerMinH = isTiny ? 110 : isSmall ? 120 : isTablet ? 140 : 130;
  const headerChevronSize = isTiny ? 16 : isSmall ? 18 : isTablet ? 22 : 20;
  const dropdownTop = headerPadding + avatarSize + Math.round(24 * scale);
  const dropdownMaxH = Math.min(Math.round(height * 0.5), 360);
  const chipPadH = isTiny ? 6 : isSmall ? 8 : Math.round(10 * scale);
  const chipPadV = isTiny ? 3 : isSmall ? 4 : Math.round(6 * scale);
  const pillPadH = isTiny ? 8 : isSmall ? 10 : Math.round(12 * scale);
  const pillPadV = isTiny ? 6 : isSmall ? 8 : Math.round(10 * scale);
  const H_MARGIN = Math.round(16 * (isTiny ? 0.85 : scale));
  const cardPad = Math.round(16 * (isTiny ? 0.85 : scale));
  const rowPadV = Math.round(8 * (isTiny ? 0.85 : scale));
  const tabHeight = isTiny ? 38 : isSmall ? 40 : 44;
  const tabFontSize = Math.round(13 * fontScale);
  const tabWidth = Math.max(Math.floor((width - H_MARGIN * 2) / tabOptions.length), 88);

  const defaultProfile = "https://cdn-icons-png.flaticon.com/512/847/847969.png";

  useEffect(() => {
    AsyncStorage.getItem("parentId").then((id) => {
      if (id) setParentId(id);
    });
  }, []);

  useEffect(() => {
    if (!parentId) return;

    const loadData = async () => {
      setLoading(true);
      const [parentsSnap, studentsSnap, usersSnap, attendanceSnap, coursesSnap, teachersSnap, assignSnap] =
        await Promise.all([
          get(ref(database, "Parents")),
          get(ref(database, "Students")),
          get(ref(database, "Users")),
          get(ref(database, "Attendance")),
          get(ref(database, "Courses")),
          get(ref(database, "Teachers")),
          get(ref(database, "TeacherAssignments")),
        ]);

      const data = {
        parents: parentsSnap.val() || {},
        students: studentsSnap.val() || {},
        users: usersSnap.val() || {},
        attendance: attendanceSnap.val() || {},
        courses: coursesSnap.val() || {},
        teachers: teachersSnap.val() || {},
        assignments: assignSnap.val() || {},
      };

      setCache(data);

      const parent = data.parents[parentId];
      const kids = parent?.children ? Object.values(parent.children) : [];
      setChildren(kids);

      if (kids.length > 0) loadChild(kids[0], 0, data);
      setLoading(false);
    };

    loadData();
  }, [parentId]);

  const loadChild = (child, index, data) => {
    const student = data.students[child.studentId];
    if (!student) return;

    const user = data.users[student.userId];
    setChildUser({
      ...user,
      grade: student.grade,
      section: student.section,
      studentId: child.studentId,
    });

    setAttendanceData(data.attendance || {});

    const courseList = Object.keys(data.courses)
      .map((id) => ({ courseId: id, ...data.courses[id] }))
      .filter((c) => c.grade === student.grade && (c.section || "") === student.section)
      .map((course) => {
        const assign = Object.values(data.assignments).find((a) => a.courseId === course.courseId);
        const teacherId = assign ? assign.teacherId : null;
        const teacherName = assign ? data.users[data.teachers[assign.teacherId]?.userId]?.name || "N/A" : "N/A";
        const teacherUserId = teacherId ? data.teachers[teacherId]?.userId : null;
        return { ...course, teacherName, teacherId, teacherUserId };
      });

    setCourses(courseList);
    setCurrentIndex(index);
    setShowList(false);
    setExpandedCourses({});
  };

  const filteredAttendance = useMemo(() => {
    if (!childUser?.studentId) return {};

    const studentId = childUser.studentId;
    const now = moment();

    return courses.reduce((acc, course) => {
      const courseAttendance = attendanceData[course.courseId] || {};
      let filtered = {};

      if (tab === "daily") {
        const today = now.format("YYYY-MM-DD");
        const status = courseAttendance[today]?.[studentId];
        if (status) filtered[today] = status;
      } else {
        Object.entries(courseAttendance).forEach(([date, students]) => {
          const m = moment(date, "YYYY-MM-DD");
          if ((tab === "weekly" && m.isSame(now, "week")) || (tab === "monthly" && m.isSame(now, "month"))) {
            const status = students?.[studentId];
            if (status) filtered[date] = status;
          }
        });
      }

      acc[course.courseId] = filtered;
      return acc;
    }, {});
  }, [attendanceData, childUser, courses, tab]);

  const statusColor = (status) => {
    switch (status) {
      case "present":
        return "#16a34a";
      case "absent":
        return "#dc2626";
      case "late":
        return "#f59e0b";
      default:
        return "#6b7280";
    }
  };

  const attendanceTotalsAll = useMemo(() => {
    const totals = { present: 0, late: 0, absent: 0 };
    if (!childUser?.studentId) return totals;
    const studentId = childUser.studentId;
    Object.values(attendanceData).forEach((courseAttendance) => {
      Object.entries(courseAttendance).forEach(([date, students]) => {
        const status = students?.[studentId];
        if (status === "present") totals.present += 1;
        else if (status === "late") totals.late += 1;
        else if (status === "absent") totals.absent += 1;
      });
    });
    return totals;
  }, [attendanceData, childUser]);

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.timing(skeletonAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
        easing: Easing.linear,
      })
    );
    shimmer.start();
    return () => shimmer.stop();
  }, [skeletonAnim]);

  useEffect(() => {
    if (showList) {
      backdropOpacity.setValue(0);
      dropdownOpacity.setValue(0);
      dropdownTrans.setValue(-10);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(dropdownOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(dropdownTrans, {
          toValue: 0,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      backdropOpacity.setValue(0);
      dropdownOpacity.setValue(0);
      dropdownTrans.setValue(-10);
    }
  }, [showList]);

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

  const renderShimmer = (style) => {
    const translateX = skeletonAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [-60, 200],
    });
    return (
      <View style={[styles.skeletonBase, style]}>
        <Animated.View
          style={[
            styles.skeletonShimmer,
            {
              transform: [{ translateX }],
            },
          ]}
        />
      </View>
    );
  };

  const renderSkeleton = () => (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { padding: headerPadding, borderRadius: headerRadius, minHeight: headerMinH }]}>
          <View style={styles.headerLeft}>
            {renderShimmer({ width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2, marginRight: 16 })}
            <View style={styles.headerText}>
              {renderShimmer({ height: 18, width: "70%", marginBottom: 10 })}
              <View style={styles.chipRow}>
                {renderShimmer({ height: 22, width: 90, borderRadius: 12, marginRight: 8, marginBottom: 6 })}
                {renderShimmer({ height: 22, width: 90, borderRadius: 12, marginBottom: 6 })}
              </View>
            </View>
          </View>
          <View style={[styles.headerMetricsRow, { marginTop: isSmall ? 8 : 14 }]}>
            {renderShimmer({ height: 60, flex: 1, borderRadius: 12, marginRight: 8 })}
            {renderShimmer({ height: 60, flex: 1, borderRadius: 12, marginRight: 8 })}
            {renderShimmer({ height: 60, flex: 1, borderRadius: 12 })}
          </View>
        </View>

        <View style={styles.tabsWrapper}>
          <View style={styles.tabs}>
            {renderShimmer({ height: 32, flex: 1, borderRadius: 10, marginHorizontal: 4 })}
            {renderShimmer({ height: 32, flex: 1, borderRadius: 10, marginHorizontal: 4 })}
            {renderShimmer({ height: 32, flex: 1, borderRadius: 10, marginHorizontal: 4 })}
          </View>
        </View>

        <View style={styles.body}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.courseCard}>
              {renderShimmer({ height: 16, width: "60%", borderRadius: 10, marginBottom: 10 })}
              {renderShimmer({ height: 12, width: "40%", borderRadius: 10, marginBottom: 14 })}
              {renderShimmer({ height: 10, width: "100%", borderRadius: 8, marginBottom: 10 })}
              {renderShimmer({ height: 10, width: "70%", borderRadius: 8, marginBottom: 12 })}
              {[1, 2].map((j) => (
                <View key={j} style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                  {renderShimmer({ height: 10, width: 10, borderRadius: 5, marginRight: 10 })}
                  {renderShimmer({ height: 12, width: "50%", borderRadius: 8 })}
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  if (loading) return renderSkeleton();

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        stickyHeaderIndices={[1]}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <LinearGradient
          colors={["#f7f9fc", "#eef3ff"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { padding: headerPadding, borderRadius: headerRadius, minHeight: headerMinH }]}
        >
          <TouchableOpacity
            style={styles.headerLeft}
            onPress={() => setShowList(!showList)}
            activeOpacity={0.85}
          >
            <Image
              source={{ uri: childUser?.profileImage || defaultProfile }}
              style={[styles.avatar, { width: avatarSize, height: avatarSize, borderRadius: Math.round(avatarSize / 2) }]}
            />

            <View style={styles.headerText}>
              <Text style={[styles.childName, { fontSize: Math.round(20 * fontScale) }]} numberOfLines={1}>
                {childUser?.name || "Student"}
              </Text>
              <View style={styles.chipRow}>
                <View style={[styles.chip, { paddingHorizontal: chipPadH, paddingVertical: chipPadV }]}>
                  <Text style={[styles.chipText, { fontSize: Math.round(13 * fontScale) }]}>Grade {childUser?.grade ?? "--"}</Text>
                </View>
                <View style={[styles.chip, { paddingHorizontal: chipPadH, paddingVertical: chipPadV }]}>
                  <Text style={[styles.chipText, { fontSize: Math.round(13 * fontScale) }]}>Section {childUser?.section ?? "--"}</Text>
                </View>
              </View>
            </View>

            {children.length > 1 && (
              <Ionicons
                name={showList ? "chevron-up" : "chevron-down"}
                size={headerChevronSize}
                color="#2563eb"
                style={[styles.headerArrow, { marginTop: -50 * scale }]}
              />
            )}
          </TouchableOpacity>
          <View style={[styles.headerMetricsRow, { marginTop: isSmall ? 8 : 14 }]}>
            <View style={[styles.metricPillPrimary, { paddingHorizontal: pillPadH, paddingVertical: pillPadV }]}>
              <Text style={[styles.pillLabel, { fontSize: Math.round(12 * fontScale) }]}>Present</Text>
              <Text style={[styles.pillValue, { fontSize: Math.round(16 * fontScale) }]}>{attendanceTotalsAll.present}</Text>
            </View>
            <View style={[styles.metricPill, { paddingHorizontal: pillPadH, paddingVertical: pillPadV }]}>
              <Text style={[styles.pillLabel, { fontSize: Math.round(12 * fontScale) }]}>Late</Text>
              <Text style={[styles.pillValue, { fontSize: Math.round(16 * fontScale) }]}>{attendanceTotalsAll.late}</Text>
            </View>
            <View style={[styles.metricPill, { paddingHorizontal: pillPadH, paddingVertical: pillPadV }]}>
              <Text style={[styles.pillLabel, { fontSize: Math.round(12 * fontScale) }]}>Absent</Text>
              <Text style={[styles.pillValue, { fontSize: Math.round(16 * fontScale) }]}>{attendanceTotalsAll.absent}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* TABS (sticky) */}
        <View style={styles.tabsWrapper}>
          <View style={[styles.tabs, { height: 44 }]}>
            <Animated.View
              style={[
                styles.tabIndicator,
                {
                  width: tabWidth - 12,
                  transform: [
                    {
                      translateX: tabAnim.interpolate({
                        inputRange: [0, tabOptions.length - 1],
                        outputRange: [6, tabWidth * (tabOptions.length - 1) + 6],
                      }),
                    },
                  ],
                },
              ]}
            />
            {tabOptions.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.tab, { width: tabWidth }]}
                onPress={() => setTab(t)}
                activeOpacity={0.85}
              >
                <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                  {t.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* BODY */}
        <View style={styles.body}>
          {courses.map((c) => {
            const courseAttendance = filteredAttendance[c.courseId] || {};
            let attendancePercent = 0;

            if (tab !== "daily") {
              const totalDays = Object.keys(courseAttendance).length;
              const attendedDays = Object.values(courseAttendance).filter((s) => s === "present" || s === "late").length;
              attendancePercent = totalDays > 0 ? Math.round((attendedDays / totalDays) * 100) : 0;
            }

            if (!progressAnim[c.courseId]) {
              progressAnim[c.courseId] = new Animated.Value(0);
            }

            Animated.timing(progressAnim[c.courseId], {
              toValue: attendancePercent,
              duration: 800,
              useNativeDriver: false,
              easing: Easing.inOut(Easing.ease),
            }).start();

            const isExpanded = expandedCourses[c.courseId];

            return (
              <TouchableOpacity
                key={c.courseId}
                onPress={() =>
                  setExpandedCourses((prev) => ({
                    ...prev,
                    [c.courseId]: !prev[c.courseId],
                  }))
                }
                activeOpacity={0.9}
                style={styles.courseCard}
              >
                <View style={styles.courseHeader}>
                  <Text style={styles.courseName}>{c.name}</Text>
                  <Text style={styles.teacher}>
                    👨‍🏫 
                    <Text
                      style={{ }}
                      onPress={() => {
                        if (c.teacherId) {
                          router.push({
                            pathname: '/userProfile',
                            params: {
                              recordId: c.teacherId,
                              userId: c.teacherUserId,
                              roleName: 'Teacher',
                            },
                          });
                        }
                      }}
                    >
                      {c.teacherName}
                    </Text>
                  </Text>
                </View>

                <View style={styles.courseBadgeRow}>
                  <View style={styles.courseBadge}>
                    <Text style={styles.courseBadgeText}>
                      {tab === "daily" ? "Today" : tab === "weekly" ? "This week" : "This month"}
                    </Text>
                  </View>
                  {tab !== "daily" && (
                    <Text style={styles.courseBadgeMeta}>{attendancePercent}% attendance</Text>
                  )}
                </View>

                {tab !== "daily" && (
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBarBackground}>
                      <Animated.View
                        style={[
                          styles.progressBarFill,
                          {
                            width: progressAnim[c.courseId].interpolate({
                              inputRange: [0, 100],
                              outputRange: ["0%", "100%"],
                            }),
                            backgroundColor:
                              attendancePercent >= 80
                                ? "#16a34a"
                                : attendancePercent >= 50
                                ? "#fbbf24"
                                : "#dc2626",
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>{attendancePercent}%</Text>
                  </View>
                )}

                {(tab === "daily" || isExpanded) &&
                  Object.keys(courseAttendance).length > 0 &&
                  Object.entries(courseAttendance).map(([date, status]) => (
                    <View key={date} style={styles.attRow}>
                      <View style={[styles.statusDot, { backgroundColor: statusColor(status) }]} />
                      <Text style={styles.attDate}>{moment(date).format("DD MMM, ddd")}</Text>
                      <View style={styles.statusWrap}>
                        <Ionicons
                          name={status === "present" ? "checkmark-circle" : status === "late" ? "time" : "close-circle"}
                          size={16}
                          color={statusColor(status)}
                          style={{ marginRight: 6 }}
                        />
                        <Text style={[styles.attStatus, { color: statusColor(status) }]}>{status.toUpperCase()}</Text>
                      </View>
                    </View>
                  ))}
                {(tab === "daily" || isExpanded) && Object.keys(courseAttendance).length === 0 && (
                  <Text style={styles.noRecords}>No attendance recorded</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* DROPDOWN */}
      {children.length > 1 && showList && (
        <>
          <TouchableWithoutFeedback onPress={() => setShowList(false)}>
            <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
          </TouchableWithoutFeedback>

          <Animated.View
            style={[
              styles.dropdown,
              {
                top: dropdownTop,
                maxWidth: Math.min(460, width - 24),
                opacity: dropdownOpacity,
                transform: [{ translateY: dropdownTrans }],
              },
            ]}
          >
            <View style={styles.dropdownHandle} />
            <View style={styles.dropdownHeader}>
              <View>
                <Text style={[styles.dropdownTitle, { fontSize: Math.round(16 * fontScale) }]}>Select your child</Text>
                <Text style={[styles.dropdownSubtitle, { fontSize: Math.round(12 * fontScale) }]}>
                  {children.length} profiles · Grade {childUser?.grade ?? "--"} / Section {childUser?.section ?? "--"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowList(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.dropdownClose}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color="#0f172a" />
              </TouchableOpacity>
            </View>

            <ScrollView style={[styles.dropdownScroll, { maxHeight: dropdownMaxH }]} nestedScrollEnabled>
              {children.map((c, i) => {
                const s = cache.students?.[c.studentId];
                const u = cache.users?.[s?.userId];

                return (
                  <TouchableOpacity
                    key={c.studentId}
                    style={[
                      styles.dropdownItem,
                      currentIndex === i && styles.dropdownActive,
                      { paddingHorizontal: isSmall ? 8 : 10, paddingVertical: isSmall ? 10 : 12 },
                    ]}
                    onPress={() => loadChild(c, i, cache)}
                    activeOpacity={0.85}
                  >
                    <Image
                      source={{ uri: u?.profileImage || defaultProfile }}
                      style={[
                        styles.dropdownAvatar,
                        { width: isSmall ? 36 : 40, height: isSmall ? 36 : 40, borderRadius: isSmall ? 18 : 20 },
                      ]}
                    />
                    <View style={styles.dropdownContent}>
                      <Text style={[styles.dropdownText, { fontSize: Math.round(15 * fontScale) }]} numberOfLines={1}>
                        {u?.name || "Student"}
                      </Text>
                      <Text style={[styles.dropdownMeta, { fontSize: Math.round(12 * fontScale) }]} numberOfLines={1}>
                        Grade {s?.grade ?? "--"} · Section {s?.section ?? "--"}
                      </Text>
                    </View>
                    <Ionicons
                      name={currentIndex === i ? "checkmark-circle" : "chevron-forward"}
                      size={18}
                      color={currentIndex === i ? "#2563eb" : "#94a3b8"}
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Animated.View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6" },
  scrollContent: { paddingBottom: 24 },
  header: {
    marginHorizontal: 8,
    marginTop: 12,
    marginBottom: 10,
    borderRadius: 20,
    padding: 22,
    elevation: 8,
    minHeight: 150,
    zIndex: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 78, height: 78, borderRadius: 39, marginRight: 16 },
  headerText: { flex: 1, marginLeft: 4, paddingTop: 4 },
  childName: { fontSize: 20, fontWeight: "800", letterSpacing: -0.2, color: "#0f172a" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 8 },
  chip: {
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 6,
  },
  chipText: { fontSize: 13, color: "#0f172a", fontWeight: "600" },
  headerArrow: { marginLeft: 8 },
  headerMetricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
  },
  metricPill: {
    flex: 1,
    backgroundColor: "#f8fafc",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  metricPillPrimary: {
    flex: 1,
    backgroundColor: "#e0f2fe",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  pillLabel: { fontSize: 12, color: "#64748b", marginBottom: 4, fontWeight: "600" },
  pillValue: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  tabs: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    backgroundColor: "#e5e7eb",
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
  },
  tabsWrapper: {
    backgroundColor: "transparent", // Make tab selector background transparent
    paddingTop: 6,
    paddingBottom: 6,
    zIndex: 5,
    elevation: 4,
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  tab: { paddingVertical: 10, alignItems: "center" },
  tabActive: {},
  tabText: { fontSize: 13, fontWeight: "700", color: "#475569", letterSpacing: 0.3 },
  tabTextActive: { color: "#2563eb", fontWeight: "bold", textShadowColor: "#fff", textShadowOffset: {width: 0, height: 1}, textShadowRadius: 2 },
  tabIndicator: {
    position: "absolute",
    top: 4,
    bottom: 4,
    left: 0,
    backgroundColor: "#fff",
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  body: { paddingHorizontal: 16, marginTop: 16 },
  courseCard: {
    marginBottom: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  courseHeader: { marginBottom: 12 },
  courseName: { fontSize: 16, fontWeight: "600", color: "#111827" },
  teacher: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  attRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomColor: "#f3f4f6",
    borderBottomWidth: 1,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  attDate: { flex: 1, fontSize: 13, color: "#111827" },
  statusWrap: { flexDirection: "row", alignItems: "center" },
  attStatus: { fontSize: 13, fontWeight: "600" },
  noRecords: { fontSize: 13, color: "#6b7280", paddingVertical: 6 },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    marginTop: 4,
  },
  progressBarBackground: {
    flex: 1,
    height: 10,
    backgroundColor: "#e5e7eb",
    borderRadius: 5,
    overflow: "hidden",
    marginRight: 8,
  },
  progressBarFill: {
    height: 10,
    borderRadius: 5,
  },
  progressText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 23, 42, 0.57)",
    zIndex: 50,
  },
  dropdown: {
    position: "absolute",
    top: 104,
    alignSelf: "center",
    width: "94%",
    maxWidth: 460,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 12,
    elevation: 14,
    zIndex: 999,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  dropdownHandle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
    marginBottom: 10,
  },
  dropdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  dropdownClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
  },
  dropdownTitle: { fontSize: 16, fontWeight: "800", color: "#0f172a", letterSpacing: -0.2 },
  dropdownSubtitle: { fontSize: 12, color: "#64748b", marginTop: 2 },
  dropdownScroll: { maxHeight: 280, paddingVertical: 4 },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
    marginTop: 6,
  },
  dropdownActive: { backgroundColor: "#eef2ff", borderColor: "#cbd5e1" },
  dropdownAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: "#e2e8f0",
  },
  dropdownContent: { flex: 1, maxWidth: "72%" },
  dropdownText: { fontSize: 15, fontWeight: "700", color: "#0f172a", letterSpacing: -0.1 },
  dropdownMeta: { fontSize: 12, color: "#64748b", marginTop: 2 },
  courseBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  courseBadge: {
    backgroundColor: "#e0f2fe",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  courseBadgeText: { fontSize: 12, fontWeight: "700", color: "#0f172a", letterSpacing: 0.2 },
  courseBadgeMeta: { fontSize: 12, color: "#475569", fontWeight: "600" },
  skeletonBase: {
    overflow: "hidden",
    backgroundColor: "#e5e7eb",
    position: "relative",
  },
  skeletonShimmer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 80,
    backgroundColor: "rgba(255,255,255,0.6)",
    opacity: 0.7,
  },
});
