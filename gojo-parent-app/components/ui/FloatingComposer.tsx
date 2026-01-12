import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type FloatingComposerProps = {
  value: string;
  onChangeText: (t: string) => void;
  onSend: () => void;
  onAttach?: () => void;
  onMicPress?: () => void;
  placeholder?: string;
  disabled?: boolean;
  busy?: boolean; // sending or uploading
  bottomOffset?: number; // additional offset from parent (e.g., for reply preview)
  onHeightChange?: (h: number) => void;
};

export default function FloatingComposer({
  value,
  onChangeText,
  onSend,
  onAttach,
  onMicPress,
  placeholder = "Message",
  disabled = false,
  busy = false,
  bottomOffset = 0,
  onHeightChange,
}: FloatingComposerProps) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [inputHeight, setInputHeight] = useState(40);

  const canSend = value.trim().length > 0 && !disabled && !busy;
  const showMic = !canSend && !busy;

  const containerBottom = useMemo(() => {
    const base = Math.max(insets.bottom, 12);
    return base + bottomOffset;
  }, [insets.bottom, bottomOffset]);

  useEffect(() => {
    // Focus behavior could be added if needed
  }, []);

  return (
    <View
      style={[styles.absoluteWrap, { bottom: containerBottom }]}
      pointerEvents={disabled ? "none" : "auto"}
      accessibilityLabel="floating-composer"
      onLayout={(e) => {
        onHeightChange && onHeightChange(e.nativeEvent.layout.height);
      }}
    >
      <View style={styles.row}>
        {/* Attach */}
        <TouchableOpacity
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.leftBtn}
          onPress={onAttach}
          disabled={disabled || busy}
          accessibilityLabel="attach"
        >
          <Ionicons name="attach" size={22} color="#5a76a1" />
        </TouchableOpacity>

        {/* Input pill */}
        <View style={[styles.inputPill, { minHeight: Math.max(40, inputHeight) }]}
          accessibilityLabel="composer-input-pill"
        >
          <TextInput
            ref={inputRef}
            style={[styles.input, { height: Math.max(40, inputHeight) }]}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor="#8796ab"
            multiline
            onContentSizeChange={(e) => {
              const h = e.nativeEvent.contentSize.height;
              const clamped = Math.min(120, Math.max(40, Math.ceil(h)));
              setInputHeight(clamped);
            }}
            returnKeyType="send"
            onSubmitEditing={() => {
              if (canSend) onSend();
            }}
            blurOnSubmit={false}
          />
        </View>

        {/* Action: send/mic */}
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => {
            if (busy) return;
            if (showMic) onMicPress && onMicPress(); else onSend();
          }}
          disabled={disabled}
          accessibilityLabel={showMic ? "voice-message" : "send"}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : showMic ? (
            <Ionicons name="mic" size={20} color="#fff" />
          ) : (
            <Ionicons name="send" size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  absoluteWrap: {
    position: "absolute",
    left: 12,
    right: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  leftBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 3,
  },
  inputPill: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  input: {
    fontSize: 16,
    padding: 0,
    color: "#0f1729",
  },
  actionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginLeft: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1f8ef1",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
});
