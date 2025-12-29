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
const MessageBubble = ({ item, isSender, repliedMsg, onLongPress, onPressReplyPreview }) => {
  return (
    <View style={[styles.messageRow, { flexDirection: isSender ? "row-reverse" : "row" }]}>
      <TouchableOpacity onLongPress={() => onLongPress(item)} activeOpacity={0.9}>
        <View style={[styles.messageBubble, isSender ? styles.senderMsg : styles.receiverMsg]}>
          
          {/* Reply Preview */}
          {repliedMsg && (
            <TouchableOpacity onPress={() => onPressReplyPreview(repliedMsg)} activeOpacity={0.7}>
              <View style={styles.replyPreviewContainer}>
                <View style={styles.replyLine} />
                <Text style={styles.replyTextPreview}>
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
            <Text style={[styles.messageText, !isSender && { color: "#000" }]}>
              {item.text} {item.edited && <Text style={styles.editedText}>(edited)</Text>}
            </Text>
          ) : (
            <Image source={{ uri: item.imageUrl }} style={styles.imageMessage} />
          )}

          <View style={styles.timestampRow}>
            <Text style={styles.timestamp}>{formatTime(item.timeStamp)}</Text>
            {isSender && !item.deleted && (
              <Ionicons
                name={item.seen ? "checkmark-done" : "checkmark"}
                size={14}
                color={item.seen ? "#1e90ff" : "#555"}
                style={{ marginLeft: 4, alignSelf: "center" }}
              />
            )}
          </View>
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
      if (status !== "granted") alert("We need media library permissions to upload images!");
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

  const deleteMessage = async (msg) => { if (!chatId) return; await update(ref(database, `Chats/${chatId}/messages/${msg.messageId}`), { deleted: true }); };
  const editMessage = (msg) => { setSelectedMessage(msg); setEditText(msg.text); setEditModalVisible(true); };
  const saveEditedMessage = async () => {
    if (!editText.trim() || !selectedMessage || !chatId) return;
    await update(ref(database, `Chats/${chatId}/messages/${selectedMessage.messageId}`), { text: editText, edited: true });
    setEditModalVisible(false); setSelectedMessage(null); setEditText("");
  };
  const onLongPressMessage = (msg) => { setSelectedMessage(msg); setShowActionModal(true); };

  const scrollToMessage = (msg) => {
    const index = messages.findIndex((m) => m.messageId === msg.messageId);
    if (index >= 0 && flatListRef.current) {
      try { flatListRef.current.scrollToIndex({ index: messages.length - 1 - index, animated: true }); } catch {}
    }
  };

  const renderItem = ({ item }) => {
    const isSender = item.senderId === parentUserId;
    const repliedMsg = item.replyTo ? messages.find((m) => m.messageId === item.replyTo) : null;
    return <MessageBubble item={item} isSender={isSender} repliedMsg={repliedMsg} onLongPress={onLongPressMessage} onPressReplyPreview={scrollToMessage} />;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#e5ddd5" }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back-outline" size={28} /></TouchableOpacity>
          {receiverProfile && <View style={styles.profileContainer}>
            {receiverProfile.image ? <Image source={{ uri: receiverProfile.image }} style={styles.profileImage} /> : <View style={styles.profilePlaceholder} />}
            <Text style={styles.topBarTitle}>{receiverProfile.name}</Text>
          </View>}
          <View style={{ width: 28 }} />
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages.slice().reverse()}
          keyExtractor={(item) => item.messageId}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, paddingBottom: 120 }} // <-- extra padding so last msg is visible
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
        <View style={{ paddingBottom: Platform.OS === "ios" ? 25 : 10, backgroundColor: "#ffffff" }}>
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
  container: { flex: 1, backgroundColor: "#e5ddd5" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    height: 70,
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 0.5,
    borderBottomColor: "#ccc",
    justifyContent: "space-between",
  },
  profileContainer: { flexDirection: "row", alignItems: "center" },
  profileImage: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  profilePlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#cccccc", marginRight: 10 },
  topBarTitle: { fontSize: 18, fontWeight: "600", color: "#000000" },
  
  messageRow: { marginVertical: 4 },
  messageBubble: { paddingHorizontal: 12, paddingVertical: 8, maxWidth: "80%", flexShrink: 1 },
  senderMsg: { backgroundColor: "#4288cfff", borderTopLeftRadius: 16, borderTopRightRadius: 16, borderBottomLeftRadius: 16, borderBottomRightRadius: 4 },
  receiverMsg: { backgroundColor: "#ffffff", borderTopLeftRadius: 16, borderTopRightRadius: 16, borderBottomRightRadius: 16, borderBottomLeftRadius: 4 },
  messageText: { fontSize: 16, color: "#ffffff" },
  editedText: { fontSize: 10, color: "#cccccc", marginLeft: 4 },
  imageMessage: { width: 200, height: 200, borderRadius: 12, marginVertical: 2 },
  timestampRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 2 },
  timestamp: { fontSize: 10, color: "#888888" },

  inputContainer: { flexDirection: "row", padding: 10, backgroundColor: "#ffffff", alignItems: "center" },
  input: { flex: 1, backgroundColor: "#f0f0f0", paddingHorizontal: 15, paddingVertical: 8, borderRadius: 25, fontSize: 16, color: "#000000", marginRight: 8 },
  sendBtn: { backgroundColor: "#0088cc", padding: 12, borderRadius: 25 },

  replyContainer: { flexDirection: "row", backgroundColor: "#f5f5f5", padding: 6, marginHorizontal: 12, borderRadius: 6, alignItems: "center", borderLeftWidth: 4, borderLeftColor: "#0088cc" },
  replyText: { flex: 1, fontSize: 14, color: "#555555" },
  cancelReply: { fontSize: 16, fontWeight: "bold", marginLeft: 8, color: "#555555" },

  replyPreviewContainer: { backgroundColor: "#f0f0f01f", padding: 6, borderRadius: 6, marginBottom: 4 },
  replyLine: { width: 3, backgroundColor: "#0099ffff", height: "100%", position: "absolute", left: 0, top: 0 },
  replyTextPreview: { paddingLeft: 8, color: "#ffffffff", fontSize: 14 },
  deletedText: { fontSize: 14, fontStyle: "italic", color: "#888888" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "center", alignItems: "center" },
  modalContent: { backgroundColor: "#ffffff", padding: 20, borderRadius: 12, width: 250 },
  modalOption: { fontSize: 16, paddingVertical: 8, color: "#000000" },
});
