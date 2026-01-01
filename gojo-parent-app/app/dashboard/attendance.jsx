import { useEffect, useState, useRef, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Dimensions,
  Animated,
} from "react-native";
import { ref, get } from "firebase/database";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { database } from "../../constants/firebaseConfig";
import moment from "moment";
import Svg, { Circle } from "react-native-svg";

const { height } = Dimensions.get("window");
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/* =======================
   CIRCLE PROGRESS
======================= */
const CircleProgress = ({
  percentage,
  radius = 36,
  strokeWidth = 6,
  color,
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: percentage,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [percentage]);

  const strokeDashoffset = animatedValue.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
  });

  const size = (radius + strokeWidth) * 2;

  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </Svg>
      <View style={styles.circleText}>
        <Text style={{ fontWeight: "800", fontSize: 14, color }}>
          {Math.round(percentage)}%
        </Text>
      </View>
    </View>
  );
};

/* =======================
   MAIN SCREEN
======================= */
export default function Attendance() {
  const [parentId, setParentId] = useState(null);
  const [children, setChildren] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [childUser, setChildUser] = useState(null);
  const [attendanceData, setAttendanceData] = useState({});
  const [courses, setCourses] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [tab, setTab] = useState("daily");
  const [cache, setCache] = useState({});
  const [showList, setShowList] = useState(false);

  const defaultProfile =
    "https://cdn-icons-png.flaticon.com/512/847/847969.png";

  /* =======================
     LOAD PARENT ID
  ======================= */
  useEffect(() => {
    AsyncStorage.getItem("parentId").then((id) => {
      if (id) setParentId(id);
    });
  }, []);

  /* =======================
     FETCH ALL DATA ONCE
  ======================= */
  useEffect(() => {
    if (!parentId) return;

    const load = async () => {
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
      const kids = parent?.children
        ? Object.values(parent.children)
        : [];

      setChildren(kids);

      if (kids.length > 0) loadChild(kids[0], 0, data);
    };

    load();
  }, [parentId]);

  /* =======================
     LOAD CHILD
  ======================= */
  const loadChild = (child, index, data) => {
    const student = data.students[child.studentId];
    if (!student) return;

    const user = data.users[student.userId || student.use];
    setChildUser({
      ...user,
      grade: student.grade,
      section: student.section,
    });

    /* Attendance filter */
    const filtered = {};
    Object.keys(data.attendance).forEach((courseId) => {
      Object.keys(data.attendance[courseId]).forEach((date) => {
        const status =
          data.attendance[courseId][date][child.studentId];
        if (status) {
          if (!filtered[courseId]) filtered[courseId] = {};
          filtered[courseId][date] = status;
        }
      });
    });
    setAttendanceData(filtered);

    /* Courses + teachers */
    const courseList = Object.keys(data.courses)
      .map((id) => ({ courseId: id, ...data.courses[id] }))
      .filter(
        (c) =>
          c.grade === student.grade &&
          (c.section || c.secation) === student.section
      )
      .map((course) => {
        let teacherName = "N/A";
        const assign = Object.values(data.assignments).find(
          (a) => a.courseId === course.courseId
        );
        if (assign) {
          const t = data.teachers[assign.teacherId];
          teacherName = data.users[t?.userId]?.name || "N/A";
        }
        return { ...course, teacherName };
      });

    setCourses(courseList);
    setCurrentIndex(index);
    setExpanded({});
    setShowList(false);
  };

  /* =======================
     HELPERS
  ======================= */
  const filterAttendance = (courseId) => {
    const data = attendanceData[courseId] || {};
    const now = moment();
    return Object.fromEntries(
      Object.entries(data).filter(([d]) => {
        const m = moment(d, "YYYY-MM-DD");
        if (tab === "daily") return m.isSame(now, "day");
        if (tab === "weekly") return m.isSame(now, "week");
        return m.isSame(now, "month");
      })
    );
  };

  const calcPercent = (courseId) => {
    const data = filterAttendance(courseId);
    const total = Object.keys(data).length;
    if (!total) return 0;
    const present = Object.values(data).filter(
      (s) => s === "present"
    ).length;
    return (present / total) * 100;
  };

  const overallPercent = useMemo(() => {
    let t = 0,
      p = 0;
    Object.keys(attendanceData).forEach((cid) => {
      const d = filterAttendance(cid);
      t += Object.keys(d).length;
      p += Object.values(d).filter((s) => s === "present").length;
    });
    return t ? (p / t) * 100 : 0;
  }, [attendanceData, tab]);

  /* =======================
     RENDER
  ======================= */
  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={[styles.header, { height: height * 0.28 }]}>
        <TouchableOpacity
          style={styles.switch}
          onPress={() => setShowList(!showList)}
        >
          <Text style={styles.switchText}>
            {children[currentIndex]?.relationship || "Child"} ▼
          </Text>
        </TouchableOpacity>

        {showList && (
          <View style={styles.dropdown}>
            {children.map((c, i) => {
              const s = cache.students?.[c.studentId];
              const u = cache.users?.[s?.userId || s?.use];
              return (
                <TouchableOpacity
                  key={c.studentId}
                  onPress={() => loadChild(c, i, cache)}
                >
                  <Text style={styles.dropdownText}>
                    {u?.name || "Student"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <Image
          source={{ uri: childUser?.profileImage || defaultProfile }}
          style={styles.avatar}
        />
        <Text style={styles.name}>{childUser?.name}</Text>
        <Text style={styles.grade}>
          Grade {childUser?.grade} - {childUser?.section}
        </Text>
      </View>

      {/* TABS */}
      <View style={styles.tabs}>
        {["daily", "weekly", "monthly"].map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={tab === t && { color: "#fff" }}>
              {t.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.body}>
        {/* OVERALL */}
        <View style={styles.card}>
          <Text style={styles.title}>Overall Attendance</Text>
          <CircleProgress
            percentage={overallPercent}
            radius={45}
            color="#2563eb"
          />
        </View>

        {/* COURSES */}
        {courses.map((c) => {
          const open = expanded[c.courseId];
          const percent = calcPercent(c.courseId);
          const data = filterAttendance(c.courseId);

          return (
            <View key={c.courseId} style={styles.card}>
              <TouchableOpacity
                style={styles.courseHeader}
                onPress={() =>
                  setExpanded((p) => ({
                    ...p,
                    [c.courseId]: !p[c.courseId],
                  }))
                }
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.course}>{c.name}</Text>
                  <Text style={styles.teacher}>👨‍🏫 {c.teacherName}</Text>
                </View>

                <CircleProgress
                  percentage={percent}
                  color={
                    percent >= 75
                      ? "#16a34a"
                      : percent >= 50
                      ? "#f59e0b"
                      : "#dc2626"
                  }
                />
              </TouchableOpacity>

              {open &&
                Object.keys(data).map((d) => (
                  <View key={d} style={styles.attRow}>
                    <Text>{moment(d).format("DD MMM, ddd")}</Text>
                    <Text
                      style={{
                        fontWeight: "700",
                        color:
                          data[d] === "present"
                            ? "#16a34a"
                            : "#dc2626",
                      }}
                    >
                      {data[d].toUpperCase()}
                    </Text>
                  </View>
                ))}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

/* =======================
   STYLES
======================= */
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    backgroundColor: "#1976D2",
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 4,
    borderColor: "#fff",
  },
  name: { color: "#fff", fontSize: 20, fontWeight: "800" },
  grade: { color: "#e5e7eb" },
  switch: {
    position: "absolute",
    top: 20,
    right: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    padding: 8,
    borderRadius: 20,
  },
  switchText: { color: "#fff", fontWeight: "700" },
  dropdown: {
    position: "absolute",
    top: 60,
    right: 20,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 10,
  },
  dropdownText: { paddingVertical: 6 },
  tabs: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 10,
    backgroundColor: "#e0e7ff",
  },
  tab: {
    padding: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
  },
  tabActive: { backgroundColor: "#1976D2" },
  body: { padding: 16 },
  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 18,
    marginBottom: 16,
    elevation: 4,
  },
  title: { fontSize: 18, fontWeight: "800", marginBottom: 8 },
  courseHeader: { flexDirection: "row", alignItems: "center" },
  course: { fontSize: 16, fontWeight: "800", color: "#2563eb" },
  teacher: { fontSize: 12, color: "#64748b" },
  attRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  circleText: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
});
