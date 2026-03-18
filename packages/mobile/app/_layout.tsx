import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";

function ThemedStack() {
  const { colors, tokens, rgba, invertedColorScheme } = useTheme();

  // headerStyle only accepts { backgroundColor } on NativeStack —
  // the border must live on a custom headerBackground View instead
  const headerBg = (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: rgba(colors.surface),
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: rgba(colors.outlineVariant),
        },
      ]}
    />
  );

  return (
    <>
      <StatusBar style={invertedColorScheme} />
      <Stack
        screenOptions={{
          headerBackground: () => headerBg,
          headerTintColor: rgba(colors.onSurface),
          headerTitleStyle: {
            ...tokens.typography.titleMedium,
            color: rgba(colors.onSurface),
          },
          headerShadowVisible: false,
          contentStyle: {
            backgroundColor: rgba(colors.surface),
          },
          animation: "slide_from_right",
        }}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ThemedStack />
    </ThemeProvider>
  );
}
