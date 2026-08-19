import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontFamily, fontSize, importanceChip } from '@/constants/tokens';

/**
 * 마감·시간·상태를 나르는 알약 칩. 웹 App.css의 `.dl-tag / .time-tag / .review-tag`
 * 무리와 같은 모양이고, **색이 뜻을 나른다**:
 *
 *   neutral  앞으로 남은 것       danger  지난 것       warn  오늘·임박
 *   accent   예정·완료된 복습·시간
 *
 * 중요도·성격처럼 색이 값에서 나오는 칩은 tone 대신 bg/fg를 직접 준다.
 */
export type ChipTone = 'neutral' | 'danger' | 'warn' | 'accent';

const TONES: Record<ChipTone, { bg: string; fg: string }> = {
  neutral: { bg: importanceChip[1].bg, fg: colors.muted },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  warn: { bg: colors.warnSoft, fg: colors.warn },
  accent: { bg: colors.accentSoft, fg: colors.accent },
};

export function Chip({ label, tone = 'neutral', bg, fg, action }: {
  label: string;
  tone?: ChipTone;
  /** 색을 직접 줄 때(중요도·성격). 주면 tone보다 앞선다. */
  bg?: string;
  fg?: string;
  /** 칩 안에 들어가는 작은 버튼. 웹의 복습 배지가 완료 버튼을 품는 것과 같다. */
  action?: ReactNode;
}) {
  const t = TONES[tone];
  return (
    <View style={[styles.chip, { backgroundColor: bg ?? t.bg }]}>
      <Text style={[styles.label, { color: fg ?? t.fg }]}>{label}</Text>
      {action}
    </View>
  );
}

/** 칩 안의 작은 버튼. 글자색은 칩에서 물려받는다(웹의 `color: inherit`). */
export function ChipButton({ label, color, onPress }: {
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      // 보이는 크기는 웹과 같게 두고 누를 수 있는 자리만 넓힌다.
      hitSlop={10}
      style={({ pressed }) => [styles.chipBtn, pressed && styles.pressed]}
      onPress={onPress}
    >
      <Text style={[styles.chipBtnText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 99,
  },
  label: { fontFamily: fontFamily.body, fontSize: fontSize.chip, fontWeight: '600' },

  chipBtn: {
    paddingVertical: 1,
    paddingHorizontal: 7,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.65)',
  },
  pressed: { backgroundColor: 'rgba(255,255,255,0.95)' },
  chipBtnText: { fontFamily: fontFamily.body, fontSize: 11, fontWeight: '700' },
});
