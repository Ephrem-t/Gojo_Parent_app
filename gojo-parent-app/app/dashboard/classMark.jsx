// app/dashboard/classMark.jsx
import { useEffect, useState, useRef } from "react";
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
  ActivityIndicator,
} from "react-native";
import { ref, get } from "firebase/database";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { database } from "../../constants/firebaseConfig";
import Svg, { Circle } from "react-native-svg";

const { height: screenHeight } = Dimensions.get("window");
const defaultProfile =
  "https://cdn-icons-png.flaticon.com/512/847/847969.png";

// ======================
// Circle Progress Component
// ======================
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const CircleProgress = ({ percentage, radius = 36, strokeWidth = 6, color }) => {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: percentage,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [percentage]);

  const strokeDashoffset = animatedValue.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
  });

  const size = (radius + strokeWidth) * 2;

  return (
    <Svg width={size} height={size}>
      <Circle
        stroke="#e5e7eb"
        fill="none"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={strokeWidth}
      />
      <AnimatedCircle
        stroke={color}
        fill="none"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
      />
    </Svg>
  );
};

// ======================
// Marks Card Component
// ======================
const MarksCard = ({ mark }) => {
  const total = (mark.mark20 || 0) + (mark.mark30 || 0) + (mark.mark50 || 0);
  const percentage = Math.min(total, 100);
  const statusColor =
    percentage >= 75 ? "#16a34a" : percentage >= 50 ? "#f59e0b" : "#dc2626";

  const assessments = [
    { key: "mark20", label: "Quiz", max: 20, color: "#2563eb" },
    { key: "mark30", label: "Test", max: 30, color: "#16a34a" },
    { key: "mark50", label: "Final", max: 50, color: "#ea580c" },
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.courseTitle}>
        {mark.courseId.replace("course_", "").replace(/_/g, " ")}
      </Text>

      <View style={styles.circleWrapper}>
        <CircleProgress percentage={percentage} color={statusColor} />
        <View style={styles.circleLabel}>
          <Text style={[styles.totalText, { color: statusColor }]}>{total}</Text>
          <Text style={styles.maxText}>/100</Text>
        </View>
      </View>

      {assessments.map(({ key, label, max, color }) => (
        <View key={key} style={styles.assessmentRow}>
          <View style={styles.assessmentLabelRow}>
            <Text style={styles.assessmentLabel}>{label}</Text>
            <Text style={styles.assessmentValue}>
              {mark[key] || 0} / {max}
            </Text>
          </View>
          <View style={styles.progressBackground}>
            <View
              style={[
                styles.progressBar,
                { width: `${((mark[key] || 0) / max) * 100}%`, backgroundColor: color },
              ]}
            />
          </View>
        </View>
      ))}

      <Text style={[styles.statusText, { color: statusColor }]}>
        {percentage >= 75 ? "Excellent" : percentage >= 50 ? "Good" : "Needs Improvement"}
      </Text>

      {mark.teacherName && <Text style={styles.teacherText}>👨‍🏫 {mark.teacherName}</Text>}
    </View>
  );
};

// ======================
// Child Dropdown Component
// ======================
const ChildDropdown = ({ children, show, onSelect, fetchedData }) => {
  if (!show) return null;
  return (
    <View style={styles.childList}>
      {children.map((child, index) => {
        const student = fetchedData.studentsData[child.studentId];
        const user = fetchedData.usersData[student?.userId] || {};
        return (
          <TouchableOpacity
            key={child.studentId}
            style={styles.childListItem}
            onPress={() => onSelect(index)}
          >
            <Text style={styles.childListText}>{user.name || "Student"}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// ======================
// Header Component
// ======================
const HeaderSection = ({
  childUser,
  children,
  currentChildIndex,
  showChildList,
  toggleDropdown,
  selectChild,
  fetchedData,
}) => {
  return (
    <View style={[styles.header, { height: screenHeight * 0.3 }]}>
      {children.length > 0 && (
        <View style={{ position: "absolute", top: 20, right: 20, zIndex: 10 }}>
          <TouchableOpacity style={styles.childSwitch} onPress={toggleDropdown}>
            <Text style={styles.childName}>
              {children[currentChildIndex]?.relationship || "Child"} ▼
            </Text>
          </TouchableOpacity>
          <ChildDropdown
            children={children}
            show={showChildList}
            onSelect={selectChild}
            fetchedData={fetchedData}
          />
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
  );
};

// ======================
// Main ClassMark Component
// ======================
export default function ClassMark() {
  const [children, setChildren] = useState([]);
  const [currentChildIndex, setCurrentChildIndex] = useState(0);
  const [childUser, setChildUser] = useState(null);
  const [marks, setMarks] = useState([]);
  const [parentUserId, setParentUserId] = useState(null);
  const [fetchedData, setFetchedData] = useState({});
  const [showChildList, setShowChildList] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load logged-in parentId from AsyncStorage
  useEffect(() => {
    const loadParentId = async () => {
      const storedParentId = await AsyncStorage.getItem("parentId");
      if (storedParentId) setParentUserId(storedParentId);
    };
    loadParentId();
  }, []);

  // Fetch children when parent ID available
  useEffect(() => {
    if (parentUserId) fetchChildren();
  }, [parentUserId]);

  const fetchChildren = async () => {
    setLoading(true);
    try {
      const [parentsSnap, studentsSnap, usersSnap, classMarksSnap] =
        await Promise.all([
          get(ref(database, "Parents")),
          get(ref(database, "Students")),
          get(ref(database, "Users")),
          get(ref(database, "ClassMarks")),
        ]);

      const parentsData = parentsSnap.val() || {};
      const studentsData = studentsSnap.val() || {};
      const usersData = usersSnap.val() || {};
      const classMarksData = classMarksSnap.val() || {};

      setFetchedData({ studentsData, usersData, classMarksData });

      const parentNode = parentsData[parentUserId];
      const childrenArray = parentNode?.children
        ? Object.values(parentNode.children)
        : [];
      setChildren(childrenArray);

      if (childrenArray.length > 0) {
        loadChild(childrenArray[0], 0, { studentsData, usersData, classMarksData });
      }
    } catch (error) {
      console.log("Error fetching children:", error);
    }
    setLoading(false);
  };

  const loadChild = (child, index, data) => {
    if (!data) return;
    const { studentsData, usersData, classMarksData } = data;
    const student = studentsData[child.studentId];
    if (!student) return;

    const user = usersData[student.userId] || null;
    setChildUser({ ...user, grade: student.grade, section: student.section });

    const marksArray = [];
    Object.keys(classMarksData).forEach((courseId) => {
      const course = classMarksData[courseId];
      if (course[child.studentId]) {
        marksArray.push({
          courseId,
          mark20: course[child.studentId].mark20 ?? 0,
          mark30: course[child.studentId].mark30 ?? 0,
          mark50: course[child.studentId].mark50 ?? 0,
          teacherName: course[child.studentId].teacherName || "N/A",
        });
      } else {
        marksArray.push({
          courseId,
          mark20: 0,
          mark30: 0,
          mark50: 0,
          teacherName: "N/A",
        });
      }
    });

    setMarks(marksArray);
    setCurrentChildIndex(index);
  };

  const selectChild = (index) => {
    loadChild(children[index], index, fetchedData);
    setShowChildList(false);
  };

  const toggleDropdown = () => setShowChildList(!showChildList);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#1976D2" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HeaderSection
        childUser={childUser}
        children={children}
        currentChildIndex={currentChildIndex}
        showChildList={showChildList}
        toggleDropdown={toggleDropdown}
        selectChild={selectChild}
        fetchedData={fetchedData}
      />

      <ScrollView style={styles.body}>
        {marks.length === 0 ? (
          <Text style={styles.noMarksText}>🚫 No Performance Records</Text>
        ) : (
          <FlatList
            data={marks}
            keyExtractor={(item, index) => item.courseId + index}
            renderItem={({ item }) => <MarksCard mark={item} />}
            numColumns={2}
            columnWrapperStyle={{ justifyContent: "space-between" }}
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        )}
      </ScrollView>
    </View>
  );
}

// ======================
// Styles
// ======================
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { backgroundColor: "#1976D2", justifyContent: "center", alignItems: "center" },
  profileImage: { width: 140, height: 140, borderRadius: 70, borderWidth: 4, borderColor: "#fff", marginBottom: 10 },
  headerText: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  gradeSectionText: { color: "#fff", fontSize: 16, marginTop: 4 },
  childSwitch: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, elevation: 5 },
  childName: { color: "#fff", fontSize: 14, fontWeight: "bold" },
  childList: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 8, marginTop: 6, paddingVertical: 4, minWidth: 120, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 5, elevation: 5 },
  childListItem: { paddingVertical: 8, paddingHorizontal: 12 },
  childListText: { fontSize: 14, color: "#fff" },
  body: { flex: 7, padding: 20 },
  noMarksText: { textAlign: "center", fontSize: 16, color: "#555", marginTop: 20 },
  card: { backgroundColor: "#fff", padding: 16, borderRadius: 20, marginBottom: 20, width: "48%", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  courseTitle: { fontSize: 16, fontWeight: "800", color: "#2563eb", marginBottom: 12 },
  circleWrapper: { alignItems: "center", marginBottom: 16, position: "relative" },
  circleLabel: { position: "absolute", top: 18, left: 0, right: 0, alignItems: "center" },
  totalText: { fontSize: 18, fontWeight: "800" },
  maxText: { fontSize: 11, color: "#64748b" },
  assessmentRow: { marginBottom: 10 },
  assessmentLabelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  assessmentLabel: { fontSize: 13, fontWeight: "600", color: "#334155" },
  assessmentValue: { fontSize: 13, fontWeight: "600", color: "#334155" },
  progressBackground: { height: 6, borderRadius: 3, backgroundColor: "#e5e7eb", overflow: "hidden" },
  progressBar: { height: "100%", borderRadius: 3 },
  statusText: { marginTop: 12, textAlign: "center", fontSize: 13, fontWeight: "700" },
  teacherText: { marginTop: 6, textAlign: "center", fontSize: 12, color: "#64748b" },
});
