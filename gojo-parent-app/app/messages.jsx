import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { child, get, ref, onValue, off, set } from "firebase/database";
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  LayoutAnimation,
  Platform,
  SafeAreaView,
  TextInput,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
  Alert,
  Dimensions,
  useWindowDimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { database } from "../constants/firebaseConfig";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Ensure Ionicons font is loaded so the back icon stays visible even during reloads
Ionicons.loadFont?.();

const animateNext = () => {
  try {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  } catch {}
};

const monthDayFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const monthDayYearFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });
const deviceLocale = (Intl?.DateTimeFormat?.().resolvedOptions().locale || "en").slice(0, 2);
const timeStrings = {
  en: { now: "now", yesterday: "Yesterday", min: "m", hr: "h" },
  ar: { now: "الآن", yesterday: "أمس", min: "د", hr: "س" },
  fr: { now: "mnt", yesterday: "Hier", min: "m", hr: "h" },
};

const formatTimeRelative = (timestamp) => {
  if (!timestamp) return "";
  const ts = Number(timestamp);
  if (Number.isNaN(ts)) return "";

  const date = new Date(ts);
  const now = new Date();
  const diffMs = now - date;

  const strings = timeStrings[deviceLocale] || timeStrings.en;

  if (diffMs < 0) return monthDayFormatter.format(date);

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return strings.now;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}${strings.min}`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}${strings.hr}`;

  const days = Math.floor(hours / 24);
  if (days === 1) return strings.yesterday;

  if (date.getFullYear() === now.getFullYear()) return monthDayFormatter.format(date);
  return monthDayYearFormatter.format(date);
};

export default function Messages() {
  const router = useRouter();
  const navigation = useNavigation();
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [filterWidth, setFilterWidth] = useState(0);
  const filterOptions = ["son", "teacher", "admin"];
  const filterAnim = useRef(new Animated.Value(0)).current;
  const skeletonAnim = useRef(new Animated.Value(0)).current;
  const [unreadTotals, setUnreadTotals] = useState({ son: 0, teacher: 0, admin: 0 });
  const [search, setSearch] = useState("");
  const isSearching = search.trim().length > 0;
  const [pinnedKeys, setPinnedKeys] = useState(new Set());
  const listenersRef = useRef([]); // store detach functions
  const unreadTotalsListenersRef = useRef([]);
  const unreadSegmentCountsRef = useRef({ son: {}, teacher: {}, admin: {} });
  const { width: SCREEN_W } = useWindowDimensions();
  const listPadH = Math.max(10, Math.min(18, SCREEN_W * 0.04));
  const cardHeight = SCREEN_W < 360 ? 78 : 86;
  const cardPadding = SCREEN_W < 360 ? 12 : 14;
  const listKeys = useMemo(
    () => listData.map((i) => `${i.roleId}:${i.receiverUserId || ""}`).join("|"),
    [listData]
  );

  // Keep both: record id stored in AsyncStorage and the actual Users UID
  const [parentRecordId, setParentRecordId] = useState(null); // key in Parents/ (what AsyncStorage holds)
  const [parentUserId, setParentUserId] = useState(null); // the actual Users UID used for chatId/unread

  // request id to avoid race conditions
  const currentFetchIdRef = useRef(0);
  const PINNED_KEY = "pinnedChats_v1";

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

  // Load pinned chats from storage
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(PINNED_KEY);
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) setPinnedKeys(new Set(arr));
        }
      } catch {}
    })();
  }, []);

  const makeChatKey = useCallback((it) => `${it.role}:${it.roleId}`, []);
  const isPinned = useCallback((it) => pinnedKeys.has(makeChatKey(it)), [pinnedKeys, makeChatKey]);
  const togglePin = useCallback(async (it) => {
    try {
      const key = makeChatKey(it);
      const next = new Set(pinnedKeys);
      if (next.has(key)) next.delete(key); else next.add(key);
      setPinnedKeys(next);
      await AsyncStorage.setItem(PINNED_KEY, JSON.stringify(Array.from(next)));
    } catch (e) {}
  }, [pinnedKeys, makeChatKey]);

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

  // Re-run filter when dependencies change (skip while searching)
  useEffect(() => {
    if (parentRecordId && !search.trim()) {
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
    search,
  ]);

  // Animate filter indicator like attendance segmented control
  useEffect(() => {
    const idx = filterOptions.indexOf(selectedFilter);
    Animated.spring(filterAnim, {
      toValue: idx >= 0 ? idx : 0,
      useNativeDriver: true,
      stiffness: 140,
      damping: 16,
      mass: 0.6,
    }).start();
  }, [selectedFilter, filterAnim]);

  // Shimmer animation for skeletons
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(skeletonAnim, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.timing(skeletonAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [skeletonAnim]);

  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
  const skelTranslateX = skeletonAnim.interpolate({ inputRange: [0, 1], outputRange: [-120, SCREEN_WIDTH] });
  const isSkeletonActive =
    isInitialLoad ||
    (isFetchingLast && listData.length === 0) ||
    (isRefreshing && listData.length === 0);
  const showRefreshOverlay = isRefreshing && listData.length > 0;
  const showLoadingOverlay = isFetchingLast && listData.length > 0;

  const attachUnreadTotalsListeners = useCallback(() => {
    unreadTotalsListenersRef.current.forEach((u) => {
      try {
        u();
      } catch {}
    });
    unreadTotalsListenersRef.current = [];
    unreadSegmentCountsRef.current = { son: {}, teacher: {}, admin: {} };

    if (!parentUserId || !parentRecordId) return;

    const lists = {
      son: buildBaseList("son"),
      teacher: buildBaseList("teacher"),
      admin: buildBaseList("admin"),
    };

    Object.entries(lists).forEach(([segment, list]) => {
      list.forEach((item) => {
        if (!item.receiverUserId) return;
        const chatId = [parentUserId, item.receiverUserId].sort().join("_");
        const unreadRef = ref(database, `Chats/${chatId}/unread/${parentUserId}`);
        const unsub = onValue(unreadRef, (snap) => {
          const val = snap.exists() ? snap.val() || 0 : 0;
          unreadSegmentCountsRef.current[segment][item.roleId] = val;
          const totals = { son: 0, teacher: 0, admin: 0 };
          Object.keys(unreadSegmentCountsRef.current).forEach((key) => {
            totals[key] = Object.values(unreadSegmentCountsRef.current[key]).reduce((acc, n) => acc + (n || 0), 0);
          });
          setUnreadTotals(totals);
        });
        unreadTotalsListenersRef.current.push(() => off(unreadRef));
        if (typeof unsub === "function") unreadTotalsListenersRef.current.push(unsub);
      });
    });
  }, [parentUserId, parentRecordId, parents, students, teachers, courses, assignments, schoolAdmins, allUsers]);

  useEffect(() => {
    if (isFocused) {
      attachUnreadTotalsListeners();
    }
  }, [isFocused, attachUnreadTotalsListeners]);

  useEffect(() => {
    attachUnreadTotalsListeners();
    return () => {
      unreadTotalsListenersRef.current.forEach((u) => {
        try {
          u();
        } catch {}
      });
      unreadTotalsListenersRef.current = [];
      unreadSegmentCountsRef.current = { son: {}, teacher: {}, admin: {} };
    };
  }, [attachUnreadTotalsListeners]);

  // Attach realtime listeners for lastMessage and unread per visible item
  useEffect(() => {
    // clear previous listeners
    listenersRef.current.forEach((unsub) => {
      try {
        unsub();
      } catch {}
    });
    listenersRef.current = [];

    if (!parentUserId || !Array.isArray(listData) || listData.length === 0) return;

    const unsubs = [];
    listData.forEach((it) => {
      if (!it?.receiverUserId) return;
      const chatId = [parentUserId, it.receiverUserId].sort().join("_");
      const lastMsgRef = ref(database, `Chats/${chatId}/lastMessage`);
      const unreadRef = ref(database, `Chats/${chatId}/unread/${parentUserId}`);

      const lastUnsub = onValue(lastMsgRef, (snap) => {
        const lm = snap.exists() ? snap.val() : null;
        setListData((prev) =>
          prev.map((row) =>
            row.roleId === it.roleId
              ? { ...row, lastMessage: lm, timeStamp: lm?.timeStamp ?? row.timeStamp ?? 0 }
              : row
          )
        );
      });

      const unreadUnsub = onValue(unreadRef, (snap) => {
        const unread = snap.exists() ? snap.val() : 0;
        setListData((prev) => prev.map((row) => (row.roleId === it.roleId ? { ...row, unreadCount: unread } : row)));
      });

      unsubs.push(() => off(lastMsgRef));
      unsubs.push(() => off(unreadRef));
      // also push native return if available
      if (typeof lastUnsub === "function") unsubs.push(lastUnsub);
      if (typeof unreadUnsub === "function") unsubs.push(unreadUnsub);
    });

    listenersRef.current = unsubs;
    return () => {
      unsubs.forEach((u) => {
        try {
          u();
        } catch {}
      });
    };
  }, [parentUserId, listKeys]);

  const markChatAsRead = async (receiverUserId) => {
    if (!parentUserId || !receiverUserId) return;
    const chatId = [parentUserId, receiverUserId].sort().join("_");
    try {
      await set(ref(database, `Chats/${chatId}/unread/${parentUserId}`), 0);
    } catch (e) {
      console.log("markChatAsRead error:", e);
    }
  };

  // Re-fetch when screen gains focus
  useEffect(() => {
    if (isFocused && parentRecordId) {
      handleFilterChange(selectedFilter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]);

  // Public handler used by UI to change filters — debounced-ish and cancels previous fetches
  const handleFilterChange = async (filter) => {
    // increment request id
    currentFetchIdRef.current += 1;
    const reqId = currentFetchIdRef.current;

    // build base list immediately but DO NOT replace listData until we fetch lastMessage/unread
    const baseList = buildBaseList(filter);

    // if there is no parentUserId yet (can't fetch chat data), show base entries with no lastMessage
    if (!parentUserId) {
      animateNext();
      setListData(baseList.map((i) => ({ ...i, lastMessage: null, unreadCount: 0 })));
      setIsInitialLoad(false);
      return;
    }

    // indicate loading (we keep showing current list until new data arrives to avoid flicker)
    setIsFetchingLast(true);

    // fetch lastMessage/unread for baseList (batched)
    try {
      const resolved = await fetchLastMessagesForList(baseList, reqId);
      if (currentFetchIdRef.current === reqId) {
        animateNext();
        setListData(resolved);
      }
    } catch (err) {
      console.log("fetchLastMessagesForList error:", err);
    } finally {
      if (currentFetchIdRef.current === reqId) setIsFetchingLast(false);
      setIsInitialLoad(false);
    }
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
                name: user?.name || "Student",
                profileImage: user.profileImage || "https://cdn-icons-png.flaticon.com/512/847/847969.png",
                role: "student",
                grade: student.grade,
                section: student.section,
              }
            : {
                roleId: child.studentId,
                receiverUserId: student.userId,
                name: "Student",
                profileImage: "https://cdn-icons-png.flaticon.com/512/847/847969.png",
                role: "student",
                grade: student.grade,
                section: student.section,
              };
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
                    name: user?.name || "Teacher",
                    profileImage: user.profileImage || teacher.profileImage || "https://cdn-icons-png.flaticon.com/512/847/847969.png",
                    role: "teacher",
                    sections: [],
                  };
                }
                const sectionKey = `${course.grade}${course.section}`;
                if (!teacherMap[assignment.teacherId].sections.includes(sectionKey)) {
                  teacherMap[assignment.teacherId].sections.push(sectionKey);
                }
              }
            });
          }
        });
      });

      list = Object.values(teacherMap).map((t) => ({
        ...t,
        sectionText: t.sections.length ? `Grade ${t.sections.join(", ")}` : "",
      }));
    } else if (filter === "admin") {
      list = Object.values(schoolAdmins)
        .map((admin) => {
          const user = allUsers[admin.userId];
          return {
            roleId: admin.adminId,
            receiverUserId: admin.userId,
            name: user?.name || admin?.name || "Admin",
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

  const MessageRow = memo(({ item, pinned, onTogglePin }) => {
    const lm = item.lastMessage;
    const previewBase = lm ? (lm.text || (lm.type === "image" ? "📷 Image" : "")) : "";
    const previewPrefix = lm && lm.senderId === parentUserId ? "You: " : "";
    const previewText = lm
      ? `${previewPrefix}${previewBase}`
      : item.role === "student"
      ? `Grade ${item.grade} · Section ${item.section}`
      : item.role === "teacher"
      ? "Start a conversation"
      : "Start a conversation";

    const showSenderTick = lm && lm.senderId === parentUserId;
    const tickName = lm?.seen ? "checkmark-done" : "checkmark";
    const tickColor = lm?.seen ? "#1e90ff" : "#94a3b8";
    const isUnread = (item.unreadCount || 0) > 0;
    const a11yLabel = `${item.name || "Chat"}. ${previewText || "No messages yet"}. ${
      isUnread ? `${item.unreadCount} unread` : ""
    }`;

    return (
      <TouchableOpacity
        style={[styles.card, { padding: cardPadding, minHeight: cardHeight }, isUnread && styles.cardUnread]}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        onLongPress={() => {
          Alert.alert(
            item.name || "Chat",
            undefined,
            [
              {
                text: pinned ? "Unpin" : "Pin",
                onPress: onTogglePin,
              },
              {
                text: "Mark as read",
                onPress: () => markChatAsRead(item.receiverUserId),
              },
              {
                text: "Open",
                onPress: () =>
                  router.push({ pathname: "/chat", params: { userId: item.roleId, name: item.name } }),
              },
              { text: "Cancel", style: "cancel" },
            ]
          );
        }}
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
          <View style={styles.cardTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={styles.metaRow}>
                <View style={styles.rolePill}>
                  <Text style={styles.rolePillText}>{item.role === "student" ? "Student" : item.role === "teacher" ? "Teacher" : "Admin"}</Text>
                </View>
                {item.role === "student" && (
                  <Text style={styles.metaText}>{`Grade ${item.grade} · Sec ${item.section}`}</Text>
                )}
                {item.role === "teacher" && item.sectionText && (
                  <Text style={styles.metaText}>{item.sectionText}</Text>
                )}
              </View>
            </View>

            <View style={styles.rightCol}>
              <Text style={styles.timeText}>
                {item.lastMessage ? formatTimeRelative(item.lastMessage.timeStamp) : ""}
              </Text>
              {isUnread && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{item.unreadCount > 99 ? "99+" : item.unreadCount}</Text>
                </View>
              )}
              <TouchableOpacity onPress={onTogglePin} style={styles.pinBtn} accessibilityLabel={pinned ? "Unpin chat" : "Pin chat"}>
                <Ionicons name={pinned ? "star" : "star-outline"} size={16} color={pinned ? "#f59e0b" : "#94a3b8"} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.previewRow}>
            {showSenderTick && <Ionicons name={tickName} size={14} color={tickColor} style={{ marginRight: 6 }} />}
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[styles.previewText, isUnread && styles.previewTextUnread]}
            >
              {previewText || "Start a conversation"}
            </Text>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
      </TouchableOpacity>
    );
  }, (prev, next) => {
    const a = prev.item;
    const b = next.item;
    return (
      a.roleId === b.roleId &&
      (a.lastMessage?.timeStamp ?? 0) === (b.lastMessage?.timeStamp ?? 0) &&
      (a.unreadCount ?? 0) === (b.unreadCount ?? 0) &&
      a.name === b.name &&
      a.profileImage === b.profileImage &&
      a.sectionText === b.sectionText &&
      a.grade === b.grade &&
      a.section === b.section &&
      prev.pinned === next.pinned
    );
  });

  const renderItem = useCallback(({ item }) => <MessageRow item={item} pinned={isPinned(item)} onTogglePin={() => togglePin(item)} />, [parentUserId, isPinned, togglePin]);

  // Build union list for search across all roles
  const buildCombinedBaseList = () => {
    const a = buildBaseList("son");
    const b = buildBaseList("teacher");
    const c = buildBaseList("admin");
    const seen = new Set();
    const out = [];
    [...a, ...b, ...c].forEach((it) => {
      const key = `${it.role}:${it.roleId}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(it);
      }
    });
    return out;
  };

  // Debounced global search across students, teachers and admins
  useEffect(() => {
    const q = search.trim().toLowerCase();
    if (!q) return; // when clearing, main effect will repopulate

    const reqId = ++currentFetchIdRef.current;
    const timer = setTimeout(async () => {
      try {
        const union = buildCombinedBaseList();
        const filtered = union.filter((it) => {
          const name = (it.name || "").toLowerCase();
          const section = (it.sectionText || "").toLowerCase();
          const cls = it.role === "student" ? `grade ${it.grade} section ${it.section}`.toLowerCase() : "";
          return name.includes(q) || section.includes(q) || cls.includes(q);
        });

        if (!parentUserId) {
          animateNext();
          setListData(filtered.map((i) => ({ ...i, lastMessage: null, unreadCount: 0 })));
          return;
        }

        setIsFetchingLast(true);
        const resolved = await fetchLastMessagesForList(filtered, reqId);
        if (currentFetchIdRef.current === reqId) {
          animateNext();
          setListData(resolved);
        }
      } catch (e) {
        console.log("search fetch error:", e);
      } finally {
        if (currentFetchIdRef.current === reqId) setIsFetchingLast(false);
        setIsInitialLoad(false);
      }
    }, 280);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, allUsers, students, teachers, parents, courses, assignments, schoolAdmins, parentUserId]);

  // Render skeleton list rows matching actual card dimensions
  const renderListSkeletons = () => {
    const CARD_H = cardHeight; // sync with getItemLayout length
    const CARD_MARGIN = 10;
    const headerApprox = 68 + 12 + 44 + 12 + 48; // topBar + spacing + filter + spacing + search
    const available = Math.max(0, SCREEN_HEIGHT - headerApprox - 80);
    const perRow = CARD_H + CARD_MARGIN;
    const count = Math.max(6, Math.ceil(available / perRow));

    const items = Array.from({ length: count }).map((_, i) => (
      <View key={`sk-${i}`} style={[styles.skeletonCard, { minHeight: CARD_H, padding: cardPadding }]}>
        <View style={styles.skeletonAvatar} />
        <View style={{ flex: 1 }}>
          <View style={styles.skeletonLineWide} />
          <View style={styles.skeletonLine} />
        </View>
        <View style={styles.skeletonDot} />
        <Animated.View style={[styles.shimmer, { transform: [{ translateX: skelTranslateX }] }]} />
      </View>
    ));
    return <View style={{ paddingHorizontal: listPadH, paddingTop: 6 }}>{items}</View>;
  };

  const displayList = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? listData.filter((it) => {
          const name = (it.name || "").toLowerCase();
          const section = (it.sectionText || "").toLowerCase();
          const cls = it.role === "student" ? `grade ${it.grade} section ${it.section}`.toLowerCase() : "";
          const last = (it.lastMessage?.text || (it.lastMessage?.type === "image" ? "image" : "")).toLowerCase();
          return name.includes(q) || section.includes(q) || cls.includes(q) || last.includes(q);
        })
      : listData.slice();

    // sort pinned first, then by timeStamp desc, then unread desc, then name
    filtered.sort((a, b) => {
      const ap = isPinned(a) ? 1 : 0;
      const bp = isPinned(b) ? 1 : 0;
      if (ap !== bp) return bp - ap;
      const at = a.timeStamp ?? a.lastMessage?.timeStamp ?? 0;
      const bt = b.timeStamp ?? b.lastMessage?.timeStamp ?? 0;
      if (at !== bt) return bt - at;
      const au = a.unreadCount ?? 0;
      const bu = b.unreadCount ?? 0;
      if (au !== bu) return bu - au;
      return (a.name || "").localeCompare(b.name || "");
    });
    return filtered;
  }, [listData, search, isPinned]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topSection}>
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => {
              try {
                if (navigation && typeof navigation.canGoBack === "function" && navigation.canGoBack()) {
                  navigation.goBack();
                } else {
                  router.replace("/dashboard/home");
                }
              } catch {
                router.replace("/dashboard/home");
              }
            }}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={22} color="#000000" />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={styles.topBarTitle}>Messages</Text>
            <Text style={styles.subTitle}>Stay connected with your school</Text>
          </View>
          <View style={styles.loaderSpot}>
            {isFetchingLast && <ActivityIndicator size="small" color="#1e90ff" />}
          </View>
        </View>

        <View style={{ marginTop: 6 }}>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
            <TextInput
              placeholder="Search by name"
              placeholderTextColor="#94a3b8"
              value={search}
              onChangeText={setSearch}
              style={styles.searchInput}
              returnKeyType="search"
              accessibilityLabel="Search conversations"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}> 
                <Ionicons name="close-circle" size={18} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {!isSearching && (
          <View style={styles.filterWrapper}>
            <View
              style={styles.filterTabs}
              onLayout={(e) => setFilterWidth(e.nativeEvent.layout.width)}
            >
              {filterWidth > 0 && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.filterIndicator,
                    {
                      width: filterWidth / filterOptions.length,
                      transform: [
                        {
                          translateX: Animated.multiply(
                            filterAnim,
                            filterWidth / filterOptions.length || 0
                          ),
                        },
                      ],
                    },
                  ]}
                />
              )}

              {filterOptions.map((f) => {
                const active = selectedFilter === f;
                const count = unreadTotals[f] || 0;
                const a11yLabel = `Filter ${f}. ${count > 0 ? `${count} unread` : "no unread"}. ${active ? "Selected" : ""}`;
                return (
                  <TouchableOpacity
                    key={f}
                    style={styles.filterTab}
                    onPress={() => {
                      if (search) setSearch("");
                      setSelectedFilter(f);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={a11yLabel}
                    accessibilityState={{ selected: active }}
                    activeOpacity={0.85}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={[styles.filterText, active && styles.filterTextActive]}>{f.toUpperCase()}</Text>
                      {count > 0 && (
                        <View style={[styles.filterBadge, count > 99 && styles.filterBadgeWide]}>
                          <Text style={styles.filterBadgeText}>{count > 99 ? "99+" : count}</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </View>

      {isSkeletonActive ? (
        <View style={{ paddingHorizontal: listPadH, paddingTop: 6 }}>
          {renderListSkeletons()}
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <FlatList
            data={displayList}
            keyExtractor={(item) => String(item.roleId)}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 24, paddingHorizontal: listPadH, paddingTop: 6 }}
            showsVerticalScrollIndicator={false}
            getItemLayout={(data, index) => ({ length: cardHeight, offset: cardHeight * index, index })}
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            updateCellsBatchingPeriod={50}
            windowSize={7}
            removeClippedSubviews
            ListEmptyComponent={
              !isSkeletonActive && (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>{search.trim() ? "No matches found" : "No users found"}</Text>
                  <TouchableOpacity
                    style={styles.emptyCta}
                    onPress={() => router.replace("/dashboard/home")}
                    accessibilityRole="button"
                    accessibilityLabel="Go to dashboard"
                  >
                    <Text style={styles.emptyCtaText}>Go to Dashboard</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.emptyCtaGhost}
                    onPress={() => handleFilterChange(selectedFilter)}
                    accessibilityRole="button"
                    accessibilityLabel="Refresh list"
                  >
                    <Text style={styles.emptyCtaGhostText}>Refresh</Text>
                  </TouchableOpacity>
                </View>
              )
            }
            refreshing={isRefreshing}
            onRefresh={() => {
              setIsRefreshing(true);
              handleFilterChange(selectedFilter).finally(() => setIsRefreshing(false));
            }}
          />
          {(showRefreshOverlay || showLoadingOverlay) && (
            <View style={styles.refreshOverlay} pointerEvents="none">
              {renderListSkeletons()}
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f5f7fb" },
  topSection: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 0,
    backgroundColor: "#f5f7fb",
  },
  topBar: { flexDirection: "row", alignItems: "center", height: 68 },
  topBarTitle: { fontSize: 20, fontWeight: "bold", color: "#0f172a" },
  subTitle: { color: "#475569", fontSize: 12, marginTop: 4 },
  loaderSpot: { width: 32, alignItems: "center", justifyContent: "center" },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(37, 100, 235, 0.07)",
  },
  filterWrapper: { marginTop: 0, marginBottom: 8 },
  filterTabs: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#dce3f5",
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
    elevation: 2,
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  filterTab: { flex: 1, paddingVertical: 10, alignItems: "center", backgroundColor: "transparent" },
  filterText: { fontWeight: "700", fontSize: 13, color: "#475569", letterSpacing: 0.3 },
  filterTextActive: { color: "#0f172a" },
  filterBadge: {
    minWidth: 22,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 6,
    backgroundColor: "#1e90ff",
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadgeWide: { minWidth: 26, paddingHorizontal: 8 },
  filterBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  filterIndicator: {
    position: "absolute",
    top: 4,
    bottom: 4,
    left: 0,
    backgroundColor: "rgba(37,99,235,0.18)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(37,99,235,0.45)",
    elevation: 2,
    shadowColor: "#2563eb",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    width: "100%",
    minHeight: 76,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardUnread: { backgroundColor: "#eaf3ff", borderColor: "#99c2ff" },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  name: { fontWeight: "800", fontSize: 16, color: "#0f172a", letterSpacing: -0.15 },
  role: { fontSize: 12, color: "gray", marginTop: 2 },
  emptyText: { textAlign: "center", marginTop: 8, color: "gray" },
  emptyCta: {
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "#1e90ff",
    borderRadius: 10,
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  emptyCtaText: { color: "#fff", fontWeight: "700", fontSize: 14, textAlign: "center" },
  emptyCtaGhost: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
  },
  emptyCtaGhostText: { color: "#0f172a", fontWeight: "700", fontSize: 14, textAlign: "center" },

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
  emptyBox: { alignItems: "center", paddingVertical: 40 },
  cardTopRow: { flexDirection: "row", alignItems: "flex-start" },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 4, gap: 6 },
  rolePill: {
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  rolePillText: { fontSize: 11, fontWeight: "700", color: "#475569" },
  metaText: { fontSize: 12, color: "#6b7280" },
  rightCol: { alignItems: "flex-end", marginLeft: 8 },
  timeText: { fontSize: 11, color: "#6b7280", marginBottom: 4 },
  previewRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  previewText: { color: "#6b7280", flex: 1, fontSize: 13 },
  previewTextUnread: { color: "#0f172a", fontWeight: "600" },
  pinBtn: { marginTop: 6, paddingVertical: 4, paddingHorizontal: 6 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    shadowColor: "#0f172a",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  searchInput: { flex: 1, color: "#0f172a", paddingVertical: 0, fontSize: 14 },
  // Skeletons
  skeletonFilterTabs: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e5e7eb",
    borderRadius: 14,
    padding: 4,
    gap: 6,
  },
  skeletonFilterPill: { flex: 1, height: 36, borderRadius: 10, backgroundColor: "#f1f5f9" },
  skeletonCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    width: "100%",
    minHeight: 76,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  skeletonAvatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12, backgroundColor: "#e5e7eb" },
  skeletonLineWide: { height: 12, borderRadius: 6, backgroundColor: "#e5e7eb", width: "68%", marginBottom: 10 },
  skeletonLine: { height: 10, borderRadius: 6, backgroundColor: "#e5e7eb", width: "40%" },
  skeletonDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#e5e7eb", marginLeft: 8 },
  shimmer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: -180,
    width: 180,
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  refreshOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 0,
    paddingTop: 0,
    backgroundColor: "rgba(245,247,251,0.35)",
  },
});