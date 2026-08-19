import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { colors, fontFamily, fontSize, radius, TAP } from '@/constants/tokens';

/**
 * 묶음 하나를 담는 카드. 웹의 `.card.section-card` + `.section-title` + `.count-sm`이다.
 *
 * 항목마다 카드를 두지 않고 **한 카드 안에 구분선으로 나누는 것**이 웹의 방식이다 —
 * 항목마다 테두리를 두르면 목록이 길어질수록 선이 시끄러워진다.
 *
 * 제목 글꼴만은 웹과 다르다. 웹은 명조(Nanum Myeongjo)를 쓰는데 앱에 그 글꼴을
 * 넣으려면 파일을 함께 담아야 해서, 지금은 굵기로만 구분한다.
 */
export function Section({ title, count, muted, children }: {
  title: string;
  count?: number;
  muted?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Text style={[styles.title, muted && styles.titleMuted]}>{title}</Text>
        {count !== undefined && count > 0 && <Count value={count} />}
      </View>
      {children}
    </View>
  );
}

/**
 * 접히는 묶음. 접힌 동안에는 안을 **아예 그리지 않는다** — 보관된 항목이 수백 개
 * 쌓여도 화면에 올라오지 않는다(웹과 같은 판단).
 */
export function CollapsibleSection({ title, count, open, onToggle, children }: {
  title: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.titleRow, styles.toggle, pressed && styles.togglePressed]}
        onPress={onToggle}
      >
        <Feather name={open ? 'chevron-down' : 'chevron-right'} size={16} color={colors.muted} />
        <Text style={[styles.title, styles.titleMuted]}>{title}</Text>
        {count !== undefined && count > 0 && <Count value={count} />}
      </Pressable>
      {open && children}
    </View>
  );
}

function Count({ value }: { value: number }) {
  return (
    <View style={styles.count}>
      <Text style={styles.countText}>{value}</Text>
    </View>
  );
}

/** 묶음 안의 작은 머리글 — 웹의 `.today-group-label` / `.rev-group-label`. */
export function GroupLabel({ children, tone = 'muted' }: {
  children: ReactNode;
  tone?: 'muted' | 'accent' | 'warn' | 'danger';
}) {
  return <Text style={[styles.groupLabel, styles[tone]]}>{children}</Text>;
}

/** 아무것도 없을 때. 이모지 대신 문장만 남긴다. */
export function Empty({ children }: { children: ReactNode }) {
  return <Text style={styles.empty}>{children}</Text>;
}

/** 목록 전체가 비었을 때 자리를 지키는 카드. 제목 없이 문장 하나만 든다(웹 `.empty-card`). */
export function EmptyCard({ children }: { children: ReactNode }) {
  return (
    <View style={styles.card}>
      <Empty>{children}</Empty>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: 16,
    gap: 14,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  // 웹 .section-title과 같은 명조. 글꼴 자체가 800이라 fontWeight를 따로 주지 않는다.
  title: { fontFamily: fontFamily.display, fontSize: 16.3, letterSpacing: -0.1, color: colors.text },
  titleMuted: { color: colors.muted },

  toggle: { minHeight: TAP, marginVertical: -10 },
  togglePressed: { opacity: 0.6 },

  count: {
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 99,
    backgroundColor: colors.accentSoft,
  },
  countText: { fontFamily: fontFamily.body, fontSize: 12, fontWeight: '700', color: colors.accent },

  groupLabel: { fontFamily: fontFamily.body, fontSize: 12.5, fontWeight: '700', letterSpacing: 0.2 },
  muted: { color: colors.muted },
  accent: { color: colors.accent },
  warn: { color: colors.warn },
  danger: { color: colors.danger },

  empty: { fontFamily: fontFamily.body, color: colors.muted, fontSize: 14, textAlign: 'center', paddingVertical: 22 },
});
