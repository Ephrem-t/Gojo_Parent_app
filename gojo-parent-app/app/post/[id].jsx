import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState, useCallback } from "react";
import { View, Text, ActivityIndicator, StyleSheet, Dimensions, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { child, get, ref } from "firebase/database";
import { database } from "../../constants/firebaseConfig";
import { Image as ExpoImage } from "expo-image";

const { width, height } = Dimensions.get("window");

const fallbackAvatar = "https://cdn-icons-png.flaticon.com/512/847/847969.png";

const STRINGS = {
  back: "Back",
  loading: "Loading post...",
  notFound: "Post not found",
};

const mapPost = (postId, post, usersData, schoolAdminData) => {
  let adminName = "School Admin";
  let adminImage = fallbackAvatar;
  let adminRecordId = post.adminId || null;
  let adminUserId = null;

  if (adminRecordId && schoolAdminData[adminRecordId]) {
    const adminInfo = schoolAdminData[adminRecordId];
    adminUserId = adminInfo.userId;
    if (adminUserId && usersData[adminUserId]) {
      const userInfo = usersData[adminUserId];
      adminName = userInfo.name || userInfo.username || adminName;
      adminImage = userInfo.profileImage || adminImage;
    }
  }

  if (!adminUserId && post.userId && usersData[post.userId]) {
    adminUserId = post.userId;
    const userInfo = usersData[adminUserId];
    adminName = userInfo?.name || userInfo?.username || adminName;
    adminImage = userInfo?.profileImage || adminImage;
  }

  return {
    id: postId,
    message: post.message || "",
    postUrl: post.postUrl || null,
    time: post.time || "",
    likes: post.likes || {},
    likeCount: post.likeCount || 0,
    adminName,
    adminImage,
    adminId: adminRecordId,
    userId: adminUserId,
  };
};

const getRelativeTime = (postTime) => {
  const date = new Date(postTime);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);

  if (diff < 60) return `${diff} sec ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)} day${Math.floor(diff / 86400) > 1 ? "s" : ""} ago`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)} month${Math.floor(diff / 2592000) > 1 ? "s" : ""} ago`;
  return `${Math.floor(diff / 31536000)} year${Math.floor(diff / 31536000) > 1 ? "s" : ""} ago`;
};

export default function PostScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const useSafeBack = (router) =>
    useCallback(() => {
      if (router?.canGoBack && router.canGoBack()) {
        router.back();
      } else {
        router.replace("/");
      }
    }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (!id) return;
      const postsSnap = await get(child(ref(database), `Posts/${id}`));
      if (!postsSnap.exists()) {
        setPost(null);
        return;
      }
      const postData = postsSnap.val();
      const usersSnap = await get(child(ref(database), "Users"));
      const usersData = usersSnap.exists() ? usersSnap.val() : {};
      const schoolAdminSnap = await get(child(ref(database), "School_Admins"));
      const schoolAdminData = schoolAdminSnap.exists() ? schoolAdminSnap.val() : {};
      setPost(mapPost(id, postData, usersData, schoolAdminData));
    } catch (e) {
      setPost(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleBack = useSafeBack(router);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1877f2" />
        <Text style={styles.subtle}>{STRINGS.loading}</Text>
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.center}>
        <Text style={styles.subtle}>{STRINGS.notFound}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
          <Ionicons name="arrow-back" size={18} color="#fff" />
          <Text style={styles.backText}>{STRINGS.back}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={18} color="#fff" />
          <Text style={styles.backText}>{STRINGS.back}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <ExpoImage source={{ uri: post.adminImage }} style={styles.avatar} contentFit="cover" transition={150} />
          <View style={{ flex: 1 }}>
            <Text style={styles.adminName}>{post.adminName}</Text>
            <Text style={styles.time}>{getRelativeTime(post.time)}</Text>
          </View>
        </View>
        {post.message ? <Text style={styles.message}>{post.message}</Text> : null}
        {post.postUrl ? (
          <ExpoImage source={{ uri: post.postUrl }} style={styles.postImage} contentFit="cover" transition={150} />
        ) : null}
        <Text style={styles.likes}>{post.likeCount} likes</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f2f5", padding: width * 0.04 },
  headerRow: { flexDirection: "row", justifyContent: "flex-start", marginBottom: width * 0.03 },
  card: { backgroundColor: "#fff", borderRadius: width * 0.03, padding: width * 0.03, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: width * 0.02 },
  avatar: { width: width * 0.12, height: width * 0.12, borderRadius: width * 0.06, marginRight: width * 0.025, backgroundColor: "#ddd" },
  adminName: { fontSize: width * 0.045, fontWeight: "700", color: "#000" },
  time: { fontSize: width * 0.03, color: "#666" },
  message: { fontSize: width * 0.038, color: "#111", marginVertical: width * 0.02 },
  postImage: { width: "100%", height: undefined, aspectRatio: 1, borderRadius: width * 0.02, backgroundColor: "#f0f0f0" },
  likes: { marginTop: width * 0.02, color: "#555", fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: width * 0.05 },
  subtle: { color: "#666", marginTop: 8 },
  backBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#1877f2", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, gap: 6 },
  backText: { color: "#fff", fontWeight: "600" },
});
