// app/messages.jsx
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { child, get, ref } from "firebase/database";
import { useEffect, useState } from "react";
import {
  FlatList,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { database } from "../constants/firebaseConfig";

export default function Messages() {
  const router = useRouter();
  const [allUsers, setAllUsers] = useState({});
  const [students, setStudents] = useState({});
  const [teachers, setTeachers] = useState({});
  const [parents, setParents] = useState({});
  const [courses, setCourses] = useState({});
  const [assignments, setAssignments] = useState({});
  const [schoolAdmins, setSchoolAdmins] = useState({});
  const [selectedFilter, setSelectedFilter] = useState("son");
  const [listData, setListData] = useState([]);

  const parentUserId = "-Oh99WO6QCBh0K-hK0eh"; // logged-in parent ID

  useEffect(() => {
    const fetchData = async () => {
      try {
        const dbRef = ref(database);
        const [
          usersSnap,
          studentsSnap,
          teachersSnap,
          parentsSnap,
          coursesSnap,
          assignmentsSnap,
          adminsSnap,
        ] = await Promise.all([
          get(child(dbRef, "Users")),
          get(child(dbRef, "Students")),
          get(child(dbRef, "Teachers")),
          get(child(dbRef, "Parents")),
          get(child(dbRef, "Courses")),
          get(child(dbRef, "TeacherAssignments")),
          get(child(dbRef, "School_Admins")),
        ]);

        setAllUsers(usersSnap.exists() ? usersSnap.val() : {});
        setStudents(studentsSnap.exists() ? studentsSnap.val() : {});
        setTeachers(teachersSnap.exists() ? teachersSnap.val() : {});
        setParents(parentsSnap.exists() ? parentsSnap.val() : {});
        setCourses(coursesSnap.exists() ? coursesSnap.val() : {});
        setAssignments(assignmentsSnap.exists() ? assignmentsSnap.val() : {});
        setSchoolAdmins(adminsSnap.exists() ? adminsSnap.val() : {});
      } catch (error) {
        console.log("Error fetching data:", error);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    filterList(selectedFilter);
  }, [
    selectedFilter,
    allUsers,
    students,
    teachers,
    parents,
    courses,
    assignments,
    schoolAdmins,
  ]);

  const filterList = (filter) => {
    let list = [];

    // SON LIST: only parent's children
    if (filter === "son") {
      const parentNode = parents[parentUserId];
      if (parentNode) {
        const children = Object.values(parentNode);

        list = children
          .map((child) => {
            const student = students[child.studentId];
            if (!student) return null;

            const user = allUsers[student.userId];
            return user
              ? {
                  userId: child.studentId,
                  name: user.name,
                  profileImage:
                    user.profileImage ||
                    "https://cdn-icons-png.flaticon.com/512/847/847969.png",
                  role: "student",
                  grade: student.grade,
                  section: student.section,
                }
              : null;
          })
          .filter(Boolean);
      }
    }

    // TEACHER LIST: teachers teaching parent's children
    if (filter === "teacher") {
      const teacherMap = {};

      const parentNode = parents[parentUserId];
      if (parentNode) {
        const children = Object.values(parentNode);

        children.forEach((child) => {
          const student = students[child.studentId];
          if (!student) return;

          Object.entries(courses).forEach(([courseId, course]) => {
            if (course.grade === student.grade && course.section === student.section) {
              Object.values(assignments).forEach((assignment) => {
                if (assignment.courseId === courseId) {
                  const teacher = teachers[assignment.teacherId];
                  const user = allUsers[teacher?.userId];
                  if (!teacher || !user) return;

                  if (!teacherMap[assignment.teacherId]) {
                    teacherMap[assignment.teacherId] = {
                      userId: assignment.teacherId,
                      name: user.name,
                      profileImage:
                        user.profileImage ||
                        "https://cdn-icons-png.flaticon.com/512/847/847969.png",
                      role: "teacher",
                      sections: [],
                    };
                  }

                  const sectionStr = `Grade ${course.grade} - Section ${course.section}`;
                  if (!teacherMap[assignment.teacherId].sections.includes(sectionStr)) {
                    teacherMap[assignment.teacherId].sections.push(sectionStr);
                  }
                }
              });
            }
          });
        });
      }

      list = Object.values(teacherMap).map((t) => ({
        ...t,
        sectionText: t.sections.join(", "),
      }));
    }

    // ADMIN LIST
    if (filter === "admin") {
      list = Object.values(schoolAdmins)
        .map((admin) => {
          const user = allUsers[admin.userId];
          return {
            userId: admin.adminId,
            name: admin.name,
            profileImage:
              user?.profileImage ||
              "https://cdn-icons-png.flaticon.com/512/847/847969.png",
            role: "admin",
          };
        })
        .filter(Boolean);
    }

    setListData(list);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        router.push({
          pathname: "/chat",
          params: { userId: item.userId, name: item.name },
        })
      }
    >
      <Image
        source={{
          uri:
            item.profileImage ||
            "https://cdn-icons-png.flaticon.com/512/847/847969.png",
        }}
        style={styles.avatar}
      />
      <View>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.role}>
          {item.role}{" "}
          {item.role === "student"
            ? `- Grade ${item.grade} Section ${item.section}`
            : item.sectionText
            ? `- ${item.sectionText}`
            : ""}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back-outline" size={28} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Messages</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Filters */}
      <View style={styles.filterRow}>
        {["son", "teacher", "admin"].map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, selectedFilter === f && styles.selectedFilter]}
            onPress={() => setSelectedFilter(f)}
          >
            <Text
              style={[
                styles.filterText,
                selectedFilter === f && { color: "#fff" },
              ]}
            >
              {f.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={listData}
        keyExtractor={(item) => item.userId}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No users found</Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f0f2f5", paddingHorizontal: 12, paddingTop: 12 },
  topBar: { flexDirection: "row", alignItems: "center", marginBottom: 12, height: 70 },
  topBarTitle: { flex: 1, textAlign: "center", fontSize: 20, fontWeight: "bold" },
  filterRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  filterBtn: { flex: 1, marginHorizontal: 4, paddingVertical: 10, borderRadius: 20, backgroundColor: "#e0e0e0", alignItems: "center" },
  selectedFilter: { backgroundColor: "#1e90ff" },
  filterText: { fontWeight: "bold", fontSize: 13, color: "#000" },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", padding: 12, borderRadius: 14, marginBottom: 10, width: "100%" },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  name: { fontWeight: "bold", fontSize: 16 },
  role: { fontSize: 12, color: "gray", marginTop: 2 },
  emptyText: { textAlign: "center", marginTop: 40, color: "gray" },
});
