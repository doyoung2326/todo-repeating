import { StyleSheet, Text, View } from 'react-native';

import { progressLevel } from '@shared/labels.js';
import { colors, fontFamily, progressColors, progressTrack } from '@/constants/tokens';

/**
 * 진행률 (브라우저). `@react-native-community/slider`는 웹을 지원하지 않으므로
 * 브라우저가 이미 가진 `<input type=range>`를 쓴다 — 웹(frontend)의 폼도 같은 것이다.
 *
 * 5% 단위인 것은 앱 쪽과 같다. 색은 낮을수록 주의색이다.
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
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        aria-label="진행률"
        onChange={e => onChange(Number(e.target.value))}
        style={{
          width: '100%',
          // 채운 쪽만 색을 주려면 트랙을 직접 그려야 한다. 브라우저마다 손잡이 셀렉터가
          // 달라서, 여기서는 그라디언트 한 줄로 같은 그림을 만든다.
          background: `linear-gradient(to right, ${color} ${value}%, ${progressTrack} ${value}%)`,
          height: 6,
          borderRadius: 99,
          appearance: 'none',
          WebkitAppearance: 'none',
          accentColor: color,
          cursor: 'pointer',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontFamily: fontFamily.body, fontSize: 13, fontWeight: '600', color: colors.muted },
  value: { fontWeight: '700' },
});
