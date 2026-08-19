import Slider from '@react-native-community/slider';
import { StyleSheet, Text, View } from 'react-native';

import { progressLevel } from '@shared/labels.js';
import { colors, fontFamily, progressColors, progressTrack } from '@/constants/tokens';

/**
 * 진행률 (아이폰·안드로이드). 웹에서는 `progress-field.web.tsx`가 쓰인다.
 *
 * 5% 단위인 것은 웹(`step="5"`)과 같다 — 손가락으로 1% 단위를 맞출 수는 없다.
 * 색은 낮을수록 주의색이다(shared/labels.js의 progressLevel이 단계를 고른다).
 */
export function ProgressField({ value, onChange }: {
  value: number;
  onChange: (next: number) => void;
}) {
  const color = progressColors[progressLevel(value)];

  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        진행률: <Text style={[styles.value, { color }]}>{value}%</Text>
      </Text>
      <Slider
        value={value}
        minimumValue={0}
        maximumValue={100}
        step={5}
        onValueChange={onChange}
        minimumTrackTintColor={color}
        maximumTrackTintColor={progressTrack}
        thumbTintColor={color}
        accessibilityLabel="진행률"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 4 },
  label: { fontFamily: fontFamily.body, fontSize: 13, fontWeight: '600', color: colors.muted },
  value: { fontWeight: '700' },
});
