import { useTheme } from "@/contexts/ThemeContext";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function Index() {
  const { colors, tokens, colorScheme, toggleColorScheme, rgba } = useTheme();

  return (
    // backgroundColor reads from the active palette — auto-switches on theme change
    <View style={[styles.container, { backgroundColor: rgba(colors.surface) }]}>
      <Text
        style={[
          styles.heading,
          {
            color: rgba(colors.onSurface),
            ...tokens.typography.headlineSmall,
          },
        ]}
      >
        Design Token Demo
      </Text>
      <Text
        style={[
          styles.body,
          {
            color: rgba(colors.onSurfaceVariant),
            ...tokens.typography.bodyMedium,
          },
        ]}
      >
        Current scheme: {colorScheme}
      </Text>
      {/* Demonstrates the toggle pattern that mirrors web's ThemeContext setTheme() */}
      <Pressable
        onPress={toggleColorScheme}
        style={[
          styles.button,
          { backgroundColor: rgba(colors.primary), ...tokens.shadows.elevation2 },
        ]}
      >
        <Text style={[styles.buttonLabel, { color: rgba(colors.onPrimary), ...tokens.typography.labelLarge }]}>
          Toggle Theme
        </Text>
      </Pressable>
    </View>
  );
}

// Static layout styles live in StyleSheet.create; dynamic color styles are inline
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 24,
  },
  heading: {
    textAlign: "center",
  },
  body: {
    textAlign: "center",
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 100,
    marginTop: 8,
  },
  buttonLabel: {
    textAlign: "center",
  },
});
