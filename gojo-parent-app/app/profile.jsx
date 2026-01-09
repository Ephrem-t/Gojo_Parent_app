// app/profile.jsx
import { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Animated,
  StatusBar,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ref, get } from "firebase/database";
import { database } from "../constants/firebaseConfig";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const { width } = Dimensions.get("window");
const HEADER_MAX_HEIGHT = 200;
const HEADER_MIN_HEIGHT = 60;
const AVATAR_SIZE = 120;
const CAMERA_SIZE = 40;

export default function ParentProfile() {
  const router = useRouter();
  const [parentUser, setParentUser] = useState(null);
  const [children, setChildren] = useState([]);
  const scrollY = useRef(new Animated.Value(0)).current;

  const defaultProfile =
    "https://cdn-icons-png.flaticon.com/512/847/847969.png";

  useEffect(() => {
    const loadParentData = async () => {
      const parentId = await AsyncStorage.getItem("parentId");
      if (!parentId) return;

      try {
        const [usersSnap, parentsSnap, studentsSnap] = await Promise.all([
          get(ref(database, "Users")),
          get(ref(database, "Parents")),
          get(ref(database, "Students")),
        ]);

        const usersData = usersSnap.val() || {};
        const parentsData = parentsSnap.val() || {};
        const studentsData = studentsSnap.val() || {};

        const parentNode = parentsData[parentId];
        if (!parentNode) return;

        const user = usersData[parentNode.userId] || {};
        setParentUser({
          ...user,
          status: parentNode.status,
          createdAt: parentNode.createdAt,
        });

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

        setChildren(childrenArray);
      } catch (error) {
        console.log("Error fetching parent profile:", error);
      }
    };

    loadParentData();
  }, []);

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.removeItem("parentId");
          router.replace("/");
        },
      },
    ]);
  };

  if (!parentUser) {
    return (
      <View style={styles.loading}>
        <Text>Loading...</Text>
      </View>
    );
  }

  // Header height animation
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

  // Camera icon animation
  const cameraTranslate = scrollY.interpolate({
    inputRange: [0, HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT],
    outputRange: [0, -60],
    extrapolate: "clamp",
  });
  const cameraOpacity = scrollY.interpolate({
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

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* Fixed Top Bar with Back & 3-dot */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.topIcon}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>

        <Animated.Text style={[styles.smallName, { opacity: smallNameOpacity }]}>
          {parentUser.name}
        </Animated.Text>

        <TouchableOpacity style={styles.topIcon}>
          <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

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
            <Text style={styles.infoValue}>{parentUser.name}</Text>
          </View>
          {parentUser.username && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Username</Text>
              <Text style={styles.infoValue}>{parentUser.username}</Text>
            </View>
          )}
          {parentUser.phone && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>{parentUser.phone}</Text>
            </View>
          )}
          {parentUser.email && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{parentUser.email}</Text>
            </View>
          )}
        </View>

        {/* Children Section */}
        {children.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Children</Text>
            {children.map((child) => (
              <View key={child.studentId} style={styles.childCard}>
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
              </View>
            ))}
          </View>
        )}

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity style={styles.accountItem}>
            <Ionicons name="key-outline" size={20} color="#2563eb" />
            <Text style={styles.accountText}>Change Password</Text>
            <Ionicons name="chevron-forward-outline" size={20} color="#999" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.accountItem}>
            <Ionicons name="mail-outline" size={20} color="#2563eb" />
            <Text style={styles.accountText}>Update Email / Phone</Text>
            <Ionicons name="chevron-forward-outline" size={20} color="#999" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.accountItem} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#dc2626" />
            <Text style={[styles.accountText, { color: "#dc2626" }]}>
              Logout
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.ScrollView>

      {/* Animated Header (Avatar + Name move & shrink together) */}
      <Animated.View
        style={[
          styles.header,
          { height: headerHeight }
        ]}
      >
        <Animated.View
          style={{
            transform: [
              { translateY: headerContentTranslate },
              { scale: headerContentScale },
            ],
            opacity: headerContentOpacity,
            alignItems: "center",
          }}
        >
          <Image
            source={{ uri: parentUser.profileImage || defaultProfile }}
            style={styles.avatar}
          />
          <Text style={styles.nameOverlay}>{parentUser.name}</Text>
          <Text style={styles.usernameOverlay}>@{parentUser.username}</Text>
        </Animated.View>
      </Animated.View>

      {/* Camera Icon */}
      <Animated.View
        style={[
          styles.cameraIcon,
          {
            transform: [{ translateY: cameraTranslate }],
            opacity: cameraOpacity,
          },
        ]}
      >
        <Ionicons name="camera" size={24} color="#fff" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#EFEFF4" },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },

  topBar: {
    position: "absolute",
    top: 10,
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

  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "#2AABEE",
    alignItems: "center",
    zIndex: 10,
    overflow: "hidden",
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

  cameraIcon: {
    position: "absolute",
    top: HEADER_MAX_HEIGHT - CAMERA_SIZE / 2,
    right: 20,
    width: CAMERA_SIZE,
    height: CAMERA_SIZE,
    borderRadius: CAMERA_SIZE / 2,
    backgroundColor: "#2AABEE",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 20,
  },

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

  childCard: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
    padding: 12,
    backgroundColor: "#F7F7F7",
    borderRadius: 10,
  },
  childImage: { width: 50, height: 50, borderRadius: 25 },
  childName: { fontSize: 16, fontWeight: "600", color: "#111" },
  childDetails: { fontSize: 14, color: "#555" },

  accountItem: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#eee" },
  accountText: { fontSize: 16, marginLeft: 12, flex: 1 },
});
