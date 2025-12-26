// app/dashboard/attendance.jsx
import { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Dimensions,
} from "react-native";
import { ref, get } from "firebase/database";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { database } from "../../constants/firebaseConfig";
import moment from "moment";

const { height: screenHeight } = Dimensions.get("window");

export default function Attendance() {
  const [children, setChildren] = useState([]);
  const [currentChildIndex, setCurrentChildIndex] = useState(0);
  const [childUser, setChildUser] = useState(null);
  const [attendanceData, setAttendanceData] = useState({});
  const [parentUserId, setParentUserId] = useState(null);
  const [fetchedData, setFetchedData] = useState({});
  const [showChildList, setShowChildList] = useState(false);
  const [selectedTab, setSelectedTab] = useState("daily"); // daily, weekly, monthly

  const defaultProfile =
    "https://cdn-icons-png.flaticon.com/512/847/847969.png";

  useEffect(() => {
    const loadParentId = async () => {
      const storedParentId = await AsyncStorage.getItem("parentId");
      if (storedParentId) setParentUserId(storedParentId);
    };
    loadParentId();
  }, []);

  useEffect(() => {
    if (parentUserId) fetchChildren();
  }, [parentUserId]);

  const fetchChildren = async () => {
    try {
      const [parentsSnap, studentsSnap, usersSnap, attendanceSnap] =
        await Promise.all([
          get(ref(database, "Parents")),
          get(ref(database, "Students")),
          get(ref(database, "Users")),
          get(ref(database, "Attendance")),
        ]);

      const parentsData = parentsSnap.val() || {};
      const studentsData = studentsSnap.val() || {};
      const usersData = usersSnap.val() || {};
      const attendanceDb = attendanceSnap.val() || {};

      setFetchedData({ studentsData, usersData, attendanceDb });

      const parentNode = parentsData[parentUserId];
      const childrenArray = parentNode?.children
        ? Object.values(parentNode.children)
        : [];
      setChildren(childrenArray);

      if (childrenArray.length > 0) {
        loadChild(childrenArray[0], 0, { studentsData, usersData, attendanceDb });
      }
    } catch (error) {
      console.log("Error fetching children:", error);
    }
  };

  const loadChild = (child, index, data) => {
    if (!data) return;
    const { studentsData, usersData, attendanceDb } = data;
    const student = studentsData[child.studentId];
    if (!student) return;

    const user = usersData[student.userId] || null;
    setChildUser({ ...user, grade: student.grade, section: student.section });

    // Filter attendance for this student
    const filteredAttendance = {};
    Object.keys(attendanceDb).forEach((courseId) => {
      const course = attendanceDb[courseId];
      const courseAttendance = {};
      Object.keys(course).forEach((date) => {
        if (course[date][child.studentId])
          courseAttendance[date] = course[date][child.studentId];
      });
      if (Object.keys(courseAttendance).length > 0)
        filteredAttendance[courseId] = courseAttendance;
    });

    setAttendanceData(filteredAttendance);
    setCurrentChildIndex(index);
  };

  const selectChild = (index) => {
    loadChild(children[index], index, fetchedData);
    setShowChildList(false);
  };

  // Filter attendance by daily, weekly, monthly
  const filterAttendance = (course) => {
    const today = moment();
    const filtered = {};

    Object.keys(course).forEach((date) => {
      const mDate = moment(date, "YYYY-MM-DD");
      if (selectedTab === "daily" && mDate.isSame(today, "day")) {
        filtered[date] = course[date];
      } else if (selectedTab === "weekly" && mDate.isSame(today, "week")) {
        filtered[date] = course[date];
      } else if (selectedTab === "monthly" && mDate.isSame(today, "month")) {
        filtered[date] = course[date];
      }
    });

    return filtered;
  };

  const renderAttendanceItem = ({ item }) => {
    const { date, status } = item;
    const statusColor =
      status === "present" ? "#16a34a" : status === "absent" ? "#dc2626" : "#f59e0b";

    return (
      <View style={styles.attendanceCard}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
          <Text style={styles.attendanceDate}>{date}</Text>
          <Text style={[styles.attendanceStatus, { color: statusColor }]}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Text>
        </View>
        <View style={{ height: 6, borderRadius: 6, backgroundColor: "#e5e7eb", overflow: "hidden" }}>
          <View
            style={{
              width: status === "present" ? "100%" : "0%",
              height: "100%",
              backgroundColor: statusColor,
            }}
          />
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { height: screenHeight * 0.25 }]}>
        {children.length > 0 && (
          <View style={{ position: "absolute", top: 20, right: 20, zIndex: 10 }}>
            <TouchableOpacity
              style={styles.childSwitch}
              onPress={() => setShowChildList(!showChildList)}
            >
              <Text style={styles.childName}>
                {children[currentChildIndex]?.relationship || "Child"} ▼
              </Text>
            </TouchableOpacity>

            {showChildList && (
              <View style={styles.childList}>
                {children.map((child, index) => {
                  const student = fetchedData.studentsData[child.studentId];
                  const user = fetchedData.usersData[student?.userId] || {};
                  return (
                    <TouchableOpacity
                      key={child.studentId}
                      style={styles.childListItem}
                      onPress={() => selectChild(index)}
                    >
                      <Text style={styles.childListText}>{user.name || "Student"}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        <Image
          source={{ uri: childUser?.profileImage || defaultProfile }}
          style={styles.profileImage}
        />
        <Text style={styles.headerText}>{childUser?.name || "Student Name"}</Text>
        <Text style={styles.gradeSectionText}>
          Grade {childUser?.grade || "--"} - Section {childUser?.section || "--"}
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        {["daily", "weekly", "monthly"].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabButton, selectedTab === tab && styles.tabButtonActive]}
            onPress={() => setSelectedTab(tab)}
          >
            <Text style={[styles.tabText, selectedTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Attendance Body */}
      <ScrollView style={styles.body}>
        {Object.keys(attendanceData).length === 0 ? (
          <Text style={styles.noDataText}>🚫 No Attendance Records</Text>
        ) : (
          Object.keys(attendanceData).map((courseId) => {
            const course = filterAttendance(attendanceData[courseId]);
            if (Object.keys(course).length === 0) return null;

            return (
              <View key={courseId} style={styles.card}>
                <Text style={styles.courseTitle}>
                  {courseId.replace("course_", "").replace(/_/g, " ")}
                </Text>
                <FlatList
                  data={Object.keys(course).map((date) => ({
                    date,
                    status: course[date],
                  }))}
                  keyExtractor={(item) => item.date}
                  renderItem={renderAttendanceItem}
                  scrollEnabled={false}
                />
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    backgroundColor: "#1976D2",
    justifyContent: "center",
    alignItems: "center",
  },

  profileImage: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 4,
    borderColor: "#fff",
    marginBottom: 10,
  },

  headerText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },

  gradeSectionText: {
    color: "#fff",
    fontSize: 16,
    marginTop: 4,
  },

  childSwitch: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    elevation: 5,
  },

  childName: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },

  childList: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 8,
    marginTop: 6,
    paddingVertical: 4,
    minWidth: 120,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },

  childListItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },

  childListText: {
    fontSize: 14,
    color: "#fff",
  },

  tabContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#e0e7ff",
    paddingVertical: 8,
  },

  tabButton: {
    paddingVertical: 6,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
  },

  tabButtonActive: {
    backgroundColor: "#1976D2",
  },

  tabText: {
    color: "#334155",
    fontWeight: "600",
  },

  tabTextActive: {
    color: "#fff",
    fontWeight: "700",
  },

  body: {
    flex: 1,
    padding: 20,
  },

  noDataText: {
    textAlign: "center",
    fontSize: 16,
    color: "#555",
    marginTop: 20,
  },

  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },

  courseTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#2563eb",
    marginBottom: 12,
  },

  attendanceCard: {
    backgroundColor: "#f0f4f8",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },

  attendanceDate: {
    fontSize: 14,
    color: "#334155",
    fontWeight: "600",
  },

  attendanceStatus: {
    fontSize: 14,
    fontWeight: "700",
  },
});
