// app/dashboard/home.jsx
import { child, get, ref, update } from "firebase/database";
import { useEffect, useState, useRef } from "react";
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View, Animated, Modal, Alert, Share, Platform, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { database } from "../../constants/firebaseConfig";

const { width, height } = Dimensions.get("window");

// 🔹 Double Tap Heart Component (moved outside to prevent recreation)
const DoubleTapHeart = ({ postId, likes, postUrl, likedPosts, handlePostTap, onDoubleTap }) => {
  const heartScale = useRef(new Animated.Value(0)).current;
  const [isAnimating, setIsAnimating] = useState(false);
  
  useEffect(() => {
    if (likedPosts[postId] && !isAnimating) {
      setIsAnimating(true);
      Animated.sequence([
        Animated.timing(heartScale, {
          toValue: 1.2,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(heartScale, {
          toValue: 0.8,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(heartScale, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Reset after animation completes
        setTimeout(() => {
          heartScale.setValue(0);
          setIsAnimating(false);
        }, 800);
      });
    }
  }, [likedPosts[postId]]);

  return (
    <TouchableOpacity 
      activeOpacity={1} 
      onPress={() => handlePostTap(postId, likes)}
      style={styles.imageContainer}
    >
      {postUrl && <Image source={{ uri: postUrl }} style={styles.postImage} />}
      
      {/* Heart Animation */}
      {likedPosts[postId] && (
        <Animated.View 
          style={[
            styles.heartOverlay,
            {
              transform: [{ scale: heartScale }]
            }
          ]}
        >
          <Text style={styles.heartIcon}>❤️</Text>
        </Animated.View>
      )}
    </TouchableOpacity>
  );
};

export default function Home() {
  const [posts, setPosts] = useState([]);
  const [tick, setTick] = useState(0); // used to trigger re-render every minute
  const [loading, setLoading] = useState(true);
  const [likedPosts, setLikedPosts] = useState({}); // Track liked posts for animation
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);

  // Shimmer animation
  const shimmerAnim = new Animated.Value(0);
  
  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    shimmer.start();
    
    return () => shimmer.stop();
  }, []);

  const parentUserId = "parent_user_id_here";

  // 🔹 Fetch posts from Firebase
  useEffect(() => {
    const fetchPosts = async () => {
      setLoading(true);
      try {
        const dbRef = ref(database);
        const postsSnap = await get(child(dbRef, "Posts"));
        if (!postsSnap.exists()) return;
        const postsData = postsSnap.val();

        const usersSnap = await get(child(dbRef, "Users"));
        const usersData = usersSnap.exists() ? usersSnap.val() : {};

        const schoolAdminSnap = await get(child(dbRef, "School_Admins"));
        const schoolAdminData = schoolAdminSnap.exists() ? schoolAdminSnap.val() : {};

        const postsList = Object.keys(postsData).map((postId) => {
          const post = postsData[postId];

          let adminName = "School Admin";
          let adminImage = "https://cdn-icons-png.flaticon.com/512/847/847969.png";

          // Get admin info from School_Admins, then user info from Users
          if (post.adminId && schoolAdminData[post.adminId]) {
            const adminInfo = schoolAdminData[post.adminId];
            const userId = adminInfo.userId;
            
            if (userId && usersData[userId]) {
              const userInfo = usersData[userId];
              adminName = userInfo.name || userInfo.username || "Unknown User";
              adminImage = userInfo.profileImage || adminImage;
            }
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
          };
        });

        setPosts(postsList.reverse());
      } catch (error) {
        console.log("Error loading posts:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, []);

  // 🔹 Update tick every 1 minute for live time updates
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  // ❤️ Like / Unlike post
  const handleLike = async (postId, likes) => {
    const updatedLikes = { ...likes };
    if (updatedLikes[parentUserId]) delete updatedLikes[parentUserId];
    else updatedLikes[parentUserId] = true;

    await update(ref(database, `Posts/${postId}`), {
      likes: updatedLikes,
      likeCount: Object.keys(updatedLikes).length,
    });

    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, likes: updatedLikes, likeCount: Object.keys(updatedLikes).length }
          : p
      )
    );
  };

  // 🔹 Handle double tap to like
  const handleDoubleTap = (postId, likes) => {
    // Trigger heart animation
    setLikedPosts(prev => ({ ...prev, [postId]: true }));
    
    // Remove animation after 1 second
    setTimeout(() => {
      setLikedPosts(prev => ({ ...prev, [postId]: false }));
    }, 1000);

    // Like the post if not already liked
    if (!likes[parentUserId]) {
      handleLike(postId, likes);
    }
  };

  // 🔹 Handle menu actions
  const handleMenuPress = (post) => {
    setSelectedPost(post);
    setMenuVisible(true);
  };

  const handleReport = () => {
    Alert.alert(
      "Report Post",
      "Are you sure you want to report this post?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Report", onPress: () => console.log("Post reported") },
      ]
    );
    setMenuVisible(false);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out this post by ${selectedPost.adminName}: ${selectedPost.message}`,
        url: selectedPost.postUrl,
      });
    } catch (error) {
      console.log("Error sharing:", error);
    }
    setMenuVisible(false);
  };

  const handleDownload = async () => {
    try {
      console.log("Starting save profile photo...");
      console.log("Profile image URL:", selectedPost?.adminImage);
      
      if (!selectedPost?.adminImage) {
        Alert.alert("Error", "No profile photo to save");
        return;
      }

      // Check if it's the default placeholder image
      if (selectedPost.adminImage === "https://cdn-icons-png.flaticon.com/512/847/847969.png") {
        Alert.alert("Info", "This is a default profile image. Downloading the default image.");
      }

      console.log("Requesting media library permissions...");
      // Request media library permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      console.log("Permission status:", status);
      
      if (status === 'denied') {
        Alert.alert("Permission Required", "Please allow access to save photos to your gallery in Settings");
        return;
      }
      
      if (status !== 'granted') {
        // Try requesting again for undetermined status
        const { status: newStatus } = await MediaLibrary.requestPermissionsAsync();
        console.log("Second permission request status:", newStatus);
        
        if (newStatus !== 'granted') {
          Alert.alert("Permission Required", "Please allow access to save photos to your gallery");
          return;
        }
      }

      console.log("Creating download...");
      // Download image using the same approach as profile.jsx
      const fileName = `profile_photo_${selectedPost.id}_${Date.now()}.jpg`;
      console.log("Filename:", fileName);
      
      const fileUri = FileSystem.cacheDirectory + fileName;
      console.log("Download path:", fileUri);
      
      const downloadObject = FileSystem.downloadAsync(selectedPost.adminImage, fileUri);
      console.log("Download started:", downloadObject);
      
      const { uri } = await downloadObject;
      console.log("Downloaded to:", uri);
      
      console.log("Creating asset...");
      // Save to device gallery
      const asset = await MediaLibrary.createAssetAsync(uri);
      console.log("Asset created:", asset);
      
      console.log("Creating album...");
      await MediaLibrary.createAlbumAsync('Gojo Profiles', asset, false);
      console.log("Album created");
      
      Alert.alert("Success", "Profile photo saved to your phone's gallery!");
      setMenuVisible(false);
    } catch (error) {
      console.log("Error saving photo:", error);
      console.log("Error details:", JSON.stringify(error, null, 2));
      Alert.alert("Error", `Failed to save profile photo: ${error.message || error}`);
      setMenuVisible(false);
    }
  };

  const handleCopyLink = () => {
    Alert.alert(
      "Copy Link",
      "Link copied to clipboard!",
      [{ text: "OK", onPress: () => setMenuVisible(false) }]
    );
  };

  const handleCloseMenu = () => {
    setMenuVisible(false);
    setSelectedPost(null);
  };

  // 🔹 Track tap timing for double tap detection
  const [lastTap, setLastTap] = useState({});
  
  const handlePostTap = (postId, likes) => {
    const now = Date.now();
    const lastTapTime = lastTap[postId] || 0;
    
    // Always update the last tap time first
    setLastTap(prev => ({ ...prev, [postId]: now }));
    
    // Check for double tap (within 300ms)
    if (now - lastTapTime < 300) {
      // Double tap detected
      handleDoubleTap(postId, likes);
    }
  };

  // 🔹 Relative time helper
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

  // 🔹 Render skeleton loading
  const renderSkeleton = () => (
    <View style={styles.postCard}>
      {/* Header skeleton */}
      <View style={styles.header}>
        <Animated.View 
          style={[
            styles.avatar, 
            styles.skeleton,
            {
              opacity: shimmerAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 0.7],
              }),
            }
          ]} 
        />
        <View style={styles.textContainer}>
          <Animated.View 
            style={[
              styles.skeletonText,
              styles.skeleton,
              {
                opacity: shimmerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.3, 0.7],
                }),
              }
            ]} 
          />
          <Animated.View 
            style={[
              styles.skeletonTextSmall,
              styles.skeleton,
              {
                opacity: shimmerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.3, 0.7],
                }),
              }
            ]} 
          />
        </View>
      </View>

      {/* Message skeleton */}
      <Animated.View 
        style={[
          styles.skeletonText,
          styles.skeleton,
          {
            opacity: shimmerAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.3, 0.7],
            }),
          }
        ]} 
      />
      
      {/* Image skeleton */}
      <Animated.View 
        style={[
          styles.skeletonImage,
          styles.skeleton,
          {
            opacity: shimmerAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.3, 0.7],
            }),
          }
        ]} 
      />

      {/* Like button skeleton */}
      <View style={styles.likeRow}>
        <Animated.View 
          style={[
            styles.skeletonButton,
            styles.skeleton,
            {
              opacity: shimmerAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 0.7],
              }),
            }
            ]} 
        />
        <Animated.View 
          style={[
            styles.skeletonMessageIcon,
            styles.skeleton,
            {
              opacity: shimmerAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 0.7],
              }),
            }
            ]} 
        />
        <Animated.View 
          style={[
            styles.skeletonTextSmall,
            styles.skeleton,
            {
              opacity: shimmerAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 0.7],
              }),
            }
            ]} 
        />
      </View>
    </View>
  );

  // 🔹 Render each post
  const renderPost = ({ item }) => {
    return (
      <View style={styles.postCard}>
        {/* Header */}
        <View style={styles.header}>
          <Image source={{ uri: item.adminImage }} style={styles.avatar} />
          <View style={styles.headerInfo}>
            <Text style={styles.adminName}>{item.adminName}</Text>
            <Text style={styles.time}>{getRelativeTime(item.time)}</Text>
          </View>
          <TouchableOpacity 
            style={styles.menuButton}
            onPress={() => handleMenuPress(item)}
          >
            <Ionicons name="ellipsis-vertical" size={20} color="#000" />
          </TouchableOpacity>
        </View>

        {/* Message */}
        {item.message !== "" && <Text style={styles.postText}>{item.message}</Text>}

        {/* Post Image with double tap */}
        <DoubleTapHeart 
          postId={item.id}
          likes={item.likes}
          postUrl={item.postUrl}
          likedPosts={likedPosts}
          handlePostTap={handlePostTap}
          onDoubleTap={() => handleDoubleTap(item.id, item.likes)}
        />

        {/* Like section */}
        <View style={styles.likeRow}>
          <TouchableOpacity onPress={() => handleLike(item.id, item.likes)}>
            <Text style={styles.likeBtn}>
              {item.likes[parentUserId] ? "❤️ Liked" : "🤍 Like"}
            </Text>
          </TouchableOpacity>
          <Text style={styles.likeCount}>{item.likeCount} likes</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={loading ? Array(5).fill({}) : posts}
        keyExtractor={(item, index) => loading ? `skeleton-${index}` : item.id}
        renderItem={loading ? renderSkeleton : renderPost}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={!loading && <Text style={styles.emptyText}>No posts available</Text>}
        contentContainerStyle={styles.listContent}
      />
      
      {/* Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseMenu}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={handleCloseMenu}
        >
          <View style={styles.menuContainer}>
            <TouchableOpacity style={styles.menuItem} onPress={handleReport}>
              <Ionicons name="flag-outline" size={20} color="#000" />
              <Text style={styles.menuText}>Report Post</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleShare}>
              <Ionicons name="share-outline" size={20} color="#000" />
              <Text style={styles.menuText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleDownload}>
              <Ionicons name="download-outline" size={20} color="#000" />
              <Text style={styles.menuText}>Download</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleCopyLink}>
              <Ionicons name="link-outline" size={20} color="#000" />
              <Text style={styles.menuText}>Copy Link</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleCloseMenu}>
              <Ionicons name="close-outline" size={20} color="#000" />
              <Text style={styles.menuText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// 🔹 STYLES
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f2f5",
  },
  listContent: {
    paddingTop: width * 0.04, // 4% of screen width
    paddingBottom: width * 0.06, // 6% of screen width
    paddingHorizontal: width * 0.025, // 2.5% of screen width
  },
  postCard: {
    backgroundColor: "#fff",
    borderRadius: width * 0.03, // Responsive border radius
    marginBottom: width * 0.035, // Responsive margin
    padding: width * 0.025, // Responsive padding
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: width * 0.025,
  },
  headerInfo: {
    flex: 1,
    marginLeft: width * 0.025,
  },
  menuButton: {
    padding: width * 0.015,
  },
  avatar: {
    width: width * 0.11, // 11% of screen width
    height: width * 0.11, // Square avatar
    borderRadius: width * 0.055, // Half of width for circle
    marginRight: width * 0.025,
    backgroundColor: "#ddd",
  },
  adminName: {
    fontSize: width * 0.04, // Instagram-style font size
    fontWeight: "bold", // Bold name
    color: "#000",
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Roboto',
  },
  time: {
    fontSize: width * 0.025, // Instagram-style time font
    color: "#8e8e8e", // Instagram gray color
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Roboto',
  },
  postText: {
    fontSize: width * 0.036, // Instagram-style post font
    marginVertical: width * 0.015,
    lineHeight: width * 0.045, // Instagram line height
    color: "#000",
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Roboto',
    fontWeight: "400", // Instagram regular weight
  },
  postImage: {
    width: "100%",
    height: undefined,
    borderRadius: width * 0.02, // Responsive border radius
    resizeMode: "contain",
    backgroundColor: "#f0f0f0",
    minHeight: width * 0.5, // Responsive minimum height
  },
  likeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: width * 0.025,
  },
  likeBtn: {
    fontSize: width * 0.038, // Responsive font size
    fontWeight: "bold",
    color: "#1877f2",
  },
  likeCount: {
    fontSize: width * 0.032, // Responsive font size
    color: "gray",
  },
  emptyText: {
    textAlign: "center",
    marginTop: height * 0.15, // 15% of screen height
    fontSize: width * 0.04, // Responsive font size
    color: "gray",
  },
  // Skeleton loading styles
  skeleton: {
    backgroundColor: "#e1e1e1",
  },
  textContainer: {
    flex: 1,
  },
  skeletonText: {
    height: width * 0.04, // Responsive height
    borderRadius: width * 0.01, // Responsive border radius
    marginBottom: width * 0.015,
    width: "80%",
  },
  skeletonTextSmall: {
    height: width * 0.03, // Responsive height
    borderRadius: width * 0.01,
    width: "40%",
  },
  skeletonImage: {
    width: "100%",
    height: width * 0.5, // Responsive height
    borderRadius: width * 0.025,
    marginVertical: width * 0.015,
  },
  skeletonButton: {
    height: width * 0.05, // Responsive height
    width: width * 0.2,
    borderRadius: width * 0.01,
  },
  skeletonMessageIcon: {
    height: width * 0.05,
    width: width * 0.05,
    borderRadius: width * 0.01,
    marginLeft: width * 0.025,
  },
  imageContainer: {
    position: 'relative',
  },
  heartOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -width * 0.08, // Responsive positioning
    marginLeft: -width * 0.08,
    width: width * 0.16,
    height: width * 0.16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartIcon: {
    fontSize: width * 0.16, // Responsive font size
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  // Menu modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  menuContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: width * 0.05, // Responsive border radius
    borderTopRightRadius: width * 0.05,
    padding: width * 0.025,
    width: '100%',
    paddingBottom: width * 0.075, // Responsive padding
  },
  menuHeader: {
    height: width * 0.01, // Responsive height
    width: width * 0.1, // Responsive width
    backgroundColor: '#000',
    borderRadius: width * 0.005,
    alignSelf: 'center',
    marginBottom: width * 0.05,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: width * 0.04, // Responsive padding
    paddingHorizontal: width * 0.05, // Responsive padding
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuText: {
    fontSize: width * 0.04, // Responsive font size
    marginLeft: width * 0.04,
    color: '#000',
    fontWeight: '500',
  },
  menuCancel: {
    borderTopWidth: width * 0.02, // Responsive border width
    borderTopColor: '#f0f0f0',
  },
});
