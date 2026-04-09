import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Alert,
  Animated,
  Modal,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import {
  ref,
  query,
  orderByChild,
  limitToLast,
  endAt,
  get,
  update,
} from "firebase/database";
import { database } from "../../constants/firebaseConfig";
import { readCachedJsonRecord, writeCachedJson } from "../lib/dataCache";
import { isInternetReachableNow } from "../lib/networkGuard";
import {
  clearQueuedPostAction,
  commitPostLikeAction,
  commitPostReportAction,
  enqueuePostLikeAction,
  enqueuePostReportAction,
} from "../lib/postActionQueue";
import AppImage from "../../components/ui/AppImage";
import { useParentTheme } from "../../hooks/use-parent-theme";

const SCREEN_WIDTH = Dimensions.get("window").width;
const IMAGE_HEIGHT = Math.round(SCREEN_WIDTH * 0.9 * 0.65);
const INITIAL_POSTS_COUNT = 2;
const SCROLL_POSTS_COUNT = 1;
const DESCRIPTION_PREVIEW_LENGTH = 140;
const HOME_FEED_CACHE_TTL_MS = 5 * 60 * 1000;
const HOME_FEED_CACHE_KEY = "cache:home:feed:v5";

function getFileExtensionFromUrl(url) {
  if (!url) return "jpg";
  const cleanUrl = url.split("?")[0] || "";
  const ext = cleanUrl.split(".").pop()?.toLowerCase();
  if (!ext || ext.length > 5) return "jpg";
  return ext;
}

function timeAgo(iso) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const seconds = Math.floor((Date.now() - t) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  const years = Math.floor(months / 12);
  return `${years}y`;
}

function formatTargetRoleLabel(data, labels) {
  const raw = data?.targetRole ?? data?.target ?? "all";
  const normalized = String(raw).trim().toLowerCase();

  if (!normalized || normalized === "all") return labels.visibleToEveryone;
  if (labels.visibleToByRole[normalized]) return labels.visibleToByRole[normalized];
  return `${labels.visibleTo} ${normalized}`;
}

function getPosterName(admin, postData, labels) {
  return admin?.name || admin?.username || postData?.adminName || labels.schoolAdmin;
}

function getPosterImage(admin, postData) {
  return admin?.profileImage || postData?.adminProfile || null;
}

function normalizeAuthorValue(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function buildFeedAuthor(postData, schoolKey = null) {
  const recordId =
    normalizeAuthorValue(postData?.adminId) ||
    normalizeAuthorValue(postData?.userId) ||
    normalizeAuthorValue(postData?.schoolAdminId) ||
    normalizeAuthorValue(postData?.teacherId) ||
    normalizeAuthorValue(postData?.registererId) ||
    normalizeAuthorValue(postData?.financeId) ||
    normalizeAuthorValue(postData?.hrId);

  const name = normalizeAuthorValue(postData?.adminName) || normalizeAuthorValue(postData?.name);
  const profileImage = normalizeAuthorValue(postData?.adminProfile) || normalizeAuthorValue(postData?.profileImage);

  if (!recordId && !name && !profileImage) {
    return null;
  }

  return {
    name,
    username: recordId,
    profileImage,
    userId: null,
    _nodeKey: null,
    _recordId: recordId,
    _sourceIdentifier: recordId,
    _schoolKey: schoolKey || null,
    role: null,
  };
}

function countLikes(likesMap) {
  return Object.keys(likesMap || {}).length;
}

function normalizeIdentityValue(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function buildViewerLikeKeys(...values) {
  return Array.from(new Set(values.map(normalizeIdentityValue).filter(Boolean)));
}

function isPostLikedByViewer(likesMap, viewerLikeKeys) {
  if (!likesMap || typeof likesMap !== "object") return false;
  return (viewerLikeKeys || []).some((key) => !!likesMap[key]);
}

function getLikeCountValue(likeCount, likesMap) {
  if (likesMap && typeof likesMap === "object") {
    return countLikes(likesMap);
  }

  const numericLikeCount = Number(likeCount);
  return Number.isFinite(numericLikeCount) ? numericLikeCount : 0;
}

function updatePostInList(posts, postId, updater) {
  let changed = false;
  const nextPosts = posts.map((post) => {
    if (post.postId !== postId) return post;
    changed = true;
    return updater(post);
  });

  return {
    changed,
    posts: changed ? nextPosts : posts,
  };
}

function updateLoadedPostLists(latestPosts, olderPosts, postId, updater) {
  const latestUpdate = updatePostInList(latestPosts, postId, updater);
  const olderUpdate = updatePostInList(olderPosts, postId, updater);

  return {
    matched: latestUpdate.changed || olderUpdate.changed,
    latest: latestUpdate.posts,
    older: olderUpdate.posts,
  };
}

const FeedPostCard = React.memo(function FeedPostCard({
  item,
  viewerLikeKeys,
  labels,
  palette,
  styles,
  isExpanded,
  likePending,
  onToggleDescription,
  onOpenPosterProfile,
  onOpenPostMenu,
  onOpenViewer,
  onToggleLike,
}) {
  const { postId, data, admin, likesMap } = item;
  const likesCount = getLikeCountValue(data.likeCount, likesMap);
  const isLiked = isPostLikedByViewer(likesMap, viewerLikeKeys);
  const imageUri = data.postUrl || null;
  const message = String(data.message || "").trim();
  const targetRoleLabel = formatTargetRoleLabel(data, labels);
  const posterName = getPosterName(admin, data, labels);
  const posterImage = getPosterImage(admin, data);
  const shouldTruncate = message.length > DESCRIPTION_PREVIEW_LENGTH;
  const previewMessage = shouldTruncate && !isExpanded
    ? `${message.slice(0, DESCRIPTION_PREVIEW_LENGTH).trimEnd()}...`
    : message;

  const scale = useRef(new Animated.Value(1)).current;

  const handleHeartPress = useCallback(() => {
    if (likePending) return;

    Animated.sequence([
      Animated.timing(scale, { toValue: 1.18, duration: 140, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1.0, duration: 140, useNativeDriver: true }),
    ]).start();

    onToggleLike(postId);
  }, [likePending, onToggleLike, postId, scale]);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <TouchableOpacity style={styles.headerProfileTap} activeOpacity={0.85} onPress={() => onOpenPosterProfile(item)}>
          <AppImage
            uri={posterImage}
            fallbackSource={require("../../assets/images/avatar_placeholder.png")}
            style={styles.avatar}
          />
          <View style={styles.headerTextWrap}>
            <Text style={styles.username}>{posterName}</Text>
            <View style={styles.headerMetaRow}>
              <Text style={styles.time}>{timeAgo(data.time)}</Text>
              <Text style={styles.headerDot}>·</Text>
              <Text style={styles.targetRoleText}>{targetRoleLabel}</Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.moreBtn} activeOpacity={0.8} onPress={() => onOpenPostMenu(postId)}>
          <Ionicons name="ellipsis-horizontal" size={20} color={palette.muted} />
        </TouchableOpacity>
      </View>

      {message ? (
        <View style={styles.messageWrap}>
          <Text style={styles.messageText}>{previewMessage}</Text>
          {shouldTruncate ? (
            <TouchableOpacity activeOpacity={0.8} onPress={() => onToggleDescription(postId)}>
              <Text style={styles.seeMoreText}>{isExpanded ? labels.seeLess : labels.seeMore}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {imageUri ? (
        <Pressable onPress={() => onOpenViewer(imageUri)}>
          <AppImage
            uri={imageUri}
            fallbackSource={require("../../assets/images/logo.png")}
            style={styles.postImage}
            resizeMode="cover"
          />
        </Pressable>
      ) : null}

      <View style={styles.reactionsSummary}>
        <View style={styles.reactionsLeft}>
          <TouchableOpacity
            onPress={handleHeartPress}
            style={[styles.likeIconOnlyBtn, likePending ? { opacity: 0.55 } : null]}
            activeOpacity={0.85}
            disabled={likePending}
          >
            <Animated.View style={{ transform: [{ scale }] }}>
              <Ionicons
                name={isLiked ? "heart" : "heart-outline"}
                size={24}
                color={isLiked ? palette.like : palette.textStrong}
              />
            </Animated.View>
          </TouchableOpacity>
          <Text style={styles.reactionCountText}>{likesCount} {likesCount === 1 ? labels.likeSingular : labels.likePlural}</Text>
        </View>
      </View>
    </View>
  );
});

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark, amharic, oromo } = useParentTheme();
  const palette = useMemo(
    () => ({
      background: colors.background,
      feedBackground: colors.background,
      primary: colors.primary,
      text: colors.text,
      textStrong: colors.textStrong,
      muted: colors.mutedAlt,
      card: colors.card,
      cardMuted: colors.cardMuted,
      border: colors.border,
      borderSoft: colors.borderSoft,
      avatarBg: colors.surfaceMuted,
      imageBg: colors.surfaceMuted,
      soft: colors.primarySoft,
      overlay: colors.overlay,
      like: isDark ? "#FF7B93" : "#ED4956",
      menuHandle: isDark ? "rgba(255,255,255,0.12)" : "#D6E2EE",
      menuDanger: isDark ? "#FF7B93" : "#ED4956",
      viewerOverlay: isDark ? "rgba(1,4,9,0.96)" : "rgba(0,0,0,0.96)",
      viewerCloseBg: isDark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.18)",
      viewerCloseIcon: colors.white,
    }),
    [colors, isDark]
  );
  const styles = useMemo(() => createStyles(palette), [palette]);
  const labels = useMemo(
    () => {
      if (oromo) {
        return {
          visibleToEveryone: "Hundaaf mul'ata",
          visibleTo: "Kan mul'atu",
          visibleToByRole: {
            parent: "Maatiif mul'ata",
            teacher: "Barsiisaaf mul'ata",
            student: "Barataaf mul'ata",
            management: "Bulchiinsaaf mul'ata",
          },
          schoolAdmin: "Bulchaa mana barumsaa",
          notSignedIn: "Hin seenne",
          likeRequiresSignIn: "Postii jaallachuuf dura seenuu qabda.",
          error: "Dogoggora",
          unableToUpdateLike: "Jaallachuu haaromsuu hin dandeenye. Irra deebi'ii yaali.",
          unavailable: "Hin argamu",
          profileCouldNotBeOpened: "Profaayiliin banamuu hin dandeenye.",
          aboutThisAccount: "Waa'ee akkaawuntii kanaa",
          postedBy: "Kan maxxanse",
          audience: "Daawwataa",
          report: "Gabaasi",
          reportRequiresSignIn: "Postii gabaasuuf dura seenuu qabda.",
          reportSuccess: "Postiin kun gabaafameera.",
          reportQueued: "Gabaasni kun yeroo internetiin deebi'utti ni ergama.",
          unableToReport: "Postii kana gabaasuu hin dandeenye. Irra deebi'ii yaali.",
          download: "Buusi",
          noImageToDownload: "Postiin kun suuraa buufachuuf hin qabu.",
          permissionNeeded: "Eeyyamni barbaachisa",
          allowPhotoAccess: "Suuraa buufame kuusuuf eeyyama suuraa kenni.",
          imageSaved: "Suuraan gara galariitti save ta'eera.",
          unableToDownload: "Suuraa kana buusuu hin dandeenye. Irra deebi'ii yaali.",
          seeLess: "Xiqqeessi",
          seeMore: "Dabalata ilaali",
          likeSingular: "jaalalaa",
          likePlural: "jaallatamtoota",
          noPostsYet: "Ammaaf postiin hin jiru",
          offlineNoPostsYet: "Offline irratti postiin kuufame hin jiru.",
          announcementsAppearHere: "Beeksisni mana barumsaa kee asitti ni mul'ata.",
          offlineFeedNotice: "Offline dha. Postii kuufame agarsiisaa jira; hojiiwwan kuufamanis yeroo internetiin deebi'utti ofumaan ni sync ta'u.",
          likeRequiresInternet: "Postii jaallachuuf internetiin si barbaachisa.",
          noMorePosts: "Postiin dabalataa hin jiru",
          aboutAccountMenu: "Waa'ee akkaawuntii kanaa",
        };
      }

      return {
        visibleToEveryone: amharic ? "ለሁሉም የሚታይ" : "Visible to everyone",
        visibleTo: amharic ? "ለ" : "Visible to",
        visibleToByRole: {
          parent: amharic ? "ለወላጅ የሚታይ" : "Visible to parent",
          teacher: amharic ? "ለመምህር የሚታይ" : "Visible to teacher",
          student: amharic ? "ለተማሪ የሚታይ" : "Visible to student",
          management: amharic ? "ለአስተዳደር የሚታይ" : "Visible to management",
        },
        schoolAdmin: amharic ? "የትምህርት ቤት አስተዳዳሪ" : "School Admin",
        notSignedIn: amharic ? "አልገቡም" : "Not signed in",
        likeRequiresSignIn: amharic ? "ፖስቶችን ለመውደድ መጀመሪያ መግባት አለብዎት።" : "You must be signed in to like posts.",
        error: amharic ? "ስህተት" : "Error",
        unableToUpdateLike: amharic ? "ላይኩን ማዘመን አልተቻለም። እንደገና ይሞክሩ።" : "Unable to update like. Please try again.",
        unavailable: amharic ? "አይገኝም" : "Unavailable",
        profileCouldNotBeOpened: amharic ? "መገለጫውን መክፈት አልተቻለም።" : "Profile could not be opened.",
        aboutThisAccount: amharic ? "ስለዚህ መለያ" : "About this account",
        postedBy: amharic ? "የለጠፈው" : "Posted by",
        audience: amharic ? "ተመልካች" : "Audience",
        report: amharic ? "ሪፖርት" : "Report",
        reportRequiresSignIn: amharic ? "ፖስቶችን ሪፖርት ለማድረግ መጀመሪያ መግባት አለብዎት።" : "You must be signed in to report posts.",
        reportSuccess: amharic ? "ይህ ፖስት ሪፖርት ተደርጓል።" : "This post has been reported.",
        reportQueued: amharic ? "ይህ ሪፖርት ኢንተርኔት ሲመለስ ይላካል።" : "This report will sync when you're back online.",
        unableToReport: amharic ? "ይህን ፖስት ሪፖርት ማድረግ አልተቻለም። እንደገና ይሞክሩ።" : "Unable to report this post. Please try again.",
        download: amharic ? "አውርድ" : "Download",
        noImageToDownload: amharic ? "ይህ ፖስት ለማውረድ ምስል የለውም።" : "This post does not have an image to download.",
        permissionNeeded: amharic ? "ፍቃድ ያስፈልጋል" : "Permission needed",
        allowPhotoAccess: amharic ? "የወረዱ ምስሎችን ለማስቀመጥ የፎቶ ፍቃድን ይፍቀዱ።" : "Allow photo access to save downloaded images.",
        imageSaved: amharic ? "ምስሉ ወደ ጋለሪዎ ተቀምጧል።" : "Image saved to your gallery.",
        unableToDownload: amharic ? "ይህን ምስል ማውረድ አልተቻለም። እንደገና ይሞክሩ።" : "Unable to download this image. Please try again.",
        seeLess: amharic ? "አሳንስ" : "See less",
        seeMore: amharic ? "ተጨማሪ ይመልከቱ" : "See more",
        likeSingular: amharic ? "ላይክ" : "like",
        likePlural: amharic ? "ላይኮች" : "likes",
        noPostsYet: amharic ? "እስካሁን ፖስቶች የሉም" : "No posts yet",
        offlineNoPostsYet: amharic ? "ከመስመር ውጭ ለማሳየት የተቀመጡ ፖስቶች የሉም።" : "No saved posts available offline yet.",
        announcementsAppearHere: amharic ? "ከትምህርት ቤትዎ የሚመጡ ማስታወቂያዎች እዚህ ይታያሉ።" : "Announcements from your school will appear here.",
        offlineFeedNotice: amharic ? "ከመስመር ውጭ ነዎት። የተቀመጡ ፖስቶችን እያሳየን ነው፣ የተሰለፉ እርምጃዎችም ኢንተርኔት ሲመለስ በራስ-ሰር ይሰምራሉ።" : "You are offline. Showing saved posts, and queued actions will sync automatically when you're back online.",
        likeRequiresInternet: amharic ? "ፖስትን ለመውደድ ኢንተርኔት ያስፈልጋል።" : "Internet is required to like a post.",
        noMorePosts: amharic ? "ተጨማሪ ፖስቶች የሉም" : "No more posts",
        aboutAccountMenu: amharic ? "ስለዚህ መለያ" : "About this account",
      };
    },
    [amharic, oromo]
  );
  const [postsLatest, setPostsLatest] = useState([]);
  const [postsOlder, setPostsOlder] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [userId, setUserId] = useState(null);
  const [viewerLikeKeys, setViewerLikeKeys] = useState([]);
  const [pendingLikes, setPendingLikes] = useState({});
  const [expandedDescriptions, setExpandedDescriptions] = useState({});
  const [postMenuPostId, setPostMenuPostId] = useState(null);

  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImage, setViewerImage] = useState(null);
  const postsLatestRef = useRef(postsLatest);
  const postsOlderRef = useRef(postsOlder);
  const hasMoreRef = useRef(hasMore);
  const pendingLikeIdsRef = useRef(new Set());
  const hasUserScrolledFeedRef = useRef(false);
  const viewerLikeKeysRef = useRef([]);
  const viewerActorIdRef = useRef(null);

  useEffect(() => {
    postsLatestRef.current = postsLatest;
    postsOlderRef.current = postsOlder;
    hasMoreRef.current = hasMore;
  }, [hasMore, postsLatest, postsOlder]);

  const persistFeedCache = useCallback((latest = postsLatestRef.current, older = postsOlderRef.current, nextHasMore = hasMoreRef.current) => {
    writeCachedJson(HOME_FEED_CACHE_KEY, {
      latest,
      older,
      hasMore: nextHasMore,
      fetchedAt: Date.now(),
    }).catch(() => {});
  }, []);

  const applyFeedState = useCallback((latest, older, nextHasMore = hasMoreRef.current, persistCache = false) => {
    postsLatestRef.current = latest;
    postsOlderRef.current = older;
    hasMoreRef.current = nextHasMore;
    setPostsLatest(latest);
    setPostsOlder(older);
    setHasMore((prev) => (prev === nextHasMore ? prev : nextHasMore));

    if (persistCache) {
      persistFeedCache(latest, older, nextHasMore);
    }
  }, [persistFeedCache]);

  const applyCachedFeed = useCallback((cachedFeed) => {
    if (!cachedFeed || !Array.isArray(cachedFeed.latest)) return false;

    applyFeedState(
      cachedFeed.latest,
      Array.isArray(cachedFeed.older) ? cachedFeed.older : [],
      typeof cachedFeed.hasMore === "boolean" ? cachedFeed.hasMore : true,
      false
    );
    setLoading(false);
    setRefreshing(false);
    return true;
  }, [applyFeedState]);

  const setLikePending = useCallback((postId, isPending) => {
    setPendingLikes((prev) => {
      const alreadyPending = !!prev[postId];
      if (alreadyPending === isPending) return prev;

      const next = { ...prev };
      if (isPending) next[postId] = true;
      else delete next[postId];
      return next;
    });
  }, []);

  const syncViewerIdentity = useCallback((nextActorId, nextLikeKeys) => {
    viewerActorIdRef.current = nextActorId || null;
    viewerLikeKeysRef.current = nextLikeKeys;
    setViewerLikeKeys((prev) => {
      if (prev.length === nextLikeKeys.length && prev.every((value, index) => value === nextLikeKeys[index])) {
        return prev;
      }
      return nextLikeKeys;
    });
  }, []);

  const loadUserContext = useCallback(async () => {
    const uid = await AsyncStorage.getItem("userId");
    const userNodeKey = await AsyncStorage.getItem("userNodeKey");
    const parentId = await AsyncStorage.getItem("parentId");
    const actorId = normalizeIdentityValue(uid) || normalizeIdentityValue(userNodeKey) || normalizeIdentityValue(parentId) || null;
    const nextLikeKeys = buildViewerLikeKeys(uid, userNodeKey, parentId);

    setUserId(actorId);
    syncViewerIdentity(actorId, nextLikeKeys);

    const cachedProfileImage = await AsyncStorage.getItem("profileImage");
    if (cachedProfileImage) {
      return actorId;
    }

    try {
      const schoolKey = await AsyncStorage.getItem("schoolKey");
      let userSnap = null;

      if (userNodeKey && schoolKey) {
        userSnap = await get(ref(database, `Platform1/Schools/${schoolKey}/Users/${userNodeKey}`));
      }
      if ((!userSnap || !userSnap.exists()) && userNodeKey) {
        userSnap = await get(ref(database, `Users/${userNodeKey}`));
      }

      if (userSnap && userSnap.exists()) {
        const u = userSnap.val();
        if (u.profileImage) {
          await AsyncStorage.setItem("profileImage", u.profileImage);
        }
      }
    } catch {}

    return actorId;
  }, [syncViewerIdentity]);

  useEffect(() => {
    loadUserContext().catch(() => {});
  }, [loadUserContext]);

  const combinedPosts = useMemo(() => [...postsLatest, ...postsOlder], [postsLatest, postsOlder]);

  const findLoadedPost = useCallback(
    (postId) => postsLatest.find((item) => item.postId === postId) || postsOlder.find((item) => item.postId === postId) || null,
    [postsLatest, postsOlder]
  );

  const resolveSchoolKeyFromUsername = useCallback(async (uname) => {
    if (!uname || uname.length < 3) return null;
    const prefix = uname.substring(0, 3).toUpperCase();

    try {
      const snap = await get(ref(database, `Platform1/schoolCodeIndex/${prefix}`));
      if (snap.exists()) return snap.val();
    } catch {
      return null;
    }

    return null;
  }, []);

  const getEffectiveSchoolKey = useCallback(async () => {
    const storedSchoolKey = await AsyncStorage.getItem("schoolKey");
    if (storedSchoolKey) return storedSchoolKey;

    const storedUsername = await AsyncStorage.getItem("username");
    const resolvedSchoolKey = await resolveSchoolKeyFromUsername(storedUsername || "");
    if (resolvedSchoolKey) {
      await AsyncStorage.setItem("schoolKey", resolvedSchoolKey);
      return resolvedSchoolKey;
    }

    return null;
  }, [resolveSchoolKeyFromUsername]);

  const postsRefForSchool = useCallback(async () => {
    const sk = await getEffectiveSchoolKey();
    if (sk) return ref(database, `Platform1/Schools/${sk}/Posts`);
    return ref(database, "Posts");
  }, [getEffectiveSchoolKey]);

  const isMissingIndexError = useCallback((err) => /index not defined/i.test(String(err?.message || "")), []);

  const toMillis = useCallback((timeValue) => {
    if (!timeValue) return 0;
    const t = new Date(timeValue).getTime();
    return Number.isNaN(t) ? 0 : t;
  }, []);

  const getPostsSnapshotWithFallback = useCallback(
    async (postsRef, beforeTime = null, pageSize = INITIAL_POSTS_COUNT) => {
      const indexedQuery = beforeTime
        ? query(postsRef, orderByChild("time"), endAt(beforeTime), limitToLast(pageSize + 1))
        : query(postsRef, orderByChild("time"), limitToLast(pageSize));

      try {
        return await get(indexedQuery);
      } catch (err) {
        if (!isMissingIndexError(err)) throw err;

        const fullSnap = await get(postsRef);
        if (!fullSnap.exists()) return fullSnap;

        const allPosts = [];
        fullSnap.forEach((child) => {
          const val = child.val();
          allPosts.push({ key: child.key, val });
        });

        allPosts.sort((a, b) => toMillis(b.val?.time) - toMillis(a.val?.time));

        const maxTime = beforeTime ? toMillis(beforeTime) : null;
        const filtered = maxTime == null ? allPosts : allPosts.filter((p) => toMillis(p.val?.time) <= maxTime);
        const limited = filtered.slice(0, beforeTime ? pageSize + 1 : pageSize);

        if (limited.length === 0) {
          return {
            exists: () => false,
            forEach: () => {},
          };
        }

        return {
          exists: () => true,
          forEach: (cb) => {
            limited.forEach((p) => cb({ key: p.key, val: () => p.val }));
          },
        };
      }
    },
    [isMissingIndexError, toMillis]
  );

  // Parent visibility filter
  const isParentVisiblePost = (data) => {
    const raw = data?.targetRole ?? data?.target ?? "all";
    const role = String(raw).toLowerCase().trim();
    if (!raw) return true;
    return role === "all" || role === "parent";
  };

  const fetchInitialPosts = useCallback(async (forceNetwork = false) => {
    if (forceNetwork) {
      hasUserScrolledFeedRef.current = false;
    }

    try {
      const cachedFeedRecord = await readCachedJsonRecord(HOME_FEED_CACHE_KEY);
      const cachedFeed = cachedFeedRecord?.value || null;
      const hasCachedFeed = applyCachedFeed(cachedFeed);
      const cacheIsFresh = cachedFeedRecord ? Date.now() - cachedFeedRecord.savedAt <= HOME_FEED_CACHE_TTL_MS : false;

      if (hasCachedFeed && !forceNetwork && cacheIsFresh) {
        setIsOffline(false);
        return;
      }

      const onlineNow = await isInternetReachableNow();
      setIsOffline(!onlineNow);
      if (!onlineNow) {
        if (!hasCachedFeed) {
          applyFeedState([], [], false, false);
        }
        return;
      }

      const currentUserId = await loadUserContext();
      const postsRef = await postsRefForSchool();
      const snap = await getPostsSnapshotWithFallback(postsRef, null, INITIAL_POSTS_COUNT);

      if (!snap.exists()) {
        applyFeedState([], [], false, true);
        return;
      }

      const tmp = [];
      snap.forEach((child) => {
        const val = child.val();
        tmp.push({ postId: child.key, data: val });
      });

      tmp.sort((a, b) => toMillis(b.data.time) - toMillis(a.data.time));

      const filteredTmp = tmp.filter((p) => isParentVisiblePost(p.data));
      const schoolKey = await getEffectiveSchoolKey();

      const enriched = filteredTmp.map((p) => {
        const likesNode = p.data.likes && typeof p.data.likes === "object" ? p.data.likes : null;
        const seenNode = p.data.seenBy || {};

        if (currentUserId && !seenNode[currentUserId]) {
          (async () => {
            try {
              const sk = await AsyncStorage.getItem("schoolKey");
              const postPath = sk ? `Platform1/Schools/${sk}/Posts/${p.postId}` : `Posts/${p.postId}`;
              const updates = {};
              updates[`${postPath}/seenBy/${currentUserId}`] = true;
              update(ref(database), updates).catch(() => {});
            } catch {}
          })();
          seenNode[currentUserId] = true;
        }

        const admin = buildFeedAuthor(p.data, schoolKey);
        return { postId: p.postId, data: p.data, admin, likesMap: likesNode, seenMap: seenNode };
      });

      applyFeedState(enriched, [], true, true);
      setIsOffline(false);
    } catch (err) {
      console.warn("Posts fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [applyCachedFeed, applyFeedState, getEffectiveSchoolKey, getPostsSnapshotWithFallback, loadUserContext, postsRefForSchool, toMillis]);

  useEffect(() => {
    fetchInitialPosts();
  }, [fetchInitialPosts]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchInitialPosts(true);
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);

    try {
      const onlineNow = await isInternetReachableNow();
      setIsOffline(!onlineNow);
      if (!onlineNow) {
        return;
      }

      const combined = [...postsLatest, ...postsOlder];
      if (combined.length === 0) {
        setHasMore(false);
        return;
      }

      const oldest = combined[combined.length - 1];
      const oldestTime = oldest.data.time;
      if (!oldestTime) {
        setHasMore(false);
        return;
      }

      const postsRef = await postsRefForSchool();
      const snap = await getPostsSnapshotWithFallback(postsRef, oldestTime, SCROLL_POSTS_COUNT);

      if (!snap.exists()) {
        setHasMore(false);
        return;
      }

      const tmp = [];
      snap.forEach((child) => {
        const val = child.val();
        tmp.push({ postId: child.key, data: val });
      });

      tmp.sort((a, b) => toMillis(b.data.time) - toMillis(a.data.time));

      const filteredTmp = tmp.filter((p) => p.postId !== oldest.postId);
      const filteredByTarget = filteredTmp.filter((p) => isParentVisiblePost(p.data));

      if (filteredByTarget.length === 0) {
        setHasMore(false);
        return;
      }

      const schoolKey = await getEffectiveSchoolKey();

      const enrichedOlder = filteredByTarget.map((p) => {
        const likesNode = p.data.likes && typeof p.data.likes === "object" ? p.data.likes : null;
        const seenNode = p.data.seenBy || {};
        const admin = buildFeedAuthor(p.data, schoolKey);
        return { postId: p.postId, data: p.data, admin, likesMap: likesNode, seenMap: seenNode };
      });

      setPostsOlder((prev) => {
        const existingIds = new Set(prev.map((p) => p.postId).concat(postsLatest.map((p) => p.postId)));
        const toAdd = enrichedOlder.filter((p) => !existingIds.has(p.postId));
        const newOlder = [...prev, ...toAdd];
        if (enrichedOlder.length < SCROLL_POSTS_COUNT) setHasMore(false);
        persistFeedCache(postsLatestRef.current, newOlder, enrichedOlder.length >= SCROLL_POSTS_COUNT);
        return newOlder;
      });
    } catch (err) {
      console.warn("loadMore error:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleLike = useCallback(async (postId) => {
    const uid = userId || (await loadUserContext());
    if (!uid) {
      Alert.alert(labels.notSignedIn, labels.likeRequiresSignIn);
      return;
    }

    const findPost = () => {
      let p = postsLatestRef.current.find((x) => x.postId === postId);
      if (p) return { which: "latest", p };
      p = postsOlderRef.current.find((x) => x.postId === postId);
      if (p) return { which: "older", p };
      return null;
    };

    const found = findPost();
    if (!found) return;

    if (pendingLikeIdsRef.current.has(postId)) return;

    const schoolKey = (await AsyncStorage.getItem("schoolKey")) || null;
    const actorId = viewerActorIdRef.current || uid;
    const activeViewerLikeKeys = viewerLikeKeysRef.current.length ? viewerLikeKeysRef.current : buildViewerLikeKeys(actorId);

    const currentlyLiked = isPostLikedByViewer(found.p.likesMap, activeViewerLikeKeys);
    const originalPost = found.p;
    const nextLiked = !currentlyLiked;

    const optimisticUpdater = (post) => {
      const likes = { ...(post.likesMap || {}) };
      const previousLikeCount = getLikeCountValue(post.data?.likeCount, post.likesMap);
      activeViewerLikeKeys.forEach((key) => {
        delete likes[key];
      });
      if (nextLiked && actorId) likes[actorId] = true;

      return {
        ...post,
        likesMap: likes,
        data: {
          ...post.data,
          likes,
          likeCount: nextLiked ? previousLikeCount + 1 : Math.max(0, previousLikeCount - 1),
        },
      };
    };

    const optimisticLists = updateLoadedPostLists(postsLatestRef.current, postsOlderRef.current, postId, optimisticUpdater);
    if (!optimisticLists.matched) {
      return;
    }

    applyFeedState(optimisticLists.latest, optimisticLists.older, hasMoreRef.current, true);

    const likeAction = {
      schoolKey,
      postId,
      userId: actorId,
      liked: nextLiked,
    };

    await enqueuePostLikeAction(likeAction);

    const onlineNow = await isInternetReachableNow();
    setIsOffline(!onlineNow);
    if (!onlineNow) {
      return;
    }

    pendingLikeIdsRef.current.add(postId);
    setLikePending(postId, true);

    try {
      await commitPostLikeAction(likeAction);
      await clearQueuedPostAction({ type: "post-like", ...likeAction });
    } catch (err) {
      const stillOnline = await isInternetReachableNow();
      setIsOffline(!stillOnline);

      if (!stillOnline) {
        return;
      }

      await clearQueuedPostAction({ type: "post-like", ...likeAction });

      const revertedLists = updateLoadedPostLists(postsLatestRef.current, postsOlderRef.current, postId, (post) => ({
        ...post,
        likesMap: originalPost.likesMap || null,
        data: {
          ...post.data,
          likes: originalPost.likesMap || null,
          likeCount: getLikeCountValue(originalPost.data?.likeCount, originalPost.likesMap),
        },
      }));
      applyFeedState(revertedLists.latest, revertedLists.older, hasMoreRef.current, true);
      console.warn("like update failed:", err);
      Alert.alert(labels.error, labels.unableToUpdateLike);
    } finally {
      pendingLikeIdsRef.current.delete(postId);
      setLikePending(postId, false);
    }
  }, [
    applyFeedState,
    labels.error,
    labels.likeRequiresSignIn,
    labels.notSignedIn,
    labels.unableToUpdateLike,
    loadUserContext,
    setLikePending,
    userId,
  ]);

  const toggleDescription = useCallback((postId) => {
    setExpandedDescriptions((prev) => ({
      ...prev,
      [postId]: !prev[postId],
    }));
  }, []);

  const closePostMenu = useCallback(() => {
    setPostMenuPostId(null);
  }, []);

  const openPostMenu = useCallback((postId) => {
    setPostMenuPostId(postId);
  }, []);

  const openPosterProfile = useCallback(
    (item) => {
      const profileNodeKey = item?.admin?._nodeKey || "";
      const profileRecordId = item?.admin?._recordId || item?.admin?._sourceIdentifier || item?.data?.adminId || "";

      if (!profileNodeKey && !profileRecordId) {
        Alert.alert(labels.unavailable, labels.profileCouldNotBeOpened);
        return;
      }

      router.push({
        pathname: "/userProfile",
        params: {
          userId: profileNodeKey,
          recordId: profileRecordId,
          roleName: item?.admin?.role || "Admin",
        },
      });
    },
    [labels.profileCouldNotBeOpened, labels.unavailable, router]
  );

  const handleAboutAccount = useCallback(() => {
    const selectedPost = findLoadedPost(postMenuPostId);
    closePostMenu();

    if (!selectedPost) return;

    const accountName = getPosterName(selectedPost.admin, selectedPost.data, labels);
    const targetRole = formatTargetRoleLabel(selectedPost.data, labels);

    Alert.alert(labels.aboutThisAccount, `${labels.postedBy} ${accountName}\n${labels.audience}: ${targetRole}`);
  }, [closePostMenu, findLoadedPost, labels, postMenuPostId]);

  const handleReportPost = useCallback(async () => {
    const uid = userId || (await loadUserContext());
    const postId = postMenuPostId;
    closePostMenu();

    if (!uid) {
      Alert.alert(labels.notSignedIn, labels.reportRequiresSignIn);
      return;
    }

    if (!postId) return;

    const schoolKey = (await AsyncStorage.getItem("schoolKey")) || null;
    const reportAction = {
      schoolKey,
      postId,
      userId: uid,
    };

    await enqueuePostReportAction(reportAction);

    try {
      const onlineNow = await isInternetReachableNow();
      setIsOffline(!onlineNow);

      if (!onlineNow) {
        Alert.alert(labels.report, labels.reportQueued);
        return;
      }

      await commitPostReportAction(reportAction);
      await clearQueuedPostAction({ type: "post-report", ...reportAction });
      Alert.alert(labels.report, labels.reportSuccess);
    } catch (error) {
      const stillOnline = await isInternetReachableNow();
      setIsOffline(!stillOnline);

      if (!stillOnline) {
        Alert.alert(labels.report, labels.reportQueued);
        return;
      }

      await clearQueuedPostAction({ type: "post-report", ...reportAction });

      console.warn("report post failed:", error);
      Alert.alert(labels.error, labels.unableToReport);
    }
  }, [closePostMenu, labels, loadUserContext, postMenuPostId, userId]);

  const handleDownloadPost = useCallback(async () => {
    const selectedPost = findLoadedPost(postMenuPostId);
    closePostMenu();

    const downloadableUrl = selectedPost?.data?.postUrl || null;
    if (!downloadableUrl) {
      Alert.alert(labels.download, labels.noImageToDownload);
      return;
    }

    try {
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert(labels.permissionNeeded, labels.allowPhotoAccess);
        return;
      }

      const ext = getFileExtensionFromUrl(downloadableUrl);
      const fileName = `gojo-parent-post-${selectedPost.postId || Date.now()}.${ext}`;
      const downloadPath = `${FileSystem.cacheDirectory}${fileName}`;

      await FileSystem.downloadAsync(downloadableUrl, downloadPath);
      await MediaLibrary.saveToLibraryAsync(downloadPath);
      await FileSystem.deleteAsync(downloadPath, { idempotent: true });

      Alert.alert(labels.download, labels.imageSaved);
    } catch (error) {
      console.warn("download post failed:", error);
      Alert.alert(labels.error, labels.unableToDownload);
    }
  }, [closePostMenu, findLoadedPost, labels, postMenuPostId]);

  const openImageViewer = useCallback((imageUri) => {
    if (!imageUri) return;
    setViewerImage(imageUri);
    setViewerVisible(true);
  }, []);

  const renderPostItem = useCallback(({ item }) => (
    <FeedPostCard
      item={item}
      viewerLikeKeys={viewerLikeKeys}
      labels={labels}
      palette={palette}
      styles={styles}
      isExpanded={!!expandedDescriptions[item.postId]}
      likePending={!!pendingLikes[item.postId]}
      onToggleDescription={toggleDescription}
      onOpenPosterProfile={openPosterProfile}
      onOpenPostMenu={openPostMenu}
      onOpenViewer={openImageViewer}
      onToggleLike={toggleLike}
    />
  ), [expandedDescriptions, labels, openImageViewer, openPosterProfile, openPostMenu, palette, pendingLikes, styles, toggleDescription, toggleLike, viewerLikeKeys]);

  const markFeedScrollStarted = useCallback(() => {
    hasUserScrolledFeedRef.current = true;
  }, []);

  const EmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyFallbackIcon}>
        <Ionicons name="newspaper-outline" size={48} color={palette.muted} />
      </View>
      <Text style={styles.emptyTitle}>{isOffline ? labels.offlineNoPostsYet : labels.noPostsYet}</Text>
      <Text style={styles.emptySubtitle}>{labels.announcementsAppearHere}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  if (!combinedPosts?.length) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.background }}>
        <EmptyState />
      </View>
    );
  }

  const ListFooter = () => {
    if (loadingMore) return <ActivityIndicator style={{ margin: 16 }} color={palette.primary} />;
    if (!hasMore) return <Text style={{ textAlign: "center", color: palette.muted, padding: 12 }}>{labels.noMorePosts}</Text>;
    return null;
  };

  return (
    <>
      {isOffline && combinedPosts.length ? (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={16} color={palette.primary} />
          <Text style={styles.offlineBannerText}>{labels.offlineFeedNotice}</Text>
        </View>
      ) : null}
      <FlatList
        data={combinedPosts}
        keyExtractor={(i) => i.postId}
        renderItem={renderPostItem}
        contentContainerStyle={[styles.list, { paddingBottom: 74 + Math.max(insets.bottom, 6) }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[palette.primary]} tintColor={palette.primary} />}
        onScrollBeginDrag={markFeedScrollStarted}
        onMomentumScrollBegin={markFeedScrollStarted}
        onEndReachedThreshold={0.18}
        onEndReached={() => {
          if (!hasUserScrolledFeedRef.current) return;
          if (!loadingMore && hasMore) loadMore();
        }}
        ListFooterComponent={<ListFooter />}
      />

      <Modal visible={!!postMenuPostId} transparent animationType="fade" onRequestClose={closePostMenu}>
        <View style={styles.menuOverlay}>
          <Pressable style={styles.menuBackdrop} onPress={closePostMenu} />
          <View style={styles.menuSheetWrap}>
            <View style={styles.menuSheetHandle} />
            <View style={styles.menuSheet}>
              <TouchableOpacity style={styles.menuItem} activeOpacity={0.85} onPress={handleAboutAccount}>
                <Ionicons name="information-circle-outline" size={20} color={palette.text} />
                <Text style={styles.menuItemText}>{labels.aboutAccountMenu}</Text>
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity style={styles.menuItem} activeOpacity={0.85} onPress={handleDownloadPost}>
                <Ionicons name="download-outline" size={20} color={palette.text} />
                <Text style={styles.menuItemText}>{labels.download}</Text>
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity style={styles.menuItem} activeOpacity={0.85} onPress={handleReportPost}>
                <Ionicons name="flag-outline" size={20} color={palette.menuDanger} />
                <Text style={[styles.menuItemText, styles.menuItemDanger]}>{labels.report}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={viewerVisible} transparent animationType="fade" onRequestClose={() => setViewerVisible(false)}>
        <View style={styles.viewerBg}>
          <View style={styles.viewerTop}>
            <TouchableOpacity style={styles.viewerClose} onPress={() => setViewerVisible(false)}>
              <Ionicons name="close" size={26} color={palette.viewerCloseIcon} />
            </TouchableOpacity>
          </View>
          <Pressable style={{ flex: 1, width: "100%" }} onPress={() => setViewerVisible(false)}>
            {viewerImage ? (
              <AppImage
                uri={viewerImage}
                fallbackSource={require("../../assets/images/logo.png")}
                style={styles.viewerImage}
                resizeMode="contain"
              />
            ) : null}
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

const createStyles = (palette) => StyleSheet.create({
  list: { paddingVertical: 0, backgroundColor: palette.feedBackground },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20, backgroundColor: palette.feedBackground },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: palette.soft,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.borderSoft,
  },
  offlineBannerText: {
    flex: 1,
    color: palette.textStrong,
    fontSize: 13,
    fontWeight: "600",
  },
  card: {
    backgroundColor: palette.card,
    marginBottom: 6,
    marginHorizontal: 0,
    overflow: "hidden",
    borderRadius: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  headerProfileTap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  headerTextWrap: { flex: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10, backgroundColor: palette.avatarBg },
  username: { fontWeight: "700", color: palette.textStrong, fontSize: 15 },
  headerMetaRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  time: { color: palette.muted, fontSize: 12 },
  headerDot: { color: palette.muted, fontSize: 12, marginHorizontal: 4 },
  targetRoleText: { color: palette.muted, fontSize: 12 },
  moreBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  messageWrap: { paddingHorizontal: 12, paddingBottom: 8 },
  seeMoreText: {
    color: palette.muted,
    fontSize: 14,
    marginTop: 4,
  },
  postImage: { width: "100%", height: IMAGE_HEIGHT, backgroundColor: palette.imageBg },
  messageText: { color: palette.text, lineHeight: 20, fontSize: 15 },
  reactionsSummary: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 4,
  },
  reactionsLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  reactionCountText: {
    color: palette.text,
    fontSize: 13,
    fontWeight: "700",
  },
  likeIconOnlyBtn: {
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: palette.overlay,
  },
  menuBackdrop: {
    flex: 1,
  },
  menuSheetWrap: {
    paddingHorizontal: 8,
    paddingBottom: 10,
  },
  menuSheetHandle: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: 999,
    backgroundColor: palette.menuHandle,
    marginBottom: 10,
  },
  menuSheet: {
    backgroundColor: palette.card,
    borderRadius: 22,
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 12,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  menuItemText: {
    color: palette.text,
    fontSize: 16,
    fontWeight: "600",
  },
  menuItemDanger: {
    color: palette.menuDanger,
  },
  menuDivider: {
    height: 1,
    backgroundColor: palette.border,
    marginHorizontal: 18,
  },
  emptyContainer: { flex: 1, backgroundColor: palette.feedBackground, alignItems: "center", justifyContent: "center", padding: 28 },
  emptyFallbackIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: palette.soft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: palette.text, marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: palette.muted, textAlign: "center" },
  viewerBg: { flex: 1, backgroundColor: palette.viewerOverlay, alignItems: "center", justifyContent: "center" },
  viewerTop: { position: "absolute", top: 45, right: 14, zIndex: 20 },
  viewerClose: { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.viewerCloseBg, alignItems: "center", justifyContent: "center" },
  viewerImage: { width: "100%", height: "100%" },
});