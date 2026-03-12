import React, { useRef, useState, useEffect } from "react";
import {
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  StyleSheet,
  TouchableWithoutFeedback,
  Keyboard,
  Linking,
  Alert,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ref, get } from "firebase/database";
import { database } from "../constants/firebaseConfig";

export const options = { headerShown: false };

const PRIMARY = "#007AFB";
const BACKGROUND = "#FFFFFF";
const MUTED = "#6B78A8";

export default function LoginScreen() {
  const router = useRouter();
  const passwordRef = useRef(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const checkSession = async () => {
      const userId = await AsyncStorage.getItem("userId");
      const role = await AsyncStorage.getItem("role");
      const lastLogin = await AsyncStorage.getItem("lastLogin");

      if (userId && lastLogin) {
        const now = Date.now();
        const last = parseInt(lastLogin, 10);
        const threeDays = 3 * 24 * 10;

        if (now - last < threeDays) {
          router.replace("/dashboard/home");
        } else {
          await AsyncStorage.multiRemove(["userId", "parentId", "lastLogin", "role", "username"]);
        }
      } else if (userId && role) {
        router.replace("/dashboard/home");
      }
    };

    checkSession();
  }, [router]);

  const handleNeedHelp = async () => {
    try {
      // old DB path
      const infoSnap = await get(ref(database, "schools/Guda Miju/info"));
      if (!infoSnap.exists()) {
        return Alert.alert("Unavailable", "School contact is not available.");
      }

      const info = infoSnap.val() || {};
      const rawPhone = info.phone || info.alternativePhone || "";
      const phone = String(rawPhone).replace(/[^\d+]/g, "");

      if (!phone) return Alert.alert("Unavailable", "School phone number is missing.");

      const tel = `tel:${phone}`;
      const can = await Linking.canOpenURL(tel);
      if (!can) return Alert.alert("Unavailable", `Cannot open dialer for: ${phone}`);

      await Linking.openURL(tel);
    } catch (e) {
      console.warn("[Parent Login] handleNeedHelp error:", e);
      Alert.alert("Error", "Could not open dialer.");
    }
  };

  const handleSignIn = async () => {
    setError("");
    const uname = username.trim();
    const pwd = String(password || "").trim();

    if (!uname || !pwd) {
      setError("Please enter username and password.");
      return;
    }

    setLoading(true);
    try {
      // old DB path
      const usersSnap = await get(ref(database, "Users"));
      if (!usersSnap.exists()) {
        setError("No users found in database.");
        return;
      }

      const users = usersSnap.val() || {};
      let matchedUser = null;
      let matchedKey = null;

      for (const key of Object.keys(users)) {
        const u = users[key] || {};
        const isParent = String(u.role || "").toLowerCase() === "parent";
        const usernameMatch = String(u.username || "").trim().toUpperCase() === uname.toUpperCase();
        const passwordMatch = String(u.password ?? "").trim() === pwd;

        if (isParent && usernameMatch && passwordMatch) {
          matchedUser = u;
          matchedKey = key;
          break;
        }
      }

      if (!matchedUser || !matchedKey) {
        setError("Invalid username or password.");
        return;
      }

      if (typeof matchedUser.isActive === "boolean" && !matchedUser.isActive) {
        setError("Your account is inactive.");
        return;
      }

      // old DB has no Parents node in your dump; parentId exists on user
      const parentId = matchedUser.parentId || "";

      // clear old session keys and save fresh
      const oldKeys = await AsyncStorage.getAllKeys();
      if (oldKeys?.length) await AsyncStorage.multiRemove(oldKeys);

      await AsyncStorage.multiSet([
        ["userId", matchedKey],
        ["username", matchedUser.username || uname],
        ["role", "parent"],
        ["parentId", parentId],
        ["lastLogin", Date.now().toString()],
      ]);

      router.replace("/dashboard/home");
    } catch (err) {
      console.error("Parent login error:", err);
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <StatusBar style="dark" />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 70 : 20}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.top}>
              <Image source={require("../assets/images/logo.png")} style={styles.logo} resizeMode="contain" />
              <Text style={styles.title}>Parent Login</Text>
              <Text style={styles.subtitle}>Sign in to your Gojo Parent account</Text>
            </View>

            <View style={styles.form}>
              {error ? <Text style={styles.error}>{error}</Text> : null}

              <View style={styles.inputRow}>
                <Ionicons name="person-outline" size={22} color={MUTED} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Username"
                  placeholderTextColor="#B8C6FF"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current && passwordRef.current.focus()}
                />
              </View>

              <View style={styles.inputRow}>
                <Ionicons name="key-outline" size={22} color={MUTED} style={styles.inputIcon} />
                <TextInput
                  ref={passwordRef}
                  style={[styles.input, { paddingRight: 44 }]}
                  placeholder="Password"
                  placeholderTextColor="#B8C6FF"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleSignIn}
                />
                <TouchableOpacity activeOpacity={0.7} onPress={() => setShowPassword((v) => !v)} style={styles.eyeButton}>
                  <Ionicons name={showPassword ? "eye" : "eye-off"} size={20} color={MUTED} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSignIn} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Login</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={styles.linkRow} onPress={handleNeedHelp}>
                <Text style={styles.linkText}>Need help? Contact your school</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.footer}>
              <Text style={styles.copyright}>© 2026 Gojo Parent. All rights reserved.</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: BACKGROUND },
  scrollContent: { flexGrow: 1, justifyContent: "space-between", paddingTop: 12, paddingBottom: 20 },

  top: { alignItems: "center", marginTop: 8 },
  logo: { width: 180, height: 180, borderRadius: 14, marginTop: 16 },
  title: { marginTop: -8, fontSize: 34, color: "#111", fontWeight: "800" },
  subtitle: { marginTop: 8, fontSize: 14, color: MUTED, textAlign: "center" },

  form: { paddingHorizontal: 28, marginTop: 8 },
  error: { color: "#B00020", marginBottom: 8, textAlign: "center" },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E7EDFF",
    paddingHorizontal: 12,
    height: 56,
    marginTop: 12,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 16, color: "#222" },

  eyeButton: {
    position: "absolute",
    right: 18,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },

  button: {
    height: 56,
    borderRadius: 12,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  buttonDisabled: { opacity: 0.75 },
  buttonText: { color: "#fff", fontWeight: "800", fontSize: 18 },

  linkRow: { marginTop: 12, alignItems: "center" },
  linkText: { color: PRIMARY, fontWeight: "600" },

  footer: { alignItems: "center", marginTop: 28, paddingBottom: 8 },
  copyright: { color: "#9AA0A6", fontSize: 12 },
});