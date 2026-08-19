import { StyleSheet, View } from 'react-native';

import { STAGE_LABELS } from '@shared/labels.js';
import { colors, importanceColors } from '@/constants/tokens';

/** 중요도 점. 색은 한 색의 세 농도다 — 빨강·주황·파랑이 아니다. */
export function Dot({ importance }: { importance: 1 | 2 | 3 }) {
  return <View style={[styles.dot, { backgroundColor: importanceColors[importance] }]} />;
}

/**
 * 1·3·7·16·30일 중 몇 번째까지 왔는지 보여주는 다섯 칸.
 *
 * 예전 웹에서는 이걸 카드 하나로 따로 두고 가장 급한 항목 하나만 그렸는데,
 * 나머지가 안 보여서 누락처럼 읽혔다. 그래서 항목마다 제자리에 붙인다.
 */
export function StageBar({ stage }: { stage: number }) {
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`복습 ${STAGE_LABELS.length}단계 중 ${stage + 1}번째`}
      style={styles.stages}
    >
      {STAGE_LABELS.map((_: string, i: number) => (
        <View
          key={i}
          style={[
            styles.stage,
            i < stage && styles.stageDone,
            i === stage && styles.stageNow,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: { width: 8, height: 8, borderRadius: 99, marginTop: 6 },

  stages: { flexDirection: 'row', gap: 2 },
  stage: { width: 8, height: 3, borderRadius: 99, backgroundColor: colors.line },
  stageDone: { backgroundColor: colors.accent },
  stageNow: { backgroundColor: importanceColors[2] },
});
