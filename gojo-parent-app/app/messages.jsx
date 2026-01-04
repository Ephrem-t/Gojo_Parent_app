import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { child, get, ref } from "firebase/database";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  LayoutAnimation,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsFocused } from "@react-navigation/native";
import { database } from "../constants/firebaseConfig";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const formatTimeShort = (timestamp) => {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const now = new Date();
  if (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  ) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } else {
    return date.toLocaleString([], { month: "short", day: "numeric" });
  }
};

export default function Messages() {
  const router = useRouter();
  const isFocused = useIsFocused();

  const [allUsers, setAllUsers] = useState({});
  const [students, setStudents] = useState({});
  const [teachers, setTeachers] = useState({});
  const [parents, setParents] = useState({});
  const [courses, setCourses] = useState({});
  const [assignments, setAssignments] = useState({});
  const [schoolAdmins, setSchoolAdmins] = useState({});
  const [selectedFilter, setSelectedFilter] = useState("son");

  const [listData, setListData] = useState([]);
  const [isFetchingLast, setIsFetchingLast] = useState(false);

  // Keep both: record id stored in AsyncStorage and the actual Users UID
  const [parentRecordId, setParentRecordId] = useState(null); // key in Parents/ (what AsyncStorage holds)
  const [parentUserId, setParentUserId] = useState(null); // the actual Users UID used for chatId/unread

  // request id to avoid race conditions
  const currentFetchIdRef = useRef(0);

  // Load parentRecordId from AsyncStorage and resolve parentUserId
  useEffect(() => {
    const loadParentId = async () => {
      try {
        const storedParentRecordId = await AsyncStorage.getItem("parentId");
        if (!storedParentRecordId) return;
        setParentRecordId(storedParentRecordId);

        // resolve the parent userId for chat computations
        const snap = await get(child(ref(database), `Parents/${storedParentRecordId}`));
        if (snap.exists() && snap.val().userId) {
          setParentUserId(snap.val().userId);
        } else {
          console.warn("Parent record not found or missing userId");
        }
      } catch (err) {
        console.log("Error loading parent userId:", err);
      }
    };
    loadParentId();
  }, []);

  // Fetch static data from Firebase once
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

  // Re-run filter when dependencies change
  useEffect(() => {
    if (parentRecordId) {
      // Use the same function as filter button press
      handleFilterChange(selectedFilter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedFilter,
    allUsers,
    students,
    teachers,
    parents,
    courses,
    assignments,
    schoolAdmins,
    parentRecordId,
    parentUserId,
  ]);

  // Re-fetch when screen gains focus
  useEffect(() => {
    if (isFocused && parentRecordId) {
      handleFilterChange(selectedFilter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]);

  // Public handler used by UI to change filters — debounced-ish and cancels previous fetches
  const handleFilterChange = (filter) => {
    // increment request id
    currentFetchIdRef.current += 1;
    const reqId = currentFetchIdRef.current;

    // build base list immediately but DO NOT replace listData until we fetch lastMessage/unread
    const baseList = buildBaseList(filter);

    // if there is no parentUserId yet (can't fetch chat data), show base entries with no lastMessage
    if (!parentUserId) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setListData(baseList.map((i) => ({ ...i, lastMessage: null, unreadCount: 0 })));
      return;
    }

    // indicate loading (we keep showing current list until new data arrives to avoid flicker)
    setIsFetchingLast(true);

    // fetch lastMessage/unread for baseList (batched)
    fetchLastMessagesForList(baseList, reqId)
      .then((resolved) => {
        // only apply if request id matches the latest
        if (currentFetchIdRef.current !== reqId) return;
        // animate list update
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setListData(resolved);
      })
      .catch((err) => {
        console.log("fetchLastMessagesForList error:", err);
      })
      .finally(() => {
        if (currentFetchIdRef.current === reqId) setIsFetchingLast(false);
      });
  };

  // Build the base list from your Pupils/Teachers/Admin discovery logic (no DB chat calls)
  const buildBaseList = (filter) => {
    if (!parentRecordId) return [];

    const parentNode = parents[parentRecordId];
    const children = parentNode?.children ? Object.values(parentNode.children) : [];
    let list = [];

    if (filter === "son") {
      list = children
        .map((child) => {
          const student = students[child.studentId];
          if (!student) return null;

          const user = allUsers[student.userId];
          return user
            ? {
                roleId: child.studentId,
                receiverUserId: student.userId,
                name: user.name,
                profileImage: user.profileImage || "https://cdn-icons-png.flaticon.com/512/847/847969.png",
                role: "student",
                grade: student.grade,
                section: student.section,
              }
            : null;
        })
        .filter(Boolean);
    } else if (filter === "teacher") {
      const teacherMap = {};
      children.forEach((child) => {
        const student = students[child.studentId];
        if (!student) return;
        Object.entries(courses).forEach(([courseId, course]) => {
          if (course.grade === student.grade && course.section === student.section) {
            Object.values(assignments).forEach((assignment) => {
              if (assignment.courseId === courseId) {
                const teacher = teachers[assignment.teacherId];
                if (!teacher) return;
                const user = allUsers[teacher.userId];
                if (!user) return;

                if (!teacherMap[assignment.teacherId]) {
                  teacherMap[assignment.teacherId] = {
                    roleId: assignment.teacherId,
                    receiverUserId: teacher.userId,
                    name: user.name,
                    profileImage: user.profileImage || teacher.profileImage || "https://cdn-icons-png.flaticon.com/512/847/847969.png",
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

      list = Object.values(teacherMap).map((t) => ({
        ...t,
        sectionText: t.sections.join(", "),
      }));
    } else if (filter === "admin") {
      list = Object.values(schoolAdmins)
        .map((admin) => {
          const user = allUsers[admin.userId];
          return {
            roleId: admin.adminId,
            receiverUserId: admin.userId,
            name: admin.name,
            profileImage: user?.profileImage || admin.profileImage || "https://cdn-icons-png.flaticon.com/512/847/847969.png",
            role: "admin",
          };
        })
        .filter(Boolean);
    }

    return list;
  };

  // Fetch lastMessage + unread for a base list — uses batching and request cancellation via reqId
  const fetchLastMessagesForList = async (list, reqId) => {
    if (!parentUserId) {
      return list.map((item) => ({ ...item, lastMessage: null, unreadCount: 0, timeStamp: 0 }));
    }
    try {
      const dbRef = ref(database);

      // Batch size to limit concurrent network requests (tweak if needed)
      const BATCH_SIZE = 8;
      const results = [];

      for (let i = 0; i < list.length; i += BATCH_SIZE) {
        // slice a batch
        const batch = list.slice(i, i + BATCH_SIZE);
        // create promises for batch
        const batchPromises = batch.map(async (item) => {
          if (!item.receiverUserId) return { ...item, lastMessage: null, unreadCount: 0, timeStamp: 0 };
          const chatId = [parentUserId, item.receiverUserId].sort().join("_");
          const lastMsgSnap = await get(child(dbRef, `Chats/${chatId}/lastMessage`));
          const unreadSnap = await get(child(dbRef, `Chats/${chatId}/unread/${parentUserId}`));
          const lm = lastMsgSnap.exists() ? lastMsgSnap.val() : null;
          const unread = unreadSnap.exists() ? unreadSnap.val() : 0;
          return { ...item, lastMessage: lm, unreadCount: unread, timeStamp: lm?.timeStamp ?? 0, chatId };
        });

        // await batch
        /* eslint-disable no-await-in-loop */
        const batchResolved = await Promise.all(batchPromises);
        /* eslint-enable no-await-in-loop */

        // If a newer request started, abort and return early
        if (currentFetchIdRef.current !== reqId) {
          throw new Error("stale");
        }

        results.push(...batchResolved);
      }

      // sort results: most recent first, then unread desc, name asc
      results.sort((a, b) => {
        const at = a.timeStamp ?? 0;
        const bt = b.timeStamp ?? 0;
        if (at === bt) {
          if ((b.unreadCount ?? 0) !== (a.unreadCount ?? 0)) return (b.unreadCount ?? 0) - (a.unreadCount ?? 0);
          return (a.name || "").localeCompare(b.name || "");
        }
        return bt - at;
      });

      return results;
    } catch (err) {
      // if request canceled by newer fetch (we throw "stale"), ignore silently
      if (err.message === "stale") return [];
      throw err;
    }
  };

  const renderItem = ({ item }) => {
    const lm = item.lastMessage;
    const previewBase = lm ? (lm.text || (lm.type === "image" ? "📷 Image" : "")) : "";
    const previewPrefix = lm && lm.senderId === parentUserId ? "You: " : "";
    const previewText = lm ? `${previewPrefix}${previewBase}` : item.role === "student"
      ? `Grade ${item.grade} Section ${item.section}`
      : item.sectionText
      ? `- ${item.sectionText}`
      : "";

    const showSenderTick = lm && lm.senderId === parentUserId;
    const tickName = lm?.seen ? "checkmark-done" : "checkmark";
    const tickColor = lm?.seen ? "#1e90ff" : "#777";

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() =>
          router.push({
            pathname: "/chat",
            params: { userId: item.roleId, name: item.name },
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
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={{ fontSize: 11, color: "gray" }}>
              {item.lastMessage ? formatTimeShort(item.lastMessage.timeStamp) : ""}
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
            {/* Tick (for messages SENT by parent) */}
            {showSenderTick && (
              <Ionicons name={tickName} size={14} color={tickColor} style={{ marginRight: 6 }} />
            )}

            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{ color: "gray", flex: 1, fontSize: 13 }}
            >
              {previewText}
            </Text>

            {/* Unread badge */}
            {item.unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{item.unreadCount > 99 ? "99+" : item.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back-outline" size={28} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Messages</Text>
        <View style={{ width: 28, alignItems: "center", justifyContent: "center" }}>
          {isFetchingLast && <ActivityIndicator size="small" color="#1e90ff" />}
        </View>
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
              style={[styles.filterText, selectedFilter === f && { color: "#fff" }]}
            >
              {f.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={listData}
        keyExtractor={(item) => item.roleId}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<Text style={styles.emptyText}>No users found</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f0f2f5", paddingHorizontal: 12, paddingTop: 12 },
  topBar: { flexDirection: "row", alignItems: "center", marginBottom: 12, height: 70 },
  topBarTitle: { flex: 1, textAlign: "center", fontSize: 20, fontWeight: "bold" },
  filterRow: { flexDirection: "row", justifyContent: "between", marginBottom: 12 },
  filterBtn: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#e0e0e0",
    alignItems: "center",
  },
  selectedFilter: { backgroundColor: "#1e90ff" },
  filterText: { fontWeight: "bold", fontSize: 13, color: "#000" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 14,
    marginBottom: 10,
    width: "100%",
  },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  name: { fontWeight: "bold", fontSize: 16 },
  role: { fontSize: 12, color: "gray", marginTop: 2 },
  emptyText: { textAlign: "center", marginTop: 40, color: "gray" },

  unreadBadge: {
    backgroundColor: "#1e90ff",
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadText: { color: "#fff", fontSize: 12, fontWeight: "bold" },
});