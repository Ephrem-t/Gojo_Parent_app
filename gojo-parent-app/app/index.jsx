// app/index.jsx (Login screen)
import { useRouter } from "expo-router";
import { child, get, ref } from "firebase/database";
import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { database } from "../constants/firebaseConfig";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter(); // Router for navigation

  // Cross-platform alert for mobile + web
  const showAlert = (title, message) => {
    if (typeof window !== "undefined" && window.alert) {
      window.alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleLogin = async () => {
    if (!username || !password) {
      showAlert("Error", "Please enter both username and password");
      return;
    }

    try {
      const dbRef = ref(database);
      const snapshot = await get(child(dbRef, `Users`));

      if (snapshot.exists()) {
        const users = snapshot.val();
        let found = false;

        Object.keys(users).forEach((key) => {
          const user = users[key];
          if (
            user.role === "parent" &&
            user.username === username &&
            user.password === password
          ) {
            found = true;
            if (user.isActive) {
              showAlert("Success", `Login successful! Welcome ${user.username}`);
              
              // Navigate to dashboard/home after login
              router.replace("/dashboard/home");
            } else {
              showAlert("Error", "Your account is inactive");
            }
          }
        });

        if (!found) {
          showAlert("Error", "Invalid username or password");
        }
      } else {
        showAlert("Error", "No users found in database");
      }
    } catch (error) {
      console.log(error);
      showAlert("Error", "Something went wrong");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gojo Parent Login</Text>

      <TextInput
        placeholder="Username"
        style={styles.input}
        value={username}
        onChangeText={setUsername}
      />

      <TextInput
        placeholder="Password"
        style={styles.input}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>Login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 30,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
  },
  button: {
    backgroundColor: "#1e90ff",
    padding: 15,
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
  },
});
