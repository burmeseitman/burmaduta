import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

export default function LoadingScreen() {
  const spinAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.6, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.spinner, { transform: [{ rotate: spin }] }]} />
      <Animated.Text style={[styles.mainText, { opacity: pulseAnim }]}>
        ခေတ္တစောင့်ဆိုင်းပေးပါ...
      </Animated.Text>
      <Text style={styles.subText}>Burma Duta is loading real-time data</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0b',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  spinner: {
    width: 64,
    height: 64,
    borderWidth: 4,
    borderColor: 'rgba(247, 183, 49, 0.1)',
    borderTopColor: '#f7b731',
    borderRadius: 32,
  },
  mainText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f7b731',
    letterSpacing: 1,
  },
  subText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: -8,
  },
});
