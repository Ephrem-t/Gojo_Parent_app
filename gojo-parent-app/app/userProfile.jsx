import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ref, get, child } from "firebase/database";
import { database } from "../constants/firebaseConfig";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/* ---------------- CONSTANTS ---------------- */
const TG_BLUE = "#2AABEE";
const { width } = Dimensions.get("window");

const COVER_HEIGHT = 240;
const AVATAR_SIZE = 120;

const GRID_COLS = 3;
const GRID_GAP = 8;
const GRID_PADDING = 16;
const GRID_ITEM_SIZE = Math.floor(
  (width - GRID_PADDING * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS
);

export default function UserProfile() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const { recordId: paramRecordId, userId: paramUserId } = params ?? {};

  const [user, setUser] = useState(null);
  const [roleData, setRoleData] = useState(null);
  const [roleName, setRoleName] = useState(null);
  const [loading, setLoading] = useState(true);
  const [parentUserId, setParentUserId] = useState(null);
  const [sharedImages, setSharedImages] = useState([]);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [activeImage, setActiveImage] = useState(null);
  const [menuVisible, setMenuVisible] = useState(false); // 3-dot menu

  const scrollY = useRef(new Animated.Value(0)).current;

  /* ---------------- LOAD PARENT USER ---------------- */
  useEffect(() => {
    let mounted = true;
    (async () => {
      const pr = await AsyncStorage.getItem("parentId");
      if (!pr || !mounted) return;
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

        if (!resolvedUserId && rId) {
          const roles = ["Students", "Teachers", "School_Admins"];
          for (const r of roles) {
            const snap = await get(child(ref(database), `${r}/${rId}`));
            if (snap.exists()) {
              resolvedUserId = snap.val().userId;
              setRoleData(snap.val());
              setRoleName(
                r === "Students" ? "Student" : r === "Teachers" ? "Teacher" : "Admin"
              );
              break;
            }
          }
        }

        if (resolvedUserId) {
          const userSnap = await get(child(ref(database), `Users/${resolvedUserId}`));
          if (mounted) setUser(userSnap.val());
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

  /* ---------------- LOAD SHARED MEDIA ---------------- */
  useEffect(() => {
    let mounted = true;
    const loadShared = async () => {
      if (!parentUserId || !paramUserId) return;
      const chatId = [parentUserId, paramUserId].sort().join("_");
      const snap = await get(child(ref(database), `Chats/${chatId}/messages`));
      if (!snap.exists()) return;
      const imgs = Object.values(snap.val())
        .filter((m) => m?.type === "image")
        .sort((a, b) => b.timeStamp - a.timeStamp)
        .slice(0, 30);
      if (mounted) setSharedImages(imgs);
    };
    loadShared();
    return () => (mounted = false);
  }, [parentUserId, paramUserId]);

  /* ---------------- ANIMATIONS ---------------- */
  const avatarScale = scrollY.interpolate({
    inputRange: [0, COVER_HEIGHT - 40],
    outputRange: [1, 0.55],
    extrapolate: "clamp",
  });

  const avatarTranslateY = scrollY.interpolate({
    inputRange: [0, COVER_HEIGHT - 40],
    outputRange: [0, -(COVER_HEIGHT / 2 - 16)],
    extrapolate: "clamp",
  });

  const openChat = () => {
    const targetId = paramRecordId ?? paramUserId ?? user?.userId;
    if (targetId) router.push({ pathname: "/chat", params: { userId: targetId } });
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={TG_BLUE} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* BLUE HEADER */}
      <View style={styles.cover} />

      {/* TOP BAR */}
      <Animated.View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity style={styles.topIcon} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.topIcon} onPress={() => setMenuVisible(!menuVisible)}>
          <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
        </TouchableOpacity>
      </Animated.View>

      {/* 3-DOT DROPDOWN MENU */}
      {menuVisible && (
        <View style={styles.dropdownMenu}>
          <Pressable style={styles.dropdownItem} onPress={() => alert("Share User")}>
            <Ionicons name="share-outline" size={18} color={TG_BLUE} style={{ marginRight: 8 }} />
            <Text style={styles.dropdownText}>Share</Text>
          </Pressable>

          <Pressable style={styles.dropdownItem} onPress={() => alert("Report User")}>
            <Ionicons name="warning-outline" size={18} color="#FFA500" style={{ marginRight: 8 }} />
            <Text style={styles.dropdownText}>Report User</Text>
          </Pressable>

          <Pressable style={styles.dropdownItem} onPress={() => alert("Block User")}>
            <Ionicons name="ban-outline" size={18} color="red" style={{ marginRight: 8 }} />
            <Text style={[styles.dropdownText, { color: "red" }]}>Block User</Text>
          </Pressable>

          <Pressable style={styles.dropdownItem} onPress={() => alert("Call User")}>
            <Ionicons name="call-outline" size={18} color={TG_BLUE} style={{ marginRight: 8 }} />
            <Text style={styles.dropdownText}>Call</Text>
          </Pressable>

          <Pressable style={styles.dropdownItem} onPress={() => alert("Other Options")}>
            <Ionicons name="ellipsis-horizontal-outline" size={18} color="#555" style={{ marginRight: 8 }} />
            <Text style={styles.dropdownText}>Other</Text>
          </Pressable>

          <Pressable style={styles.dropdownItem} onPress={() => setMenuVisible(false)}>
            <Text style={[styles.dropdownText, { color: "gray" }]}>Cancel</Text>
          </Pressable>
        </View>
      )}

      {/* AVATAR + NAME/USERNAME ON BLUE HEADER */}
      <Animated.View
        style={[
          styles.avatarContainer,
          { transform: [{ translateY: avatarTranslateY }, { scale: avatarScale }] },
        ]}
      >
        <Image
          source={{
            uri: user?.profileImage || "https://cdn-icons-png.flaticon.com/512/847/847969.png",
          }}
          style={styles.avatar}
        />
        <Animated.View
          style={[styles.headerInfoOverlay, { transform: [{ translateY: avatarTranslateY }] }]}
        >
          <Text style={styles.nameOverlay}>{user?.name}</Text>
          {user?.username && <Text style={styles.usernameOverlay}>@{user.username}</Text>}
        </Animated.View>
      </Animated.View>

      {/* SCROLLABLE CONTENT */}
      <Animated.ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
      >
        <View style={{ marginTop: COVER_HEIGHT / 2 + AVATAR_SIZE / 1.5 + 10 }}>
          {/* INFO / ABOUT */}
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

          {/* SHARED MEDIA */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Shared Media ({sharedImages.length})</Text>
            {sharedImages.length > 0 ? (
              <FlatList
                data={sharedImages}
                numColumns={GRID_COLS}
                keyExtractor={(i, idx) => idx.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => {
                      setActiveImage(item.imageUrl);
                      setImageModalVisible(true);
                    }}
                    style={{ margin: GRID_GAP / 2 }}
                  >
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={{
                        width: GRID_ITEM_SIZE,
                        height: GRID_ITEM_SIZE,
                        borderRadius: 8,
                      }}
                    />
                  </TouchableOpacity>
                )}
              />
            ) : (
              <Text style={{ marginTop: 8, color: "#888" }}>No shared media</Text>
            )}
          </View>
        </View>
      </Animated.ScrollView>

      {/* FLOATING MESSAGE BUTTON */}
      <TouchableOpacity
        style={styles.floatingMessageBtn}
        onPress={openChat}
      >
        <Ionicons name="chatbubble-outline" size={24} color="#fff" />
      </TouchableOpacity>

      {/* IMAGE MODAL */}
      <Modal visible={imageModalVisible} transparent animationType="fade">
        <View style={styles.modal}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setImageModalVisible(false)}
          />
          <Image source={{ uri: activeImage }} style={styles.fullImage} />
        </View>
      </Modal>
    </View>
  );
}

/* ---------------- STYLES ---------------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#EFEFF4" },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },

  cover: { position: "absolute", top: 0, left: 0, right: 0, height: COVER_HEIGHT, backgroundColor: TG_BLUE },

  topBar: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },

  avatarContainer: {
    position: "absolute",
    top: COVER_HEIGHT / 2 - AVATAR_SIZE / 1.7,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 20,
  },
  avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, borderWidth: 3, borderColor: "#fff" },

  headerInfoOverlay: {
    alignItems: "center",
    marginTop: 4,
  },
  nameOverlay: { fontSize: 22, fontWeight: "700", color: "#fff" },
  usernameOverlay: { fontSize: 14, color: "#EAF4FF", marginTop: 2 },

  section: { marginTop: 16, backgroundColor: "#fff", padding: 16, borderRadius: 12 },
  sectionTitle: { fontSize: 13, fontWeight: "600", color: "#6d6d72", marginBottom: 8 },

  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  infoLabel: { color: "#888", fontSize: 13 },
  infoValue: { color: "#111", fontSize: 14 },
  link: { color: TG_BLUE },

  modal: { flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" },
  fullImage: { width: "94%", height: "78%", resizeMode: "contain", borderRadius: 12 },

  /* FLOATING MESSAGE BUTTON */
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

  /* 3-DOT DROPDOWN MENU */
  dropdownMenu: {
    position: "absolute",
    top: 50,
    right: 12,
    width: 180,
    backgroundColor: "#fff",
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
    paddingVertical: 4,
    zIndex: 999,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  dropdownText: {
    fontSize: 15,
    color: "#111",
  },
});
