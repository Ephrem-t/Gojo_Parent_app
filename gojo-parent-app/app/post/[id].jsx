import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { View, Text, ActivityIndicator, StyleSheet, Dimensions, TouchableOpacity } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { child, get, ref } from "firebase/database";
import { database } from "../../constants/firebaseConfig";
import AppImage from "../../components/ui/AppImage";
import { useParentTheme } from "../../hooks/use-parent-theme";
import { resolvePostAuthor } from "../lib/userHelpers";

const { width } = Dimensions.get("window");

const STRINGS = {
  back: "Back",
  loading: "Loading post...",
  notFound: "Post not found",
};

function getLikeCount(likeCount, likes) {
  if (likes && typeof likes === "object") {
    return Object.keys(likes).length;
  }

  const numericLikeCount = Number(likeCount);
  return Number.isFinite(numericLikeCount) ? numericLikeCount : 0;
}

async function findPostRecord(postsPath, identifier) {
  const normalizedIdentifier = String(identifier || "").trim();
  if (!normalizedIdentifier) return null;

  try {
    const directSnap = await get(child(ref(database), `${postsPath}/${normalizedIdentifier}`));
    if (directSnap.exists()) {
      return {
        key: normalizedIdentifier,
        value: directSnap.val() || {},
      };
    }
  } catch {
    // ignore and try scanning by postId field
  }

  try {
    const postsSnap = await get(child(ref(database), postsPath));
    if (!postsSnap.exists()) return null;

    let match = null;
    postsSnap.forEach((childSnap) => {
      if (match) return true;

      const value = childSnap.val() || {};
      if (String(value.postId || "").trim() === normalizedIdentifier) {
        match = {
          key: childSnap.key,
          value,
        };
        return true;
      }

      return false;
    });

    return match;
  } catch {
    return null;
  }
}

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
  const { colors, isDark } = useParentTheme();
  const postRouteId = useMemo(() => {
    if (Array.isArray(id)) return String(id[0] || "").trim();
    return typeof id === "string" ? id.trim() : "";
  }, [id]);
  const palette = useMemo(
    () => ({
      background: colors.backgroundAlt,
      card: colors.card,
      text: colors.text,
      textStrong: colors.textStrong,
      muted: colors.muted,
      border: colors.border,
      avatarBg: colors.avatarPlaceholder,
      imageBg: colors.surfaceMuted,
      primary: colors.primary,
      white: colors.white,
      shadow: isDark ? "#000000" : "#000000",
    }),
    [colors, isDark]
  );
  const styles = useMemo(() => createStyles(palette), [palette]);
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
      if (!postRouteId) {
        setPost(null);
        return;
      }

      const schoolKey = await AsyncStorage.getItem("schoolKey");
      let postRecord = null;

      if (schoolKey) {
        postRecord = await findPostRecord(`Platform1/Schools/${schoolKey}/Posts`, postRouteId);
      }

      if (!postRecord) {
        postRecord = await findPostRecord("Posts", postRouteId);
      }

      if (!postRecord) {
        setPost(null);
        return;
      }

      const postData = postRecord.value || {};
      const author = await resolvePostAuthor(postData, schoolKey);

      setPost({
        id: postRecord.key,
        message: postData.message || "",
        postUrl: postData.postUrl || null,
        time: postData.time || "",
        likes: postData.likes || {},
        likeCount: getLikeCount(postData.likeCount, postData.likes),
        adminName: author?.name || author?.username || postData.adminName || "School Admin",
        adminImage: author?.profileImage || postData.adminProfile || null,
        adminId: author?._recordId || postData.adminId || null,
        userId: author?._nodeKey || null,
      });
    } catch {
      setPost(null);
    } finally {
      setLoading(false);
    }
  }, [postRouteId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleBack = useSafeBack(router);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={palette.primary} />
        <Text style={styles.subtle}>{STRINGS.loading}</Text>
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.center}>
        <Text style={styles.subtle}>{STRINGS.notFound}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
          <Ionicons name="arrow-back" size={18} color={palette.white} />
          <Text style={styles.backText}>{STRINGS.back}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={18} color={palette.white} />
          <Text style={styles.backText}>{STRINGS.back}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <AppImage
            uri={post.adminImage}
            fallbackSource={require("../../assets/images/avatar_placeholder.png")}
            style={styles.avatar}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.adminName}>{post.adminName}</Text>
            <Text style={styles.time}>{getRelativeTime(post.time)}</Text>
          </View>
        </View>
        {post.message ? <Text style={styles.message}>{post.message}</Text> : null}
        {post.postUrl ? (
          <AppImage uri={post.postUrl} style={styles.postImage} />
        ) : null}
        <Text style={styles.likes}>{post.likeCount} likes</Text>
      </View>
    </View>
  );
}

const createStyles = (palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background, padding: width * 0.04 },
  headerRow: { flexDirection: "row", justifyContent: "flex-start", marginBottom: width * 0.03 },
  card: { backgroundColor: palette.card, borderRadius: width * 0.03, padding: width * 0.03, borderWidth: 1, borderColor: palette.border, shadowColor: palette.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: width * 0.02 },
  avatar: { width: width * 0.12, height: width * 0.12, borderRadius: width * 0.06, marginRight: width * 0.025, backgroundColor: palette.avatarBg },
  adminName: { fontSize: width * 0.045, fontWeight: "700", color: palette.textStrong },
  time: { fontSize: width * 0.03, color: palette.muted },
  message: { fontSize: width * 0.038, color: palette.text, marginVertical: width * 0.02 },
  postImage: { width: "100%", height: undefined, aspectRatio: 1, borderRadius: width * 0.02, backgroundColor: palette.imageBg },
  likes: { marginTop: width * 0.02, color: palette.muted, fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: width * 0.05 },
  subtle: { color: palette.muted, marginTop: 8 },
  backBtn: { flexDirection: "row", alignItems: "center", backgroundColor: palette.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, gap: 6 },
  backText: { color: palette.white, fontWeight: "600" },
});
