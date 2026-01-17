
import React from "react";
import { View, Image, StyleSheet, StatusBar, Text, Platform, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export default function SplashScreen() {
  return (
    <LinearGradient
      colors={["#2563eb", "#f7f9fc"]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" backgroundColor="#2563eb" />
      <View style={{ alignItems: 'center' }}>
        <Image
          source={require("../assets/images/logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.brandTitle}>Gojo Parent</Text>
      </View>
      <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 36 }} />
    </LinearGradient>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 120,
    height: 120,
  },
  brandTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: "#111827", // black
    letterSpacing: 1.5,
    marginTop: 18,
    textTransform: "uppercase",
    fontFamily: Platform.OS === "ios" ? "AvenirNext-Bold" : "sans-serif-black",
    textShadowColor: "#f3f4f6",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});
