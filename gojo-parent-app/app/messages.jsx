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

  const parentUserId = "parent_user_id_here";

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
    const parent = Object.values(parents).find(
      (p) => p.userId === parentUserId
    );
    const myChildrenIds = parent?.children || [];

    let list = [];

    if (filter === "son") {
      list = myChildrenIds
        .map((id) => {
          const student = students[id];
          if (!student) return null;
          const user = allUsers[student.userId];
          return user ? { ...user, role: "student" } : null;
        })
        .filter(Boolean);
    }

    if (filter === "teacher") {
      const teacherSet = new Set();
      myChildrenIds.forEach((childId) => {
        const student = students[childId];
        if (!student) return;
        Object.entries(courses).forEach(([courseId, course]) => {
          if (
            course.grade === student.grade &&
            course.section === student.section
          ) {
            Object.values(assignments).forEach((assignment) => {
              if (assignment.courseId === courseId) {
                teacherSet.add(assignment.teacherId);
              }
            });
          }
        });
      });

      list = Array.from(teacherSet)
        .map((teacherId) => {
          const teacher = teachers[teacherId];
          if (!teacher) return null;
          const user = allUsers[teacher.userId];
          return user ? { ...user, role: "teacher" } : null;
        })
        .filter(Boolean);
    }

    if (filter === "admin") {
      list = Object.values(schoolAdmins)
        .map((admin) => {
          const user = allUsers[admin.userId]; // get profile from Users node
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
        <Text style={styles.role}>{item.role}</Text>
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
            style={[
              styles.filterBtn,
              selectedFilter === f && styles.selectedFilter,
            ]}
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
  safeArea: {
    flex: 1,
    backgroundColor: "#f0f2f5",
    paddingHorizontal: 12,
    paddingTop: 12,
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    height: 70,
  },

  topBarTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "bold",
  },

  filterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  filterBtn: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#e0e0e0",
    alignItems: "center",
  },

  selectedFilter: {
    backgroundColor: "#1e90ff",
  },

  filterText: {
    fontWeight: "bold",
    fontSize: 13,
    color: "#000",
  },

  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 14,
    marginBottom: 10,
    width: "100%",
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },

  name: {
    fontWeight: "bold",
    fontSize: 16,
  },

  role: {
    fontSize: 12,
    color: "gray",
    marginTop: 2,
  },

  emptyText: {
    textAlign: "center",
    marginTop: 40,
    color: "gray",
  },
});
