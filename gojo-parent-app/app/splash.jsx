
import React from "react";
import { View, Image, StyleSheet, StatusBar, Text, Platform, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useParentTheme } from "../hooks/use-parent-theme";

export default function SplashScreen() {
  const { colors, statusBarStyle } = useParentTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  return (
    <LinearGradient
      colors={[colors.splashGradientTop, colors.splashGradientBottom]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.container}
    >
      <StatusBar barStyle={statusBarStyle} backgroundColor={colors.splashGradientTop} />
      <View style={{ alignItems: 'center' }}>
        <Image
          source={require("../assets/images/logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.brandTitle}>Gojo Parent</Text>
      </View>
      <ActivityIndicator size="large" color={colors.splashSpinner} style={{ marginTop: 36 }} />
    </LinearGradient>
  );
}
const createStyles = (colors) => StyleSheet.create({
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
    color: colors.splashBrand,
    letterSpacing: 1.5,
    marginTop: 18,
    textTransform: "uppercase",
    fontFamily: Platform.OS === "ios" ? "AvenirNext-Bold" : "sans-serif-black",
    textShadowColor: colors.overlay,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});
