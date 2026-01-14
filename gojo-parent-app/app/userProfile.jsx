import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Linking,
  Share,
  Alert,
  Platform,
  ToastAndroid,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ref, get, child, push, set } from "firebase/database";
import { database } from "../constants/firebaseConfig";
import { useSafeAreaInsets } from "react-native-safe-area-context";
/* ---------------- CONSTANTS ---------------- */
const TG_BLUE = "#2AABEE";
const { width } = Dimensions.get("window");

const HEADER_MAX_HEIGHT = Math.max(220, Math.min(300, width * 0.62));
const HEADER_MIN_HEIGHT = 60;
const AVATAR_SIZE = Math.max(96, Math.min(140, width * 0.32));
const CAMERA_SIZE = Math.max(36, Math.min(50, width * 0.12));
const SKELETON_BASE = "#E6E8EB";
const SKELETON_HIGHLIGHT = "#F2F4F6";

function ShimmerBlock({ style }) {
  const animated = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(animated, {
        toValue: 1,
        duration: 1400,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [animated]);

  const translateX = animated.interpolate({ inputRange: [0, 1], outputRange: [-120, 240] });

  return (
    <View style={[{ overflow: "hidden", backgroundColor: SKELETON_BASE, borderRadius: 8 }, style]}>
      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          width: 120,
          opacity: 0.6,
          transform: [{ translateX }],
          backgroundColor: SKELETON_HIGHLIGHT,
        }}
      />
    </View>
  );
}

function SkeletonProfile() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: "#EFEFF4" }}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      <View style={[styles.topBar, { top: insets.top + 8 }]}> 
        {/* Remove shimmer for back icon and 3-dot menu */}
        <View style={styles.topIcon} />
        <View style={styles.topTitleStack}>
          <ShimmerBlock style={{ height: 12, width: Math.min(140, width * 0.4), borderRadius: 6, marginBottom: 6 }} />
          <ShimmerBlock style={{ height: 10, width: Math.min(90, width * 0.26), borderRadius: 6 }} />
        </View>
        <View style={styles.topIcon} />
      </View>

      <View style={{ height: HEADER_MAX_HEIGHT }}>
        <ShimmerBlock style={{ flex: 1, borderRadius: 0 }} />
      </View>

      <View style={{ alignItems: "center", marginTop: -AVATAR_SIZE / 2 }}>
        <ShimmerBlock style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 }} />
        <ShimmerBlock style={{ height: 14, width: Math.min(180, width * 0.5), borderRadius: 7, marginTop: 12 }} />
        <ShimmerBlock style={{ height: 10, width: Math.min(120, width * 0.32), borderRadius: 6, marginTop: 8 }} />
      </View>

      <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
        {/* Info Card */}
        <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <ShimmerBlock style={{ height: 14, width: 120, borderRadius: 7, marginBottom: 10 }} />
          <ShimmerBlock style={{ height: 10, width: "90%", borderRadius: 6, marginBottom: 8 }} />
          <ShimmerBlock style={{ height: 10, width: "80%", borderRadius: 6, marginBottom: 8 }} />
          <ShimmerBlock style={{ height: 10, width: "70%", borderRadius: 6 }} />
        </View>

        {/* Badges Section */}
        <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <ShimmerBlock style={{ height: 14, width: 160, borderRadius: 7, marginBottom: 10 }} />
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            <ShimmerBlock style={{ height: 24, width: 80, borderRadius: 12, marginRight: 8, marginBottom: 8 }} />
            <ShimmerBlock style={{ height: 24, width: 60, borderRadius: 12, marginRight: 8, marginBottom: 8 }} />
            <ShimmerBlock style={{ height: 24, width: 70, borderRadius: 12, marginRight: 8, marginBottom: 8 }} />
          </View>
        </View>

        {/* Parents Section */}
        <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <ShimmerBlock style={{ height: 14, width: 120, borderRadius: 7, marginBottom: 10 }} />
          {[...Array(2)].map((_, i) => (
            <View key={`p-${i}`} style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
              <ShimmerBlock style={{ width: 48, height: 48, borderRadius: 24, marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <ShimmerBlock style={{ height: 12, width: "60%", borderRadius: 6, marginBottom: 6 }} />
                <ShimmerBlock style={{ height: 10, width: "40%", borderRadius: 6 }} />
              </View>
              <ShimmerBlock style={{ width: 36, height: 36, borderRadius: 18 }} />
            </View>
          ))}
        </View>

        {/* Teachers Section */}
        <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 24 }}>
          <ShimmerBlock style={{ height: 14, width: 140, borderRadius: 7, marginBottom: 10 }} />
          {[...Array(2)].map((_, i) => (
            <View key={`t-${i}`} style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
              <ShimmerBlock style={{ width: 48, height: 48, borderRadius: 24, marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <ShimmerBlock style={{ height: 12, width: "60%", borderRadius: 6, marginBottom: 6 }} />
                <ShimmerBlock style={{ height: 10, width: "40%", borderRadius: 6 }} />
              </View>
              <ShimmerBlock style={{ width: 36, height: 36, borderRadius: 18 }} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

export default function UserProfile() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const { recordId: paramRecordId, userId: paramUserId, roleName: paramRoleName } = params ?? {};

  const [user, setUser] = useState(null);
  const [roleData, setRoleData] = useState(null);
  const [roleName, setRoleName] = useState(paramRoleName ?? null);
  const [loading, setLoading] = useState(true);
  const [parentUserId, setParentUserId] = useState(null);
  const [parentRecordId, setParentRecordId] = useState(null);
  const [menuVisible, setMenuVisible] = useState(false); // 3-dot menu
  const [showFullProfileImage, setShowFullProfileImage] = useState(true);
  const [children, setChildren] = useState([]);
  const [parents, setParents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [badges, setBadges] = useState([]);
  const [teacherCourses, setTeacherCourses] = useState([]);

  const scrollY = useRef(new Animated.Value(0)).current;

  /* ---------------- LOAD PARENT USER ---------------- */
  useEffect(() => {
    let mounted = true;
    (async () => {
      const pr = await AsyncStorage.getItem("parentId");
      if (!pr || !mounted) return;
      setParentRecordId(pr);
      const snap = await get(child(ref(database), `Parents/${pr}`));
      if (snap.exists()) setParentUserId(snap.val()?.userId);
    })();
    return () => (mounted = false);
  }, []);

  /* ---------------- LOAD USER + ROLE ---------------- */
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        let resolvedUserId = paramUserId ?? null;
        let rId = paramRecordId ?? null;
        let detectedRole = roleName;

        if (!resolvedUserId && rId) {
          const roles = ["Students", "Teachers", "School_Admins", "Parents"];
          for (const r of roles) {
            const snap = await get(child(ref(database), `${r}/${rId}`));
            if (snap.exists()) {
              resolvedUserId = snap.val().userId;
              setRoleData(snap.val());
              detectedRole = r === "Students" ? "Student" : r === "Teachers" ? "Teacher" : r === "Parents" ? "Parent" : "Admin";
              setRoleName(detectedRole);
              break;
            }
          }
        }

        const effectiveRole = detectedRole;

        if (resolvedUserId) {
          const userSnap = await get(child(ref(database), `Users/${resolvedUserId}`));
          if (mounted) setUser(userSnap.val());
        }

        // If Parent role detected, load children
        if ((rId && effectiveRole === "Parent") || (!effectiveRole && rId)) {
          const parentSnap = await get(child(ref(database), `Parents/${rId}`));
          if (parentSnap.exists()) {
            const parentNode = parentSnap.val();
            const usersSnap = await get(child(ref(database), `Users`));
            const studentsSnap = await get(child(ref(database), `Students`));
            const usersData = usersSnap.exists() ? usersSnap.val() : {};
            const studentsData = studentsSnap.exists() ? studentsSnap.val() : {};
            const defaultProfile = "https://cdn-icons-png.flaticon.com/512/847/847969.png";
            const childrenArray = parentNode.children
              ? Object.values(parentNode.children).map((childLink) => {
                  const student = studentsData[childLink.studentId];
                  const studentUser = usersData[student?.userId] || {};
                  return {
                    ...childLink,
                    name: studentUser.name || "Student Name",
                    profileImage: studentUser.profileImage || defaultProfile,
                    grade: student?.grade || "--",
                    section: student?.section || "--",
                  };
                })
              : [];
            if (mounted) setChildren(childrenArray);
          }
        }

        // If Student role detected, load parents and teachers linked to this student
        if (rId && effectiveRole === "Student") {
          const studentSnap = await get(child(ref(database), `Students/${rId}`));
          const usersSnap = await get(child(ref(database), `Users`));
          const usersData = usersSnap.exists() ? usersSnap.val() : {};
          const defaultProfile = "https://cdn-icons-png.flaticon.com/512/847/847969.png";
          const coursesSnap = await get(child(ref(database), `Courses`));
          const assignmentsSnap = await get(child(ref(database), `TeacherAssignments`));
          const teachersSnap = await get(child(ref(database), `Teachers`));
          const coursesData = coursesSnap.exists() ? coursesSnap.val() : {};
          const assignmentsData = assignmentsSnap.exists() ? assignmentsSnap.val() : {};
          const teachersData = teachersSnap.exists() ? teachersSnap.val() : {};

          let parentsArray = [];
          let teachersArray = [];
          let badgeArray = [];
          if (studentSnap.exists()) {
            const sData = studentSnap.val();
            const parentMap = sData?.parents || {};
            const parentIds = Object.keys(parentMap);
            if (parentIds.length) {
              // Fetch each parent to get relationship and user details
              const collected = [];
              for (const pid of parentIds) {
                const pSnap = await get(child(ref(database), `Parents/${pid}`));
                if (pSnap.exists()) {
                  const pNode = pSnap.val();
                  const pUser = usersData[pNode.userId] || {};
                  const relationship = parentMap[pid]?.relationship || "Parent";
                  collected.push({
                    parentId: pid,
                    name: pUser.name || pUser.username || "Parent",
                    profileImage: pUser.profileImage || defaultProfile,
                    relationship,
                  });
                }
              }
              parentsArray = collected;
            }

            // Build teacher list based on grade/section courses and assignments
            const grade = sData?.grade;
            const section = sData?.section;
            const courseIds = Object.keys(coursesData).filter((cid) => {
              const c = coursesData[cid];
              return c?.grade === grade && c?.section === section;
            });

            if (courseIds.length) {
              const teacherMap = {};
              Object.keys(assignmentsData).forEach((aid) => {
                const assign = assignmentsData[aid];
                if (!assign?.teacherId || !assign?.courseId) return;
                if (!courseIds.includes(assign.courseId)) return;
                const tId = assign.teacherId;
                if (!teacherMap[tId]) {
                  teacherMap[tId] = {
                    teacherId: tId,
                    subjects: new Set(),
                  };
                }
                const course = coursesData[assign.courseId] || {};
                if (course?.subject) teacherMap[tId].subjects.add(course.subject);
              });

              teachersArray = Object.keys(teacherMap).map((tId) => {
                const tNode = teachersData[tId] || {};
                const tUser = usersData[tNode.userId] || {};
                return {
                  teacherId: tId,
                  userId: tNode.userId,
                  name: tUser.name || tUser.username || "Teacher",
                  profileImage: tUser.profileImage || defaultProfile,
                  subjects: Array.from(teacherMap[tId].subjects),
                };
              });
            }

            // Collect badges from Students/<id>/badges if present
            const badgeMap = sData?.badges || {};
            badgeArray = Object.keys(badgeMap).map((bid) => {
              const b = badgeMap[bid] || {};
              return {
                id: bid,
                title: b.title || b.name || "Badge",
                teacherId: b.teacherId || null,
                color: b.color || "#e0f2fe",
                issuedAt: b.issuedAt || null,
              };
            });
          }

          // Fallback: scan Parents if student.parents is missing
          if (!parentsArray.length) {
            const parentsSnap = await get(child(ref(database), `Parents`));
            const parentsData = parentsSnap.exists() ? parentsSnap.val() : {};
            parentsArray = Object.keys(parentsData).reduce((acc, pid) => {
              const pNode = parentsData[pid];
              const links = pNode?.children ? Object.values(pNode.children) : [];
              const match = links.find((link) => link?.studentId === rId);
              if (match) {
                const pUser = usersData[pNode.userId] || {};
                acc.push({
                  parentId: pid,
                  userId: pNode.userId,
                  name: pUser.name || pUser.username || "Parent",
                  profileImage: pUser.profileImage || defaultProfile,
                  relationship: match.relationship || "Parent",
                });
              }
              return acc;
            }, []);
          }

          if (mounted) {
            setParents(parentsArray);
            setTeachers(teachersArray);
            setBadges(badgeArray);
          }
        }

        // If Teacher role detected, load assigned courses and students
        if (rId && effectiveRole === "Teacher") {
          const usersSnap = await get(child(ref(database), `Users`));
          const usersData = usersSnap.exists() ? usersSnap.val() : {};
          const coursesSnap = await get(child(ref(database), `Courses`));
          const assignmentsSnap = await get(child(ref(database), `TeacherAssignments`));
          const coursesData = coursesSnap.exists() ? coursesSnap.val() : {};
          const assignmentsData = assignmentsSnap.exists() ? assignmentsSnap.val() : {};

          const assignedCourseIds = Object.keys(assignmentsData)
            .filter((aid) => assignmentsData[aid]?.teacherId === rId)
            .map((aid) => assignmentsData[aid].courseId);

          const uniqueCourseIds = Array.from(new Set(assignedCourseIds));

          const coursesArray = uniqueCourseIds.map((cid) => {
            const c = coursesData[cid] || {};
            return {
              courseId: cid,
              subject: c.subject || "Subject",
              grade: c.grade || "--",
              section: c.section || "--",
            };
          });

          if (mounted) {
            setTeacherCourses(coursesArray);
          }
        }
      } catch (e) {
        console.warn(e);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => (mounted = false);
  }, [paramRecordId, paramUserId]);

  /* ---------------- ANIMATIONS ---------------- */
  const headerHeight = scrollY.interpolate({
    inputRange: [0, HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT],
    outputRange: [HEADER_MAX_HEIGHT, HEADER_MIN_HEIGHT],
    extrapolate: "clamp",
  });

  // Avatar + Name animation (move & shrink together)
  const headerContentTranslate = scrollY.interpolate({
    inputRange: [0, HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT],
    outputRange: [0, -60],
    extrapolate: "clamp",
  });
  const headerContentScale = scrollY.interpolate({
    inputRange: [0, HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT],
    outputRange: [1, 0.6],
    extrapolate: "clamp",
  });
  const headerContentOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT - 20],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  // Small name in top bar appear
  const smallNameOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT - 20, HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT],
    outputRange: [0, 0, 1],
    extrapolate: "clamp",
  });

  // Toggle header modes based on scroll position
  useEffect(() => {
    const listenerId = scrollY.addListener(({ value }) => {
      if (value > 0 && showFullProfileImage) {
        setShowFullProfileImage(false);
      } else if (value === 0 && !showFullProfileImage) {
        setShowFullProfileImage(true);
      }
    });
    return () => scrollY.removeListener(listenerId);
  }, [showFullProfileImage, scrollY]);

  const handleCall = () => {
    const phone = user?.phone || "";
    if (!phone) {
      alert("No phone number available for this user.");
      return;
    }
    try {
      const sanitized = phone.toString().trim();
      Linking.openURL(`tel:${sanitized}`);
    } catch (_) {
      alert("Unable to start a call on this device.");
    }
  };

  const shareProfile = async () => {
    try {
      const name = user?.name || "User";
      const link = `https://gojo.app/userProfile?recordId=${paramRecordId ?? ""}&userId=${paramUserId ?? ""}`;
      await Share.share({
        message: `View ${name}'s profile\n${link}`,
      });
    } catch (e) {
      Alert.alert("Sharing failed", "Unable to share this profile.");
    } finally {
      setMenuVisible(false);
    }
  };

  const reportUser = async () => {
    try {
      const reportRef = push(ref(database, "Reports"));
      await set(reportRef, {
        targetUserId: paramUserId || user?.userId || null,
        targetRecordId: paramRecordId || null,
        targetName: user?.name || null,
        targetRole: roleName || null,
        reporterUserId: parentUserId || null,
        createdAt: Date.now(),
        status: "open",
      });
      const msg = "Reported. We will review this user.";
      if (Platform.OS === "android") {
        ToastAndroid.show(msg, ToastAndroid.SHORT);
      } else {
        Alert.alert("Reported", msg);
      }
    } catch (e) {
      const msg = "Could not submit the report.";
      if (Platform.OS === "android") {
        ToastAndroid.show(msg, ToastAndroid.SHORT);
      } else {
        Alert.alert("Error", msg);
      }
    } finally {
      setMenuVisible(false);
    }
  };

  const openChat = () => {
    const targetId = paramRecordId ?? paramUserId ?? user?.userId;
    if (targetId) router.push({ pathname: "/chat", params: { userId: targetId } });
  };

  const openChatWith = useCallback(
    (targetUserId, displayName) => {
      if (targetUserId) {
        router.push({ pathname: "/chat", params: { userId: targetUserId } });
      } else if (displayName) {
        alert(`No chat available for ${displayName}.`);
      } else {
        alert("Chat unavailable for this user.");
      }
    },
    [router]
  );

  const handleBack = useCallback(() => {
    if (router?.canGoBack && router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  }, [router]);

  if (loading) {
    return (
      <SkeletonProfile />
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* Fixed Top Bar with Back & 3-dot */}
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <TouchableOpacity style={styles.topIcon} onPress={handleBack}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>

        <View style={styles.topTitleStack}>
          <Animated.Text style={[styles.smallName, { opacity: smallNameOpacity }]}>
            {user?.name}
          </Animated.Text>
          <Animated.Text style={[styles.smallStatus, { opacity: smallNameOpacity }]}>
            Last seen recently
          </Animated.Text>
        </View>

        <TouchableOpacity style={styles.topIcon} onPress={() => setMenuVisible(!menuVisible)}>
          <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Telegram Style Dropdown Menu */}
      {menuVisible && (
        <>
          <TouchableOpacity 
            style={styles.menuOverlay} 
            activeOpacity={1}
            onPress={() => setMenuVisible(false)}
          />
          <View style={styles.dropdownMenu}>
            <Pressable style={styles.menuItem} onPress={shareProfile}>
              <Ionicons name="share-outline" size={18} color={TG_BLUE} style={{ marginRight: 8 }} />
              <Text style={styles.menuText}>Share</Text>
            </Pressable>
            <Pressable style={styles.menuItem} onPress={reportUser}>
              <Ionicons name="warning-outline" size={18} color="#FFA500" style={{ marginRight: 8 }} />
              <Text style={styles.menuText}>Report User</Text>
            </Pressable>
            <Pressable style={styles.menuItem} onPress={handleCall}>
              <Ionicons name="call-outline" size={18} color={TG_BLUE} style={{ marginRight: 8 }} />
              <Text style={styles.menuText}>Call</Text>
            </Pressable>
          </View>
        </>
      )}

      {/* Scrollable content */}
      <Animated.ScrollView
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        contentContainerStyle={{ paddingTop: HEADER_MAX_HEIGHT + CAMERA_SIZE / 2 }}
      >
        {/* Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Info</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Name</Text>
            <Text style={styles.infoValue}>{user?.name}</Text>
          </View>
          {user?.username && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Username</Text>
              <Text style={styles.infoValue}>{user.username}</Text>
            </View>
          )}
          {user?.phone && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={[styles.infoValue, styles.link]}>{user.phone}</Text>
            </View>
          )}
          {user?.email && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{user.email}</Text>
            </View>
          )}
          {roleName && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Role</Text>
              <Text style={styles.infoValue}>{roleName}</Text>
            </View>
          )}
        </View>

        {/* Badges Section (Student only) */}
        {roleName === "Student" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Collected Badges ({badges.length})</Text>
            {badges.length > 0 ? (
              <View style={styles.badgeGrid}>
                {badges.map((b) => (
                  <View key={b.id} style={[styles.badgePill, { backgroundColor: b.color || "#e0f2fe" }]}>
                    <Text style={styles.badgeText}>{b.title}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.childDetails}>No badges yet</Text>
            )}
          </View>
        )}

        {/* Children Section (for Parent profiles) */}
        {children.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Children</Text>
            {children.map((child) => (
              <TouchableOpacity 
                key={child.studentId}
                style={styles.childCard}
                onPress={() => router.push(`/userProfile?recordId=${child.studentId}`)}
              >
                <Image source={{ uri: child.profileImage }} style={styles.childImage} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.childName}>{child.name}</Text>
                  <Text style={styles.childDetails}>
                    Grade {child.grade} - Section {child.section}
                  </Text>
                  <Text style={styles.childDetails}>
                    Relation: {child.relationship}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>
            ))}
          </View>
        )}
        {/* Parents Section (for Student profiles) */}
        {parents.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Parents</Text>
            {parents.map((p) => (
              <TouchableOpacity
                key={p.parentId}
                style={styles.childCard}
                onPress={() => {
                  if (parentRecordId && p.parentId === parentRecordId) {
                    router.push("/profile");
                  } else {
                    router.push(`/userProfile?recordId=${p.parentId}`);
                  }
                }}
              >
                <Image source={{ uri: p.profileImage }} style={styles.childImage} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.childName}>{p.name}</Text>
                  <Text style={styles.childDetails}>Relation: {p.relationship}</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  {p.userId ? (
                    <TouchableOpacity
                      style={styles.messageBtn}
                      onPress={() => openChatWith(p.userId, p.name)}
                      accessibilityRole="button"
                      accessibilityLabel={`Message ${p.name}`}
                    >
                      <Ionicons name="chatbubble-ellipses-outline" size={18} color="#1e90ff" />
                    </TouchableOpacity>
                  ) : null}
                  <Ionicons name="chevron-forward" size={20} color="#999" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
        
        {/* Teachers Section (for Student profiles) */}
        {teachers.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Teachers</Text>
            {teachers.map((t) => (
              <TouchableOpacity
                key={t.teacherId}
                style={styles.childCard}
                onPress={() => router.push(`/userProfile?recordId=${t.teacherId}`)}
              >
                <Image source={{ uri: t.profileImage }} style={styles.childImage} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.childName}>{t.name}</Text>
                  <Text style={styles.childDetails}>
                    {t.subjects && t.subjects.length ? t.subjects.join(", ") : "Teacher"}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  {t.userId ? (
                    <TouchableOpacity
                      style={styles.messageBtn}
                      onPress={() => openChatWith(t.userId, t.name)}
                      accessibilityRole="button"
                      accessibilityLabel={`Message ${t.name}`}
                    >
                      <Ionicons name="chatbubble-ellipses-outline" size={18} color="#1e90ff" />
                    </TouchableOpacity>
                  ) : null}
                  <Ionicons name="chevron-forward" size={20} color="#999" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Subjects Section (for Teacher profiles) */}
        {roleName === "Teacher" && teacherCourses.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Subjects</Text>
            {teacherCourses.map((c) => (
              <View key={c.courseId} style={styles.childCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.childName}>{c.subject}</Text>
                  <Text style={styles.childDetails}>Grade {c.grade} - Section {c.section}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Students Section removed for Teacher profiles per request */}
      </Animated.ScrollView>

      {/* Animated Header (Avatar + Name move & shrink together) */}
      <Animated.View
        style={[styles.header, { height: headerHeight }]}
      >
        {/* Background Profile Image - Shows at top (0 scroll) */}
        <Image
          source={{ uri: user?.profileImage || "https://cdn-icons-png.flaticon.com/512/847/847969.png" }}
          style={[styles.bgProfileImage, { opacity: showFullProfileImage ? 1 : 0 }]}
        />

        {showFullProfileImage ? (
          <View style={styles.heroOverlayBare}>
            <Text style={styles.heroName}>{user?.name}</Text>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Last seen recently</Text>
            </View>
          </View>
        ) : null}

        <Animated.View
          style={{
            transform: [
              { translateY: headerContentTranslate },
              { scale: headerContentScale },
            ],
            opacity: showFullProfileImage ? 0 : headerContentOpacity,
            alignItems: "center",
          }}
        >
          {showFullProfileImage ? null : (
            <>
              <Image
                source={{ uri: user?.profileImage || "https://cdn-icons-png.flaticon.com/512/847/847969.png" }}
                style={styles.avatar}
              />
              <Text style={styles.nameOverlay}>{user?.name}</Text>
              
            </>
          )}
        </Animated.View>
      </Animated.View>

      {/* FLOATING MESSAGE BUTTON */}
      <TouchableOpacity
        style={styles.floatingMessageBtn}
        onPress={openChat}
      >
        <Ionicons name="chatbubble-outline" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

/* ---------------- STYLES ---------------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#EFEFF4" },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },

  topBar: {
    position: "absolute",
    top: 20,
    left: 12,
    right: 12,
    height: 40,
    zIndex: 100,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  topIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  smallName: { color: "#fff", fontSize: 18, fontWeight: "600" },
  smallStatus: { color: "#e2e8f0", fontSize: 12 },
  topTitleStack: { alignItems: "center", justifyContent: "center" },

  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: TG_BLUE,
    alignItems: "center",
    zIndex: 10,
    overflow: "hidden",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "#ffffff",
    borderColor: "rgba(100,116,139,0.35)",
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 5,
    backgroundColor: "#94a3b8",
  },
  statusText: { fontSize: 13, fontWeight: "700", color: "#475569" },
  bgProfileImage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  heroOverlayBare: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 10,
    alignItems: "flex-start",
  },
  heroName: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 0.25,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 3,
    borderColor: "#fff",
    marginTop: HEADER_MAX_HEIGHT / 2 - AVATAR_SIZE / 2,
  },
  nameOverlay: { color: "#fff", fontSize: 22, fontWeight: "700", marginTop: 8 },
  usernameOverlay: { color: "#EAF4FF", fontSize: 14 },

  section: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },

  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  infoLabel: { color: "#888", fontSize: 14 },
  infoValue: { color: "#111", fontSize: 14 },
  link: { color: TG_BLUE },

  floatingMessageBtn: {
    position: "absolute",
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: TG_BLUE,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 100,
  },

  // Telegram Style Dropdown Menu
  dropdownMenu: {
    position: "absolute",
    top: 28,
    right: 8,
    backgroundColor: "#fff",
    borderRadius: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
    minWidth: 180,
    borderWidth: 1,
    borderColor: "#e5e5e5",
  },
  menuOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
    zIndex: 999,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
  },
  menuText: {
    fontSize: 16,
    color: "#000",
    fontWeight: "400",
  },
  logoutText: {
    color: "#ff3b30",
    fontWeight: "500",
  },
  // Children card styles (match profile.jsx aesthetics)
  childCard: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
    padding: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "rgba(15, 23, 42, 0.08)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  childImage: { width: 50, height: 50, borderRadius: 25, borderWidth: 1, borderColor: "#e5e7eb" },
  childName: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  childDetails: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  messageBtn: {
    marginRight: 10,
    padding: 6,
    borderRadius: 999,
    backgroundColor: "#e0f2fe",
  },
  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badgePill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.4)",
  },
  badgeText: { fontSize: 13, fontWeight: "700", color: "#0f172a" },
});