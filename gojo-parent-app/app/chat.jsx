// app/chat.jsx
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ref, push, update, onValue, get, child } from "firebase/database";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { useEffect, useState } from "react";
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
import { database, storage } from "../constants/firebaseConfig";

export default function Chat() {
  const router = useRouter();
  const { userId: receiverParamId } = useLocalSearchParams();
  const parentUserId = "-OhJQgw7yuwdSUYGX9Fd"; // logged-in parent ID

  const [receiverUserId, setReceiverUserId] = useState(null);
  const [receiverProfile, setReceiverProfile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);

  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editText, setEditText] = useState("");

  useEffect(() => {
    (async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        alert("We need media library permissions to upload images!");
      }
    })();
  }, []);

  // Fetch receiver profile
  useEffect(() => {
    const fetchReceiverUser = async () => {
      try {
        let userId = null;
        let name = null;

        const studentSnap = await get(child(ref(database), `Students/${receiverParamId}`));
        if (studentSnap.exists()) {
          userId = studentSnap.val().userId;
          name = studentSnap.val().name || "Student";
        }

        if (!userId) {
          const teacherSnap = await get(child(ref(database), `Teachers/${receiverParamId}`));
          if (teacherSnap.exists()) {
            userId = teacherSnap.val().userId;
            name = teacherSnap.val().name || "Teacher";
          }
        }

        if (!userId) {
          const adminSnap = await get(child(ref(database), `School_Admins/${receiverParamId}`));
          if (adminSnap.exists()) {
            userId = adminSnap.val().userId;
            name = adminSnap.val().name || "Admin";
          }
        }

        if (!userId) {
          alert("Receiver not found!");
          return;
        }

        setReceiverUserId(userId);

        const userSnap = await get(child(ref(database), `Users/${userId}`));
        if (userSnap.exists()) {
          const profileImage = userSnap.val().profileImage || null;
          setReceiverProfile({ name, image: profileImage });
        } else {
          setReceiverProfile({ name, image: null });
        }
      } catch (error) {
        console.log("Fetch receiver profile error:", error);
      }
    };

    fetchReceiverUser();
  }, [receiverParamId]);

  // Fetch messages & mark seen
  useEffect(() => {
    if (!receiverUserId) return;

    const chatId = `${parentUserId}_${receiverUserId}`;
    const messagesRef = ref(database, `Chats/${chatId}/messages`);

    const unsubscribe = onValue(messagesRef, async (snapshot) => {
      const data = snapshot.val() || {};

      const formatted = Object.entries(data)
        .map(([key, value]) => ({
          ...value,
          messageId: key,
          type: value.type || "text"
        }))
        .sort((a, b) => a.timeStamp - b.timeStamp);

      setMessages(formatted);

      for (let msg of formatted) {
        if (!msg.seen && msg.receiverId === parentUserId) {
          await update(ref(database, `Chats/${chatId}/messages/${msg.messageId}`), { seen: true });
        }
      }
    });

    return () => unsubscribe();
  }, [receiverUserId]);

  // Send text
  const sendMessage = async () => {
    if (!newMessage.trim() || !receiverUserId) return;

    const chatId = `${parentUserId}_${receiverUserId}`;
    const messagesRef = ref(database, `Chats/${chatId}/messages`);
    const newMsgRef = push(messagesRef);

    const messageData = {
      messageId: newMsgRef.key,
      senderId: parentUserId,
      receiverId: receiverUserId,
      text: newMessage,
      seen: false,
      edited: false,
      deleted: false,
      timeStamp: Date.now(),
      type: "text",
    };

    await update(newMsgRef, messageData);
    setNewMessage("");
    setShowEmoji(false);
  };

  // Pick image
  const pickImage = async () => {
    if (!receiverUserId) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });

      if (!result.canceled) {
        const imageUri = result.assets[0].uri;
        const response = await fetch(imageUri);
        const blob = await response.blob();

        const storageReference = storageRef(storage, `chatImages/${Date.now()}.jpg`);
        await uploadBytes(storageReference, blob);
        const downloadURL = await getDownloadURL(storageReference);

        const chatId = `${parentUserId}_${receiverUserId}`;
        const messagesRef = ref(database, `Chats/${chatId}/messages`);
        const newMsgRef = push(messagesRef);

        const messageData = {
          messageId: newMsgRef.key,
          senderId: parentUserId,
          receiverId: receiverUserId,
          text: downloadURL,
          seen: false,
          edited: false,
          deleted: false,
          timeStamp: Date.now(),
          type: "image",
        };

        await update(newMsgRef, messageData);
      }
    } catch (error) {
      console.log("Image upload error:", error);
    }
  };

  // Delete message
  const deleteMessage = async (msg) => {
    const chatId = `${parentUserId}_${receiverUserId}`;
    await update(ref(database, `Chats/${chatId}/messages/${msg.messageId}`), { deleted: true });
  };

  // Edit message
  const editMessage = (msg) => {
    setSelectedMessage(msg);
    setEditText(msg.text);
    setEditModalVisible(true);
  };

  const saveEditedMessage = async () => {
    if (!editText.trim() || !selectedMessage) return;

    const chatId = `${parentUserId}_${receiverUserId}`;
    await update(ref(database, `Chats/${chatId}/messages/${selectedMessage.messageId}`), {
      text: editText,
      edited: true,
    });

    setEditModalVisible(false);
    setSelectedMessage(null);
    setEditText("");
  };

  // Long press handler
  const onLongPressMessage = (msg) => {
    setSelectedMessage(msg);
    setShowActionModal(true);
  };

  // Render message
  const renderItem = ({ item }) => {
    const isParent = item.senderId === parentUserId;
    const messageType = item.type || "text";

    return (
      <View style={[styles.messageRow, { flexDirection: isParent ? "row-reverse" : "row" }]}>
        <TouchableOpacity onLongPress={() => onLongPressMessage(item)}>
          <View style={[styles.messageBubble, isParent ? styles.parentMsg : styles.userMsg]}>
            {item.deleted ? (
              <Text style={{ fontStyle: "italic", color: "#555" }}>This message was deleted</Text>
            ) : messageType === "text" ? (
              <Text style={[styles.messageText, !isParent && { color: "#000" }]}>
                {item.text} {item.edited && <Text style={{ fontSize: 10, color: isParent ? "#fff" : "#555" }}>(edited)</Text>}
              </Text>
            ) : (
              <Image source={{ uri: item.text }} style={styles.imageMessage} />
            )}

            <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 2 }}>
              <Text style={styles.timestamp}>
                {new Date(item.timeStamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
              {isParent && !item.deleted && (
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

  return (
    <SafeAreaView style={styles.container}>
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
        data={messages.slice().reverse()}
        keyExtractor={(item) => item.messageId}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 12, paddingBottom: 20 }}
        inverted
        showsVerticalScrollIndicator={false}
      />

      {/* Emoji Selector */}
      {showEmoji && (
        <View style={{ height: 250 }}>
          <EmojiSelector
            onEmojiSelected={(emoji) => setNewMessage((prev) => prev + emoji)}
            showSearchBar={false}
            columns={8}
          />
        </View>
      )}

      {/* Message Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.inputContainer}
      >
        <TouchableOpacity onPress={() => setShowEmoji((prev) => !prev)}>
          <Ionicons name="happy-outline" size={28} style={{ marginRight: 8 }} />
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Type a message..."
        />

        <TouchableOpacity onPress={pickImage} style={{ marginRight: 8 }}>
          <Ionicons name="attach-outline" size={28} color="#555" />
        </TouchableOpacity>

        <TouchableOpacity onPress={sendMessage} style={styles.sendBtn}>
          <Ionicons name="send" size={24} color="#fff" />
        </TouchableOpacity>
      </KeyboardAvoidingView>

      {/* Long Press Action Modal */}
      <Modal
        visible={showActionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActionModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowActionModal(false)}>
          <View style={styles.modalContent}>
            {selectedMessage && selectedMessage.senderId === parentUserId && !selectedMessage.deleted && (
              <>
                <Pressable onPress={() => { editMessage(selectedMessage); setShowActionModal(false); }}>
                  <Text style={styles.modalOption}>Edit</Text>
                </Pressable>
                <Pressable onPress={() => { deleteMessage(selectedMessage); setShowActionModal(false); }}>
                  <Text style={[styles.modalOption, { color: "red" }]}>Delete</Text>
                </Pressable>
              </>
            )}
            {!selectedMessage?.deleted && (
              <>
                <Pressable onPress={() => { Alert.alert("Forward", "Not implemented yet"); setShowActionModal(false); }}>
                  <Text style={styles.modalOption}>Forward</Text>
                </Pressable>
                <Pressable onPress={() => { Alert.alert("Reply", "Not implemented yet"); setShowActionModal(false); }}>
                  <Text style={styles.modalOption}>Reply</Text>
                </Pressable>
              </>
            )}
            <Pressable onPress={() => setShowActionModal(false)}>
              <Text style={styles.modalOption}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Edit Message Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setEditModalVisible(false)}>
          <View style={styles.modalContent}>
            <Text style={{ fontSize: 16, marginBottom: 10 }}>Edit Message:</Text>
            <TextInput
              value={editText}
              onChangeText={setEditText}
              style={{ backgroundColor: "#f0f0f0", padding: 10, borderRadius: 8, marginBottom: 12 }}
            />
            <Pressable
              onPress={saveEditedMessage}
              style={{ backgroundColor: "#0088cc", padding: 10, borderRadius: 8 }}
            >
              <Text style={{ color: "#fff", textAlign: "center", fontWeight: "bold" }}>Save</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f7f7f7" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    height: 70,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 0.5,
    borderBottomColor: "#ccc",
    justifyContent: "space-between",
  },
  profileContainer: { flexDirection: "row", alignItems: "center" },
  profileImage: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  profilePlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#ccc", marginRight: 10 },
  topBarTitle: { fontSize: 18, fontWeight: "bold" },

  messageRow: { alignItems: "flex-end", marginVertical: 4 },
  messageBubble: { padding: 10, borderRadius: 16, maxWidth: "75%" },
  parentMsg: { backgroundColor: "#0088cc", borderTopRightRadius: 4, borderTopLeftRadius: 16, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  userMsg: { backgroundColor: "#e5e5ea", borderTopLeftRadius: 4, borderTopRightRadius: 16, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  messageText: { fontSize: 16, color: "#fff" },
  imageMessage: { width: 200, height: 200, borderRadius: 15 },
  timestamp: { fontSize: 10, color: "#888", marginTop: 4, alignSelf: "flex-end" },

  inputContainer: { flexDirection: "row", padding: 10, backgroundColor: "#fff", alignItems: "center" },
  input: { flex: 1, backgroundColor: "#f0f0f0", paddingHorizontal: 15, paddingVertical: 8, borderRadius: 25, fontSize: 16 },
  sendBtn: { backgroundColor: "#0088cc", padding: 12, borderRadius: 25 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "center", alignItems: "center" },
  modalContent: { backgroundColor: "#fff", borderRadius: 12, padding: 20, minWidth: 200 },
  modalOption: { fontSize: 18, paddingVertical: 10 },
});
