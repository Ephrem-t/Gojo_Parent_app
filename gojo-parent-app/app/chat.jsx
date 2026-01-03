// app/chat.jsx
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ref, push, update, onValue, get, child } from "firebase/database";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { useEffect, useState, useMemo, useRef } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
  Alert,
  Dimensions,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import EmojiSelector from "react-native-emoji-selector";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { database, storage } from "../constants/firebaseConfig";

// --- Helper to format time ---
const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  const now = new Date();
  if (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  ) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } else {
    return date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }
};

// --- Message Bubble Component ---
const MessageBubble = ({
  item,
  isSender,
  repliedMsg,
  onLongPress,
  onPressReplyPreview,
  isFirstInGroup,
  isLastInGroup,
}) => {
  const screenWidth = Dimensions.get("window").width;
  const maxBubbleWidth = screenWidth * 0.75;

  return (
    <View style={[styles.messageRow, { flexDirection: isSender ? "row-reverse" : "row" }]}>
      <TouchableOpacity onLongPress={() => onLongPress(item)} activeOpacity={0.9}>
        <View
          style={[
            styles.messageBubble,
            isSender ? styles.senderMsg : styles.receiverMsg,
            {
              maxWidth: maxBubbleWidth,
              minWidth: 60,
              borderTopLeftRadius: isSender ? 16 : isFirstInGroup ? 16 : 4,
              borderTopRightRadius: isSender ? (isFirstInGroup ? 16 : 4) : 16,
              borderBottomLeftRadius: isSender ? 16 : isLastInGroup ? 16 : 4,
              borderBottomRightRadius: isSender ? (isLastInGroup ? 16 : 4) : 16,
            },
          ]}
        >
          {repliedMsg && (
            <TouchableOpacity onPress={() => onPressReplyPreview(repliedMsg)} activeOpacity={0.7}>
              <View style={styles.replyPreviewContainer}>
                <View style={styles.replyLine} />
                <Text
                  style={[styles.replyTextPreview, isSender ? { color: "#ffffffaa" } : { color: "#000000aa" }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {repliedMsg.deleted
                    ? "This message was deleted"
                    : repliedMsg.type === "text"
                    ? repliedMsg.text.length > 50
                      ? repliedMsg.text.slice(0, 50) + "..."
                      : repliedMsg.text
                    : "📷 Image"}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          <View style={{ flexDirection: "row", alignItems: "flex-end", flexWrap: "wrap" }}>
            {item.deleted ? (
              <Text style={styles.deletedText}>This message was deleted</Text>
            ) : item.type === "text" ? (
              <Text style={[styles.messageText, { color: isSender ? "#fff" : "#000" }]}>
                {item.text} {item.edited && <Text style={styles.editedText}>(edited)</Text>}
              </Text>
            ) : (
              <Image source={{ uri: item.imageUrl }} style={styles.imageMessage} />
            )}

            {item.type === "text" && !item.deleted && (
              <View style={styles.timestampWrapperInline}>
                <Text style={styles.timestamp}>{formatTime(item.timeStamp)}</Text>
                {isSender && (
                  <Ionicons
                    name={item.seen ? "checkmark-done" : "checkmark"}
                    size={14}
                    color={item.seen ? "#1e90ff" : "#555"}
                    style={{ marginLeft: 4 }}
                  />
                )}
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
};

// --- Main Chat Component ---
export default function Chat() {
  const router = useRouter();
  const { userId: receiverParamId } = useLocalSearchParams();

  const [parentUserId, setParentUserId] = useState(null);
  const [receiverUserId, setReceiverUserId] = useState(null);
  const [receiverProfile, setReceiverProfile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);

  const flatListRef = useRef();

  // Fetch parent
  useEffect(() => {
    const fetchParent = async () => {
      try {
        const parentId = await AsyncStorage.getItem("parentId");
        if (!parentId) throw new Error("No parent ID found");
        const snap = await get(ref(database, `Parents/${parentId}`));
        if (!snap.exists()) throw new Error("Parent not found");
        setParentUserId(snap.val().userId);
      } catch (err) {
        Alert.alert("Error", err.message);
        router.back();
      }
    };
    fetchParent();
  }, []);

  // Request media permissions
  useEffect(() => {
    (async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") alert("Media library permission needed!");
    })();
  }, []);

  // Fetch receiver profile
  useEffect(() => {
    if (!receiverParamId) return;
    const fetchReceiver = async () => {
      try {
        let userId = null;
        const roles = ["Students", "Teachers", "School_Admins"];
        for (let role of roles) {
          const snap = await get(child(ref(database), `${role}/${receiverParamId}`));
          if (snap.exists()) {
            userId = snap.val().userId;
            break;
          }
        }
        if (!userId) return alert("Receiver not found!");
        setReceiverUserId(userId);

        const profileSnap = await get(child(ref(database), `Users/${userId}`));
        setReceiverProfile({
          name: profileSnap.exists() ? profileSnap.val().name : "User",
          image: profileSnap.exists() ? profileSnap.val().profileImage || null : null,
        });
      } catch (err) {
        console.log("Fetch receiver error:", err);
      }
    };
    fetchReceiver();
  }, [receiverParamId]);

  const chatId = useMemo(() => {
    if (!parentUserId || !receiverUserId) return null;
    return [parentUserId, receiverUserId].sort().join("_");
  }, [parentUserId, receiverUserId]);

  // Listen for messages
  useEffect(() => {
    if (!chatId) return;
    const messagesRef = ref(database, `Chats/${chatId}/messages`);
    const unsubscribe = onValue(messagesRef, async (snapshot) => {
      const data = snapshot.val() || {};
      const formatted = Object.entries(data)
        .map(([key, value]) => ({ ...value, messageId: key }))
        .sort((a, b) => a.timeStamp - b.timeStamp);
      setMessages(formatted);

      // Update seen messages
      const unseenUpdates = {};
      formatted.forEach((msg) => {
        if (!msg.seen && msg.receiverId === parentUserId) {
          unseenUpdates[`${msg.messageId}/seen`] = true;
        }
      });
      if (Object.keys(unseenUpdates).length > 0) await update(messagesRef, unseenUpdates);
    });
    return () => unsubscribe();
  }, [chatId, parentUserId]);

  // Send Text Message
  const sendMessage = async () => {
    if (!newMessage.trim() || !chatId) return;
    const messagesRef = ref(database, `Chats/${chatId}`);
    const newMsgRef = push(ref(database, `Chats/${chatId}/messages`));

    const messageData = {
      messageId: newMsgRef.key,
      senderId: parentUserId,
      receiverId: receiverUserId,
      text: newMessage,
      imageUrl: null,
      replyTo: replyingTo?.messageId || null,
      seen: false,
      edited: false,
      deleted: false,
      timeStamp: Date.now(),
      type: "text",
    };

    await update(newMsgRef, messageData);

    await update(messagesRef, {
      lastMessage: {
        text: newMessage,
        senderId: parentUserId,
        seen: false,
        timeStamp: messageData.timeStamp,
      },
      unread: {
        [receiverUserId]: (await get(ref(database, `Chats/${chatId}/unread/${receiverUserId}`))).val()
          ? (await get(ref(database, `Chats/${chatId}/unread/${receiverUserId}`))).val() + 1
          : 1,
        [parentUserId]: 0,
      },
      participants: {
        [parentUserId]: true,
        [receiverUserId]: true,
      },
    });

    setNewMessage("");
    setReplyingTo(null);
    setShowEmoji(false);
  };

  // Pick Image
  const pickImage = async () => {
    if (!chatId) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
      if (result.canceled) return;

      const uri = result.assets[0].uri;
      const blob = await (await fetch(uri)).blob();
      const storageReference = storageRef(storage, `chatImages/${Date.now()}.jpg`);
      await uploadBytes(storageReference, blob);
      const downloadURL = await getDownloadURL(storageReference);

      const messagesRef = ref(database, `Chats/${chatId}`);
      const newMsgRef = push(ref(database, `Chats/${chatId}/messages`));

      const messageData = {
        messageId: newMsgRef.key,
        senderId: parentUserId,
        receiverId: receiverUserId,
        text: "",
        imageUrl: downloadURL,
        replyTo: replyingTo?.messageId || null,
        seen: false,
        edited: false,
        deleted: false,
        timeStamp: Date.now(),
        type: "image",
      };

      await update(newMsgRef, messageData);

      await update(messagesRef, {
        lastMessage: {
          text: "📷 Image",
          senderId: parentUserId,
          seen: false,
          timeStamp: messageData.timeStamp,
        },
        unread: {
          [receiverUserId]: (await get(ref(database, `Chats/${chatId}/unread/${receiverUserId}`))).val()
            ? (await get(ref(database, `Chats/${chatId}/unread/${receiverUserId}`))).val() + 1
            : 1,
          [parentUserId]: 0,
        },
        participants: {
          [parentUserId]: true,
          [receiverUserId]: true,
        },
      });

      setReplyingTo(null);
    } catch (err) {
      Alert.alert("Error", "Failed to send image");
      console.log(err);
    }
  };

  // Render Item
  const renderItem = ({ item, index }) => {
    const isSender = item.senderId === parentUserId;
    const repliedMsg = item.replyTo ? messages.find((m) => m.messageId === item.replyTo) : null;

    const prevMsg = messages[index - 1];
    const nextMsg = messages[index + 1];
    const isFirstInGroup = !prevMsg || prevMsg.senderId !== item.senderId;
    const isLastInGroup = !nextMsg || nextMsg.senderId !== item.senderId;

    return (
      <MessageBubble
        item={item}
        isSender={isSender}
        repliedMsg={repliedMsg}
        onLongPress={(msg) => setSelectedMessage(msg)}
        onPressReplyPreview={(msg) => {
          const idx = messages.findIndex((m) => m.messageId === msg.messageId);
          flatListRef.current?.scrollToIndex({ index: messages.length - 1 - idx, animated: true });
        }}
        isFirstInGroup={isFirstInGroup}
        isLastInGroup={isLastInGroup}
      />
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#e5ddd5" }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back-outline" size={28} />
          </TouchableOpacity>
          {receiverProfile && (
            <View style={styles.profileContainer}>
              {receiverProfile.image ? (
                <Image source={{ uri: receiverProfile.image }} style={styles.profileImage} />
              ) : (
                <View style={styles.profilePlaceholder} />
              )}
              <Text style={styles.topBarTitle}>{receiverProfile.name}</Text>
            </View>
          )}
          <View style={{ width: 28 }} />
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages.slice().reverse()}
          keyExtractor={(item) => item.messageId}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, paddingBottom: 120 }}
          inverted
          showsVerticalScrollIndicator={false}
        />

        {/* Replying */}
        {replyingTo && (
          <View style={styles.replyContainer}>
            <Text style={styles.replyText}>Replying to: {replyingTo.text?.slice(0, 50) || "Image..."}</Text>
            <TouchableOpacity onPress={() => setReplyingTo(null)}>
              <Text style={styles.cancelReply}>X</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Emoji Selector */}
        {showEmoji && (
          <View style={{ height: 250 }}>
            <EmojiSelector onEmojiSelected={(emoji) => setNewMessage((prev) => prev + emoji)} showSearchBar={false} columns={8} />
          </View>
        )}

        {/* Input */}
        <View style={{ paddingBottom: Platform.OS === "ios" ? 25 : 10, backgroundColor: "#fff" }}>
          <View style={styles.inputContainer}>
            <TouchableOpacity onPress={() => setShowEmoji((prev) => !prev)}>
              <Ionicons name="happy-outline" size={28} style={{ marginRight: 8 }} />
            </TouchableOpacity>
            <TextInput style={styles.input} value={newMessage} onChangeText={setNewMessage} placeholder="Type a message..." />
            <TouchableOpacity onPress={pickImage} style={{ marginRight: 8 }}>
              <Ionicons name="attach-outline" size={28} color="#555" />
            </TouchableOpacity>
            <TouchableOpacity onPress={sendMessage} style={styles.sendBtn}>
              <Ionicons name="send" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileContainer: { flexDirection: "row", alignItems: "center", marginLeft: 12 },
  profileImage: { width: 36, height: 36, borderRadius: 18 },
  profilePlaceholder: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#ccc" },
  topBarTitle: { fontSize: 18, fontWeight: "600", marginLeft: 10 },

  messageRow: { marginVertical: 2 },

  messageBubble: {
    padding: 10,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  senderMsg: { backgroundColor: "#1e90ff", alignSelf: "flex-end" },
  receiverMsg: { backgroundColor: "#f0f0f0", alignSelf: "flex-start" },

  messageText: { fontSize: 16 },
  editedText: { fontSize: 10, fontStyle: "italic", color: "#555" },
  deletedText: { fontSize: 14, fontStyle: "italic", color: "#888" },

  timestampWrapperInline: { flexDirection: "row", alignItems: "flex-end", marginLeft: 4 },
  timestamp: { fontSize: 10, color: "#555", marginLeft: 4 },

  imageMessage: { width: 180, height: 180, borderRadius: 10 },

  replyPreviewContainer: { borderLeftWidth: 3, borderLeftColor: "#888", paddingLeft: 6, marginBottom: 4 },
  replyLine: { height: 1 },
  replyTextPreview: { fontSize: 12 },

  inputContainer: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6 },
  input: { flex: 1, fontSize: 16, paddingVertical: 6 },
  sendBtn: { backgroundColor: "#1e90ff", padding: 10, borderRadius: 20 },

  replyContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "#eee", padding: 6, borderLeftWidth: 3, borderLeftColor: "#1e90ff" },
  replyText: { flex: 1, fontSize: 14, color: "#333" },
  cancelReply: { fontSize: 14, color: "#555", marginLeft: 6 },
});
