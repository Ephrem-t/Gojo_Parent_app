// app/chat.jsx
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { onValue, push, ref } from "firebase/database";
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
} from "react-native";
import { database } from "../constants/firebaseConfig";

export default function Chat() {
  const router = useRouter();
  const { userId, name } = useLocalSearchParams(); // <-- correct hook
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");

  const chatId = `parent_${userId}`; // unique chat ID between parent and user

  useEffect(() => {
    const messagesRef = ref(database, `chats/${chatId}`);
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val() || {};
      const formatted = Object.values(data);
      setMessages(formatted);
    });

    return () => unsubscribe();
  }, [chatId]);

  const sendMessage = () => {
    if (!newMessage.trim()) return;
    const messagesRef = ref(database, `chats/${chatId}`);
    push(messagesRef, {
      sender: "parent",
      text: newMessage,
      timestamp: Date.now(),
    });
    setNewMessage("");
  };

  const renderItem = ({ item }) => (
    <View
      style={[
        styles.message,
        item.sender === "parent" ? styles.parentMsg : styles.userMsg,
      ]}
    >
      <Text style={styles.messageText}>{item.text}</Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f0f2f5" }}>
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
        data={messages.sort((a, b) => a.timestamp - b.timestamp)}
        keyExtractor={(_, index) => index.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 12 }}
      />

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.inputContainer}
      >
        <TextInput
          style={styles.input}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Type a message..."
        />
        <TouchableOpacity onPress={sendMessage} style={styles.sendBtn}>
          <Ionicons name="send" size={24} color="#fff" />
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    height: 70,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
  },
  topBarTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "bold",
  },
  message: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
    maxWidth: "70%",
  },
  parentMsg: {
    backgroundColor: "#1e90ff",
    alignSelf: "flex-end",
  },
  userMsg: {
    backgroundColor: "#e0e0e0",
    alignSelf: "flex-start",
  },
  messageText: {
    color: "#fff",
  },
  inputContainer: {
    flexDirection: "row",
    padding: 10,
    backgroundColor: "#fff",
    alignItems: "center",
  },
  input: {
    flex: 1,
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  sendBtn: {
    backgroundColor: "#1e90ff",
    padding: 10,
    borderRadius: 20,
    marginLeft: 8,
  },
});
