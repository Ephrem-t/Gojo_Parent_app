// app/dashboard/messages.jsx
import { child, get, ref } from "firebase/database";
import { useEffect, useState } from "react";
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { database } from "../../constants/firebaseConfig";

export default function Messages() {
  const [allUsers, setAllUsers] = useState({});
  const [students, setStudents] = useState({});
  const [teachers, setTeachers] = useState({});
  const [parents, setParents] = useState({});
  const [courses, setCourses] = useState({});
  const [assignments, setAssignments] = useState({});
  const [schoolAdmins, setSchoolAdmins] = useState({});
  const [selectedFilter, setSelectedFilter] = useState("all"); // all, son, teacher, admin
  const [listData, setListData] = useState([]);

  // 🔴 Replace with logged-in parent userId
  const parentUserId = "parent_user_id_here";

  useEffect(() => {
    const fetchData = async () => {
      try {
        const dbRef = ref(database);

        // Fetch all nodes
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
  }, [selectedFilter, allUsers, students, teachers, parents, courses, assignments, schoolAdmins]);

  const filterList = (filter) => {
    const parent = Object.values(parents).find(p => p.userId === parentUserId);
    const myChildrenIds = parent?.children || [];

    let list = [];

    if (filter === "all") {
      // all users except the parent
      list = Object.values(allUsers).filter(u => u.userId !== parentUserId);
    }

    if (filter === "son") {
      list = myChildrenIds.map(id => {
        const student = students[id];
        if (!student) return null;
        const user = allUsers[student.userId];
        return user ? { ...user, role: "student" } : null;
      }).filter(Boolean);
    }

    if (filter === "teacher") {
      // teachers of the parent's children
      const teacherSet = new Set();
      myChildrenIds.forEach(childId => {
        const student = students[childId];
        if (!student) return;
        const grade = student.grade;
        const section = student.section;

        // find courses for this grade & section
        Object.entries(courses).forEach(([courseId, course]) => {
          if (course.grade === grade && course.section === section) {
            // find assignments for this course
            Object.values(assignments).forEach(assignment => {
              if (assignment.courseId === courseId) {
                teacherSet.add(assignment.teacherId);
              }
            });
          }
        });
      });

      list = Array.from(teacherSet).map(teacherId => {
        const teacher = teachers[teacherId];
        if (!teacher) return null;
        const user = allUsers[teacher.userId];
        return user ? { ...user, role: "teacher" } : null;
      }).filter(Boolean);
    }

    if (filter === "admin") {
      list = Object.values(schoolAdmins).map(admin => {
        return {
          userId: admin.adminId,
          name: admin.name,
          profileImage: admin.profileImage || "https://cdn-icons-png.flaticon.com/512/847/847969.png",
          role: "admin"
        };
      });
    }

    setListData(list);
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <Image
        source={{ uri: item.profileImage || "https://cdn-icons-png.flaticon.com/512/847/847969.png" }}
        style={styles.avatar}
      />
      <View>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.role}>{item.role}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Filter buttons */}
      <View style={styles.filterRow}>
        {["all", "son", "teacher", "admin"].map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, selectedFilter === f && styles.selectedFilter]}
            onPress={() => setSelectedFilter(f)}
          >
            <Text style={{ color: selectedFilter === f ? "#fff" : "#000", fontWeight: "bold" }}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={listData}
        keyExtractor={item => item.userId}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={{ textAlign: "center", marginTop: 20 }}>No users found</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f2f5", padding: 10 },
  filterRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: 10 },
  filterBtn: { padding: 10, borderRadius: 20, backgroundColor: "#ddd" },
  selectedFilter: { backgroundColor: "#1e90ff" },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", padding: 10, borderRadius: 12, marginBottom: 10 },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 10 },
  name: { fontWeight: "bold", fontSize: 16 },
  role: { fontSize: 12, color: "gray" },
});
