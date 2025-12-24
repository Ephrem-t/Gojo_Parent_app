// app/chat.jsx
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ref, push, update, onValue } from "firebase/database";
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
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import EmojiSelector from "react-native-emoji-selector";
import { database, storage } from "../constants/firebaseConfig";

export default function Chat() {
  const router = useRouter();
  const { userId, name } = useLocalSearchParams();
  const parentUserId = "-OglQMkh2fGIV_cdRqUS"; // logged-in parent ID
  const chatId = `${parentUserId}_${userId}`;

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);

  // Request permissions for image picker
  useEffect(() => {
    (async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        alert("We need media library permissions to upload images!");
      }
    })();
  }, []);

  // Fetch messages in real-time
  useEffect(() => {
    const messagesRef = ref(database, `Chats/${chatId}/messages`);
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val() || {};
      const formatted = Object.values(data).sort((a, b) => a.timeStamp - b.timeStamp);
      setMessages(formatted);
    });

    return () => unsubscribe();
  }, [chatId]);

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    const messagesRef = ref(database, `Chats/${chatId}/messages`);
    const newMsgRef = push(messagesRef);

    const messageData = {
      messageId: newMsgRef.key,
      senderId: parentUserId,
      receiverId: userId,
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

  const pickImage = async () => {
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

        const messagesRef = ref(database, `Chats/${chatId}/messages`);
        const newMsgRef = push(messagesRef);

        const messageData = {
          messageId: newMsgRef.key,
          senderId: parentUserId,
          receiverId: userId,
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

  const renderItem = ({ item, index }) => {
    const isParent = item.senderId === parentUserId;
    const prevSenderId = messages[index - 1]?.senderId;
    const showMargin = prevSenderId && prevSenderId !== item.senderId;

    return (
      <View
        style={[
          styles.messageRow,
          { flexDirection: isParent ? "row-reverse" : "row", marginTop: showMargin ? 12 : 2 },
        ]}
      >
        <View style={[styles.messageBubble, isParent ? styles.parentMsg : styles.userMsg]}>
          {item.type === "text" ? (
            <Text style={[styles.messageText, !isParent && { color: "#000" }]}>{item.text}</Text>
          ) : (
            <Image source={{ uri: item.text }} style={styles.imageMessage} />
          )}
          <Text style={styles.timestamp}>
            {new Date(item.timeStamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
        </View>
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
        <Text style={styles.topBarTitle}>{name}</Text>
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

      {/* Input */}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#d0e6f6" },
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
  topBarTitle: { fontSize: 18, fontWeight: "bold" },
  messageRow: { alignItems: "flex-end" },
  messageBubble: {
    padding: 10,
    borderRadius: 15,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  parentMsg: { backgroundColor: "#1e90ff", borderTopRightRadius: 0 },
  userMsg: { backgroundColor: "#e0e0e0", borderTopLeftRadius: 0 },
  messageText: { fontSize: 16, color: "#fff" },
  imageMessage: { width: 200, height: 200, borderRadius: 10 },
  timestamp: { fontSize: 10, color: "#555", alignSelf: "flex-end", marginTop: 4 },
  inputContainer: { flexDirection: "row", padding: 10, backgroundColor: "#fff", alignItems: "center" },
  input: { flex: 1, backgroundColor: "#f0f0f0", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 25, fontSize: 16 },
  sendBtn: { backgroundColor: "#1e90ff", padding: 12, borderRadius: 25 },
});
