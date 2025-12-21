import { child, get, ref, update } from "firebase/database";
import { useEffect, useState } from "react";
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { database } from "../../constants/firebaseConfig";

export default function Home() {
  const [posts, setPosts] = useState([]);

  // 🔴 Replace with logged-in parent userId
  const parentUserId = "parent_user_id_here";

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const dbRef = ref(database);

        // 1️⃣ Get all posts
        const postsSnap = await get(child(dbRef, "Posts"));
        if (!postsSnap.exists()) return;
        const postsData = postsSnap.val();

        // 2️⃣ Get all admins
        const adminsSnap = await get(child(dbRef, "School_Admins"));
        const adminsData = adminsSnap.exists() ? adminsSnap.val() : {};

        // 3️⃣ Get all users
        const usersSnap = await get(child(dbRef, "Users"));
        const usersData = usersSnap.exists() ? usersSnap.val() : {};

        // 4️⃣ Map posts with admin info
       const postsList = Object.keys(postsData).map((postId) => {
  const post = postsData[postId];
  const admin = adminsData[post.adminId] || {};

  return {
    id: postId,
    message: post.message || "",
    postUrl: post.postUrl || null,
    time: post.time || "",
    likes: post.likes || {},
    likeCount: post.likeCount || 0,
    adminName: admin.name || "School Admin",
    adminImage:
      admin.profileImage ||
      "https://cdn-icons-png.flaticon.com/512/847/847969.png",
  };
});


        // 5️⃣ Sort newest first
        setPosts(postsList.reverse());
      } catch (error) {
        console.log("Error loading posts:", error);
      }
    };

    fetchPosts();
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

  // 🔹 Render each post
  const renderPost = ({ item }) => (
    <View style={styles.postCard}>
      {/* Header */}
      <View style={styles.header}>
        <Image source={{ uri: item.adminImage }} style={styles.avatar} />
        <View>
          <Text style={styles.adminName}>{item.adminName}</Text>
          <Text style={styles.time}>{item.time}</Text>
        </View>
      </View>

      {/* Message */}
      {item.message !== "" && <Text style={styles.postText}>{item.message}</Text>}

      {/* Post Image */}
      {item.postUrl && <Image source={{ uri: item.postUrl }} style={styles.postImage} />}

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

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<Text style={styles.emptyText}>No posts available</Text>}
      />
    </View>
  );
}

// 🔹 STYLES
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f2f5",
    padding: 10,
  },
  postCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 15,
    padding: 10,
    elevation: 3,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  avatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    marginRight: 10,
    backgroundColor: "#ddd",
  },
  adminName: {
    fontSize: 15,
    fontWeight: "bold",
  },
  time: {
    fontSize: 12,
    color: "gray",
  },
  postText: {
    fontSize: 14,
    marginVertical: 6,
  },
  postImage: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 10,
    resizeMode: "cover",
  },
  likeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  likeBtn: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1877f2",
  },
  likeCount: {
    fontSize: 14,
    color: "gray",
  },
  emptyText: {
    textAlign: "center",
    marginTop: 50,
    fontSize: 16,
    color: "gray",
  },
});
