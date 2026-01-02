import { useEffect, useState, useMemo, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  Dimensions,
} from "react-native";
import { ref, get } from "firebase/database";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { database } from "../../constants/firebaseConfig";
import moment from "moment";

export default function Attendance() {
  const [parentId, setParentId] = useState(null);
  const [children, setChildren] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [childUser, setChildUser] = useState(null);
  const [attendanceData, setAttendanceData] = useState({});
  const [courses, setCourses] = useState([]);
  const [tab, setTab] = useState("daily");
  const [showList, setShowList] = useState(false);
  const [cache, setCache] = useState({});
  const [expandedCourses, setExpandedCourses] = useState({}); // track expanded courses

  const defaultProfile =
    "https://cdn-icons-png.flaticon.com/512/847/847969.png";

  const progressAnim = useRef({}).current;
  const dropdownAnim = useRef(new Animated.Value(0)).current;

  const windowHeight = Dimensions.get("window").height;

  // Load parentId from AsyncStorage
  useEffect(() => {
    AsyncStorage.getItem("parentId").then((id) => {
      if (id) setParentId(id);
    });
  }, []);

  // Load data from Firebase
  useEffect(() => {
    if (!parentId) return;

    const loadData = async () => {
      const [
        parentsSnap,
        studentsSnap,
        usersSnap,
        attendanceSnap,
        coursesSnap,
        teachersSnap,
        assignSnap,
      ] = await Promise.all([
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
    };

    loadData();
  }, [parentId]);

  // Load selected child
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
      .filter(
        (c) => c.grade === student.grade && (c.section || "") === student.section
      )
      .map((course) => {
        const assign = Object.values(data.assignments).find(
          (a) => a.courseId === course.courseId
        );
        const teacherName = assign
          ? data.users[data.teachers[assign.teacherId]?.userId]?.name || "N/A"
          : "N/A";
        return { ...course, teacherName };
      });

    setCourses(courseList);
    setCurrentIndex(index);
    setShowList(false);
    setExpandedCourses({}); // reset expanded
  };

  // Filtered attendance per course
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
          if (
            (tab === "weekly" && m.isSame(now, "week")) ||
            (tab === "monthly" && m.isSame(now, "month"))
          ) {
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

  useEffect(() => {
    Animated.timing(dropdownAnim, {
      toValue: showList ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
      easing: Easing.inOut(Easing.ease),
    }).start();
  }, [showList]);

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <Image
          source={{ uri: childUser?.profileImage || defaultProfile }}
          style={styles.avatar}
        />
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={styles.childName}>{childUser?.name || "Student"}</Text>
          <Text style={styles.grade}>
            Grade {childUser?.grade || "-"} - {childUser?.section || "-"}
          </Text>
        </View>
        {children.length > 1 && (
          <TouchableOpacity
            onPress={() => setShowList(!showList)}
            style={styles.dropdownBtn}
          >
            <Text style={styles.dropdown}>▼</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* FLOATING DROPDOWN */}
      {children.length > 1 && showList && (
        <Animated.View
          style={[
            styles.dropdownList,
            {
              opacity: dropdownAnim,
              top: 90, // adjust distance below header
              zIndex: 9999,
              elevation: 10,
              transform: [
                {
                  scaleY: dropdownAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1],
                  }),
                },
              ],
            },
          ]}
        >
          {children.map((c, i) => {
            const s = cache.students?.[c.studentId];
            const u = cache.users?.[s?.userId];
            return (
              <TouchableOpacity
                key={c.studentId}
                onPress={() => loadChild(c, i, cache)}
                style={[
                  styles.dropdownItemContainer,
                  currentIndex === i && { backgroundColor: "#eef2ff" },
                ]}
              >
                <Text style={styles.dropdownItem}>{u?.name || "Student"}</Text>
              </TouchableOpacity>
            );
          })}
        </Animated.View>
      )}

      {/* TABS */}
      <View style={styles.tabs}>
        {["daily", "weekly", "monthly"].map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* BODY */}
      <ScrollView style={styles.body}>
        {courses.map((c) => {
          const courseAttendance = filteredAttendance[c.courseId] || {};
          let attendancePercent = 0;

          if (tab !== "daily") {
            const totalDays = Object.keys(courseAttendance).length;
            const attendedDays = Object.values(courseAttendance).filter(
              (s) => s === "present" || s === "late"
            ).length;
            attendancePercent =
              totalDays > 0 ? Math.round((attendedDays / totalDays) * 100) : 0;
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
                <Text style={styles.teacher}>👨‍🏫 {c.teacherName}</Text>
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
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: statusColor(status) },
                      ]}
                    />
                    <Text style={styles.attDate}>
                      {moment(date).format("DD MMM, ddd")}
                    </Text>
                    <Text
                      style={[styles.attStatus, { color: statusColor(status) }]}
                    >
                      {status.toUpperCase()}
                    </Text>
                  </View>
                ))}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    margin: 16,
    elevation: 4,
    zIndex: 1,
  },
  avatar: { width: 60, height: 60, borderRadius: 30 },
  childName: { fontSize: 18, fontWeight: "700", color: "#111827" },
  grade: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  dropdownBtn: { paddingHorizontal: 8 },
  dropdown: { fontSize: 16, color: "#2563eb" },
  dropdownList: {
    position: "absolute",
    right: 16,
    backgroundColor: "#fff",
    padding: 8,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    overflow: "hidden",
  },
  dropdownItemContainer: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  dropdownItem: { fontSize: 14, color: "#111827" },
  tabs: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: "#e5e7eb",
    borderRadius: 12,
  },
  tab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 12 },
  tabActive: { backgroundColor: "#2563eb" },
  tabText: { fontSize: 13, fontWeight: "600", color: "#6b7280" },
  tabTextActive: { color: "#fff" },
  body: { paddingHorizontal: 16, marginTop: 16 },
  courseCard: {
    marginBottom: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    elevation: 3,
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
  attStatus: { fontSize: 13, fontWeight: "600" },
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
});
