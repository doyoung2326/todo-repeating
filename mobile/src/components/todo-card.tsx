import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { daysDiff } from '@shared/dates.js';
import { IMP_LABELS, STAGE_LABELS, progressLevel } from '@shared/labels.js';
import type { Todo } from '@/lib/api';
import { useTodos } from '@/lib/todos-context';
import { colors, importanceColors, progressColors, radius, TAP } from '@/constants/tokens';

/** 중요도를 나타내는 점. 색은 한 색의 세 농도다. */
function Dot({ importance }: { importance: 1 | 2 | 3 }) {
  return <View style={[styles.dot, { backgroundColor: importanceColors[importance] }]} />;
}

/** 마감·수행일을 "며칠 남았는가"로 읽어준다. 날짜 문자열을 그대로 보여주지 않는다. */
function dueLabel(prefix: string, dateStr: string, today: string) {
  const diff = daysDiff(dateStr, today);
  if (diff < 0) return `${prefix} ${Math.abs(diff)}일 지남`;
  if (diff === 0) return `${prefix} 오늘`;
  return `${prefix} D-${diff}`;
}

export function TodoCard({ todo, actions }: { todo: Todo; actions?: ReactNode }) {
  const { today } = useTodos();
  const pct = todo.progress ?? 0;

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <Dot importance={todo.importance} />
        <Text style={[styles.text, todo.completed && styles.struck]} numberOfLines={2}>{todo.text}</Text>
        <Text style={styles.imp}>{IMP_LABELS[todo.importance]}</Text>
      </View>

      <View style={styles.meta}>
        {todo.start_time && (
          <Text style={styles.tag}>
            {todo.start_time}{todo.end_time ? `–${todo.end_time}` : ''}
          </Text>
        )}
        {todo.deadline && !todo.completed && (
          <Text style={styles.tag}>{dueLabel('마감', todo.deadline, today)}</Text>
        )}
        {todo.perform_date && !todo.completed && (
          <Text style={styles.tag}>{dueLabel('수행', todo.perform_date, today)}</Text>
        )}
        {todo.activeReview && (
          <Text style={styles.tag}>
            {STAGE_LABELS[todo.activeReview.stage]} {dueLabel('복습', todo.activeReview.due_date, today)}
          </Text>
        )}
      </View>

      {!todo.completed && todo.progress !== null && (
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: progressColors[progressLevel(pct)] }]} />
          <Text style={styles.barPct}>{pct}%</Text>
        </View>
      )}

      {actions && <View style={styles.actions}>{actions}</View>}
    </View>
  );
}

/** 카드 안의 작은 버튼. 누르는 것은 44px 이상으로 둔다. */
export function CardButton({ label, onPress, tone = 'normal' }: {
  label: string;
  onPress: () => void;
  tone?: 'normal' | 'danger';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.btn, tone === 'danger' && styles.btnDanger, pressed && styles.btnPressed]}
      onPress={onPress}
    >
      <Text style={[styles.btnText, tone === 'danger' && styles.btnTextDanger]}>{label}</Text>
    </Pressable>
  );
}

/**
 * 실패하면 사용자에게 알린다. 성공은 목록이 바뀌는 것으로 이미 보인다.
 *
 * **`Alert.alert`으로 알리지 않는다** — react-native-web의 Alert는 본문이 빈 함수라
 * 웹에서 개발할 때 실패가 조용히 묻힌다(눌렀는데 아무 일도 안 일어나는 것처럼 보인다).
 * 화면 위쪽 띠에 남기면 웹·앱 양쪽에서 보이고, 항목을 누를 때마다 창이 뜨지 않아
 * 덜 거슬린다. 띠는 다음에 무언가 성공하면 reload가 걷어 간다.
 */
export function useReportedMutate() {
  const { mutate, notify } = useTodos();
  return (what: string, fn: () => Promise<unknown>) => {
    void mutate(fn).then(message => {
      if (message) notify(`${what}: ${message}`);
    });
  };
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    gap: 8,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { flex: 1, fontSize: 15, color: colors.text },
  struck: { textDecorationLine: 'line-through', color: colors.muted },
  imp: { fontSize: 12, color: colors.muted },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    fontSize: 12, color: colors.muted,
    backgroundColor: colors.bg, borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  barTrack: { height: 18, borderRadius: 9, backgroundColor: colors.bg, justifyContent: 'center', overflow: 'hidden' },
  barFill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  barPct: { fontSize: 11, color: colors.text, alignSelf: 'flex-end', marginRight: 8 },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  btn: {
    minHeight: TAP, justifyContent: 'center',
    paddingHorizontal: 14, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg,
  },
  btnPressed: { opacity: 0.6 },
  btnDanger: { borderColor: colors.dangerSoft, backgroundColor: colors.dangerSoft },
  btnText: { fontSize: 14, color: colors.accent, fontWeight: '600' },
  btnTextDanger: { color: colors.danger },
});
