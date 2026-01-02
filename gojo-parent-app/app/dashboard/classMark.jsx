import { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { ref, get } from "firebase/database";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { database } from "../../constants/firebaseConfig";

export default function ClassMark() {
  const [parentId, setParentId] = useState(null);
  const [children, setChildren] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [childUser, setChildUser] = useState(null);
  const [courses, setCourses] = useState([]);
  const [marks, setMarks] = useState({});
  const [showList, setShowList] = useState(false);
  const [cache, setCache] = useState({});
  const [expanded, setExpanded] = useState({}); // 🔽 expand state

  const defaultProfile =
    "https://cdn-icons-png.flaticon.com/512/847/847969.png";

  /* ---------------- LOAD PARENT ID ---------------- */
  useEffect(() => {
    AsyncStorage.getItem("parentId").then((id) => {
      if (id) setParentId(id);
    });
  }, []);

  /* ---------------- LOAD ALL DATA ---------------- */
  useEffect(() => {
    if (!parentId) return;

    const loadData = async () => {
      const [
        parentsSnap,
        studentsSnap,
        usersSnap,
        coursesSnap,
        marksSnap,
        teachersSnap,
        assignSnap,
      ] = await Promise.all([
        get(ref(database, "Parents")),
        get(ref(database, "Students")),
        get(ref(database, "Users")),
        get(ref(database, "Courses")),
        get(ref(database, "ClassMarks")),
        get(ref(database, "Teachers")),
        get(ref(database, "TeacherAssignments")),
      ]);

      const data = {
        parents: parentsSnap.val() || {},
        students: studentsSnap.val() || {},
        users: usersSnap.val() || {},
        courses: coursesSnap.val() || {},
        marks: marksSnap.val() || {},
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

  /* ---------------- LOAD CHILD ---------------- */
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

    const courseList = Object.keys(data.courses)
      .map((id) => ({ courseId: id, ...data.courses[id] }))
      .filter(
        (c) => c.grade === student.grade && c.section === student.section
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
    setMarks(data.marks || {});
    setExpanded({}); // reset expand on child change
    setCurrentIndex(index);
    setShowList(false);
  };

  /* ---------------- TOTAL MARK ---------------- */
  const calcTotal = (assessments) => {
    let score = 0;
    let max = 0;

    Object.values(assessments || {}).forEach((a) => {
      score += a.score || 0;
      max += a.max || 0;
    });

    return { score, max };
  };

  /* ---------------- TOGGLE EXPAND ---------------- */
  const toggleExpand = (courseId) => {
    setExpanded((prev) => ({
      ...prev,
      [courseId]: !prev[courseId],
    }));
  };

  return (
    <View style={styles.container}>
      {/* ================= HEADER ================= */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerLeft}
          onPress={() => setShowList(!showList)}
          activeOpacity={0.8}
        >
          <Image
            source={{ uri: childUser?.profileImage || defaultProfile }}
            style={styles.avatar}
          />

          <View style={styles.headerText}>
            <Text style={styles.childName} numberOfLines={1}>
              {childUser?.name || "Student"}
            </Text>
            <Text style={styles.gradeText}>
              Grade {childUser?.grade} • Section {childUser?.section}
            </Text>
          </View>

          {children.length > 1 && (
            <Text style={styles.arrow}>{showList ? "▲" : "▼"}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ================= DROPDOWN ================= */}
      {children.length > 1 && showList && (
        <View style={styles.dropdown}>
          {children.map((c, i) => {
            const s = cache.students?.[c.studentId];
            const u = cache.users?.[s?.userId];

            return (
              <TouchableOpacity
                key={c.studentId}
                style={[
                  styles.dropdownItem,
                  currentIndex === i && styles.dropdownActive,
                ]}
                onPress={() => loadChild(c, i, cache)}
              >
                <Text style={styles.dropdownText}>{u?.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ================= BODY ================= */}
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {courses.map((course) => {
          const studentMarks =
            marks?.[course.courseId]?.[childUser?.studentId];
          if (!studentMarks) return null;

          const { score, max } = calcTotal(studentMarks.assessments);
          const percent = max > 0 ? Math.round((score / max) * 100) : 0;
          const isOpen = expanded[course.courseId];

          return (
            <View key={course.courseId} style={styles.card}>
              {/* 🔽 CLICKABLE COURSE HEADER */}
              <TouchableOpacity
                onPress={() => toggleExpand(course.courseId)}
                activeOpacity={0.7}
              >
                <View style={styles.courseHeader}>
                  <View>
                    <Text style={styles.courseName}>{course.name}</Text>
                    <Text style={styles.teacher}>
                      👨‍🏫 {course.teacherName}
                    </Text>
                  </View>
                  <Text style={styles.arrow}>
                    {isOpen ? "▲" : "▼"}
                  </Text>
                </View>

                <View style={styles.totalBox}>
                  <Text style={styles.totalText}>
                    Total: {score} / {max}
                  </Text>
                  <Text style={styles.percent}>{percent}%</Text>
                </View>
              </TouchableOpacity>

              {/* 🔽 DETAILS */}
              {isOpen &&
                Object.values(studentMarks.assessments || {}).map(
                  (a, index) => (
                    <View key={index} style={styles.row}>
                      <Text style={styles.assessName}>{a.name}</Text>
                      <Text style={styles.assessScore}>
                        {a.score}/{a.max}
                      </Text>
                    </View>
                  )
                )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6" },

  header: {
    backgroundColor: "#ffffff",
    margin: 20,
    borderRadius: 16,
    padding: 18,
    elevation: 6,
    minHeight: 90,
    zIndex: 10,
  },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 56, height: 56, borderRadius: 28, marginRight: 14 },
  headerText: { flex: 1 },
  childName: { fontSize: 18, fontWeight: "700", color: "#111827" },
  gradeText: { fontSize: 14, color: "#6b7280", marginTop: 4 },
  arrow: { fontSize: 16, color: "#2563eb" },

  dropdown: {
    position: "absolute",
    top: 110,
    left: 20,
    right: 20,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    elevation: 10,
    zIndex: 999,
  },
  dropdownItem: { paddingVertical: 14, paddingHorizontal: 18 },
  dropdownActive: { backgroundColor: "#eef2ff" },
  dropdownText: { fontSize: 15, fontWeight: "600" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    elevation: 4,
  },

  courseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  courseName: { fontSize: 16, fontWeight: "700", color: "#111827" },
  teacher: { fontSize: 13, color: "#6b7280", marginBottom: 6 },

  totalBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#f1f5f9",
    padding: 12,
    borderRadius: 12,
    marginTop: 6,
  },
  totalText: { fontWeight: "600" },
  percent: { fontWeight: "700", color: "#2563eb" },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  assessName: { fontSize: 14 },
  assessScore: { fontSize: 14, fontWeight: "600" },
});
