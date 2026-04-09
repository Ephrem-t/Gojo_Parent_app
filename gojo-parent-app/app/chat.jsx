import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  StatusBar,
  TextInput,
  Platform,
  Alert,
  Keyboard,
  Modal,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ref, push, update, get, onValue, off, query, limitToLast } from "firebase/database";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import * as ImagePicker from "expo-image-picker";
import { database } from "../constants/firebaseConfig";
import { getOpenedChat, clearOpenedChat } from "./lib/chatStore";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import { getUserVal } from "./lib/userHelpers";
import { useParentTheme } from "../hooks/use-parent-theme";

const AVATAR_PLACEHOLDER = require("../assets/images/avatar_placeholder.png");
const CHAT_RECENT_MESSAGE_LIMIT = 80;

function fmtTime12(ts, amharic = false, oromo = false) {
  if (!ts) return "";
  try {
    const d = new Date(Number(ts));
    let h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, "0");
    const ampm = h >= 12 ? (amharic ? "ከሰዓት" : oromo ? "WB" : "PM") : amharic ? "ጥዋት" : oromo ? "WD" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m} ${ampm}`;
  } catch {
    return "";
  }
}

function stripTime(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function dateLabelForTs(ts, labels, amharic = false, oromo = false) {
  if (!ts) return "";
  const date = new Date(Number(ts));
  const today = new Date();
  const diffDays = Math.floor((stripTime(today) - stripTime(date)) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return labels.today;
  if (diffDays === 1) return labels.yesterday;
  return date.toLocaleDateString(amharic ? "am-ET" : oromo ? "om-ET" : undefined);
}

async function getPathPrefix() {
  const sk = (await AsyncStorage.getItem("schoolKey")) || null;
  return sk ? `Platform1/Schools/${sk}/` : "";
}

async function getDbRef(subPath) {
  const prefix = await getPathPrefix();
  return ref(database, `${prefix}${subPath}`);
}

function addChatSummaryUpdates(updates, prefix, payload) {
  const {
    chatId,
    senderId,
    receiverId,
    lastText,
    lastType,
    timeStamp,
    seen,
    senderUnread,
    receiverUnread,
  } = payload;

  if (!chatId || !senderId || !receiverId) return;

  updates[`${prefix}ChatSummaries/${senderId}/${chatId}`] = {
    chatId,
    otherUserId: receiverId,
    lastText: lastText || "",
    lastType: lastType || "text",
    lastTime: Number(timeStamp || Date.now()),
    lastSenderId: senderId,
    unread: Number(senderUnread || 0),
    seen: typeof seen === "boolean" ? seen : false,
    updatedAt: Number(timeStamp || Date.now()),
  };

  updates[`${prefix}ChatSummaries/${receiverId}/${chatId}`] = {
    chatId,
    otherUserId: senderId,
    lastText: lastText || "",
    lastType: lastType || "text",
    lastTime: Number(timeStamp || Date.now()),
    lastSenderId: senderId,
    unread: Number(receiverUnread || 1),
    seen: false,
    updatedAt: Number(timeStamp || Date.now()),
  };
}

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const storage = getStorage();
  const params = useLocalSearchParams();
  const { colors, statusBarStyle, isDark, amharic, oromo } = useParentTheme();
  const palette = useMemo(
    () => ({
      primary: colors.primary,
      muted: colors.mutedAlt,
      background: colors.background,
      card: colors.card,
      text: colors.text,
      textStrong: colors.textStrong,
      line: colors.lineSoft,
      border: colors.border,
      borderStrong: colors.borderStrong,
      avatarBg: colors.avatarPlaceholder,
      incomingBg: colors.chatIncoming,
      outgoingBg: colors.chatOutgoing,
      incomingText: colors.chatIncomingText,
      outgoingText: colors.chatOutgoingText,
      inputBg: colors.inputBackground,
      placeholder: colors.muted,
      sendDisabled: colors.surfaceMuted,
      sendDisabledIcon: isDark ? colors.mutedAlt : "#BFCBEF",
      overlay: colors.overlay,
      overlayStrong: colors.overlayStrong,
      viewerOverlay: isDark ? "rgba(1,4,9,0.95)" : "rgba(0,0,0,0.95)",
      outgoingMeta: isDark ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.85)",
      outgoingMetaStrong: isDark ? "rgba(255,255,255,0.94)" : "rgba(255,255,255,0.9)",
      seen: colors.heroSubtleText,
      seenMuted: isDark ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.78)",
      incomingImageBg: colors.surfaceMuted,
      outgoingImageBg: colors.primaryDark,
      danger: colors.danger,
      cancel: colors.mutedAlt,
      white: colors.white,
    }),
    [colors, isDark]
  );
  const styles = useMemo(() => createStyles(palette), [palette]);
  const labels = useMemo(
    () =>
      oromo
        ? {
            today: "Har'a",
            yesterday: "Kaleessa",
            conversation: "Haasa'aa",
            chatError: "Dogoggora chat",
            couldNotFindOrCreateChat: "Chat argachuu yookaan uumuu hin dandeenye",
            permissionRequired: "Eeyyamni barbaachisa",
            allowPhotoAccess: "Suuraa walqabsiisuuf eeyyama suuraa kenni.",
            missingSender: "Ergaan kan erge dhabame.",
            missingReceiver: "Kan fudhatu dhabame.",
            uploadFailed: "Olkaa'uun hin milkoofne",
            couldNotUploadImage: "Suuraa olkaa'uu hin dandeenye. Irra deebi'ii yaali.",
            sendFailed: "Erguun hin milkoofne",
            couldNotSendMessage: "Ergaa erguu hin dandeenye - irra deebi'ii yaali.",
            validation: "Mirkaneessa",
            messageCannotBeEmpty: "Ergaan duwwaa ta'uu hin danda'u.",
            error: "Dogoggora",
            failedToEditMessage: "Ergaa gulaaluu hin dandeenye.",
            failedToDeleteMessage: "Ergaa haquu hin dandeenye.",
            unavailable: "Hin argamu",
            profileCouldNotBeOpened: "Profaayiliin banamuu hin dandeenye.",
            imagePreview: "📷 Suuraa",
            messageDeleted: "Ergaan haqame",
            edited: "gulaalame",
            messagePlaceholder: "Ergaa",
            editMessage: "Ergaa gulaali",
            deleteMessage: "Ergaa haqi",
            cancel: "Dhiisi",
            save: "Kaa'i",
            editYourMessage: "Ergaa kee gulaali",
            roleLabels: {
              Child: "Ijoollee",
              Teacher: "Barsiisaa",
              Management: "Bulchiinsa",
              Registerer: "Galmeessaa",
              Finance: "Faayinaansii",
            },
          }
        : amharic
        ? {
            today: "ዛሬ",
            yesterday: "ትናንት",
            conversation: "ውይይት",
            chatError: "የውይይት ስህተት",
            couldNotFindOrCreateChat: "ውይይቱን ማግኘት ወይም መፍጠር አልተቻለም።",
            permissionRequired: "ፍቃድ ያስፈልጋል",
            allowPhotoAccess: "ምስሎችን ለማያያዝ የፎቶ ፍቃድን ይፍቀዱ።",
            missingSender: "ላኪ ጠፍቷል።",
            missingReceiver: "ተቀባይ ጠፍቷል።",
            uploadFailed: "ስቀል አልተሳካም",
            couldNotUploadImage: "ምስሉን መስቀል አልተቻለም። እንደገና ይሞክሩ።",
            sendFailed: "መላክ አልተሳካም",
            couldNotSendMessage: "መልዕክቱን መላክ አልተቻለም። እንደገና ይሞክሩ።",
            validation: "ማረጋገጫ",
            messageCannotBeEmpty: "መልዕክቱ ባዶ መሆን አይችልም።",
            error: "ስህተት",
            failedToEditMessage: "መልዕክቱን ማስተካከል አልተቻለም።",
            failedToDeleteMessage: "መልዕክቱን ማጥፋት አልተቻለም።",
            unavailable: "አይገኝም",
            profileCouldNotBeOpened: "የተጠቃሚው ፕሮፋይል ሊከፈት አልቻለም።",
            imagePreview: "📷 ምስል",
            messageDeleted: "መልዕክት ተሰርዟል",
            edited: "ተስተካክሏል",
            messagePlaceholder: "መልዕክት",
            editMessage: "መልዕክት ያስተካክሉ",
            deleteMessage: "መልዕክት ያጥፉ",
            cancel: "ይቅር",
            save: "አስቀምጥ",
            editYourMessage: "መልዕክትዎን ያስተካክሉ",
            roleLabels: {
              Child: "ልጅ",
              Teacher: "መምህር",
              Management: "አስተዳደር",
              Registerer: "ሬጅስትራር",
              Finance: "ፋይናንስ",
            },
          }
        : {
            today: "Today",
            yesterday: "Yesterday",
            conversation: "Conversation",
            chatError: "Chat error",
            couldNotFindOrCreateChat: "Could not find or create chat",
            permissionRequired: "Permission required",
            allowPhotoAccess: "Please allow access to photos to attach images.",
            missingSender: "Missing sender.",
            missingReceiver: "Missing receiver.",
            uploadFailed: "Upload failed",
            couldNotUploadImage: "Could not upload image. Try again.",
            sendFailed: "Send failed",
            couldNotSendMessage: "Could not send message - try again.",
            validation: "Validation",
            messageCannotBeEmpty: "Message cannot be empty.",
            error: "Error",
            failedToEditMessage: "Failed to edit message.",
            failedToDeleteMessage: "Failed to delete message.",
            unavailable: "Unavailable",
            profileCouldNotBeOpened: "User profile could not be opened.",
            imagePreview: "📷 Image",
            messageDeleted: "Message deleted",
            edited: "edited",
            messagePlaceholder: "Message",
            editMessage: "Edit message",
            deleteMessage: "Delete message",
            cancel: "Cancel",
            save: "Save",
            editYourMessage: "Edit your message",
            roleLabels: {
              Child: "Child",
              Teacher: "Teacher",
              Management: "Management",
              Registerer: "Registerer",
              Finance: "Finance",
            },
          },
    [amharic, oromo]
  );

  const routeChatId = typeof params.chatId === "string" ? params.chatId : "";
  const routeUserId = typeof params.userId === "string" ? params.userId : "";
  const routeContactName = typeof params.contactName === "string" ? params.contactName : "";
  const routeContactImage = typeof params.contactImage === "string" ? params.contactImage : "";

  const opened = getOpenedChat() || {};

  const [bootstrapped, setBootstrapped] = useState(false);

  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUserNodeKey, setCurrentUserNodeKey] = useState(null);

  const [chatId, setChatId] = useState("");
  const [contactUserId, setContactUserId] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactImage, setContactImage] = useState(null);
  const [contactSubtitle, setContactSubtitle] = useState("");

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [lastMessageMeta, setLastMessageMeta] = useState(null);

  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImageUri, setViewerImageUri] = useState(null);

  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [activeMessage, setActiveMessage] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editDraft, setEditDraft] = useState("");

  const messagesRefRef = useRef(null);
  const lastMessageRefRef = useRef(null);
  const flatListRef = useRef(null);

  const makeDeterministicChatId = (a, b) => `${a}_${b}`;

  const getResolvedUserId = useCallback(async () => {
    if (currentUserId) return currentUserId;

    let uId = await AsyncStorage.getItem("userId");
    if (uId) return uId;

    const nodeKey =
      (await AsyncStorage.getItem("userNodeKey")) ||
      (await AsyncStorage.getItem("studentNodeKey")) ||
      (await AsyncStorage.getItem("studentId")) ||
      null;

    if (!nodeKey) return null;

    try {
      const v = await getUserVal(nodeKey);
      return v ? (v.userId || nodeKey) : nodeKey;
    } catch {
      return nodeKey;
    }
  }, [currentUserId]);

  const findOrCreateChatId = useCallback(async (userA, userB, createIfMissing = true) => {
    if (!userA || !userB) return null;

    const c1 = makeDeterministicChatId(userA, userB);
    const c2 = makeDeterministicChatId(userB, userA);

    try {
      const s1 = await get(await getDbRef(`Chats/${c1}`));
      if (s1.exists()) return c1;

      const s2 = await get(await getDbRef(`Chats/${c2}`));
      if (s2.exists()) return c2;

      if (!createIfMissing) return null;

      const prefix = await getPathPrefix();
      const now = Date.now();

      const participants = { [userA]: true, [userB]: true };
      const lastMessage = {
        seen: false,
        senderId: userA,
        text: "",
        timeStamp: now,
        type: "system",
      };
      const unread = { [userA]: 0, [userB]: 0 };

      const updates = {};
      updates[`${prefix}Chats/${c1}/participants`] = participants;
      updates[`${prefix}Chats/${c1}/lastMessage`] = lastMessage;
      updates[`${prefix}Chats/${c1}/unread`] = unread;
      addChatSummaryUpdates(updates, prefix, {
        chatId: c1,
        senderId: userA,
        receiverId: userB,
        lastText: "",
        lastType: "system",
        timeStamp: now,
        seen: false,
        senderUnread: 0,
        receiverUnread: 0,
      });

      await update(ref(database), updates);
      return c1;
    } catch (err) {
      console.warn("[Chat] findOrCreateChatId error", err);
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        let uId = await AsyncStorage.getItem("userId");
        const nodeKey =
          (await AsyncStorage.getItem("userNodeKey")) ||
          (await AsyncStorage.getItem("studentNodeKey")) ||
          (await AsyncStorage.getItem("studentId")) ||
          null;

        if (!uId && nodeKey) {
          try {
            const uVal = await getUserVal(nodeKey);
            uId = uVal ? (uVal.userId || nodeKey) : nodeKey;
          } catch {
            uId = nodeKey;
          }
        }

        const initialChatId = opened.chatId || routeChatId || "";
        const initialContactUserId = opened.contactUserId || routeUserId || "";
        const initialContactName = opened.contactName || routeContactName || "";
        const initialContactImage = opened.contactImage || routeContactImage || null;

        if (!mounted) return;

        setCurrentUserId(uId || null);
        setCurrentUserNodeKey(nodeKey || null);
        setChatId(initialChatId);
        setContactUserId(initialContactUserId);
        setContactName(initialContactName);
        setContactImage(initialContactImage);
        setBootstrapped(true);

        clearOpenedChat();
      } catch (e) {
        console.warn("[Chat] bootstrap error", e);
        if (mounted) setBootstrapped(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [
    opened.chatId,
    opened.contactUserId,
    opened.contactName,
    opened.contactImage,
    routeChatId,
    routeUserId,
    routeContactName,
    routeContactImage,
  ]);

  useEffect(() => {
    const onShow = (e) => {
      setKeyboardVisible(true);
      setKeyboardHeight(e?.endCoordinates?.height || 300);
    };

    const onHide = () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    };

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const subShow = Keyboard.addListener(showEvent, onShow);
    const subHide = Keyboard.addListener(hideEvent, onHide);

    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const resolveContact = async () => {
      if (!bootstrapped) return;
      if (!currentUserId) return;

      let resolvedContactUserId = contactUserId;

      if (!resolvedContactUserId && chatId) {
        try {
          const chatSnap = await get(await getDbRef(`Chats/${chatId}`));
          if (!mounted || !chatSnap.exists()) return;

          const chatVal = chatSnap.val() || {};
          const participants = chatVal.participants || {};

          resolvedContactUserId =
            Object.keys(participants).find((id) => String(id) !== String(currentUserId)) || "";

          if (resolvedContactUserId && mounted) {
            setContactUserId(resolvedContactUserId);
          }
        } catch (e) {
          console.warn("[Chat] resolve participants error", e);
        }
      }

      if (!resolvedContactUserId) {
        if (mounted && !chatId) setLoading(false);
        return;
      }

      try {
        const userSnap = await get(await getDbRef(`Users/${resolvedContactUserId}`));
        if (!mounted) return;

        if (userSnap.exists()) {
          const val = userSnap.val() || {};
          setContactName((prev) => prev || val.name || val.username || labels.conversation);
          setContactImage((prev) => prev || val.profileImage || null);
          setContactSubtitle(val.role || "");
        }
      } catch (e) {
        console.warn("[Chat] load contact user error", e);
      }
    };

    resolveContact();

    return () => {
      mounted = false;
    };
  }, [bootstrapped, currentUserId, chatId, contactUserId, labels]);

  useEffect(() => {
    let mounted = true;

    const prepareChat = async () => {
      if (!bootstrapped) return;
      if (!currentUserId) return;

      if (chatId) return;
      if (!contactUserId) return;

      try {
        const resolvedChatId = await findOrCreateChatId(currentUserId, contactUserId, true);
        if (!resolvedChatId) {
          if (mounted) {
            setLoading(false);
            Alert.alert(labels.chatError, labels.couldNotFindOrCreateChat);
          }
          return;
        }

        if (mounted) setChatId(resolvedChatId);
      } catch (e) {
        console.warn("[Chat] prepareChat error", e);
        if (mounted) setLoading(false);
      }
    };

    prepareChat();

    return () => {
      mounted = false;
    };
  }, [bootstrapped, currentUserId, contactUserId, chatId, findOrCreateChatId, labels]);

  useEffect(() => {
    let mounted = true;

    const attach = async () => {
      if (!bootstrapped) return;
      if (!chatId) return;

      setLoading(true);

      const msgsRef = await getDbRef(`Chats/${chatId}/messages`);
      const recentMsgsQuery = query(msgsRef, limitToLast(CHAT_RECENT_MESSAGE_LIMIT));
      messagesRefRef.current = recentMsgsQuery;

      onValue(recentMsgsQuery, async (snap) => {
        if (!mounted) return;

        const arr = [];
        if (snap.exists()) {
          snap.forEach((childSnap) => {
            const data = childSnap.val() || {};
            arr.push({ ...data, messageId: data.messageId || childSnap.key });
          });
        }

        arr.sort((a, b) => Number(a.timeStamp || 0) - Number(b.timeStamp || 0));
        setMessages(arr);
        setLoading(false);

        if (currentUserId) {
          try {
            const prefix = await getPathPrefix();

            const unreadResetUpdates = {
              [`${prefix}Chats/${chatId}/unread/${currentUserId}`]: 0,
              [`${prefix}ChatSummaries/${currentUserId}/${chatId}/unread`]: 0,
              [`${prefix}ChatSummaries/${currentUserId}/${chatId}/seen`]: true,
              [`${prefix}ChatSummaries/${currentUserId}/${chatId}/updatedAt`]: Date.now(),
            };
            if (contactUserId) {
              unreadResetUpdates[`${prefix}ChatSummaries/${contactUserId}/${chatId}/seen`] = true;
            }

            await update(ref(database), unreadResetUpdates);

            const updates = {};
            arr.forEach((m) => {
              if (
                (String(m.receiverId) === String(currentUserId) ||
                  String(m.receiverId) === String(currentUserNodeKey)) &&
                !m.seen
              ) {
                updates[`${prefix}Chats/${chatId}/messages/${m.messageId}/seen`] = true;
              }
            });

            if (Object.keys(updates).length) {
              await update(ref(database), updates);
            }
          } catch {}
        }
      });
    };

    attach();

    return () => {
      mounted = false;
      if (messagesRefRef.current) {
        try {
          off(messagesRefRef.current);
        } catch {}
      }
    };
  }, [bootstrapped, chatId, currentUserId, currentUserNodeKey, contactUserId]);

  useEffect(() => {
    if (!bootstrapped || !chatId) {
      setLastMessageMeta(null);
      return;
    }

    (async () => {
      const lastRef = await getDbRef(`Chats/${chatId}/lastMessage`);
      lastMessageRefRef.current = lastRef;
      onValue(lastRef, (snap) => {
        if (snap.exists()) setLastMessageMeta(snap.val());
        else setLastMessageMeta(null);
      });
    })();

    return () => {
      try {
        if (lastMessageRefRef.current) off(lastMessageRefRef.current);
      } catch {}
      lastMessageRefRef.current = null;
    };
  }, [bootstrapped, chatId]);

  useEffect(() => {
    if (!messages.length) return;
    const t = setTimeout(() => {
      try {
        flatListRef.current?.scrollToEnd({ animated: true });
      } catch {}
    }, 120);
    return () => clearTimeout(t);
  }, [messages]);

  async function uriToBlob(uri) {
    return await new Promise((resolve, reject) => {
      try {
        const xhr = new XMLHttpRequest();
        xhr.onload = () => resolve(xhr.response);
        xhr.onerror = () => reject(new TypeError("Network request failed"));
        xhr.responseType = "blob";
        xhr.open("GET", uri, true);
        xhr.send(null);
      } catch (err) {
        reject(err);
      }
    });
  }

  const resolveReceiver = useCallback(async () => {
    const cu = await getResolvedUserId();
    if (!cu) return { senderId: null, receiverId: null };

    let receiverId = contactUserId;

    if (!receiverId && chatId) {
      try {
        const chatSnap = await get(await getDbRef(`Chats/${chatId}`));
        const participants = chatSnap.exists() ? chatSnap.val()?.participants || {} : {};
        receiverId = Object.keys(participants).find((id) => String(id) !== String(cu)) || "";
        if (receiverId) setContactUserId(receiverId);
      } catch {}
    }

    return { senderId: cu, receiverId };
  }, [contactUserId, chatId, getResolvedUserId]);

  async function pickImageAndSend() {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(labels.permissionRequired, labels.allowPhotoAccess);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsEditing: false,
      });

      const cancelled = result.cancelled ?? result.canceled;
      if (cancelled) return;

      const localUri = result.uri ?? result.assets?.[0]?.uri;
      if (!localUri) return;

      const { senderId, receiverId } = await resolveReceiver();

      if (!senderId) {
        Alert.alert(labels.chatError, labels.missingSender);
        return;
      }
      if (!receiverId) {
        Alert.alert(labels.chatError, labels.missingReceiver);
        return;
      }

      let chatKeyLocal = chatId;
      if (!chatKeyLocal) {
        chatKeyLocal = await findOrCreateChatId(senderId, receiverId, true);
        if (!chatKeyLocal) {
          Alert.alert(labels.chatError, labels.couldNotFindOrCreateChat);
          return;
        }
        setChatId(chatKeyLocal);
      }

      const messageId = push(await getDbRef(`Chats/${chatKeyLocal}/messages`)).key;
      const now = Date.now();

      setMessages((prev) => [
        ...prev,
        {
          messageId,
          senderId,
          receiverId,
          text: "",
          timeStamp: now,
          type: "image",
          imageUrl: localUri,
          uploading: true,
          edited: false,
          deleted: false,
          seen: false,
        },
      ]);

      const blob = await uriToBlob(localUri);
      const path = `chatImages/${chatKeyLocal}/${messageId}.jpg`;
      const storageReference = storageRef(storage, path);
      await uploadBytes(storageReference, blob);
      const downloadUrl = await getDownloadURL(storageReference);

      const prefix = await getPathPrefix();
      const messageObj = {
        messageId,
        senderId,
        receiverId,
        text: "",
        timeStamp: now,
        type: "image",
        imageUrl: downloadUrl,
        seen: false,
        edited: false,
        deleted: false,
      };

      const updates = {};
      updates[`${prefix}Chats/${chatKeyLocal}/messages/${messageId}`] = messageObj;
      updates[`${prefix}Chats/${chatKeyLocal}/lastMessage`] = {
        seen: false,
        senderId,
        text: labels.imagePreview,
        timeStamp: now,
        type: "image",
      };
      updates[`${prefix}Chats/${chatKeyLocal}/unread/${receiverId}`] = 1;
      updates[`${prefix}Chats/${chatKeyLocal}/unread/${senderId}`] = 0;
      addChatSummaryUpdates(updates, prefix, {
        chatId: chatKeyLocal,
        senderId,
        receiverId,
        lastText: labels.imagePreview,
        lastType: "image",
        timeStamp: now,
        seen: false,
        senderUnread: 0,
        receiverUnread: 1,
      });

      await update(ref(database), updates);
    } catch (err) {
      console.warn("[Chat:pickImageAndSend] error", err);
      Alert.alert(labels.uploadFailed, labels.couldNotUploadImage);
    }
  }

  async function sendMessage() {
    if (!text.trim()) return;

    setSending(true);
    try {
      const { senderId, receiverId } = await resolveReceiver();

      if (!senderId) {
        Alert.alert(labels.chatError, labels.missingSender);
        return;
      }
      if (!receiverId) {
        Alert.alert(labels.chatError, labels.missingReceiver);
        return;
      }

      let chatKeyLocal = chatId;
      if (!chatKeyLocal) {
        chatKeyLocal = await findOrCreateChatId(senderId, receiverId, true);
        if (!chatKeyLocal) {
          Alert.alert(labels.chatError, labels.couldNotFindOrCreateChat);
          return;
        }
        setChatId(chatKeyLocal);
      }

      const messageId = push(await getDbRef(`Chats/${chatKeyLocal}/messages`)).key;
      const now = Date.now();

      const messageObj = {
        messageId,
        senderId,
        receiverId,
        text: text.trim(),
        timeStamp: now,
        type: "text",
        seen: false,
        edited: false,
        deleted: false,
      };

      const prefix = await getPathPrefix();
      const updates = {};
      updates[`${prefix}Chats/${chatKeyLocal}/messages/${messageId}`] = messageObj;
      updates[`${prefix}Chats/${chatKeyLocal}/lastMessage`] = {
        seen: false,
        senderId,
        text: text.trim(),
        timeStamp: now,
        type: "text",
      };
      updates[`${prefix}Chats/${chatKeyLocal}/unread/${receiverId}`] = 1;
      updates[`${prefix}Chats/${chatKeyLocal}/unread/${senderId}`] = 0;
      addChatSummaryUpdates(updates, prefix, {
        chatId: chatKeyLocal,
        senderId,
        receiverId,
        lastText: text.trim(),
        lastType: "text",
        timeStamp: now,
        seen: false,
        senderUnread: 0,
        receiverUnread: 1,
      });

      await update(ref(database), updates);
      setText("");
    } catch (err) {
      console.warn("[Chat:send] error", err);
      Alert.alert(labels.sendFailed, labels.couldNotSendMessage);
    } finally {
      setSending(false);
    }
  }

  const openMessageActions = (m) => {
    const isMe =
      (currentUserId && String(m.senderId) === String(currentUserId)) ||
      (currentUserNodeKey && String(m.senderId) === String(currentUserNodeKey));

    if (!isMe || m.deleted) return;
    setActiveMessage(m);
    setActionSheetVisible(true);
  };

  const closeMessageActions = () => {
    setActionSheetVisible(false);
    setActiveMessage(null);
  };

  const startEditMessage = () => {
    if (!activeMessage || activeMessage.type !== "text") return;
    setEditDraft(activeMessage.text || "");
    setActionSheetVisible(false);
    setTimeout(() => setEditModalVisible(true), 120);
  };

  const doEditMessage = async () => {
    if (!activeMessage?.messageId || !chatId) return;
    const nextText = (editDraft || "").trim();
    if (!nextText) {
      Alert.alert(labels.validation, labels.messageCannotBeEmpty);
      return;
    }
    try {
      const prefix = await getPathPrefix();
      const updates = {};
      updates[`${prefix}Chats/${chatId}/messages/${activeMessage.messageId}/text`] = nextText;
      updates[`${prefix}Chats/${chatId}/messages/${activeMessage.messageId}/edited`] = true;
      await update(ref(database), updates);
      setEditModalVisible(false);
      setEditDraft("");
      setActiveMessage(null);
    } catch {
      Alert.alert(labels.error, labels.failedToEditMessage);
    }
  };

  const doDeleteMessage = async () => {
    if (!activeMessage?.messageId || !chatId) return;
    try {
      const prefix = await getPathPrefix();
      const updates = {};
      updates[`${prefix}Chats/${chatId}/messages/${activeMessage.messageId}/deleted`] = true;
      updates[`${prefix}Chats/${chatId}/messages/${activeMessage.messageId}/text`] = labels.messageDeleted;
      updates[`${prefix}Chats/${chatId}/messages/${activeMessage.messageId}/type`] = "text";
      await update(ref(database), updates);
      closeMessageActions();
    } catch {
      Alert.alert(labels.error, labels.failedToDeleteMessage);
    }
  };

  const openContactProfile = useCallback(() => {
    if (!contactUserId) {
      Alert.alert(labels.unavailable, labels.profileCouldNotBeOpened);
      return;
    }

    router.push({
      pathname: "/userProfile",
      params: {
        userId: contactUserId,
        contactName: contactName || "",
        contactImage: contactImage || "",
        fromChat: "1",
        chatId: chatId || "",
      },
    });
  }, [router, contactUserId, contactName, contactImage, chatId, labels]);

  function closeViewer() {
    setViewerVisible(false);
    setViewerImageUri(null);
  }

  async function openImageViewer(message) {
    const uri = message.imageUrl || message.imageUri || message.image || null;
    if (!uri) return;

    setViewerImageUri(uri);
    setViewerVisible(true);
  }

  const displayItems = useMemo(() => {
    const items = [];
    let lastDateLabel = null;

    messages.forEach((m) => {
      const label = dateLabelForTs(m.timeStamp, labels, amharic, oromo);
      if (label !== lastDateLabel) {
        items.push({ type: "date", id: `date-${m.timeStamp}`, label });
        lastDateLabel = label;
      }
      items.push({ type: "message", ...m });
    });

    return items;
  }, [messages, labels, amharic, oromo]);

  const renderDateSeparator = (label) => (
    <View style={styles.dateSeparator}>
      <View style={styles.dateLine} />
      <Text style={styles.dateText}>{label}</Text>
      <View style={styles.dateLine} />
    </View>
  );

  const renderSeenIcon = (message, isMe) => {
    if (!isMe) return null;

    const isLastMessage =
      lastMessageMeta &&
      Number(lastMessageMeta.timeStamp || 0) === Number(message.timeStamp || 0) &&
      String(lastMessageMeta.senderId || "") === String(message.senderId || "");

    const seen = !!message.seen || (isLastMessage && !!lastMessageMeta?.seen);

    return (
      <Ionicons
        name={seen ? "checkmark-done" : "checkmark"}
        size={14}
        color={seen ? palette.seen : palette.seenMuted}
        style={{ marginLeft: 6 }}
      />
    );
  };

  const renderMessage = ({ item, index }) => {
    if (item.type === "date") {
      return <View style={{ paddingVertical: 10 }}>{renderDateSeparator(item.label)}</View>;
    }

    const m = item;
    const isMe =
      (currentUserId && String(m.senderId) === String(currentUserId)) ||
      (currentUserNodeKey && String(m.senderId) === String(currentUserNodeKey));

    const prev = index > 0 ? displayItems[index - 1] : null;
    const prevSameSender = prev && prev.type === "message" && String(prev.senderId) === String(m.senderId);
    const showAvatar = !isMe && !prevSameSender;

    if (m.type === "image" && !m.deleted) {
      const imageSource = m.imageUrl ? { uri: m.imageUrl } : AVATAR_PLACEHOLDER;

      if (isMe) {
        return (
          <View style={[styles.messageRow, styles.messageRowRight]}>
            <View style={{ flex: 1 }} />
            <View style={{ marginRight: 8 }}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => openImageViewer(m)}
                onLongPress={() => openMessageActions(m)}
              >
                <Image source={imageSource} style={styles.outgoingImage} />
                <View style={styles.imageMeta}>
                  <Text style={styles.imageTime}>{fmtTime12(m.timeStamp, amharic, oromo)}</Text>
                  {renderSeenIcon(m, true)}
                </View>
              </TouchableOpacity>
              <View style={styles.rightTailContainer}>
                <View style={styles.rightTail} />
              </View>
            </View>
            <View style={{ width: 36 }} />
          </View>
        );
      }

      return (
        <View style={[styles.messageRow, styles.messageRowLeft]}>
          {showAvatar ? (
            <Image source={contactImage ? { uri: contactImage } : AVATAR_PLACEHOLDER} style={styles.msgAvatar} />
          ) : (
            <View style={{ width: 36 }} />
          )}
          <View style={{ width: 8 }} />
          <View>
            <TouchableOpacity activeOpacity={0.9} onPress={() => openImageViewer(m)}>
              <Image source={imageSource} style={styles.incomingImage} />
              <View style={styles.incomingImageMeta}>
                <Text style={styles.imageTimeIncoming}>{fmtTime12(m.timeStamp, amharic, oromo)}</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.leftTailContainer}>
              <View style={styles.leftTail} />
            </View>
          </View>
          <View style={{ flex: 1 }} />
        </View>
      );
    }

    return (
      <View style={[styles.messageRow, isMe ? styles.messageRowRight : styles.messageRowLeft]}>
        {!isMe && showAvatar && (
          <Image source={contactImage ? { uri: contactImage } : AVATAR_PLACEHOLDER} style={styles.msgAvatar} />
        )}
        {!isMe && !showAvatar && <View style={{ width: 36 }} />}

        <View style={[styles.bubbleWrap, isMe ? { alignItems: "flex-end" } : { alignItems: "flex-start" }]}>
          <TouchableOpacity
            activeOpacity={isMe ? 0.82 : 1}
            onLongPress={() => openMessageActions(m)}
            disabled={!isMe || m.deleted}
          >
            <View style={[styles.bubble, isMe ? styles.bubbleRight : styles.bubbleLeft]}>
              <Text style={[styles.bubbleText, isMe ? styles.bubbleTextRight : styles.bubbleTextLeft]}>
                {m.deleted ? labels.messageDeleted : m.text}
              </Text>

              <View style={styles.bubbleMetaRow}>
                {m.edited && !m.deleted ? (
                  <Text style={[styles.editedLabel, isMe ? styles.editedRight : styles.editedLeft]}>{labels.edited}</Text>
                ) : null}
                <Text style={[styles.bubbleTime, isMe ? styles.bubbleTimeRight : styles.bubbleTimeLeft]}>
                  {fmtTime12(m.timeStamp, amharic, oromo)}
                </Text>
                {renderSeenIcon(m, isMe)}
              </View>
            </View>
          </TouchableOpacity>

          {!isMe ? (
            <View style={styles.leftTailContainer}>
              <View style={styles.leftTail} />
            </View>
          ) : (
            <View style={styles.rightTailContainer}>
              <View style={styles.rightTail} />
            </View>
          )}
        </View>

        {isMe && <View style={{ width: 36 }} />}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { paddingTop: insets.top }]} edges={["bottom"]}>
      <StatusBar barStyle={statusBarStyle} backgroundColor={palette.background} translucent={false} />
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.back} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={palette.text} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerName} numberOfLines={1}>
              {contactName || labels.conversation}
            </Text>
            <Text style={styles.headerSub}>{labels.roleLabels[contactSubtitle] || contactSubtitle || ""}</Text>
          </View>

          <TouchableOpacity style={styles.headerRight} onPress={openContactProfile} activeOpacity={0.85}>
            <Image source={contactImage ? { uri: contactImage } : AVATAR_PLACEHOLDER} style={styles.headerAvatar} />
          </TouchableOpacity>
        </View>

        <View style={styles.messagesWrap}>
          {loading ? (
            <ActivityIndicator size="small" color={palette.primary} style={{ marginTop: 24 }} />
          ) : (
            <FlatList
              ref={flatListRef}
              data={displayItems}
              renderItem={renderMessage}
              keyExtractor={(it, idx) => (it.type === "date" ? it.id : it.messageId || `${it.timeStamp}-${idx}`)}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingVertical: 12,
                paddingBottom: 12 + (keyboardVisible ? keyboardHeight : 0),
              }}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            />
          )}
        </View>

        <View
          style={[
            styles.inputRow,
            {
              paddingBottom: Math.max(insets.bottom, 8),
              marginBottom: keyboardVisible ? keyboardHeight : 0,
            },
          ]}
        >
          <TouchableOpacity onPress={pickImageAndSend} style={styles.attachmentBtn}>
            <Ionicons name="image-outline" size={22} color={palette.muted} />
          </TouchableOpacity>

          <TextInput
            placeholder={labels.messagePlaceholder}
            placeholderTextColor={palette.placeholder}
            value={text}
            onChangeText={setText}
            style={styles.input}
            multiline
            returnKeyType="send"
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity
            style={[styles.sendBtn, text.trim() ? styles.sendBtnActive : styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!text.trim() || sending}
          >
            <Ionicons name="send" size={20} color={text.trim() ? palette.white : palette.sendDisabledIcon} />
          </TouchableOpacity>
        </View>

        <Modal visible={actionSheetVisible} transparent animationType="fade" onRequestClose={closeMessageActions}>
          <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={closeMessageActions}>
            <View style={styles.sheetContainer}>
              {activeMessage?.type === "text" && !activeMessage?.deleted ? (
                <TouchableOpacity style={styles.sheetItem} onPress={startEditMessage}>
                  <Ionicons name="create-outline" size={18} color={palette.text} />
                  <Text style={styles.sheetText}>{labels.editMessage}</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity style={styles.sheetItem} onPress={doDeleteMessage}>
                <Ionicons name="trash-outline" size={18} color={palette.danger} />
                <Text style={[styles.sheetText, { color: palette.danger }]}>{labels.deleteMessage}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.sheetItem} onPress={closeMessageActions}>
                <Ionicons name="close-outline" size={18} color={palette.cancel} />
                <Text style={[styles.sheetText, { color: palette.cancel }]}>{labels.cancel}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        <Modal visible={editModalVisible} transparent animationType="slide" onRequestClose={() => setEditModalVisible(false)}>
          <View style={styles.modalOverlayEdit}>
            <View style={styles.editCard}>
              <View style={styles.editHead}>
                <Text style={styles.editTitle}>{labels.editMessage}</Text>
                <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                  <Ionicons name="close" size={22} color={palette.muted} />
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.editInput}
                value={editDraft}
                onChangeText={setEditDraft}
                placeholder={labels.editYourMessage}
                placeholderTextColor={palette.placeholder}
                multiline
              />

              <View style={styles.editActions}>
                <TouchableOpacity style={[styles.editBtn, styles.editBtnCancel]} onPress={() => setEditModalVisible(false)}>
                  <Text style={styles.editBtnCancelText}>{labels.cancel}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.editBtn, styles.editBtnSave]} onPress={doEditMessage}>
                  <Text style={styles.editBtnSaveText}>{labels.save}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={viewerVisible} transparent animationType="fade" onRequestClose={closeViewer}>
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={closeViewer}>
              <Ionicons name="close" size={28} color={palette.white} />
            </TouchableOpacity>
            <View style={styles.modalContent}>
              {viewerImageUri ? (
                <Image source={{ uri: viewerImageUri }} style={styles.modalImage} resizeMode="contain" />
              ) : null}
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  container: { flex: 1, backgroundColor: palette.background },

  header: {
    height: 62,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderBottomColor: palette.line,
    borderBottomWidth: 1,
    backgroundColor: palette.background,
  },
  back: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerName: { fontSize: 16, fontWeight: "700", color: palette.textStrong, letterSpacing: 0.1 },
  headerSub: { fontSize: 12, color: palette.muted, marginTop: 2 },
  headerRight: { width: 36, alignItems: "center", justifyContent: "center" },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: palette.avatarBg },

  messagesWrap: { flex: 1, paddingHorizontal: 12, backgroundColor: palette.background },

  messageRow: { flexDirection: "row", marginVertical: 6, alignItems: "flex-end" },
  messageRowLeft: { justifyContent: "flex-start" },
  messageRowRight: { justifyContent: "flex-end" },

  msgAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 8, backgroundColor: palette.avatarBg },

  bubbleWrap: { maxWidth: "78%", position: "relative" },
  bubble: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  bubbleLeft: {
    backgroundColor: palette.incomingBg,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    borderBottomLeftRadius: 14,
  },
  bubbleRight: {
    backgroundColor: palette.outgoingBg,
    borderTopRightRadius: 6,
    borderTopLeftRadius: 14,
    borderBottomRightRadius: 14,
    borderBottomLeftRadius: 14,
    marginRight: -12,
  },

  bubbleText: { fontSize: 15, lineHeight: 20 },
  bubbleTextLeft: { color: palette.incomingText, fontWeight: "500" },
  bubbleTextRight: { color: palette.outgoingText, fontWeight: "500" },

  bubbleMetaRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: 6 },
  bubbleTime: { fontSize: 10, opacity: 0.9 },
  bubbleTimeLeft: { color: palette.muted, textAlign: "left" },
  bubbleTimeRight: { color: palette.outgoingMeta, textAlign: "right" },

  editedLabel: { fontSize: 10, marginRight: 6, fontWeight: "600" },
  editedLeft: { color: palette.muted, },
  editedRight: { color: palette.outgoingMeta },

  leftTailContainer: {
    position: "absolute",
    left: -6,
    bottom: -2,
    width: 12,
    height: 8,
    overflow: "hidden",
    alignItems: "flex-start",
  },
  leftTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: palette.incomingBg,
    transform: [{ rotate: "180deg" }],
  },

  rightTailContainer: {
    position: "absolute",
    right: -20,
    bottom: -2,
    width: 12,
    height: 8,
    overflow: "hidden",
    alignItems: "flex-end",
  },
  rightTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: palette.outgoingBg,
  },

  incomingImage: {
    width: 220,
    height: 140,
    borderRadius: 12,
    resizeMode: "cover",
    backgroundColor: palette.incomingImageBg,
  },
  outgoingImage: {
    width: 220,
    height: 140,
    borderRadius: 12,
    resizeMode: "cover",
    backgroundColor: palette.outgoingImageBg,
    marginRight: -12,
  },
  imageMeta: {
    position: "absolute",
    right: 8,
    bottom: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  incomingImageMeta: {
    position: "absolute",
    left: 8,
    bottom: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  imageTime: { color: palette.outgoingMetaStrong, fontSize: 11 },
  imageTimeIncoming: { color: palette.muted, fontSize: 11 },

  dateSeparator: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  dateLine: { height: 1, backgroundColor: palette.line, flex: 1, marginHorizontal: 12 },
  dateText: { color: palette.muted, fontSize: 12 },

  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderTopColor: palette.line,
    borderTopWidth: 1,
    backgroundColor: palette.background,
  },
  attachmentBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginRight: 6 },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 140,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 8 : 6,
    borderRadius: 20,
    backgroundColor: palette.inputBg,
    color: palette.textStrong,
    fontSize: 15,
    marginRight: 8,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  sendBtnActive: { backgroundColor: palette.primary },
  sendBtnDisabled: { backgroundColor: palette.sendDisabled },

  sheetOverlay: {
    flex: 1,
    backgroundColor: palette.overlay,
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: palette.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderColor: palette.border,
  },
  sheetItem: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
    gap: 10,
  },
  sheetText: { fontSize: 15, fontWeight: "500", color: palette.textStrong },

  modalOverlayEdit: {
    flex: 1,
    backgroundColor: palette.overlayStrong,
    justifyContent: "center",
    padding: 14,
  },
  editCard: {
    backgroundColor: palette.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: "hidden",
  },
  editHead: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  editTitle: { fontSize: 16, fontWeight: "700", color: palette.textStrong },
  editInput: {
    minHeight: 100,
    maxHeight: 180,
    margin: 12,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: palette.textStrong,
    fontSize: 15,
    backgroundColor: palette.inputBg,
    textAlignVertical: "top",
  },
  editActions: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    flexDirection: "row",
    gap: 10,
  },
  editBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  editBtnCancel: {
    backgroundColor: palette.sendDisabled,
    borderWidth: 1,
    borderColor: palette.border,
  },
  editBtnSave: {
    backgroundColor: palette.primary,
  },
  editBtnCancelText: { color: palette.cancel, fontWeight: "700" },
  editBtnSaveText: { color: palette.white, fontWeight: "700" },

  modalOverlay: {
    flex: 1,
    backgroundColor: palette.viewerOverlay,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    padding: 12,
  },
  modalImage: { width: "100%", height: "100%" },
  modalCloseBtn: {
    position: "absolute",
    top: 40,
    right: 20,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.overlay,
    alignItems: "center",
    justifyContent: "center",
  },
});