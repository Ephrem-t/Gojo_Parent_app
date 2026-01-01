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
  Modal,
  Pressable,
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

// --- MessageBubble ---
const MessageBubble = ({
  item,
  isSender,
  showAvatar,
  repliedMsg,
  onLongPress,
  onPressReplyPreview,
  receiverProfile,
}) => {
  const screenWidth = Dimensions.get("window").width;
  const maxBubbleWidth = screenWidth * 0.75;

  let bubbleWidth = maxBubbleWidth;
  if (item.type === "text") {
    const estimatedWidth = 20 + item.text.length * 7;
    bubbleWidth = Math.min(estimatedWidth, maxBubbleWidth);
  } else if (item.type === "image") {
    bubbleWidth = 200;
  }

  return (
    <View style={[styles.messageRow, { flexDirection: isSender ? "row-reverse" : "row" }]}>
      {!isSender && showAvatar && receiverProfile?.image && (
        <Image source={{ uri: receiverProfile.image }} style={styles.receiverAvatar} />
      )}

      <TouchableOpacity onLongPress={() => onLongPress(item)} activeOpacity={0.9}>
        <View
          style={[
            styles.messageBubble,
            isSender ? styles.senderMsg : styles.receiverMsg,
            { maxWidth: bubbleWidth, minWidth: 50 },
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

          {item.deleted ? (
            <Text style={styles.deletedText}>This message was deleted</Text>
          ) : item.type === "text" ? (
            <View style={styles.messageTextColumn}>
              <Text style={[styles.messageText, !isSender && { color: "#000" }]}>
                {item.text} {item.edited && <Text style={styles.editedText}>(edited)</Text>}
              </Text>
              <View style={styles.timestampWrapperBottomRight}>
                <Text style={styles.timestamp}>{formatTime(item.timeStamp)}</Text>
                {isSender && !item.deleted && (
                  <Ionicons
                    name={item.seen ? "checkmark-done" : "checkmark"}
                    size={14}
                    color={item.seen ? "#1e90ff" : "#555"}
                    style={{ marginLeft: 4 }}
                  />
                )}
              </View>
            </View>
          ) : (
            <Image source={{ uri: item.imageUrl }} style={styles.imageMessage} />
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
};

// --- Chat Component ---
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
  const [showActionModal, setShowActionModal] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editText, setEditText] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);

  const flatListRef = useRef();

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

  useEffect(() => {
    (async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") alert("Media library permission needed!");
    })();
  }, []);

  useEffect(() => {
    if (!receiverParamId) return;
    const fetchReceiver = async () => {
      try {
        let userId = null;
        let name = null;
        const roles = ["Students", "Teachers", "School_Admins"];
        for (let role of roles) {
          const snap = await get(child(ref(database), `${role}/${receiverParamId}`));
          if (snap.exists()) {
            userId = snap.val().userId;
            name = snap.val().name || role.slice(0, -1);
            break;
          }
        }
        if (!userId) return alert("Receiver not found!");
        setReceiverUserId(userId);

        const profileSnap = await get(child(ref(database), `Users/${userId}`));
        setReceiverProfile({
          name,
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

  useEffect(() => {
    if (!chatId) return;
    const messagesRef = ref(database, `Chats/${chatId}/messages`);
    const unsubscribe = onValue(messagesRef, async (snapshot) => {
      const data = snapshot.val() || {};
      const formatted = Object.entries(data)
        .map(([key, value]) => ({
          ...value,
          messageId: key,
          type: value.type || "text",
        }))
        .sort((a, b) => a.timeStamp - b.timeStamp);
      setMessages(formatted);

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

  const sendMessage = async () => {
    if (!newMessage.trim() || !chatId) return;
    const messagesRef = ref(database, `Chats/${chatId}/messages`);
    const newMsgRef = push(messagesRef);
    await update(newMsgRef, {
      messageId: newMsgRef.key,
      senderId: parentUserId,
      receiverId: receiverUserId,
      text: newMessage,
      imageUrl: null,
      seen: false,
      edited: false,
      deleted: false,
      timeStamp: Date.now(),
      type: "text",
      replyTo: replyingTo?.messageId || null,
    });
    setNewMessage("");
    setShowEmoji(false);
    setReplyingTo(null);
  };

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

      const messagesRef = ref(database, `Chats/${chatId}/messages`);
      const newMsgRef = push(messagesRef);
      await update(newMsgRef, {
        messageId: newMsgRef.key,
        senderId: parentUserId,
        receiverId: receiverUserId,
        text: "",
        imageUrl: downloadURL,
        seen: false,
        edited: false,
        deleted: false,
        timeStamp: Date.now(),
        type: "image",
        replyTo: replyingTo?.messageId || null,
      });
      setReplyingTo(null);
    } catch (err) {
      Alert.alert("Error", "Failed to send image");
      console.log(err);
    }
  };

  const deleteMessage = async (msg) => {
    if (!chatId) return;
    await update(ref(database, `Chats/${chatId}/messages/${msg.messageId}`), { deleted: true });
  };
  const editMessage = (msg) => { setSelectedMessage(msg); setEditText(msg.text); setEditModalVisible(true); };
  const saveEditedMessage = async () => {
    if (!editText.trim() || !selectedMessage || !chatId) return;
    await update(ref(database, `Chats/${chatId}/messages/${selectedMessage.messageId}`), { text: editText, edited: true });
    setEditModalVisible(false);
    setSelectedMessage(null);
    setEditText("");
  };
  const onLongPressMessage = (msg) => { setSelectedMessage(msg); setShowActionModal(true); };
  const scrollToMessage = (msg) => {
    const index = messages.findIndex((m) => m.messageId === msg.messageId);
    if (index >= 0 && flatListRef.current) {
      try { flatListRef.current.scrollToIndex({ index: messages.length - 1 - index, animated: true }); } catch {}
    }
  };

  const renderItem = ({ item, index }) => {
    const isSender = item.senderId === parentUserId;
    const repliedMsg = item.replyTo ? messages.find((m) => m.messageId === item.replyTo) : null;
    const showAvatar = !isSender && (index === 0 || messages[index - 1].senderId !== item.senderId);
    return (
      <MessageBubble
        item={item}
        isSender={isSender}
        showAvatar={showAvatar}
        repliedMsg={repliedMsg}
        onLongPress={onLongPressMessage}
        onPressReplyPreview={scrollToMessage}
        receiverProfile={receiverProfile}
      />
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#e5ddd5" }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back-outline" size={28} /></TouchableOpacity>
          {receiverProfile && (
            <View style={styles.profileContainer}>
              {receiverProfile.image ? <Image source={{ uri: receiverProfile.image }} style={styles.profileImage} /> : <View style={styles.profilePlaceholder} />}
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
        {replyingTo && <View style={styles.replyContainer}>
          <Text style={styles.replyText}>Replying to: {replyingTo.text?.slice(0, 50) || "Image..."}</Text>
          <TouchableOpacity onPress={() => setReplyingTo(null)}><Text style={styles.cancelReply}>X</Text></TouchableOpacity>
        </View>}

        {/* Emoji Selector */}
        {showEmoji && <View style={{ height: 250 }}>
          <EmojiSelector onEmojiSelected={(emoji) => setNewMessage((prev) => prev + emoji)} showSearchBar={false} columns={8} />
        </View>}

        {/* Input */}
        <View style={{ paddingBottom: Platform.OS === "ios" ? 25 : 10, backgroundColor: "#fff" }}>
          <View style={styles.inputContainer}>
            <TouchableOpacity onPress={() => setShowEmoji((prev) => !prev)}><Ionicons name="happy-outline" size={28} style={{ marginRight: 8 }} /></TouchableOpacity>
            <TextInput style={styles.input} value={newMessage} onChangeText={setNewMessage} placeholder="Type a message..." />
            <TouchableOpacity onPress={pickImage} style={{ marginRight: 8 }}><Ionicons name="attach-outline" size={28} color="#555" /></TouchableOpacity>
            <TouchableOpacity onPress={sendMessage} style={styles.sendBtn}><Ionicons name="send" size={24} color="#fff" /></TouchableOpacity>
          </View>
        </View>

        {/* Action Modal */}
        <Modal visible={showActionModal} transparent animationType="fade" onRequestClose={() => setShowActionModal(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowActionModal(false)}>
            <View style={styles.modalContent}>
              {selectedMessage && selectedMessage.senderId === parentUserId && !selectedMessage.deleted && <>
                <Pressable onPress={() => { editMessage(selectedMessage); setShowActionModal(false); }}><Text style={styles.modalOption}>Edit</Text></Pressable>
                <Pressable onPress={() => { deleteMessage(selectedMessage); setShowActionModal(false); }}><Text style={[styles.modalOption, { color: "red" }]}>Delete</Text></Pressable>
              </>}
              {!selectedMessage?.deleted && <Pressable onPress={() => { setReplyingTo(selectedMessage); setShowActionModal(false); }}><Text style={styles.modalOption}>Reply</Text></Pressable>}
              <Pressable onPress={() => setShowActionModal(false)}><Text style={styles.modalOption}>Cancel</Text></Pressable>
            </View>
          </Pressable>
        </Modal>

        {/* Edit Modal */}
        <Modal visible={editModalVisible} transparent animationType="fade" onRequestClose={() => setEditModalVisible(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setEditModalVisible(false)}>
            <View style={styles.modalContent}>
              <Text style={{ fontSize: 16, marginBottom: 10 }}>Edit Message:</Text>
              <TextInput value={editText} onChangeText={setEditText} style={{ backgroundColor: "#f0f0f0", padding: 10, borderRadius: 8, marginBottom: 12 }} />
              <Pressable onPress={saveEditedMessage} style={{ backgroundColor: "#0088cc", padding: 10, borderRadius: 8 }}>
                <Text style={{ color: "#fff", textAlign: "center", fontWeight: "bold" }}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", height: 70, paddingHorizontal: 12, backgroundColor: "#fff", borderBottomWidth: 0.5, borderBottomColor: "#ccc", justifyContent: "space-between" },
  profileContainer: { flexDirection: "row", alignItems: "center" },
  profileImage: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  profilePlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#ccc", marginRight: 10 },
  topBarTitle: { fontSize: 18, fontWeight: "600", color: "#000" },

  messageRow: { marginVertical: 4 },
  messageBubble: { paddingHorizontal: 12, paddingVertical: 8, maxWidth: "75%", borderRadius: 20, flexShrink: 1 },
  senderMsg: { backgroundColor: "#0088cc", alignSelf: "flex-end", borderTopRightRadius: 5 },
  receiverMsg: { backgroundColor: "#f0f0f0", alignSelf: "flex-start", borderTopLeftRadius: 5 },

  messageTextColumn: { flexDirection: "column", alignSelf: "flex-start", flexShrink: 1, minWidth: 50 },
  messageText: { fontSize: 16, color: "#fff" },
  editedText: { fontSize: 12, fontStyle: "italic", color: "#eee" },
  timestampWrapperBottomRight: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", marginTop: 2 },
  timestamp: { fontSize: 10, color: "#ccc" },

  deletedText: { fontSize: 14, fontStyle: "italic", color: "#999" },
  imageMessage: { width: 200, height: 200, borderRadius: 12, marginTop: 4 },

  receiverAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: 8 },

  inputContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "#f5f5f5", paddingHorizontal: 8, paddingVertical: 6, borderRadius: 25, marginHorizontal: 12, marginTop: 6 },
  input: { flex: 1, fontSize: 16, maxHeight: 100 },
  sendBtn: { backgroundColor: "#0088cc", padding: 10, borderRadius: 20 },

  replyPreviewContainer: { borderLeftWidth: 2, borderLeftColor: "#aaa", paddingLeft: 8, marginBottom: 4 },
  replyLine: { width: 2, backgroundColor: "#aaa", position: "absolute", left: 0, top: 0, bottom: 0 },
  replyTextPreview: { fontSize: 12, color: "#555" },

  replyContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "#eee", padding: 6, marginHorizontal: 12, borderRadius: 8, marginBottom: 4 },
  replyText: { flex: 1, fontSize: 14 },
  cancelReply: { fontWeight: "bold", marginLeft: 8, fontSize: 16 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "center", alignItems: "center" },
  modalContent: { backgroundColor: "#fff", padding: 20, borderRadius: 12, width: "80%" },
  modalOption: { fontSize: 16, paddingVertical: 8 },
});
